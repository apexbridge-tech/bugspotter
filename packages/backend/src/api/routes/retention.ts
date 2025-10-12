/**
 * Retention API Routes
 * Admin endpoints for managing data retention policies
 */

import type { FastifyInstance, FastifyRequest, FastifyReply, preHandlerHookHandler } from 'fastify';
import type { ZodSchema } from 'zod';
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
import { ProjectRetentionSettingsSchema } from '../../retention/types.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

// ============================================================================
// CONSTANTS
// ============================================================================

const USER_ROLES = {
  ADMIN: 'admin',
  OWNER: 'owner',
} as const;

const DEFAULT_TIER = 'free' as const;

const ERROR_MESSAGES = {
  ADMIN_REQUIRED: 'Admin access required',
  OWNER_OR_ADMIN_REQUIRED: 'Project owner or admin access required',
  PROJECT_ACCESS_DENIED: 'Access denied to this project',
  PROJECT_NOT_FOUND: 'Project not found',
  VALIDATION_FAILED: 'Validation failed',
} as const;

// ============================================================================
// MIDDLEWARE HELPERS
// ============================================================================

/**
 * Require admin role for route access
 */
const requireAdmin: preHandlerHookHandler = async (request, reply) => {
  if (request.authUser?.role !== USER_ROLES.ADMIN) {
    return reply.code(403).send({ error: ERROR_MESSAGES.ADMIN_REQUIRED });
  }
};

/**
 * Validate request body against Zod schema
 * Returns validation result for handler to use
 */
function validateRequestBody<T>(schema: ZodSchema<T>, body: unknown) {
  const validation = schema.safeParse(body);
  return validation;
}

/**
 * Format success response
 */
