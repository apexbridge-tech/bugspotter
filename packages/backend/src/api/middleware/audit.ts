/**
 * Audit Middleware
 * Automatically logs all administrative actions (POST, PUT, PATCH, DELETE)
 */

import type { FastifyRequest, FastifyReply } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

// Routes to exclude from audit logging (health checks, public endpoints, etc.)
const EXCLUDED_ROUTES = new Set([
  '/health',
  '/api/v1/auth/login',
  '/api/v1/auth/refresh',
  '/api/v1/auth/logout',
  '/api/v1/setup/status',
]);

// Methods that trigger audit logging
const AUDIT_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Extract resource ID from request path and body
 */
function extractResourceId(request: FastifyRequest): string | null {
  // Try to extract from URL params (e.g., /api/v1/users/123)
  const pathParts = request.url.split('/');
  const lastPart = pathParts[pathParts.length - 1];

  // Check if last part looks like a UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(lastPart)) {
    return lastPart;
  }

  // Try to extract from body
  const body = request.body as Record<string, unknown> | null;
  if (body && typeof body === 'object') {
    const id =
      (body.id as string) || (body.project_id as string) || (body.user_id as string) || null;
    return id;
  }

  return null;
}

/**
 * Sanitize request body for audit logging
 * Remove sensitive fields like passwords
 */
function sanitizeBody(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object') {
    return null;
  }

  const sanitized = { ...body } as Record<string, unknown>;

  // Remove sensitive fields
  const sensitiveFields = ['password', 'password_hash', 'api_key', 'secret', 'token'];
  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

/**
 * Create audit middleware
 * This runs after the request handler completes
 */
export function createAuditMiddleware(db: DatabaseClient) {
  return async function auditMiddleware(request: FastifyRequest, reply: FastifyReply) {
    // Skip if not an auditable method
    if (!AUDIT_METHODS.has(request.method)) {
      return;
    }

    // Skip excluded routes
    const path = request.url.split('?')[0]; // Remove query params
    if (EXCLUDED_ROUTES.has(path)) {
      return;
    }

    // Skip public routes (routes without authentication)
    const routeConfig = request.routeOptions?.config as { public?: boolean } | undefined;
    if (routeConfig?.public) {
      return;
    }

    // Get user info from auth context
    const authUser = (request as FastifyRequest & { authUser?: { id: string } }).authUser;
    const userId = authUser?.id || null;

    // Extract request details
    const resourceId = extractResourceId(request);
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'] || null;

    // Determine success based on status code
    const success = reply.statusCode < 400;
    let errorMessage: string | null = null;

    if (!success) {
      errorMessage = `Request failed with status ${reply.statusCode}`;
    }

    // Create audit log entry asynchronously (don't block response)
    const auditData = {
      user_id: userId,
      action: request.method,
      resource: path,
      resource_id: resourceId,
      ip_address: ipAddress,
      user_agent: userAgent,
      details: {
        body: sanitizeBody(request.body),
        query: request.query,
        params: request.params,
      },
      success,
      error_message: errorMessage,
    };

    // Log asynchronously without blocking
    db.auditLogs.create(auditData).catch((err) => {
      logger.error('Failed to create audit log', { error: err, auditData });
    });
  };
}

/**
 * Manually create an audit log entry
 * Use this for custom audit events not captured by middleware
 */
export async function createAuditLog(
  db: DatabaseClient,
  data: {
    userId?: string;
    action: string;
    resource: string;
    resourceId?: string;
    details?: Record<string, unknown>;
    success?: boolean;
    errorMessage?: string;
  }
) {
  try {
    await db.auditLogs.create({
      user_id: data.userId || null,
      action: data.action,
      resource: data.resource,
      resource_id: data.resourceId || null,
      details: data.details || null,
      success: data.success ?? true,
      error_message: data.errorMessage || null,
    });
  } catch (error) {
    logger.error('Failed to create manual audit log', { error, data });
  }
}
