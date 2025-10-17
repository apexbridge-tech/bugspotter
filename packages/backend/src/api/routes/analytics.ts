/**
 * Analytics Routes
 * Endpoints for dashboard metrics and analytics
 */

import type { FastifyInstance } from 'fastify';
import { requireRole } from '../middleware/auth.js';
import type { AnalyticsService } from '../../analytics/analytics-service.js';

export function analyticsRoutes(fastify: FastifyInstance, analytics: AnalyticsService) {
  // Get dashboard overview
  fastify.get(
    '/api/v1/analytics/dashboard',
    {
      preHandler: requireRole('admin'),
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
    },
    async (request, reply) => {
      const { days = 30 } = request.query as { days?: number };

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
