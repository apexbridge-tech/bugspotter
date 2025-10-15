/**
 * Fastify Server Setup
 * Configures Fastify with all plugins, middleware, and routes
 */

import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import { config } from '../config.js';
import { getLogger } from '../logger.js';
import type { DatabaseClient } from '../db/client.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { healthRoutes } from './routes/health.js';
import { bugReportRoutes } from './routes/reports.js';
import { projectRoutes } from './routes/projects.js';
import { authRoutes } from './routes/auth.js';
import { retentionRoutes } from './routes/retention.js';
import { jobRoutes } from './routes/jobs.js';
import { registerIntegrationRoutes } from './routes/integrations.js';
import type { RetentionService } from '../retention/retention-service.js';
import type { RetentionScheduler } from '../retention/retention-scheduler.js';
import type { QueueManager } from '../queue/queue-manager.js';
import type { IStorageService } from '../storage/types.js';
import type { PluginRegistry } from '../integrations/plugin-registry.js';

export interface ServerOptions {
  db: DatabaseClient;
  storage: IStorageService;
  pluginRegistry: PluginRegistry;
  retentionService?: RetentionService;
  retentionScheduler?: RetentionScheduler;
  queueManager?: QueueManager;
}

/**
 * Create and configure Fastify server
 */
export async function createServer(options: ServerOptions): Promise<FastifyInstance> {
  const { db } = options;
  const logger = getLogger();

  // Create Fastify instance with logging
  const fastify = Fastify({
    logger: {
      level: config.server.logLevel,
    },
    requestIdHeader: 'x-request-id',
    requestIdLogLabel: 'requestId',
    disableRequestLogging: false,
    genReqId: () => {
      return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    },
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: config.server.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  });

  // Register Helmet for security headers
  await fastify.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        fontSrc: ["'self'"],
        objectSrc: ["'none'"],
        frameSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: { policy: 'same-site' },
  });

  // Register rate limiting
  await fastify.register(rateLimit, {
    max: config.rateLimit.maxRequests,
    timeWindow: config.rateLimit.windowMs,
    hook: 'onRequest',
    errorResponseBuilder: (_request, _context) => {
      return {
        success: false,
        error: 'TooManyRequests',
        message: 'Rate limit exceeded. Please try again later',
        statusCode: 429,
        timestamp: new Date().toISOString(),
      };
    },
  });

  // Register JWT plugin
  if (config.jwt.secret) {
    await fastify.register(jwt, {
      secret: config.jwt.secret,
    });
  } else {
    logger.warn('JWT_SECRET not configured. JWT authentication will not work.');
  }

  // Register multipart for file uploads
  await fastify.register(multipart, {
    limits: {
      fileSize: config.server.maxUploadSize,
      files: 1,
    },
  });

  // Global hooks for request logging
  fastify.addHook('onRequest', async (request, _reply) => {
    request.log.info(
      {
        url: request.url,
        method: request.method,
        headers: {
          'user-agent': request.headers['user-agent'],
          'x-api-key': request.headers['x-api-key'] ? '[REDACTED]' : undefined,
          authorization: request.headers.authorization ? '[REDACTED]' : undefined,
        },
      },
      'Incoming request'
    );
  });

  fastify.addHook('onResponse', async (request, reply) => {
    request.log.info(
      {
        url: request.url,
        method: request.method,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    );
  });

  // Register authentication middleware (before routes, runs early)
  const authMiddleware = createAuthMiddleware(db);
  fastify.addHook('onRequest', authMiddleware);

  // Register routes
  await healthRoutes(fastify, db);
  bugReportRoutes(fastify, db, options.queueManager);
  await projectRoutes(fastify, db);
  await authRoutes(fastify, db);

  // Register job/queue routes if queue manager is provided
  if (options.queueManager) {
    jobRoutes(fastify, db, options.queueManager);
  }

  // Register retention routes if services are provided
  if (options.retentionService && options.retentionScheduler) {
    retentionRoutes(fastify, db, options.retentionService, options.retentionScheduler);
  }

  // Register integration routes
  await registerIntegrationRoutes(fastify, db, options.pluginRegistry);

  // Register error handlers
  fastify.setErrorHandler(errorHandler);
  fastify.setNotFoundHandler(notFoundHandler);

  // Root endpoint (public)
  fastify.get('/', { config: { public: true } }, async (_request, reply) => {
    return reply.send({
      name: 'BugSpotter API',
      version: '1.0.0',
      status: 'running',
      documentation: '/api/v1/docs',
      timestamp: new Date().toISOString(),
    });
  });

  return fastify;
}

/**
 * Start the Fastify server
 */
export async function startServer(fastify: FastifyInstance): Promise<void> {
  const logger = getLogger();

  try {
    const address = await fastify.listen({
      port: config.server.port,
      host: '0.0.0.0', // Listen on all interfaces for Docker compatibility
    });

    logger.info('Server started successfully', {
      address,
      port: config.server.port,
      env: config.server.env,
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    throw error;
  }
}

/**
 * Gracefully shutdown the server
 */
export async function shutdownServer(
  fastify: FastifyInstance,
  db: DatabaseClient,
  queueManager?: QueueManager
): Promise<void> {
  const logger = getLogger();

  logger.info('Shutting down server...');

  try {
    // Stop accepting new requests
    await fastify.close();
    logger.info('Server closed');

    // Shutdown queue manager
    if (queueManager) {
      await queueManager.shutdown();
      logger.info('Queue manager shut down');
    }

    // Close database connections
    await db.close();
    logger.info('Database connections closed');

    logger.info('Shutdown complete');
  } catch (error) {
    logger.error('Error during shutdown', { error });
    throw error;
  }
}
