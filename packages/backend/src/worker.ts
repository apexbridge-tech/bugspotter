/**
 * Worker Process Entry Point
 * Standalone process for running BullMQ workers
 */

import dotenv from 'dotenv';
import { createDatabaseClient } from './db/client.js';
import { getLogger } from './logger.js';
import { WorkerManager } from './queue/worker-manager.js';
import { createStorageFromEnv } from './storage/index.js';
import { getQueueConfig } from './config/queue.config.js';

// Load environment variables
dotenv.config();

const logger = getLogger();

/**
 * Main worker initialization and startup
 */
async function main() {
  try {
    logger.info('Starting BugSpotter Worker Process...');

    // Validate queue configuration
    const queueConfig = getQueueConfig();
    if (!queueConfig.redis.url) {
      throw new Error('Redis configuration missing. Workers require REDIS_URL');
    }

    logger.info('Queue configuration loaded', {
      redis: queueConfig.redis.url,
      screenshotEnabled: queueConfig.workers.screenshot.enabled,
      replayEnabled: queueConfig.workers.replay.enabled,
      integrationEnabled: queueConfig.workers.integration.enabled,
      notificationEnabled: queueConfig.workers.notification.enabled,
    });

    // Initialize database client
    logger.info('Connecting to database...');
    const db = createDatabaseClient();
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established');

    // Initialize storage service
    logger.info('Initializing storage service...');
    const storage = await createStorageFromEnv();
    logger.info('Storage service initialized');

    // Create and start worker manager
    logger.info('Creating worker manager...');
    const workerManager = new WorkerManager(db, storage);

    logger.info('Starting workers...');
    await workerManager.start();

    // Log initial metrics
    const metrics = workerManager.getMetrics();
    logger.info('Workers started successfully', {
      totalWorkers: metrics.totalWorkers,
      runningWorkers: metrics.runningWorkers,
      workers: metrics.workers.map((w) => w.workerName),
    });

    // Setup graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);

      try {
        // Shutdown workers (allows current jobs to complete)
        logger.info('Shutting down workers...');
        await workerManager.shutdown();
        logger.info('Workers shut down successfully');

        // Close database connections
        logger.info('Closing database connections...');
        await db.close();
        logger.info('Database connections closed');

        logger.info('Worker process shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        });
        process.exit(1);
      }
    };

    // Register signal handlers
    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception in worker process', {
        error: error.message,
        stack: error.stack,
      });
      void shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason) => {
      logger.error('Unhandled rejection in worker process', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
      });
      void shutdown('unhandledRejection');
    });

    // Log health metrics periodically (every 60 seconds)
    const healthCheckInterval = setInterval(async () => {
      try {
        const health = await workerManager.healthCheck();
        const currentMetrics = workerManager.getMetrics();

        logger.info('Worker health check', {
          healthy: health.healthy,
          totalJobs: currentMetrics.totalJobsProcessed,
          failedJobs: currentMetrics.totalJobsFailed,
          uptimeSeconds: Math.floor(currentMetrics.uptime / 1000),
          workers: health.workers,
        });
      } catch (error) {
        logger.error('Health check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }, 60 * 1000); // 60 seconds

    // Clear interval on shutdown
    process.on('beforeExit', () => {
      clearInterval(healthCheckInterval);
    });

    logger.info('Worker process running. Press Ctrl+C to stop');
  } catch (error) {
    logger.error('Failed to start worker process', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    process.exit(1);
  }
}

// Start the worker process
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error during worker startup:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { WorkerManager } from './queue/worker-manager.js';
export { getQueueManager } from './queue/queue-manager.js';
