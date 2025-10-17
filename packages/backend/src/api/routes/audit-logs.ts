/**
 * Audit Log API Routes
 * Provides read-only access to audit logs for administrators
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type {
  AuditLogFilters,
  AuditLogSortOptions,
} from '../../db/repositories/audit-log.repository.js';
import { requireRole } from '../middleware/auth.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Register audit log routes
 */
export function auditLogRoutes(fastify: FastifyInstance, db: DatabaseClient) {
  /**
   * GET /api/v1/audit-logs
   * List audit logs with filtering, sorting, and pagination
   */
  fastify.get<{
    Querystring: {
      user_id?: string;
      action?: string;
      resource?: string;
      success?: string; // 'true' or 'false'
      start_date?: string; // ISO 8601
      end_date?: string; // ISO 8601
      sort_by?: string;
      sort_order?: 'asc' | 'desc';
      page?: string;
      limit?: string;
    };
  }>(
    '/api/v1/audit-logs',
    {
      preHandler: requireRole('admin'), // Only admins can view audit logs
    },
    async (request, reply) => {
      try {
        const {
          user_id,
          action,
          resource,
          success,
          start_date,
          end_date,
          sort_by = 'timestamp',
          sort_order = 'desc',
          page = '1',
          limit = '50',
        } = request.query;

        // Build filters
        const filters: AuditLogFilters = {};
        if (user_id) {
          filters.user_id = user_id;
        }
        if (action) {
          filters.action = action;
        }
        if (resource) {
          filters.resource = resource;
        }
        if (success !== undefined) {
          filters.success = success === 'true';
        }
        if (start_date) {
          filters.start_date = new Date(start_date);
        }
        if (end_date) {
          filters.end_date = new Date(end_date);
        }

        // Parse pagination
        const pageNum = Math.max(1, parseInt(page, 10));
        const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10))); // Max 100 per page

        // Build sort options
        const sortOptions: AuditLogSortOptions = {
          sort_by: sort_by as 'timestamp' | 'action' | 'resource',
          order: sort_order,
        };

        // Fetch audit logs
        const result = await db.auditLogs.list(filters, sortOptions, pageNum, pageSize);

        logger.debug('Audit logs retrieved', {
          filters,
          total: result.pagination.total,
          page: pageNum,
          limit: pageSize,
        });

        return reply.send({
          success: true,
          ...result,
        });
      } catch (error) {
        logger.error('Failed to retrieve audit logs', { error });
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve audit logs',
        });
      }
    }
  );

  /**
   * GET /api/v1/audit-logs/:id
   * Get a specific audit log entry by ID
   */
  fastify.get<{
    Params: {
      id: string;
    };
  }>(
    '/api/v1/audit-logs/:id',
    {
      preHandler: requireRole('admin'),
    },
    async (request, reply) => {
      try {
        const { id } = request.params;

        const auditLog = await db.auditLogs.findById(id);

        if (!auditLog) {
          return reply.status(404).send({
            success: false,
            error: 'Audit log not found',
          });
        }

        return reply.send({
          success: true,
          data: auditLog,
        });
      } catch (error) {
        logger.error('Failed to retrieve audit log', { error, id: request.params.id });
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve audit log',
        });
      }
    }
  );

  /**
   * GET /api/v1/audit-logs/statistics
   * Get audit log statistics (totals by action, user, success/failure)
   */
  fastify.get(
    '/api/v1/audit-logs/statistics',
    {
      preHandler: requireRole('admin'),
    },
    async (_request, reply) => {
      try {
        const stats = await db.auditLogs.getStatistics();

        return reply.send({
          success: true,
          data: stats,
        });
      } catch (error) {
        logger.error('Failed to retrieve audit log statistics', { error });
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve statistics',
        });
      }
    }
  );

  /**
   * GET /api/v1/audit-logs/recent
   * Get the most recent audit logs (last 100 by default)
   */
  fastify.get<{
    Querystring: {
      limit?: string;
    };
  }>(
    '/api/v1/audit-logs/recent',
    {
      preHandler: requireRole('admin'),
    },
    async (request, reply) => {
      try {
        const { limit = '100' } = request.query;
        const maxLimit = Math.min(500, Math.max(1, parseInt(limit, 10))); // Max 500

        const auditLogs = await db.auditLogs.getRecent(maxLimit);

        return reply.send({
          success: true,
          data: auditLogs,
          count: auditLogs.length,
        });
      } catch (error) {
        logger.error('Failed to retrieve recent audit logs', { error });
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve recent audit logs',
        });
      }
    }
  );

  /**
   * GET /api/v1/audit-logs/user/:userId
   * Get all audit logs for a specific user
   */
  fastify.get<{
    Params: {
      userId: string;
    };
    Querystring: {
      limit?: string;
    };
  }>(
    '/api/v1/audit-logs/user/:userId',
    {
      preHandler: requireRole('admin'),
    },
    async (request, reply) => {
      try {
        const { userId } = request.params;
        const { limit = '100' } = request.query;

        const maxLimit = Math.min(500, Math.max(1, parseInt(limit, 10)));

        const logs = await db.auditLogs.findByUserId(userId, maxLimit);

        return reply.send({
          success: true,
          data: logs,
          count: logs.length,
        });
      } catch (error) {
        logger.error('Failed to retrieve user audit logs', {
          error,
          userId: request.params.userId,
        });
        return reply.status(500).send({
          success: false,
          error: 'Failed to retrieve user audit logs',
        });
      }
    }
  );

  logger.info('Audit log routes registered');
}
