/**
 * Retention API Routes
 * Admin endpoints for managing data retention policies
 *
 * NOTE: This is a skeleton implementation. Full integration requires:
 * 1. Proper FastifyInstance type augmentation with db property
 * 2. RetentionService and RetentionScheduler initialization
 * 3. Auth middleware configuration
 * 4. Request type definitions with authUser property
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { RetentionService } from '../../retention/retention-service.js';
import type { RetentionScheduler } from '../../retention/retention-scheduler.js';
import {
  updateRetentionPolicyRequestSchema,
  applyRetentionRequestSchema,
  legalHoldRequestSchema,
  restoreReportsRequestSchema,
  hardDeleteRequestSchema,
} from '../../retention/schemas.js';
import {
  validateRetentionDays,
  getRetentionPolicyForTier,
  MANUAL_DELETION_CONFIRMATION_THRESHOLD,
} from '../../retention/retention-config.js';
import type { ProjectRetentionSettings } from '../../retention/types.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Register retention API routes
 */
export function retentionRoutes(
  fastify: FastifyInstance,
  db: DatabaseClient,
  retentionService: RetentionService,
  retentionScheduler: RetentionScheduler
): void {
  /**
   * GET /api/v1/admin/retention
   * Get current retention policies (admin only)
   */
  fastify.get(
    '/api/v1/admin/retention',
    {
      schema: {},
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      // Return default retention configuration
      const config = {
        defaultPolicy: getRetentionPolicyForTier('free'),
        schedulerEnabled: retentionScheduler.isJobRunning(),
        schedulerStatus: retentionScheduler.isJobRunning() ? 'running' : 'idle',
      };

      return reply.send(config);
    }
  );

  /**
   * PUT /api/v1/admin/retention
   * Update global retention policy (admin only)
   */
  fastify.put(
    '/api/v1/admin/retention',
    {
      schema: {
        description: 'Update global retention policy',
        body: updateRetentionPolicyRequestSchema.shape.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      // Validate request body
      const validation = updateRetentionPolicyRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      logger.info('Updated global retention policy', {
        userId: request.authUser?.id,
        updates: validation.data,
      });

      return reply.send({ success: true, policy: validation.data });
    }
  );

  /**
   * GET /api/v1/projects/:id/retention
   * Get project-specific retention settings
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id/retention',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      const { id: projectId } = request.params;

      // Check if user has access to project
      const hasAccess = await db.projects.hasAccess(projectId, request.authUser?.id ?? '');
      if (!hasAccess) {
        return reply.code(403).send({ error: 'Access denied to this project' });
      }

      const project = await db.projects.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      const settings = project.settings as unknown as ProjectRetentionSettings;
      return reply.send({
        projectId,
        tier: settings?.tier ?? 'free',
        retention: settings?.retention ?? getRetentionPolicyForTier('free'),
      });
    }
  );

  /**
   * PUT /api/v1/projects/:id/retention
   * Update project-specific retention settings
   */
  fastify.put<{ Params: { id: string } }>(
    '/api/v1/projects/:id/retention',
    {
      schema: {
        params: {
          type: 'object',
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
        body: updateRetentionPolicyRequestSchema.shape.body,
      },
    },
    async (request, reply: FastifyReply) => {
      const { id: projectId } = request.params;

      // Check if user is admin or project owner
      const role = await db.projects.getUserRole(projectId, request.authUser?.id ?? '');
      if (role !== 'owner' && request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Project owner or admin access required' });
      }

      // Validate request body
      const validation = updateRetentionPolicyRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const project = await db.projects.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: 'Project not found' });
      }

      const settings = project.settings as unknown as ProjectRetentionSettings;
      const tier = settings?.tier ?? 'free';

      // Validate retention days against tier limits
      if (validation.data.bugReportRetentionDays) {
        const validationResult = validateRetentionDays(
          validation.data.bugReportRetentionDays,
          tier,
          validation.data.dataClassification ?? 'general'
        );
        if (!validationResult.valid) {
          return reply.code(400).send({ error: validationResult.error });
        }
      }

      // Update project settings
      const updatedSettings: ProjectRetentionSettings = {
        ...settings,
        retention: {
          ...(settings?.retention ?? getRetentionPolicyForTier(tier)),
          ...validation.data,
        },
      };

      await db.projects.update(projectId, {
        settings: updatedSettings as unknown as Record<string, unknown>,
      });

      logger.info('Updated project retention settings', {
        projectId,
        userId: request.authUser?.id,
        updates: validation.data,
      });

      return reply.send({ success: true, settings: updatedSettings });
    }
  );

  /**
   * POST /api/v1/admin/retention/preview
   * Preview what would be deleted (dry-run)
   */
  fastify.post<{ Querystring: { projectId?: string } }>(
    '/api/v1/admin/retention/preview',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            projectId: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const preview = await retentionService.previewRetentionPolicy(request.query.projectId);

      return reply.send(preview);
    }
  );

  /**
   * POST /api/v1/admin/retention/apply
   * Manually trigger retention policy application
   */
  fastify.post(
    '/api/v1/admin/retention/apply',
    {
      schema: {
        description: 'Apply retention policies manually',
        body: applyRetentionRequestSchema.shape.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      // Validate request body
      const validation = applyRetentionRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { dryRun, batchSize, maxErrorRate, confirm } = validation.data;

      // Require confirmation for large deletions
      if (!dryRun && !confirm) {
        const preview = await retentionService.previewRetentionPolicy();
        if (preview.totalReports > MANUAL_DELETION_CONFIRMATION_THRESHOLD) {
          return reply.code(400).send({
            error: `This operation would delete ${preview.totalReports} reports. Set confirm=true to proceed.`,
            preview,
          });
        }
      }

      const result = await retentionService.applyRetentionPolicies({
        dryRun,
        batchSize,
        maxErrorRate,
      });

      logger.info('Manual retention policy applied', {
        userId: request.authUser?.id,
        dryRun,
        result,
      });

      return reply.send(result);
    }
  );

  /**
   * POST /api/v1/admin/retention/legal-hold
   * Apply or remove legal hold on bug reports
   */
  fastify.post(
    '/api/v1/admin/retention/legal-hold',
    {
      schema: {
        description: 'Apply or remove legal hold on reports',
        body: legalHoldRequestSchema.shape.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const validation = legalHoldRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { reportIds, hold } = validation.data;
      const count = await retentionService.setLegalHold(
        reportIds,
        hold,
        request.authUser?.id ?? ''
      );

      return reply.send({
        success: true,
        message: `Legal hold ${hold ? 'applied to' : 'removed from'} ${count} reports`,
        count,
      });
    }
  );

  /**
   * POST /api/v1/admin/retention/restore
   * Restore soft-deleted bug reports
   */
  fastify.post(
    '/api/v1/admin/retention/restore',
    {
      schema: {
        description: 'Restore soft-deleted reports',
        body: restoreReportsRequestSchema.shape.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const validation = restoreReportsRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { reportIds } = validation.data;
      const count = await retentionService.restoreReports(reportIds);

      logger.info('Restored soft-deleted reports', {
        userId: request.authUser?.id,
        count,
        reportIds,
      });

      return reply.send({
        success: true,
        message: `Restored ${count} reports`,
        count,
      });
    }
  );

  /**
   * DELETE /api/v1/admin/retention/hard-delete
   * Permanently delete bug reports (Kazakhstan compliance)
   */
  fastify.delete(
    '/api/v1/admin/retention/hard-delete',
    {
      schema: {
        description: 'Permanently delete reports (generates deletion certificate)',
        body: hardDeleteRequestSchema.shape.body,
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const validation = hardDeleteRequestSchema.shape.body.safeParse(request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { reportIds, confirm, generateCertificate } = validation.data;

      if (!confirm) {
        return reply.code(400).send({
          error: `This operation will permanently delete ${reportIds.length} reports. Set confirm=true to proceed.`,
        });
      }

      const certificate = await retentionService.hardDeleteReports(
        reportIds,
        request.authUser?.id ?? null,
        generateCertificate
      );

      logger.info('Hard deleted reports', {
        userId: request.authUser?.id,
        count: reportIds.length,
        certificateGenerated: !!certificate,
      });

      return reply.send({
        success: true,
        message: `Permanently deleted ${reportIds.length} reports`,
        certificate,
      });
    }
  );

  /**
   * GET /api/v1/admin/retention/status
   * Get retention scheduler status
   */
  fastify.get(
    '/api/v1/admin/retention/status',
    {
      schema: {},
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Verify admin role
      if (request.authUser?.role !== 'admin') {
        return reply.code(403).send({ error: 'Admin access required' });
      }

      const status = {
        isRunning: retentionScheduler.isJobRunning(),
        nextRunTime: retentionScheduler.getNextRunTime(),
      };

      return reply.send(status);
    }
  );
}
