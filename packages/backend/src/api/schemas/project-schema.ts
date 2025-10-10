/**
 * Project schemas for request/response validation
 */

export const projectSchema = {
  type: 'object',
  required: ['id', 'name', 'api_key', 'created_at', 'updated_at'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    name: { type: 'string' },
    api_key: { type: 'string' },
    settings: { type: 'object', additionalProperties: true },
    created_at: { type: 'string', format: 'date-time' },
    updated_at: { type: 'string', format: 'date-time' },
  },
} as const;

export const createProjectSchema = {
  body: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      settings: { type: 'object', additionalProperties: true },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: projectSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const getProjectSchema = {
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
        data: projectSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const updateProjectSchema = {
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
      name: { type: 'string', minLength: 1, maxLength: 255 },
      settings: { type: 'object', additionalProperties: true },
    },
    minProperties: 1,
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: projectSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const regenerateApiKeySchema = {
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
        data: {
          type: 'object',
          required: ['api_key'],
          properties: {
            api_key: { type: 'string' },
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;
