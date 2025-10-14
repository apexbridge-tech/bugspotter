/**
 * Bug Report schemas for request/response validation
 */

import { paginationSchema, paginationResponseSchema, sortOrderSchema } from './common-schema.js';

// Re-export constants from @bugspotter/types for backward compatibility
export { BugStatus, BugPriority } from '@bugspotter/types';

export const bugStatusEnum = ['open', 'in-progress', 'resolved', 'closed'] as const;
export const bugPriorityEnum = ['low', 'medium', 'high', 'critical'] as const;

export const bugReportSchema = {
  type: 'object',
  required: ['id', 'project_id', 'title', 'status', 'priority', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    project_id: { type: 'string', format: 'uuid' },
    title: { type: 'string' },
    description: { type: 'string', nullable: true },
    screenshot_url: { type: 'string', nullable: true },
    replay_url: { type: 'string', nullable: true },
    metadata: { type: 'object' },
    status: { type: 'string', enum: bugStatusEnum },
    priority: { type: 'string', enum: bugPriorityEnum },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
} as const;

export const createBugReportSchema = {
  body: {
    type: 'object',
    required: ['title', 'report'],
    properties: {
      title: { type: 'string', minLength: 1, maxLength: 500 },
      description: { type: 'string', maxLength: 5000 },
      priority: { type: 'string', enum: bugPriorityEnum, default: 'medium' },
      report: {
        type: 'object',
        required: ['consoleLogs', 'networkRequests', 'browserMetadata'],
        properties: {
          consoleLogs: { type: 'array', items: { type: 'object' } },
          networkRequests: { type: 'array', items: { type: 'object' } },
          browserMetadata: { type: 'object' },
          screenshot: { type: 'string', nullable: true },
          sessionReplay: {
            type: 'object',
            nullable: true,
            properties: {
              events: { type: 'array' },
              duration: { type: 'number' },
            },
          },
        },
      },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: bugReportSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const listBugReportsSchema = {
  querystring: {
    type: 'object',
    properties: {
      ...paginationSchema.properties,
      status: { type: 'string', enum: bugStatusEnum },
      priority: { type: 'string', enum: bugPriorityEnum },
      project_id: { type: 'string', format: 'uuid' },
      sort_by: {
        type: 'string',
        enum: ['created_at', 'updated_at', 'priority'],
        default: 'created_at',
      },
      order: sortOrderSchema,
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data', 'pagination', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'array',
          items: bugReportSchema,
        },
        pagination: paginationResponseSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const getBugReportSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: bugReportSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const updateBugReportSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    properties: {
      status: { type: 'string', enum: bugStatusEnum },
      priority: { type: 'string', enum: bugPriorityEnum },
      description: { type: 'string', maxLength: 5000 },
    },
    minProperties: 1,
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: bugReportSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;