function successResponse(data: Record<string, unknown>) {
  return { success: true, ...data };
}

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
    { preHandler: requireAdmin },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const config = {
        defaultPolicy: getRetentionPolicyForTier(DEFAULT_TIER),
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
      preHandler: requireAdmin,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = validateRequestBody(
        updateRetentionPolicyRequestSchema.shape.body,
        request.body
      );
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      logger.info('Updated global retention policy', {
        userId: request.authUser?.id,
        updates: validation.data,
      });

      return reply.send(successResponse({ policy: validation.data }));
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

      // CRITICAL: Verify user is authenticated
      if (!request.authUser) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User authentication required (Authorization Bearer token)',
        });
      }

      // Admins can access any project
      const isAdmin = request.authUser.role === USER_ROLES.ADMIN;
      if (!isAdmin) {
        const hasAccess = await db.projects.hasAccess(projectId, request.authUser.id);
        if (!hasAccess) {
          return reply.code(403).send({ error: ERROR_MESSAGES.PROJECT_ACCESS_DENIED });
        }
      }

      const project = await db.projects.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND });
      }

      // Validate project settings with runtime type checking
      const validationResult = ProjectRetentionSettingsSchema.safeParse(project.settings);
      let settings: ProjectRetentionSettings | undefined;

      if (validationResult.success) {
        // Type assertion safe after Zod validation
        settings = validationResult.data as ProjectRetentionSettings;
      } else {
        logger.warn('Invalid project settings, using defaults', {
          projectId,
          error: validationResult.error.message,
        });
        settings = undefined;
      }

      const tier = settings?.tier ?? DEFAULT_TIER;
      const retention = settings?.retention ?? getRetentionPolicyForTier(tier);

      return reply.send({
        projectId,
        tier,
        retention: {
          ...retention,
          autoDeleteEnabled: retention.bugReportRetentionDays > 0,
        },
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
      },
    },
    async (request, reply: FastifyReply) => {
      const { id: projectId } = request.params;

      // CRITICAL: Verify user is authenticated
      if (!request.authUser) {
        return reply.code(401).send({
          error: 'Unauthorized',
          message: 'User authentication required (Authorization Bearer token)',
        });
      }

      // Check if user has permission (owner or admin)
      const isAdmin = request.authUser.role === USER_ROLES.ADMIN;
      if (!isAdmin) {
        const role = await db.projects.getUserRole(projectId, request.authUser.id);
        if (role !== USER_ROLES.OWNER) {
          return reply.code(403).send({ error: ERROR_MESSAGES.OWNER_OR_ADMIN_REQUIRED });
        }
      }

      const validation = validateRequestBody(
        updateRetentionPolicyRequestSchema.shape.body,
        request.body
      );
      if (!validation.success) {
        const firstError = validation.error.issues?.[0];
        const fieldName = (firstError?.path?.join('.') || 'field')
          .replace(/([A-Z])/g, ' $1')
          .toLowerCase();
        const message = firstError?.message || validation.error.message;
        return reply.code(400).send({ error: `${fieldName}: ${message}` });
      }

      const project = await db.projects.findById(projectId);
      if (!project) {
        return reply.code(404).send({ error: ERROR_MESSAGES.PROJECT_NOT_FOUND });
      }

      // Validate project settings with runtime type checking
      const validationResult = ProjectRetentionSettingsSchema.safeParse(project.settings);
      let settings: ProjectRetentionSettings | undefined;

      if (validationResult.success) {
        // Type assertion safe after Zod validation
        settings = validationResult.data as ProjectRetentionSettings;
      } else {
        logger.warn('Invalid project settings, using defaults', {
          projectId,
          error: validationResult.error.message,
        });
        settings = undefined;
      }

      const tier = settings?.tier ?? DEFAULT_TIER;

      // Validate retention days (admins bypass tier limits)
      if (validation.data.bugReportRetentionDays && !isAdmin) {
        const validationResult = validateRetentionDays(
          validation.data.bugReportRetentionDays,
          tier,
          validation.data.dataClassification ?? 'general'
        );
        if (!validationResult.valid) {
          return reply.code(400).send({ error: validationResult.error });
        }
      }

      const updatedSettings: ProjectRetentionSettings = {
        ...settings,
        tier, // Ensure tier is always defined
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

      return reply.send(successResponse({ settings: updatedSettings }));
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
      preHandler: requireAdmin,
    },
    async (request, reply: FastifyReply) => {
      const preview = await retentionService.previewRetentionPolicy(request.query.projectId);

      return reply.send({
        totalReports: preview.totalReports,
        reportsByProject: preview.affectedProjects.map((p) => ({
          projectId: p.projectId,
          projectName: p.projectName,
          count: p.reportsToDelete,
        })),
        estimatedStorageFreed: preview.totalStorageBytes,
      });
    }
  );

  /**
   * POST /api/v1/admin/retention/apply
   * Manually trigger retention policy application
   */
  fastify.post(
    '/api/v1/admin/retention/apply',
    {
      preHandler: requireAdmin,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = validateRequestBody(applyRetentionRequestSchema.shape.body, request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { dryRun, batchSize, maxErrorRate, confirm } = validation.data;

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

      return reply.send({
        totalProcessed: result.projectsProcessed,
        deleted: result.totalDeleted,
        storageFreed: result.storageFreed,
        errors: result.errors,
        duration: result.durationMs,
      });
    }
  );

  /**
   * POST /api/v1/admin/retention/legal-hold
   * Apply or remove legal hold on bug reports
   */
  fastify.post(
    '/api/v1/admin/retention/legal-hold',
    {
      preHandler: requireAdmin,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = validateRequestBody(legalHoldRequestSchema.shape.body, request.body);
      if (!validation.success) {
        return reply.code(400).send({ error: validation.error.message });
      }

      const { reportIds, hold } = validation.data;
      const count = await retentionService.setLegalHold(
        reportIds,
        hold,
        request.authUser?.id ?? ''
      );

      return reply.send(
        successResponse({
          message: `Legal hold ${hold ? 'applied to' : 'removed from'} ${count} reports`,
          count,
        })
      );
    }
  );

  /**
   * POST /api/v1/admin/retention/restore
   * Restore soft-deleted bug reports
   */
  fastify.post(
    '/api/v1/admin/retention/restore',
    {
      preHandler: requireAdmin,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = validateRequestBody(restoreReportsRequestSchema.shape.body, request.body);
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

      return reply.send(successResponse({ message: `Restored ${count} reports`, count }));
    }
  );

  /**
   * DELETE /api/v1/admin/retention/hard-delete
   * Permanently delete bug reports (Kazakhstan compliance)
   */
  fastify.delete(
    '/api/v1/admin/retention/hard-delete',
    {
      preHandler: requireAdmin,
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const validation = validateRequestBody(hardDeleteRequestSchema.shape.body, request.body);
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

      return reply.send(
        successResponse({
          message: `Permanently deleted ${reportIds.length} reports`,
          certificate,
        })
      );
    }
  );

  /**
   * GET /api/v1/admin/retention/status
   * Get retention scheduler status
   */
  fastify.get(
    '/api/v1/admin/retention/status',
    {
      preHandler: requireAdmin,
    },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const status = {
        isRunning: retentionScheduler.isJobRunning(),
        nextRunTime: retentionScheduler.getNextRunTime(),
      };

      return reply.send(status);
    }
  );
}
