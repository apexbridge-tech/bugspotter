/**
 * Setup routes
 * Initial system setup and configuration
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { S3ClientConfig } from '@aws-sdk/client-s3';
import bcrypt from 'bcrypt';
import { AppError } from '../middleware/error.js';
import { sendSuccess } from '../utils/response.js';
import { PASSWORD } from '../utils/constants.js';
import { S3Client, ListBucketsCommand } from '@aws-sdk/client-s3';

// ============================================================================
// CONSTANTS
// ============================================================================

const USER_ROLES = {
  ADMIN: 'admin',
} as const;

const DEFAULT_REGION = 'us-east-1';
const TOKEN_EXPIRY = {
  ACCESS: '24h',
  REFRESH: '7d',
} as const;

const ERROR_MESSAGES = {
  ALREADY_INITIALIZED: 'System already initialized',
  ADMIN_CREDENTIALS_REQUIRED: 'Admin credentials required',
  STORAGE_CONFIG_REQUIRED: 'Storage configuration required',
} as const;

const SYSTEM_CONFIG_KEY = 'system_settings';

// ============================================================================
// TYPES
// ============================================================================

interface SetupStatus {
  initialized: boolean;
  requiresSetup: boolean;
}

interface SetupRequest {
  admin_email: string;
  admin_password: string;
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Check if system has been initialized (has admin users)
 */
async function isSystemInitialized(db: DatabaseClient): Promise<boolean> {
  const result = await db.query(`SELECT COUNT(*) as count FROM users WHERE role = $1`, [
    USER_ROLES.ADMIN,
  ]);
  const adminCount = parseInt(result.rows[0]?.count || '0', 10);
  return adminCount > 0;
}

/**
 * Validate admin credentials
 */
function validateAdminCredentials(email: string | undefined, password: string | undefined): void {
  if (!email || !password) {
    throw new AppError(ERROR_MESSAGES.ADMIN_CREDENTIALS_REQUIRED, 400, 'ValidationError');
  }
}

/**
 * Validate storage configuration
 */
function validateStorageConfig(
  accessKey: string | undefined,
  secretKey: string | undefined,
  bucket: string | undefined
): void {
  if (!accessKey || !secretKey || !bucket) {
    throw new AppError(ERROR_MESSAGES.STORAGE_CONFIG_REQUIRED, 400, 'ValidationError');
  }
}

/**
 * Build S3 client configuration
 */
function buildS3Config(
  storageType: string,
  storageEndpoint: string | undefined,
  accessKey: string,
  secretKey: string,
  region: string | undefined
): S3ClientConfig {
  const config: S3ClientConfig = {
    region: region || DEFAULT_REGION,
    credentials: {
      accessKeyId: accessKey,
      secretAccessKey: secretKey,
    },
  };

  if (storageType === 'minio' && storageEndpoint) {
    config.endpoint = storageEndpoint;
    config.forcePathStyle = true;
  }

  return config;
}

// ============================================================================
// ROUTES
// ============================================================================

export async function setupRoutes(fastify: FastifyInstance, db: DatabaseClient): Promise<void> {
  /**
   * GET /api/v1/setup/status
   * Check if the system has been initialized
   */
  fastify.get('/api/v1/setup/status', { config: { public: true } }, async (_request, reply) => {
    const initialized = await isSystemInitialized(db);

    const status: SetupStatus = {
      initialized,
      requiresSetup: !initialized,
    };

    return sendSuccess(reply, status);
  });

  /**
   * POST /api/v1/setup/initialize
   * Initialize the system with admin account and instance settings
   */
  fastify.post<{ Body: SetupRequest }>(
    '/api/v1/setup/initialize',
    { config: { public: true } },
    async (request, reply) => {
      const {
        admin_email,
        admin_password,
        storage_access_key,
        storage_secret_key,
        storage_bucket,
      } = request.body;

      // Check if already initialized
      if (await isSystemInitialized(db)) {
        throw new AppError(ERROR_MESSAGES.ALREADY_INITIALIZED, 400, 'AlreadyInitialized');
      }

      // Validate required fields
      validateAdminCredentials(admin_email, admin_password);
      validateStorageConfig(storage_access_key, storage_secret_key, storage_bucket);

      // Hash admin password
      const passwordHash = await bcrypt.hash(admin_password, PASSWORD.SALT_ROUNDS);

      // Create admin user using repository
      const user = await db.users.create({
        email: admin_email,
        password_hash: passwordHash,
        role: USER_ROLES.ADMIN,
      });

      // Store system settings in database
      const systemSettings = {
        instance_name: request.body.instance_name,
        instance_url: request.body.instance_url,
        storage_type: request.body.storage_type,
        storage_endpoint: request.body.storage_endpoint,
        storage_access_key: request.body.storage_access_key,
        storage_secret_key: request.body.storage_secret_key,
        storage_bucket: request.body.storage_bucket,
        storage_region: request.body.storage_region || 'us-east-1',
      };

      await db.systemConfig.set(
        SYSTEM_CONFIG_KEY,
        systemSettings,
        'System configuration from initial setup',
        user.id
      );

      request.log.info({ settings: Object.keys(systemSettings) }, 'System settings stored');

      // Generate JWT tokens
      const payload = { userId: user.id, role: user.role };
      const access_token = fastify.jwt.sign(payload, { expiresIn: TOKEN_EXPIRY.ACCESS });
      const refresh_token = fastify.jwt.sign(payload, { expiresIn: TOKEN_EXPIRY.REFRESH });

      // Set refresh token in httpOnly cookie (secure practice)
      reply.setCookie('refresh_token', refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
        path: '/',
      });

      request.log.info({ email: admin_email }, 'System initialized with admin user');

      return sendSuccess(reply, {
        access_token,
        expires_in: 24 * 60 * 60, // 24 hours in seconds
        token_type: 'Bearer',
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
      });
    }
  );

  /**
   * POST /api/v1/setup/test-storage
   * Test storage connection with provided credentials
   */
  fastify.post<{ Body: TestStorageRequest }>(
    '/api/v1/setup/test-storage',
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
        const s3Config = buildS3Config(
          storage_type,
          storage_endpoint,
          storage_access_key,
          storage_secret_key,
          storage_region
        );

        const s3Client = new S3Client(s3Config);

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
