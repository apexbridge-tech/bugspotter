/**
 * Project routes
 * CRUD operations for projects and API key management
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import { randomBytes } from 'crypto';
import {
  createProjectSchema,
  getProjectSchema,
  updateProjectSchema,
  regenerateApiKeySchema,
} from '../schemas/project.schema.js';
import { requireUser, requireRole } from '../middleware/auth.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { findOrThrow } from '../utils/resource.js';
import { API_KEY_PREFIX, API_KEY_BYTES } from '../utils/constants.js';

interface CreateProjectBody {
  name: string;
  settings?: Record<string, unknown>;
}

interface UpdateProjectBody {
  name?: string;
  settings?: Record<string, unknown>;
}

/**
 * Generate a secure random API key
 */
function generateApiKey(): string {
  return `${API_KEY_PREFIX}${randomBytes(API_KEY_BYTES).toString('hex')}`;
}

export function projectRoutes(fastify: FastifyInstance, db: DatabaseClient) {
  /**
   * POST /api/v1/projects
   * Create a new project (requires user authentication)
   */
  fastify.post<{ Body: CreateProjectBody }>(
    '/api/v1/projects',
    {
      schema: createProjectSchema,
      preHandler: [requireUser],
    },
    async (request, reply) => {
      const { name, settings } = request.body;

      const project = await db.projects.create({
        name,
        api_key: generateApiKey(),
        settings: settings ?? {},
      });

      return sendCreated(reply, project);
    }
  );

  /**
   * GET /api/v1/projects/:id
   * Get a project by ID
   */
  fastify.get<{ Params: { id: string } }>(
    '/api/v1/projects/:id',
    {
      schema: getProjectSchema,
      preHandler: [requireUser],
    },
    async (request, reply) => {
      const { id } = request.params;

      const project = await findOrThrow(() => db.projects.findById(id), 'Project');

      return sendSuccess(reply, project);
    }
  );

  /**
   * PATCH /api/v1/projects/:id
   * Update a project
   */
  fastify.patch<{ Params: { id: string }; Body: UpdateProjectBody }>(
    '/api/v1/projects/:id',
    {
      schema: updateProjectSchema,
      preHandler: [requireUser],
    },
    async (request, reply) => {
      const { id } = request.params;
      const updates = request.body;

      // Check if project exists
      await findOrThrow(() => db.projects.findById(id), 'Project');

      // Update the project
      const updated = await db.projects.update(id, updates);

      return sendSuccess(reply, updated);
    }
  );

  /**
   * POST /api/v1/projects/:id/regenerate-key
   * Generate a new API key for a project
   */
  fastify.post<{ Params: { id: string } }>(
    '/api/v1/projects/:id/regenerate-key',
    {
      schema: regenerateApiKeySchema,
      preHandler: [requireUser, requireRole('admin')],
    },
    async (request, reply) => {
      const { id } = request.params;

      // Check if project exists
      await findOrThrow(() => db.projects.findById(id), 'Project');

      // Generate new API key
      const newApiKey = generateApiKey();
      await db.projects.update(id, { api_key: newApiKey });

      request.log.info({ project_id: id, user_id: request.authUser?.id }, 'API key regenerated');

      return sendSuccess(reply, { api_key: newApiKey });
    }
  );
}
