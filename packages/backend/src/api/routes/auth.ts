/**
 * Authentication routes
 * User registration, login, and token refresh
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import bcrypt from 'bcrypt';
import { loginSchema, registerSchema, refreshTokenSchema } from '../schemas/auth-schema.js';
import { AppError } from '../middleware/error.js';
import { config } from '../../config.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { findOrThrow, omitFields } from '../utils/resource.js';
import { PASSWORD, TIME_MULTIPLIERS, DEFAULT_TOKEN_EXPIRY_SECONDS } from '../utils/constants.js';

interface LoginBody {
  email: string;
  password: string;
}

interface RegisterBody {
  email: string;
  password: string;
  role?: 'admin' | 'user' | 'viewer';
}

interface RefreshTokenBody {
  refresh_token: string;
}

/**
 * Generate JWT tokens for a user
 */
function generateTokens(fastify: FastifyInstance, userId: string, role: string) {
  const payload = { userId, role };

  const access_token = fastify.jwt.sign(payload, {
    expiresIn: config.jwt.expiresIn,
  });

  const refresh_token = fastify.jwt.sign(payload, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  // Calculate expiry time in seconds
  const expiresIn = parseExpiryTime(config.jwt.expiresIn);

  return {
    access_token,
    refresh_token,
    expires_in: expiresIn,
    token_type: 'Bearer' as const,
  };
}

/**
 * Parse JWT expiry time string to seconds
 */
function parseExpiryTime(timeString: string): number {
  const match = timeString.match(/^(\d+)([smhd])$/);
  if (!match) {
    return DEFAULT_TOKEN_EXPIRY_SECONDS;
  }

  const value = parseInt(match[1], 10);
  const unit = match[2];

  return value * (TIME_MULTIPLIERS[unit] || 1);
}

export function authRoutes(fastify: FastifyInstance, db: DatabaseClient) {
  /**
   * POST /api/v1/auth/register
   * Create a new user account
   */
  fastify.post<{ Body: RegisterBody }>(
    '/api/v1/auth/register',
    {
      schema: registerSchema,
      config: { public: true },
    },
    async (request, reply) => {
      const { email, password, role } = request.body;

      // Check if user already exists
      const existing = await db.users.findByEmail(email);
      if (existing) {
        throw new AppError('User with this email already exists', 409, 'Conflict');
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, PASSWORD.SALT_ROUNDS);

      // Create user
      const user = await db.users.create({
        email,
        password_hash,
        role: role || 'user',
      });

      // Generate tokens
      const tokens = generateTokens(fastify, user.id, user.role);

      // Remove password hash from response
      const userWithoutPassword = omitFields(user, 'password_hash');

      return sendCreated(reply, {
        user: userWithoutPassword,
        tokens,
      });
    }
  );

  /**
   * POST /api/v1/auth/login
   * Authenticate user with email and password
   */
  fastify.post<{ Body: LoginBody }>(
    '/api/v1/auth/login',
    {
      schema: loginSchema,
      config: { public: true },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // Find user by email
      const user = await db.users.findByEmail(email);
      if (!user) {
        throw new AppError('Invalid email or password', 401, 'Unauthorized');
      }

      // Verify password
      if (!user.password_hash) {
        throw new AppError('Password login not available for this account', 401, 'Unauthorized');
      }

      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new AppError('Invalid email or password', 401, 'Unauthorized');
      }

      // Generate tokens
      const tokens = generateTokens(fastify, user.id, user.role);

      // Remove password hash from response
      const userWithoutPassword = omitFields(user, 'password_hash');

      return sendSuccess(reply, {
        user: userWithoutPassword,
        tokens,
      });
    }
  );

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token
   */
  fastify.post<{ Body: RefreshTokenBody }>(
    '/api/v1/auth/refresh',
    {
      schema: refreshTokenSchema,
      config: { public: true },
    },
    async (request, reply) => {
      const { refresh_token } = request.body;

      try {
        // Verify refresh token
        const decoded = fastify.jwt.verify<{ userId: string; role: string }>(refresh_token);

        // Verify user still exists
        const user = await findOrThrow(() => db.users.findById(decoded.userId), 'User');

        // Generate new tokens
        const tokens = generateTokens(fastify, user.id, user.role);

        return sendSuccess(reply, tokens);
      } catch {
        throw new AppError('Invalid or expired refresh token', 401, 'Unauthorized');
      }
    }
  );
}
