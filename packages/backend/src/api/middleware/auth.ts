/**
 * Authentication Middleware
 * Handles API key and JWT Bearer token authentication
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { Project, User } from '../../db/types.js';
import '../types.js'; // Import type declarations

/**
 * Authentication middleware factory
 * Validates API keys or JWT tokens and sets request context
 *
 * Routes can be marked as public by setting `config.public = true` in route options:
 * @example
 * fastify.get('/public-route', { config: { public: true } }, handler);
 */
export function createAuthMiddleware(db: {
  projects: { findByApiKey: (apiKey: string) => Promise<Project | null> };
  users: { findById: (id: string) => Promise<User | null> };
}) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip authentication if route is marked as public
    if (request.routeOptions.config?.public) {
      return;
    }

    // Skip auth if route doesn't exist (will return 404 later)
    // This prevents auth errors on non-existent routes
    if (!request.routeOptions.url) {
      return;
    }

    // Try API key authentication first (X-API-Key header)
    const apiKey = request.headers['x-api-key'] as string | undefined;
    if (apiKey) {
      try {
        const project = await db.projects.findByApiKey(apiKey);
        if (project) {
          request.authProject = project;
          request.log.debug({ project_id: project.id }, 'API key authentication successful');
          return;
        }
        // Invalid API key
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid API key',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        request.log.error({ error }, 'Error during API key authentication');
        return reply.code(500).send({
          success: false,
          error: 'InternalServerError',
          message: 'Authentication failed',
          statusCode: 500,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Try JWT Bearer token authentication
    const authorization = request.headers.authorization;
    if (authorization && authorization.startsWith('Bearer ')) {
      try {
        // Verify JWT token using Fastify JWT plugin
        const decoded = await request.jwtVerify();

        // Fetch full user details from database to ensure fresh data
        // This ensures role changes and account status are reflected
        const user = await db.users.findById(decoded.userId);
        if (!user) {
          return reply.code(401).send({
            success: false,
            error: 'Unauthorized',
            message: 'User not found',
            statusCode: 401,
            timestamp: new Date().toISOString(),
          });
        }

        request.authUser = user;
        request.log.debug({ user_id: user.id }, 'JWT authentication successful');
        return;
      } catch (error) {
        request.log.debug({ error }, 'JWT authentication failed');
        return reply.code(401).send({
          success: false,
          error: 'Unauthorized',
          message: 'Invalid or expired token',
          statusCode: 401,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // No authentication provided
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Authentication required. Provide X-API-Key header or Authorization Bearer token',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  };
}

/**
 * Role-based authorization middleware factory
 * Requires JWT authentication and checks user role
 */
export function requireRole(...allowedRoles: Array<'admin' | 'user' | 'viewer'>) {
  return async function roleMiddleware(request: FastifyRequest, reply: FastifyReply) {
    if (!request.authUser) {
      return reply.code(401).send({
        success: false,
        error: 'Unauthorized',
        message: 'User authentication required',
        statusCode: 401,
        timestamp: new Date().toISOString(),
      });
    }

    if (!allowedRoles.includes(request.authUser.role)) {
      return reply.code(403).send({
        success: false,
        error: 'Forbidden',
        message: `Insufficient permissions. Required role: ${allowedRoles.join(' or ')}`,
        statusCode: 403,
        timestamp: new Date().toISOString(),
      });
    }
  };
}

/**
 * Require project authentication (API key)
 */
export async function requireProject(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authProject) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Project API key required (X-API-Key header)',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Require user authentication (JWT)
 */
export async function requireUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.authUser) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'User authentication required (Authorization Bearer token)',
      statusCode: 401,
      timestamp: new Date().toISOString(),
    });
  }
}
