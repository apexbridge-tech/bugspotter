/**
 * Authentication schemas for request/response validation
 */

const userRoleEnum = ['admin', 'user', 'viewer'] as const;

export const userSchema = {
  type: 'object',
  required: ['id', 'email', 'role', 'created_at'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    email: { type: 'string', format: 'email' },
    role: { type: 'string', enum: userRoleEnum },
    oauth_provider: { type: 'string', nullable: true },
    oauth_id: { type: 'string', nullable: true },
    created_at: { type: 'string', format: 'date-time' },
  },
} as const;

export const authTokenSchema = {
  type: 'object',
  required: ['access_token', 'refresh_token', 'expires_in'],
  properties: {
    access_token: { type: 'string' },
    refresh_token: { type: 'string' },
    expires_in: { type: 'number' },
    token_type: { type: 'string', enum: ['Bearer'], default: 'Bearer' },
  },
} as const;

export const loginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128 },
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
          required: ['user', 'tokens'],
          properties: {
            user: userSchema,
            tokens: authTokenSchema,
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const registerSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      role: { type: 'string', enum: userRoleEnum, default: 'user' },
    },
  },
  response: {
    201: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: {
          type: 'object',
          required: ['user', 'tokens'],
          properties: {
            user: userSchema,
            tokens: authTokenSchema,
          },
        },
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;

export const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refresh_token'],
    properties: {
      refresh_token: { type: 'string' },
    },
  },
  response: {
    200: {
      type: 'object',
      required: ['success', 'data', 'timestamp'],
      properties: {
        success: { type: 'boolean', enum: [true] },
        data: authTokenSchema,
        timestamp: { type: 'string', format: 'date-time' },
      },
    },
  },
} as const;
