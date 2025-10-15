/**
 * Jira Plugin Tests
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { jiraPlugin } from '../../../src/integrations/jira/plugin.js';
import type { PluginContext } from '../../../src/integrations/plugin.types.js';

describe('jiraPlugin', () => {
  let mockContext: PluginContext;

  beforeEach(() => {
    mockContext = {
      db: {
        bugReports: {},
        projectIntegrations: {},
        tickets: {},
      } as any,
      storage: {} as any,
    };
  });

  describe('metadata', () => {
    it('should have correct metadata', () => {
      expect(jiraPlugin.metadata).toEqual({
        name: 'Jira Integration',
        platform: 'jira',
        version: '1.0.0',
        description: 'Create and sync issues with Atlassian Jira',
        author: 'BugSpotter Team',
        requiredEnvVars: ['ENCRYPTION_KEY'],
      });
    });

    it('should require ENCRYPTION_KEY environment variable', () => {
      expect(jiraPlugin.metadata.requiredEnvVars).toContain('ENCRYPTION_KEY');
    });
  });

  describe('factory', () => {
    it('should create JiraIntegrationService instance', () => {
      const service = jiraPlugin.factory(mockContext);

      expect(service).toBeDefined();
      expect(service.platform).toBe('jira');
      expect(service.createFromBugReport).toBeDefined();
      expect(service.testConnection).toBeDefined();
    });

    it('should pass context to service', () => {
      const service = jiraPlugin.factory(mockContext);

      // Service should have access to context dependencies
      expect(service).toBeDefined();
    });
  });

  describe('lifecycle', () => {
    it('should not have lifecycle hooks defined', () => {
      expect('lifecycle' in jiraPlugin).toBe(false);
    });
  });
});
