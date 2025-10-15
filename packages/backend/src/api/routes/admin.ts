/**
 * Admin routes
 * System health monitoring and settings management
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import { sendSuccess } from '../utils/response.js';
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
 * Check Redis health (placeholder - implement if Redis is added)
 */
async function checkRedisHealth(): Promise<ServiceHealth> {
  // For now, return mock data
  // TODO: Implement actual Redis health check when Redis is added
  return {
    status: 'up',
    response_time: 5,
    last_check: new Date().toISOString(),
  };
}

/**
 * Check storage health
 */
async function checkStorageHealth(): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    // Simple check: try to access storage directory or S3
    if (config.storage.backend === 'local') {
      await fs.access(config.storage.local.baseDirectory);
    }
    // TODO: Add S3 health check
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

export async function adminRoutes(fastify: FastifyInstance, db: DatabaseClient): Promise<void> {
  /**
   * GET /api/admin/health
   * Get system health status
   */
  fastify.get('/api/admin/health', async (_request, reply) => {
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
        worker_queue_depth: 0, // TODO: Integrate with actual queue
        uptime: process.uptime(),
      },
    };

    return sendSuccess(reply, health);
  });

  /**
   * GET /api/admin/settings
   * Get instance settings
   */
  fastify.get('/api/admin/settings', async (_request, reply) => {
    // TODO: Store settings in database, for now return from config
    const settings: InstanceSettings = {
      instance_name: process.env.INSTANCE_NAME || 'BugSpotter',
      instance_url: process.env.INSTANCE_URL || 'http://localhost:3000',
      support_email: process.env.SUPPORT_EMAIL || 'support@bugspotter.dev',
      storage_type: config.storage.backend === 's3' ? 's3' : 'minio',
      storage_endpoint: config.storage.s3.endpoint,
      storage_bucket: config.storage.s3.bucket || 'bugspotter',
      storage_region: config.storage.s3.region,
      jwt_access_expiry: parseTimeString(config.jwt.expiresIn),
      jwt_refresh_expiry: parseTimeString(config.jwt.refreshExpiresIn),
      rate_limit_max: config.rateLimit.maxRequests,
      rate_limit_window: Math.floor(config.rateLimit.windowMs / 1000),
      cors_origins: config.server.corsOrigins,
      retention_days: parseInt(process.env.RETENTION_DAYS || '90', 10),
      max_reports_per_project: parseInt(process.env.MAX_REPORTS_PER_PROJECT || '10000', 10),
      session_replay_enabled: process.env.SESSION_REPLAY_ENABLED === 'true',
    };

    return sendSuccess(reply, settings);
  });

  /**
   * PATCH /api/admin/settings
   * Update instance settings
   */
  fastify.patch<{ Body: Partial<InstanceSettings> }>(
    '/api/admin/settings',
    async (request, reply) => {
      // TODO: Validate and persist settings to database
      // For now, just return updated settings
      const updates = request.body;

      // In production, you would:
      // 1. Validate the updates
      // 2. Update environment variables or database
      // 3. Apply changes dynamically where possible

      const settings: InstanceSettings = {
        instance_name: updates.instance_name || process.env.INSTANCE_NAME || 'BugSpotter',
        instance_url: updates.instance_url || process.env.INSTANCE_URL || 'http://localhost:3000',
        support_email: updates.support_email || process.env.SUPPORT_EMAIL || 'support@bugspotter.dev',
        storage_type: config.storage.backend === 's3' ? 's3' : 'minio',
        storage_endpoint: config.storage.s3.endpoint,
        storage_bucket: config.storage.s3.bucket || 'bugspotter',
        storage_region: config.storage.s3.region,
        jwt_access_expiry: parseTimeString(config.jwt.expiresIn),
        jwt_refresh_expiry: parseTimeString(config.jwt.refreshExpiresIn),
        rate_limit_max: config.rateLimit.maxRequests,
        rate_limit_window: Math.floor(config.rateLimit.windowMs / 1000),
        cors_origins: config.server.corsOrigins,
        retention_days: parseInt(process.env.RETENTION_DAYS || '90', 10),
        max_reports_per_project: parseInt(process.env.MAX_REPORTS_PER_PROJECT || '10000', 10),
        session_replay_enabled: process.env.SESSION_REPLAY_ENABLED === 'true',
      };

      request.log.info({ updates }, 'Settings updated');
      return sendSuccess(reply, settings);
    }
  );
}

/**
 * Parse time string (e.g., "24h", "7d") to seconds
 */
function parseTimeString(timeStr: string): number {
  const match = timeStr.match(/^(\d+)([smhd])$/);
  if (!match) {
    return 3600; // Default 1 hour
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    s: 1,
    m: 60,
    h: 3600,
    d: 86400,
  };

  return value * (multipliers[unit] || 1);
}
