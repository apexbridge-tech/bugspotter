/**
 * Health check routes
 * Provides liveness and readiness endpoints for monitoring
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';

export async function healthRoutes(fastify: FastifyInstance, db: DatabaseClient) {
  await Promise.resolve(); // Make function actually async
  /**
   * GET /health
   * Simple liveness check - returns 200 if server is running
   */
  fastify.get('/health', async (_request, reply) => {
    return reply.code(200).send({
      status: 'ok',
      timestamp: new Date().toISOString(),
    });
  });

  /**
   * GET /ready
   * Readiness check - verifies database connectivity
   */
  fastify.get('/ready', async (request, reply) => {
    try {
      const dbHealthy = await db.testConnection();

      if (!dbHealthy) {
        return reply.code(503).send({
          status: 'unavailable',
          timestamp: new Date().toISOString(),
          checks: {
            database: 'unhealthy',
          },
        });
      }

      return reply.code(200).send({
        status: 'ready',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'healthy',
        },
      });
    } catch (error) {
      request.log.error({ error }, 'Readiness check failed');
      return reply.code(503).send({
        status: 'unavailable',
        timestamp: new Date().toISOString(),
        checks: {
          database: 'unhealthy',
        },
      });
    }
  });
}
