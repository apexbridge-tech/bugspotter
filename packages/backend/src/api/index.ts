/**
 * BugSpotter API Server Entry Point
 * Main application that initializes and starts the Fastify server
 */

import dotenv from 'dotenv';
import { createDatabaseClient } from '../db/client.js';
import { config, validateConfig } from '../config.js';
import { getLogger } from '../logger.js';
import { createServer, startServer, shutdownServer } from './server.js';
import { getQueueManager } from '../queue/queue-manager.js';
import { getQueueConfig } from '../config/queue.config.js';

// Load environment variables from .env file
dotenv.config();

/**
 * Initialize and start the API server
 */
async function main() {
  const logger = getLogger();

  try {
    // Validate configuration
    logger.info('Validating configuration...');
    validateConfig();
    logger.info('Configuration validated successfully');

    // Initialize database client
    logger.info('Connecting to database...', {
      url: config.database.url.replace(/:[^:@]+@/, ':***@'), // Hide password in logs
    });
    const db = createDatabaseClient();

    // Test database connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to database');
    }
    logger.info('Database connection established');

    // Initialize queue manager if Redis is configured
    let queueManager: ReturnType<typeof getQueueManager> | undefined;
    const queueConfig = getQueueConfig();
    if (queueConfig.redis.url) {
      try {
        logger.info('Initializing queue manager...');
        queueManager = getQueueManager();
        await queueManager.initialize();

        // Test queue health
        const queueHealthy = await queueManager.healthCheck();
        if (queueHealthy) {
          logger.info('Queue manager initialized successfully');
        } else {
          logger.warn('Queue manager initialized but health check failed');
        }
      } catch (error) {
        logger.error('Failed to initialize queue manager, continuing without queues', {
          error: error instanceof Error ? error.message : String(error),
        });
        queueManager = undefined;
      }
    } else {
      logger.info('Redis not configured, queue system disabled');
    }

    // Create Fastify server
    logger.info('Creating Fastify server...');
    const server = await createServer({ db, queueManager });
    logger.info('Server created successfully');

    // Start listening for requests
    await startServer(server);

    // Graceful shutdown handlers
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}, starting graceful shutdown...`);
      try {
        await shutdownServer(server, db, queueManager);
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught exception', { error });
      void shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled rejection', { reason, promise });
      void shutdown('unhandledRejection');
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

// Start the server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error during startup:', error);
    process.exit(1);
  });
}

// Export for programmatic use
export { createServer, startServer, shutdownServer } from './server.js';
export {
  createAuthMiddleware,
  requireRole,
  requireProject,
  requireUser,
} from './middleware/auth.js';
export { AppError, errorHandler, notFoundHandler } from './middleware/error.js';
