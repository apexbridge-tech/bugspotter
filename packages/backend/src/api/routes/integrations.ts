/**
 * Integration routes
 * Generic API endpoints for external platform integrations (Jira, GitHub, etc.)
 * Works with any integration plugin through the plugin registry
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { IStorageService } from '../../storage/types.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { checkProjectAccess } from '../utils/resource.js';
import { AppError } from '../middleware/error.js';
import { PluginRegistry } from '../../integrations/plugin-registry.js';
import { loadIntegrationPlugins } from '../../integrations/plugin-loader.js';
import { getEncryptionService } from '../../utils/encryption.js';
import { getLogger } from '../../logger.js';

const logger = getLogger();

/**
 * Register integration routes
 */
export async function registerIntegrationRoutes(
  server: FastifyInstance,
  db: DatabaseClient,
  storage: IStorageService
): Promise<void> {
  // Initialize plugin registry
  const registry = new PluginRegistry(db, storage);
  await loadIntegrationPlugins(registry);

  const encryptionService = getEncryptionService();

  /**
   * List available integration platforms
   * GET /api/integrations/platforms
   */
  server.get('/api/integrations/platforms', async (request, reply) => {
    if (!request.authUser) {
      throw new AppError('Authentication required', 401, 'Unauthorized');
    }

    const platforms = registry.listPlugins();
    return sendSuccess(reply, platforms);
  });

  /**
   * Test integration connection with provided config
   * POST /api/integrations/:platform/test
   */
  server.post<{ Params: { platform: string }; Body: Record<string, unknown> }>(
    '/api/integrations/:platform/test',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { platform } = request.params;
      const config = request.body;

      // Check if platform is supported
      if (!registry.isSupported(platform)) {
        throw new AppError(`Integration platform '${platform}' not supported`, 400, 'BadRequest');
      }

      logger.info('Testing integration connection', {
        platform,
        userId: request.authUser.id,
      });

      // Get plugin and validate through its interface
      const service = registry.get(platform);
      if (!service) {
        throw new AppError(`Integration platform '${platform}' not found`, 404, 'NotFound');
      }

      const result = await service.validateConfig(config);

      return sendSuccess(reply, result);
    }
  );

  /**
   * Save integration configuration for project
   * POST /api/integrations/:platform/:projectId
   */
  server.post<{
    Params: { platform: string; projectId: string };
    Body: {
      config: Record<string, unknown>;
      credentials: Record<string, unknown>;
      enabled?: boolean;
    };
  }>('/api/integrations/:platform/:projectId', async (request, reply) => {
    if (!request.authUser) {
      throw new AppError('Authentication required', 401, 'Unauthorized');
    }

    const { platform, projectId } = request.params;
    const { config, credentials, enabled = true } = request.body;

    // Check if platform is supported
    if (!registry.isSupported(platform)) {
      throw new AppError(`Integration platform '${platform}' not supported`, 400, 'BadRequest');
    }

    // Check project access
    await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

    logger.info('Saving integration configuration', {
      platform,
      projectId,
      userId: request.authUser.id,
    });

    // Encrypt credentials
    const encryptedCredentials = encryptionService.encrypt(JSON.stringify(credentials));

    // Save to database using repository
    await db.projectIntegrations.upsert(projectId, platform, {
      enabled,
      config,
      encrypted_credentials: encryptedCredentials,
    });

    return sendCreated(reply, { message: `${platform} configuration saved successfully` });
  });

  /**
   * Get integration configuration for project
   * GET /api/integrations/:platform/:projectId
   */
  server.get<{ Params: { platform: string; projectId: string } }>(
    '/api/integrations/:platform/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { platform, projectId } = request.params;

      // Check if platform is supported
      if (!registry.isSupported(platform)) {
        throw new AppError(`Integration platform '${platform}' not supported`, 400, 'BadRequest');
      }

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      // Load from database
      const integration = await db.projectIntegrations.findByProjectAndPlatform(
        projectId,
        platform
      );

      if (!integration) {
        return sendSuccess(reply, null);
      }

      // Return config without sensitive credentials
      return sendSuccess(reply, {
        platform: integration.platform,
        enabled: integration.enabled,
        config: integration.config,
        // Do NOT return encrypted_credentials
      });
    }
  );

  /**
   * Update integration status (enable/disable)
   * PATCH /api/integrations/:platform/:projectId
   */
  server.patch<{ Params: { platform: string; projectId: string }; Body: { enabled: boolean } }>(
    '/api/integrations/:platform/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { platform, projectId } = request.params;
      const { enabled } = request.body;

      // Check if platform is supported
      if (!registry.isSupported(platform)) {
        throw new AppError(`Integration platform '${platform}' not supported`, 400, 'BadRequest');
      }

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      logger.info('Updating integration status', {
        platform,
        projectId,
        enabled,
        userId: request.authUser.id,
      });

      const updated = await db.projectIntegrations.setEnabled(projectId, platform, enabled);

      if (!updated) {
        throw new AppError(`${platform} integration not found for project`, 404, 'NotFound');
      }

      return sendSuccess(reply, {
        message: `${platform} integration ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    }
  );

  /**
   * Delete integration configuration
   * DELETE /api/integrations/:platform/:projectId
   */
  server.delete<{ Params: { platform: string; projectId: string } }>(
    '/api/integrations/:platform/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { platform, projectId } = request.params;

      // Check if platform is supported
      if (!registry.isSupported(platform)) {
        throw new AppError(`Integration platform '${platform}' not supported`, 400, 'BadRequest');
      }

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      logger.info('Deleting integration configuration', {
        platform,
        projectId,
        userId: request.authUser.id,
      });

      const deleted = await db.projectIntegrations.deleteByProjectAndPlatform(projectId, platform);

      if (!deleted) {
        throw new AppError(`${platform} integration not found for project`, 404, 'NotFound');
      }

      return sendSuccess(reply, {
        message: `${platform} configuration deleted successfully`,
      });
    }
  );

  logger.info('Integration routes registered', {
    supportedPlatforms: registry.listPlugins().map((p: { platform: string }) => p.platform),
  });
}
