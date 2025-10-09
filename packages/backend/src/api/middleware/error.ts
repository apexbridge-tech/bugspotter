/**
 * Error Handling Middleware
 * Global error handler with structured responses
 */

import type { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../../config.js';

/**
 * Custom error class for application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public error: string = 'InternalServerError',
    public details?: unknown
  ) {
    super(message);
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Database error types that should be mapped to HTTP status codes
 */
const DB_ERROR_CODES: Record<string, { statusCode: number; error: string; message: string }> = {
  '23505': {
    statusCode: 409,
    error: 'Conflict',
    message: 'Resource already exists',
  },
  '23503': {
    statusCode: 400,
    error: 'BadRequest',
    message: 'Referenced resource not found',
  },
  '23502': {
    statusCode: 400,
    error: 'BadRequest',
    message: 'Required field is missing',
  },
  '22P02': {
    statusCode: 400,
    error: 'BadRequest',
    message: 'Invalid data format',
  },
  '42P01': {
    statusCode: 500,
    error: 'InternalServerError',
    message: 'Database configuration error',
  },
};

/**
 * Map database errors to HTTP status codes
 */
function mapDatabaseError(error: Error): {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
} {
  // PostgreSQL error
  const pgError = error as Error & { code?: string; detail?: string; constraint?: string };
  if (pgError.code && DB_ERROR_CODES[pgError.code]) {
    const mapped = DB_ERROR_CODES[pgError.code];
    return {
      ...mapped,
      details:
        config.server.env === 'development'
          ? { code: pgError.code, detail: pgError.detail, constraint: pgError.constraint }
          : undefined,
    };
  }

  // Connection errors
  if (error.message.includes('Connection') || error.message.includes('ECONNREFUSED')) {
    return {
      statusCode: 503,
      error: 'ServiceUnavailable',
      message: 'Database connection failed',
      details: config.server.env === 'development' ? { message: error.message } : undefined,
    };
  }

  // Default database error
  return {
    statusCode: 500,
    error: 'InternalServerError',
    message: 'Database operation failed',
    details: config.server.env === 'development' ? { message: error.message } : undefined,
  };
}

/**
 * Global error handler for Fastify
 */
export async function errorHandler(
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply
) {
  const requestId = request.id;
  const isDevelopment = config.server.env === 'development';

  // Log error with context
  request.log.error(
    {
      err: error,
      requestId,
      url: request.url,
      method: request.method,
      statusCode: error.statusCode || 500,
    },
    'Request error'
  );

  // Handle validation errors (Fastify schema validation)
  if (error.validation) {
    return reply.code(400).send({
      success: false,
      error: 'ValidationError',
      message: 'Request validation failed',
      statusCode: 400,
      timestamp: new Date().toISOString(),
      requestId,
      details: isDevelopment
        ? {
            validation: error.validation,
            validationContext: error.validationContext,
          }
        : undefined,
    });
  }

  // Handle custom AppError
  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({
      success: false,
      error: error.error,
      message: error.message,
      statusCode: error.statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      details: isDevelopment ? error.details : undefined,
    });
  }

  // Handle database errors
  if (
    error.message.includes('database') ||
    error.message.includes('postgres') ||
    error.message.includes('pg') ||
    (error as Error & { code?: string }).code
  ) {
    const dbError = mapDatabaseError(error);
    return reply.code(dbError.statusCode).send({
      success: false,
      error: dbError.error,
      message: dbError.message,
      statusCode: dbError.statusCode,
      timestamp: new Date().toISOString(),
      requestId,
      details: dbError.details,
    });
  }

  // Handle JWT errors
  if (error.message.includes('jwt') || error.message.includes('token')) {
    return reply.code(401).send({
      success: false,
      error: 'Unauthorized',
      message: 'Invalid or expired token',
      statusCode: 401,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  // Handle rate limit errors
  if (error.statusCode === 429) {
    return reply.code(429).send({
      success: false,
      error: 'TooManyRequests',
      message: 'Rate limit exceeded. Please try again later',
      statusCode: 429,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  // Handle file upload errors
  if (error.message.includes('file') || error.message.includes('upload')) {
    return reply.code(413).send({
      success: false,
      error: 'PayloadTooLarge',
      message: 'File upload failed. File may be too large',
      statusCode: 413,
      timestamp: new Date().toISOString(),
      requestId,
    });
  }

  // Default error response
  const statusCode = error.statusCode || 500;
  return reply.code(statusCode).send({
    success: false,
    error: error.name || 'InternalServerError',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    statusCode,
    timestamp: new Date().toISOString(),
    requestId,
    details: isDevelopment
      ? {
          stack: error.stack,
          code: error.code,
        }
      : undefined,
  });
}

/**
 * Not found (404) handler
 */
export async function notFoundHandler(request: FastifyRequest, reply: FastifyReply) {
  return reply.code(404).send({
    success: false,
    error: 'NotFound',
    message: `Route ${request.method} ${request.url} not found`,
    statusCode: 404,
    timestamp: new Date().toISOString(),
    requestId: request.id,
  });
}
