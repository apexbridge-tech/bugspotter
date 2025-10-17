/**
 * Analytics Routes
 * Endpoints for dashboard metrics and analytics
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import type { AnalyticsService } from '../../analytics/analytics-service.js';

const analyticsSchemas = {
  dashboard: {
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    },
  },
  trend: {
    querystring: {
      type: 'object',
      properties: {
        days: { type: 'integer', minimum: 1, maximum: 365, default: 30 },
      },
    },
    response: {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    },
  },
};

export function analyticsRoutes(fastify: FastifyInstance, analytics: AnalyticsService) {
  // Get dashboard overview
  fastify.get(
    '/api/v1/analytics/dashboard',
    {
      preHandler: requireRole('admin'),
      schema: analyticsSchemas.dashboard,
    },
    async (_request, reply) => {
      const data = await analytics.getDashboardMetrics();

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // Get report trend data
  fastify.get(
    '/api/v1/analytics/reports/trend',
    {
      preHandler: requireRole('admin'),
      schema: analyticsSchemas.trend,
    },
    async (request, reply) => {
      const { days = 30 } = request.query as { days?: number };

      // Validate days parameter (belt and suspenders with schema validation)
      if (typeof days !== 'number' || days < 1 || days > 365) {
        throw new AppError('Days parameter must be between 1 and 365', 400, 'ValidationError');
      }

      const data = await analytics.getReportTrend(days);

      return reply.send({
        success: true,
        data,
      });
    }
  );

  // Get per-project statistics
  fastify.get(
    '/api/v1/analytics/projects/stats',
    {
      preHandler: requireRole('admin'),
      schema: analyticsSchemas.dashboard, // Same response structure
    },
    async (_request, reply) => {
      const data = await analytics.getProjectStats();

      return reply.send({
        success: true,
        data,
      });
    }
  );
}
