/**
 * Type declarations for Fastify extensions
 * Using custom properties to avoid conflicts with Fastify's built-in properties
 */

import type { Project, User } from '../db/types.js';

declare module 'fastify' {
  interface FastifyRequest {
    authProject?: Project;
    authUser?: User;
    jwtVerify(): Promise<{ userId: string }>;
  }

  interface FastifyContextConfig {
    public?: boolean;
  }
}

export {};
