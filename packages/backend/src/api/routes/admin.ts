/**
 * Admin routes
 * System health monitoring and settings management
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import { sendSuccess } from '../utils/response.js';
import { requireRole } from '../middleware/auth.js';
import { parseTimeString } from '../utils/constants.js';
import fs from 'fs/promises';
import { config } from '../../config.js';

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  services: {
    database: ServiceHealth;
    redis: ServiceHealth;
    storage: ServiceHealth;
  };
  system: {
    disk_space_available: number;
    disk_space_total: number;
    worker_queue_depth: number;
    uptime: number;
  };
}

interface ServiceHealth {
  status: 'up' | 'down';
  response_time: number;
  last_check: string;
  error?: string;
}

interface InstanceSettings {
  instance_name: string;
  instance_url: string;
  support_email: string;
  storage_type: 'minio' | 's3';
  storage_endpoint?: string;
  storage_bucket: string;
  storage_region?: string;
  jwt_access_expiry: number;
  jwt_refresh_expiry: number;
  rate_limit_max: number;
  rate_limit_window: number;
  cors_origins: string[];
  retention_days: number;
  max_reports_per_project: number;
  session_replay_enabled: boolean;
}

/**
 * Check database health
 */
async function checkDatabaseHealth(db: DatabaseClient): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    await db.query('SELECT 1');
    return {
      status: 'up',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check Redis health
 */
async function checkRedisHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Import dynamically to avoid circular dependencies
    const { getQueueManager } = await import('../../queue/index.js');
    const queueManager = getQueueManager();

    // Simple ping to verify Redis connection
    await queueManager.getConnection().ping();

    return {
      status: 'up',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check storage health
 */
async function checkStorageHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Check based on storage backend
    if (config.storage.backend === 'local') {
      await fs.access(config.storage.local.baseDirectory);
    } else {
      // S3-compatible storage (s3, minio, r2)
      const { createStorageFromEnv } = await import('../../storage/index.js');
      const storage = createStorageFromEnv();
      const healthy = await storage.healthCheck();

      if (!healthy) {
        throw new Error('Storage health check failed');
      }
    }

    return {
      status: 'up',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
    };
  } catch (error) {
    return {
      status: 'down',
      response_time: Date.now() - start,
      last_check: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get disk space information
 */
async function getDiskSpace(): Promise<{ available: number; total: number }> {
  // Basic implementation - could be enhanced with diskusage library
  const diskUsage = await fs.statfs('/');
  return {
    available: diskUsage.bavail * diskUsage.bsize,
    total: diskUsage.blocks * diskUsage.bsize,
  };
}

/**
 * Get total worker queue depth across all queues
 */
async function getWorkerQueueDepth(): Promise<number> {
  try {
    const { getQueueManager } = await import('../../queue/index.js');
    const queueManager = getQueueManager();
    const stats = await queueManager.getQueueStats();

    // Sum waiting and active jobs across all queues
    return Object.values(stats).reduce(
      (total, queueMetrics) => total + queueMetrics.waiting + queueMetrics.active,
      0
    );
  } catch {
    // If queue manager isn't initialized, return 0
    return 0;
  }
}

/**
 * Writable settings keys that can be stored in database
 */
const WRITABLE_SETTINGS = new Set([
  'instance_name',
  'instance_url',
  'support_email',
  'retention_days',
  'max_reports_per_project',
  'session_replay_enabled',
]);

export async function adminRoutes(fastify: FastifyInstance, db: DatabaseClient): Promise<void> {
  /**
   * Get instance settings from database
   */
  async function getInstanceSettings(): Promise<Record<string, unknown>> {
    try {
      const result = await db.query<{ value: Record<string, unknown> }>(
        "SELECT value FROM system_config WHERE key = 'instance_settings'",
        []
      );
      return result.rows[0]?.value || {};
    } catch {
      return {};
    }
  }

  /**
   * Update instance settings in database
   */
  async function updateInstanceSettings(
    updates: Partial<InstanceSettings>,
    userId: string
  ): Promise<void> {
    // Filter to only writable settings
    const filteredUpdates = Object.entries(updates).reduce(
      (acc, [key, value]) => {
        if (WRITABLE_SETTINGS.has(key)) {
          acc[key] = value;
        }
        return acc;
      },
      {} as Record<string, unknown>
    );

    if (Object.keys(filteredUpdates).length === 0) {
      return;
    }

    // Get current settings
    const currentSettings = await getInstanceSettings();

    // Merge with updates
    const newSettings = { ...currentSettings, ...filteredUpdates };

    // Update in database
    await db.query(
      `INSERT INTO system_config (key, value, updated_by, description)
       VALUES ('instance_settings', $1, $2, 'Instance-wide configuration settings (admin panel)')
       ON CONFLICT (key) DO UPDATE
       SET value = $1, updated_by = $2, updated_at = NOW()`,
      [JSON.stringify(newSettings), userId]
    );
  }

  /**
   * Type-safe helper to get string setting
   */
  function getStringSetting(
    settings: Record<string, unknown>,
    key: string,
    envKey: string,
    defaultValue: string
  ): string {
    const value = settings[key];
    if (typeof value === 'string') {
      return value;
    }
    return process.env[envKey] || defaultValue;
  }

  /**
   * Type-safe helper to get number setting
   */
  function getNumberSetting(
    settings: Record<string, unknown>,
    key: string,
    envKey: string,
    defaultValue: number
  ): number {
    const value = settings[key];
    if (typeof value === 'number') {
      return value;
    }
    return parseInt(process.env[envKey] || String(defaultValue), 10);
  }

  /**
   * Type-safe helper to get boolean setting
   */
  function getBooleanSetting(
    settings: Record<string, unknown>,
    key: string,
    envKey: string,
    defaultValue: boolean
  ): boolean {
    const value = settings[key];
    if (typeof value === 'boolean') {
      return value;
    }
    return process.env[envKey] === 'true' || defaultValue;
  }

  /**
   * GET /api/v1/admin/health
   * Get system health status
   * Requires: admin role
   */
  fastify.get(
    '/api/v1/admin/health',
    { onRequest: [requireRole('admin')] },
    async (_request, reply) => {
      const [databaseHealth, redisHealth, storageHealth, diskSpace] = await Promise.all([
        checkDatabaseHealth(db),
        checkRedisHealth(),
        checkStorageHealth(),
        getDiskSpace(),
      ]);

      // Determine overall status
      const servicesDown = [databaseHealth, redisHealth, storageHealth].filter(
        (s) => s.status === 'down'
      ).length;

      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      if (servicesDown === 0) {
        overallStatus = 'healthy';
      } else if (servicesDown === 1) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'unhealthy';
      }

      const health: HealthStatus = {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        services: {
          database: databaseHealth,
          redis: redisHealth,
          storage: storageHealth,
        },
        system: {
          disk_space_available: diskSpace.available,
          disk_space_total: diskSpace.total,
          worker_queue_depth: await getWorkerQueueDepth(),
          uptime: process.uptime(),
        },
      };

      return sendSuccess(reply, health);
    }
  );

  /**
   * GET /api/v1/admin/settings
   * Get instance settings
   * Note: Writable settings from database, read-only from environment
   * Requires: admin role
   */
  fastify.get(
    '/api/v1/admin/settings',
    { onRequest: [requireRole('admin')] },
    async (_request, reply) => {
      // Fetch writable settings from database
      const dbSettings = await getInstanceSettings();

      // Combine with read-only settings from config
      const settings: InstanceSettings = {
        instance_name: getStringSetting(dbSettings, 'instance_name', 'INSTANCE_NAME', 'BugSpotter'),
        instance_url: getStringSetting(
          dbSettings,
          'instance_url',
          'INSTANCE_URL',
          'http://localhost:3000'
        ),
        support_email: getStringSetting(
          dbSettings,
          'support_email',
          'SUPPORT_EMAIL',
          'support@bugspotter.dev'
        ),
        storage_type: config.storage.backend === 's3' ? 's3' : 'minio',
        storage_endpoint: config.storage.s3.endpoint,
        storage_bucket: config.storage.s3.bucket || 'bugspotter',
        storage_region: config.storage.s3.region,
        jwt_access_expiry: parseTimeString(config.jwt.expiresIn),
        jwt_refresh_expiry: parseTimeString(config.jwt.refreshExpiresIn),
        rate_limit_max: config.rateLimit.maxRequests,
        rate_limit_window: Math.floor(config.rateLimit.windowMs / 1000),
        cors_origins: config.server.corsOrigins,
        retention_days: getNumberSetting(dbSettings, 'retention_days', 'RETENTION_DAYS', 90),
        max_reports_per_project: getNumberSetting(
          dbSettings,
          'max_reports_per_project',
          'MAX_REPORTS_PER_PROJECT',
          10000
        ),
        session_replay_enabled: getBooleanSetting(
          dbSettings,
          'session_replay_enabled',
          'SESSION_REPLAY_ENABLED',
          true
        ),
      };

      return sendSuccess(reply, settings);
    }
  );

  /**
   * PATCH /api/v1/admin/settings
   * Update instance settings
   * Stores writable settings in database (no restart required)
   * Requires: admin role
   */
  fastify.patch<{ Body: Partial<InstanceSettings> }>(
    '/api/v1/admin/settings',
    { onRequest: [requireRole('admin')] },
    async (request, reply) => {
      const updates = request.body;
      const userId = request.authUser!.id;

      // Validate updates
      if (
        'instance_name' in updates &&
        (!updates.instance_name || updates.instance_name.length < 1)
      ) {
        return reply.code(400).send({ error: 'Instance name cannot be empty' });
      }

      // Write changes to database
      try {
        await updateInstanceSettings(updates, userId);
        request.log.info({ updates, userId }, 'Settings updated in database');
      } catch (error) {
        request.log.error({ error, updates }, 'Failed to update settings');
        return reply.code(500).send({ error: 'Failed to update settings' });
      }

      // Fetch updated settings from database
      const dbSettings = await getInstanceSettings();

      // Return updated configuration
      const settings: InstanceSettings = {
        instance_name: getStringSetting(dbSettings, 'instance_name', 'INSTANCE_NAME', 'BugSpotter'),
        instance_url: getStringSetting(
          dbSettings,
          'instance_url',
          'INSTANCE_URL',
          'http://localhost:3000'
        ),
        support_email: getStringSetting(
          dbSettings,
          'support_email',
          'SUPPORT_EMAIL',
          'support@bugspotter.dev'
        ),
        storage_type: config.storage.backend === 's3' ? 's3' : 'minio',
        storage_endpoint: config.storage.s3.endpoint,
        storage_bucket: config.storage.s3.bucket!,
        storage_region: config.storage.s3.region,
        jwt_access_expiry: parseTimeString(config.jwt.expiresIn),
        jwt_refresh_expiry: parseTimeString(config.jwt.refreshExpiresIn),
        rate_limit_max: config.rateLimit.maxRequests,
        rate_limit_window: Math.floor(config.rateLimit.windowMs / 1000),
        cors_origins: config.server.corsOrigins,
        retention_days: getNumberSetting(dbSettings, 'retention_days', 'RETENTION_DAYS', 90),
        max_reports_per_project: getNumberSetting(
          dbSettings,
          'max_reports_per_project',
          'MAX_REPORTS_PER_PROJECT',
          10000
        ),
        session_replay_enabled: getBooleanSetting(
          dbSettings,
          'session_replay_enabled',
          'SESSION_REPLAY_ENABLED',
          true
        ),
      };

      return sendSuccess(reply, settings);
    }
  );
}
