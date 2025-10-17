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
import { PASSWORD, parseTimeString, DEFAULT_TOKEN_EXPIRY_SECONDS } from '../utils/constants.js';

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
  const expiresIn = parseTimeString(config.jwt.expiresIn, DEFAULT_TOKEN_EXPIRY_SECONDS);
  const refreshExpiresIn = parseTimeString(
    config.jwt.refreshExpiresIn,
    DEFAULT_TOKEN_EXPIRY_SECONDS
  );

  return {
    access_token,
    refresh_token,
    expires_in: expiresIn,
    refresh_expires_in: refreshExpiresIn,
    token_type: 'Bearer' as const,
  };
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

      // Set refresh token in httpOnly cookie
      reply.setCookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: config.server.env === 'production',
        sameSite: 'strict',
        maxAge: tokens.refresh_expires_in,
        path: '/',
      });

      // Remove password hash from response
      const userWithoutPassword = omitFields(user, 'password_hash');

      return sendCreated(reply, {
        user: userWithoutPassword,
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
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

      // Set refresh token in httpOnly cookie
      reply.setCookie('refresh_token', tokens.refresh_token, {
        httpOnly: true,
        secure: config.server.env === 'production',
        sameSite: 'strict',
        maxAge: tokens.refresh_expires_in,
        path: '/',
      });

      // Remove password hash from response
      const userWithoutPassword = omitFields(user, 'password_hash');

      return sendSuccess(reply, {
        user: userWithoutPassword,
        access_token: tokens.access_token,
        expires_in: tokens.expires_in,
        token_type: tokens.token_type,
      });
    }
  );

  /**
   * POST /api/v1/auth/refresh
   * Refresh access token using refresh token from httpOnly cookie
   */
  fastify.post<{ Body: RefreshTokenBody }>(
    '/api/v1/auth/refresh',
    {
      schema: refreshTokenSchema,
      config: { public: true },
    },
    async (request, reply) => {
      // Try to get refresh token from cookie first (new secure method)
      let refresh_token = request.cookies.refresh_token;

      // Fallback to request body for backward compatibility
      if (!refresh_token && request.body?.refresh_token) {
        refresh_token = request.body.refresh_token;
      }

      if (!refresh_token) {
        throw new AppError('Refresh token not provided', 401, 'Unauthorized');
      }

      try {
        // Verify refresh token
        const decoded = fastify.jwt.verify<{ userId: string; role: string }>(refresh_token);

        // Verify user still exists
        const user = await findOrThrow(() => db.users.findById(decoded.userId), 'User');

        // Generate new tokens
        const tokens = generateTokens(fastify, user.id, user.role);

        // Set new refresh token in httpOnly cookie
        reply.setCookie('refresh_token', tokens.refresh_token, {
          httpOnly: true,
          secure: config.server.env === 'production',
          sameSite: 'strict',
          maxAge: tokens.refresh_expires_in,
          path: '/',
        });

        return sendSuccess(reply, {
          access_token: tokens.access_token,
          expires_in: tokens.expires_in,
          token_type: tokens.token_type,
        });
      } catch {
        throw new AppError('Invalid or expired refresh token', 401, 'Unauthorized');
      }
    }
  );

  /**
   * POST /api/v1/auth/logout
   * Logout user and clear refresh token cookie
   */
  fastify.post(
    '/api/v1/auth/logout',
    {
      config: { public: true },
    },
    async (_request, reply) => {
      // Clear refresh token cookie
      reply.clearCookie('refresh_token', {
        httpOnly: true,
        secure: config.server.env === 'production',
        sameSite: 'strict',
        path: '/',
      });

      return sendSuccess(reply, { message: 'Logged out successfully' });
    }
  );
}
