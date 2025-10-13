/**
 * Job Status routes
 * Query job queue status and job details
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { QueueManager } from '../../queue/queue-manager.js';
import type { QueueName } from '../../queue/types.js';
import { QUEUE_NAMES } from '../../queue/queue-manager.js';
import { sendSuccess } from '../utils/response.js';
import { checkProjectAccess, findOrThrow } from '../utils/resource.js';
import { AppError } from '../middleware/error.js';

interface JobParams {
  queueName: QueueName;
  id: string;
}

interface ReportJobsParams {
  id: string;
}

export function jobRoutes(
  fastify: FastifyInstance,
  db: DatabaseClient,
  queueManager?: QueueManager
) {
  /**
   * GET /api/v1/queues/:queueName/jobs/:id
   * Get status of a specific job in a queue
   */
  fastify.get<{ Params: JobParams }>(
    '/api/v1/queues/:queueName/jobs/:id',
    async (request, reply) => {
      if (!queueManager) {
        throw new AppError('Queue system not available', 503, 'ServiceUnavailable');
      }

      const { queueName, id } = request.params;

      try {
        const jobStatus = await queueManager.getJobStatus(queueName, id);

        if (!jobStatus) {
          throw new AppError(`Job ${id} not found in ${queueName} queue`, 404, 'NotFound');
        }

        return sendSuccess(reply, {
          queueName,
          jobId: id,
          status: jobStatus,
        });
      } catch (error) {
        if (error instanceof AppError) {
          throw error;
        }
        throw new AppError(
          'Failed to fetch job status',
          500,
          'InternalServerError',
          error instanceof Error ? error : undefined
        );
      }
    }
  );

  /**
   * GET /api/v1/reports/:id/jobs
   * Get all jobs associated with a bug report
   * Note: This is a simplified version - in production you'd track job IDs in metadata
   */
  fastify.get<{ Params: ReportJobsParams }>('/api/v1/reports/:id/jobs', async (request, reply) => {
    if (!queueManager) {
      throw new AppError('Queue system not available', 503, 'ServiceUnavailable');
    }

    const { id: bugReportId } = request.params;

    // Check if report exists and user has access
    const bugReport = await findOrThrow(() => db.bugReports.findById(bugReportId), 'Bug report');

    await checkProjectAccess(
      bugReport.project_id,
      request.authUser,
      request.authProject,
      db,
      'Bug report'
    );

    // Return placeholder response
    // In production, you'd store job IDs in bug_reports.metadata and query them
    return sendSuccess(reply, {
      bugReportId,
      message: 'Job tracking requires storing job IDs in bug report metadata',
      note: 'Use GET /api/v1/queues/:queueName/jobs/:jobId to check specific jobs',
    });
  });

  /**
   * GET /api/v1/queues/metrics
   * Get metrics for all queues (admin/monitoring endpoint)
   */
  fastify.get('/api/v1/queues/metrics', async (_request, reply) => {
    if (!queueManager) {
      throw new AppError('Queue system not available', 503, 'ServiceUnavailable');
    }

    try {
      const metrics = await Promise.all(
        QUEUE_NAMES.map(async (queueName) => {
          try {
            const queueMetrics = await queueManager.getQueueMetrics(queueName);
            return { queue: queueName, ...queueMetrics };
          } catch (error) {
            return {
              queue: queueName,
              error: error instanceof Error ? error.message : 'Unknown error',
            };
          }
        })
      );

      return sendSuccess(reply, { queues: metrics });
    } catch (error) {
      throw new AppError(
        'Failed to fetch queue metrics',
        500,
        'InternalServerError',
        error instanceof Error ? error : undefined
      );
    }
  });

  /**
   * GET /api/v1/queues/health
   * Health check for queue system
   */
  fastify.get('/api/v1/queues/health', { config: { public: true } }, async (_request, reply) => {
    if (!queueManager) {
      return reply.status(503).send({
        success: false,
        error: 'ServiceUnavailable',
        message: 'Queue system not available',
        statusCode: 503,
        timestamp: new Date().toISOString(),
      });
    }

    try {
      const isHealthy = await queueManager.healthCheck();

      if (isHealthy) {
        return sendSuccess(reply, { status: 'healthy', queues: 'operational' });
      } else {
        return reply.status(503).send({
          success: false,
          error: 'ServiceUnavailable',
          message: 'Queue system unhealthy',
          statusCode: 503,
          timestamp: new Date().toISOString(),
        });
      }
    } catch {
      return reply.status(503).send({
        success: false,
        error: 'ServiceUnavailable',
        message: 'Queue health check failed',
        statusCode: 503,
        timestamp: new Date().toISOString(),
      });
    }
  });
}
