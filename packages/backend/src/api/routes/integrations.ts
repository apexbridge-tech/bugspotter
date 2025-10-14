/**
 * Integration routes
 * API endpoints for external platform integrations (Jira, GitHub, etc.)
 */

import type { FastifyInstance } from 'fastify';
import type { DatabaseClient } from '../../db/client.js';
import type { IStorageService } from '../../storage/types.js';
import { sendSuccess, sendCreated } from '../utils/response.js';
import { checkProjectAccess } from '../utils/resource.js';
import { AppError } from '../middleware/error.js';
import { JiraIntegrationService, type JiraConfig } from '../../integrations/jira/index.js';
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
  const jiraService = new JiraIntegrationService(db, storage);

  /**
   * Test Jira connection
   * POST /api/integrations/jira/test
   */
  server.post(
    '/api/integrations/jira/test',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { host, email, apiToken, projectKey, issueType } = request.body as {
        host: string;
        email: string;
        apiToken: string;
        projectKey: string;
        issueType?: string;
      };

      logger.info('Testing Jira connection', {
        host,
        projectKey,
        userId: request.authUser.id,
      });

      const config: JiraConfig = {
        host,
        email,
        apiToken,
        projectKey,
        issueType: issueType || 'Bug',
        enabled: true,
      };

      const result = await jiraService.testConnectionWithConfig(config);

      return sendSuccess(reply, result);
    }
  );

  /**
   * Save Jira configuration for project
   * POST /api/integrations/jira
   */
  server.post(
    '/api/integrations/jira',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { projectId, host, email, apiToken, projectKey, issueType, enabled } = request.body as {
        projectId: string;
        host: string;
        email: string;
        apiToken: string;
        projectKey: string;
        issueType?: string;
        enabled?: boolean;
      };

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      logger.info('Saving Jira configuration', {
        projectId,
        host,
        projectKey,
        userId: request.authUser.id,
      });

      const config: JiraConfig = {
        host,
        email,
        apiToken,
        projectKey,
        issueType: issueType || 'Bug',
        enabled: enabled !== false,
      };

      await jiraService.saveConfiguration(projectId, config);

      return sendCreated(reply, { message: 'Jira configuration saved successfully' });
    }
  );

  /**
   * Get Jira configuration for project
   * GET /api/integrations/jira/:projectId
   */
  server.get<{ Params: { projectId: string } }>(
    '/api/integrations/jira/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { projectId } = request.params;

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      const config = await jiraService.getConfiguration(projectId);

      if (!config) {
        return sendSuccess(reply, null);
      }

      // Return config without sensitive credentials
      return sendSuccess(reply, {
        host: config.host,
        projectKey: config.projectKey,
        issueType: config.issueType,
        enabled: config.enabled,
      });
    }
  );

  /**
   * Update Jira integration status (enable/disable)
   * PATCH /api/integrations/jira/:projectId
   */
  server.patch<{ Params: { projectId: string }; Body: { enabled: boolean } }>(
    '/api/integrations/jira/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { projectId } = request.params;
      const { enabled } = request.body;

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      logger.info('Updating Jira integration status', {
        projectId,
        enabled,
        userId: request.authUser.id,
      });

      await jiraService.setEnabled(projectId, enabled);

      return sendSuccess(reply, {
        message: `Jira integration ${enabled ? 'enabled' : 'disabled'} successfully`,
      });
    }
  );

  /**
   * Delete Jira configuration
   * DELETE /api/integrations/jira/:projectId
   */
  server.delete<{ Params: { projectId: string } }>(
    '/api/integrations/jira/:projectId',
    async (request, reply) => {
      if (!request.authUser) {
        throw new AppError('Authentication required', 401, 'Unauthorized');
      }

      const { projectId } = request.params;

      // Check project access
      await checkProjectAccess(projectId, request.authUser, request.authProject, db, 'Project');

      logger.info('Deleting Jira configuration', {
        projectId,
        userId: request.authUser.id,
      });

      await jiraService.deleteConfiguration(projectId);

      return sendSuccess(reply, {
        message: 'Jira configuration deleted successfully',
      });
    }
  );

  logger.info('Integration routes registered');
}
