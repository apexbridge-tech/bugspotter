/**
 * Validation middleware using Zod schemas
 */

import { z } from 'zod';
import type { Request, Response, NextFunction } from 'express';
import type { ApiErrorResponse } from '@bugspotter/types';

/**
 * Validates request body against a Zod schema
 */
export function validateBody<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response<ApiErrorResponse>, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'Validation Error',
          message: 'Invalid request payload',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          details: error.errors,
        };
        return res.status(400).json(errorResponse);
      }
      next(error);
    }
  };
}

/**
 * Validates query parameters against a Zod schema
 */
export function validateQuery<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response<ApiErrorResponse>, next: NextFunction) => {
    try {
      req.query = await schema.parseAsync(req.query);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'Validation Error',
          message: 'Invalid query parameters',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          details: error.errors,
        };
        return res.status(400).json(errorResponse);
      }
      next(error);
    }
  };
}

/**
 * Validates route parameters against a Zod schema
 */
export function validateParams<T extends z.ZodType>(schema: T) {
  return async (req: Request, res: Response<ApiErrorResponse>, next: NextFunction) => {
    try {
      req.params = await schema.parseAsync(req.params);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errorResponse: ApiErrorResponse = {
          success: false,
          error: 'Validation Error',
          message: 'Invalid route parameters',
          statusCode: 400,
          timestamp: new Date().toISOString(),
          details: error.errors,
        };
        return res.status(400).json(errorResponse);
      }
      next(error);
    }
  };
}
