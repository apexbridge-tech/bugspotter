/**
 * Setup routes
 * Initial system setup and configuration
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import bcrypt from 'bcrypt';
import { AppError } from '../middleware/error.js';
import { sendSuccess } from '../utils/response.js';
import { PASSWORD } from '../utils/constants.js';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

interface SetupStatus {
  initialized: boolean;
  requiresSetup: boolean;
}

interface SetupRequest {
  admin_email: string;
  admin_password: string;
  admin_name: string;
  instance_name: string;
  instance_url: string;
  storage_type: 'minio' | 's3';
  storage_endpoint?: string;
  storage_access_key: string;
  storage_secret_key: string;
  storage_bucket: string;
  storage_region?: string;
}

interface TestStorageRequest {
  storage_type: string;
  storage_endpoint?: string;
  storage_access_key: string;
  storage_secret_key: string;
  storage_bucket: string;
  storage_region?: string;
}

export async function setupRoutes(fastify: FastifyInstance, db: DatabaseClient): Promise<void> {
  /**
   * GET /api/setup/status
   * Check if system has been initialized
   */
  fastify.get('/api/setup/status', { config: { public: true } }, async (_request, reply) => {
    // Check if any admin users exist
    const result = await db.query(
      "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
    );
    const adminCount = parseInt(result.rows[0]?.count || '0', 10);

    const status: SetupStatus = {
      initialized: adminCount > 0,
      requiresSetup: adminCount === 0,
    };

    return sendSuccess(reply, status);
  });

  /**
   * POST /api/setup/initialize
   * Initialize the system with admin account and settings
   */
  fastify.post<{ Body: SetupRequest }>(
    '/api/setup/initialize',
    { config: { public: true } },
    async (request, reply) => {
      const {
        admin_email,
        admin_password,
        admin_name,
        storage_access_key,
        storage_secret_key,
        storage_bucket,
      } = request.body;

      // Check if already initialized
      const statusResult = await db.query(
        "SELECT COUNT(*) as count FROM users WHERE role = 'admin'"
      );
      const adminCount = parseInt(statusResult.rows[0]?.count || '0', 10);

      if (adminCount > 0) {
        throw new AppError('System already initialized', 400, 'AlreadyInitialized');
      }

      // Validate required fields
      if (!admin_email || !admin_password || !admin_name) {
        throw new AppError('Admin credentials required', 400, 'ValidationError');
      }

      if (!storage_access_key || !storage_secret_key || !storage_bucket) {
        throw new AppError('Storage configuration required', 400, 'ValidationError');
      }

      // Hash admin password
      const passwordHash = await bcrypt.hash(admin_password, PASSWORD.SALT_ROUNDS);

      // Create admin user
      const userResult = await db.query(
        `INSERT INTO users (email, password_hash, role, name, created_at, updated_at)
         VALUES ($1, $2, 'admin', $3, NOW(), NOW())
         RETURNING id, email, role, name, created_at`,
        [admin_email, passwordHash, admin_name]
      );

      const user = userResult.rows[0];

      // TODO: Store system settings in database
      // For now, these would need to be set via environment variables

      // Generate JWT tokens
      const payload = { userId: user.id, role: user.role };
      const access_token = fastify.jwt.sign(payload, { expiresIn: '24h' });
      const refresh_token = fastify.jwt.sign(payload, { expiresIn: '7d' });

      request.log.info({ email: admin_email }, 'System initialized with admin user');

      return sendSuccess(reply, {
        access_token,
        refresh_token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    }
  );

  /**
   * POST /api/setup/test-storage
   * Test storage connection
   */
  fastify.post<{ Body: TestStorageRequest }>(
    '/api/setup/test-storage',
    { config: { public: true } },
    async (request, reply) => {
      const {
        storage_type,
        storage_endpoint,
        storage_access_key,
        storage_secret_key,
        storage_bucket,
        storage_region,
      } = request.body;

      try {
        interface S3Config {
          region: string;
          credentials: {
            accessKeyId: string;
            secretAccessKey: string;
          };
          endpoint?: string;
          forcePathStyle?: boolean;
        }

        const s3Config: S3Config = {
          region: storage_region || 'us-east-1',
          credentials: {
            accessKeyId: storage_access_key,
            secretAccessKey: storage_secret_key,
          },
        };

        if (storage_type === 'minio' && storage_endpoint) {
          s3Config.endpoint = storage_endpoint;
          s3Config.forcePathStyle = true;
        }

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s3Client = new S3Client(s3Config as any);

        // Try to list buckets
        await s3Client.send(new ListBucketsCommand({}));

        return sendSuccess(reply, {
          success: true,
          message: 'Storage connection successful',
        });
      } catch (error) {
        request.log.error({ error, storage_type, storage_bucket }, 'Storage connection failed');

        return sendSuccess(reply, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }
  );
}
