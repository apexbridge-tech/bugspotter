/**
 * Zod schemas for runtime validation
 * These ensure that incoming data matches our type expectations
 */

import { z } from 'zod';

/**
 * Console log schema - validates SDK console capture
 */
export const ConsoleLogSchema = z.object({
  level: z.enum(['log', 'warn', 'error', 'info', 'debug']),
  message: z.string(),
  timestamp: z.number().positive(),
  stack: z.string().optional(),
});

/**
 * Network request schema - validates SDK network capture
 */
export const NetworkRequestSchema = z.object({
  url: z.string().url(),
  method: z.string().min(1),
  status: z.number().int().min(0).max(599),
  duration: z.number().nonnegative(),
  timestamp: z.number().positive(),
  error: z.string().optional(),
});

/**
 * Browser metadata schema - validates SDK metadata capture
 */
export const BrowserMetadataSchema = z.object({
  userAgent: z.string().min(1),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive(),
  }),
  browser: z.string().min(1),
  os: z.string().min(1),
  url: z.string().url(),
  timestamp: z.number().positive(),
});

/**
 * Captured report schema - validates complete SDK capture
 */
export const CapturedReportSchema = z.object({
  screenshot: z.string().min(1), // Base64 or data URL
  console: z.array(ConsoleLogSchema),
  network: z.array(NetworkRequestSchema),
  metadata: BrowserMetadataSchema,
});

/**
 * Create bug report request schema - validates API input
 */
export const CreateBugReportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(5000),
  report: CapturedReportSchema,
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  project_id: z.string().uuid().optional(),
});

/**
 * List bug reports query schema - validates query parameters
 */
export const ListBugReportsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['open', 'in-progress', 'resolved', 'closed']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  project_id: z.string().uuid().optional(),
  sort_by: z.enum(['created_at', 'updated_at', 'priority']).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

// Export inferred types for use in code
export type CreateBugReportInput = z.infer<typeof CreateBugReportSchema>;
export type ListBugReportsQueryInput = z.infer<typeof ListBugReportsQuerySchema>;
export type CapturedReportInput = z.infer<typeof CapturedReportSchema>;
