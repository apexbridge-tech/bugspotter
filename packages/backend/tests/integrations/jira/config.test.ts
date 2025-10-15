/**
 * Jira Configuration Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { JiraConfigManager } from '../../../src/integrations/jira/config.js';
import type { ProjectIntegrationRepository } from '../../../src/db/project-integration.repository.js';

// Mock JiraClient
vi.mock('../../../src/integrations/jira/client.js', () => ({
  JiraClient: vi.fn().mockImplementation(() => ({
    testConnection: vi.fn().mockResolvedValue({
      valid: true,
      details: { projectExists: true },
    }),
  })),
}));

describe('JiraConfigManager', () => {
  let configManager: JiraConfigManager;
  let mockRepository: ProjectIntegrationRepository;

  beforeEach(() => {
    mockRepository = {
      findEnabledByProjectAndPlatform: vi.fn(),
      upsert: vi.fn(),
      setEnabled: vi.fn(),
      deleteByProjectAndPlatform: vi.fn(),
    } as any;

    configManager = new JiraConfigManager(mockRepository);
  });

  describe('fromDatabase', () => {
    it('should load and decrypt configuration', async () => {
      // Import encryption service to encrypt test data
      const { getEncryptionService } = await import('../../../src/utils/encryption.js');
      const encryptionService = getEncryptionService();
      const encryptedCreds = encryptionService.encrypt(
        JSON.stringify({ email: 'test@example.com', apiToken: 'token' })
      );

      mockRepository.findEnabledByProjectAndPlatform = vi.fn().mockResolvedValue({
        project_id: 'proj-123',
        platform: 'jira',
        config: {
          host: 'https://example.atlassian.net',
          projectKey: 'PROJ',
          issueType: 'Bug',
        },
        encrypted_credentials: encryptedCreds,
        enabled: true,
      });

      const config = await configManager.fromDatabase('proj-123');

      expect(config).toBeDefined();
      expect(config?.host).toBe('https://example.atlassian.net');
      expect(config?.projectKey).toBe('PROJ');
      expect(config?.issueType).toBe('Bug');
      expect(config?.enabled).toBe(true);
      expect(mockRepository.findEnabledByProjectAndPlatform).toHaveBeenCalledWith(
        'proj-123',
        'jira'
      );
    });

    it('should return null when config not found', async () => {
      mockRepository.findEnabledByProjectAndPlatform = vi.fn().mockResolvedValue(null);

      const config = await configManager.fromDatabase('proj-123');

      expect(config).toBeNull();
    });

    it('should return null when credentials missing', async () => {
      mockRepository.findEnabledByProjectAndPlatform = vi.fn().mockResolvedValue({
        project_id: 'proj-123',
        platform: 'jira',
        config: { host: 'https://example.atlassian.net', projectKey: 'PROJ' },
        encrypted_credentials: null,
        enabled: true,
      });

      const config = await configManager.fromDatabase('proj-123');

      expect(config).toBeNull();
    });
  });

  describe('saveToDatabase', () => {
    it('should encrypt and save configuration', async () => {
      mockRepository.upsert = vi.fn().mockResolvedValue({});

      const config = {
        host: 'https://example.atlassian.net',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: 'secret-token',
        enabled: true,
      };

      await configManager.saveToDatabase('proj-123', config);

      expect(mockRepository.upsert).toHaveBeenCalledWith(
        'proj-123',
        'jira',
        expect.objectContaining({
          enabled: true,
          config: expect.objectContaining({
            host: 'https://example.atlassian.net',
            projectKey: 'PROJ',
          }),
          encrypted_credentials: expect.any(String),
        })
      );
    });

    it('should throw error for invalid configuration', async () => {
      const invalidConfig = {
        host: '', // Invalid
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: 'secret-token',
        enabled: true,
      };

      await expect(configManager.saveToDatabase('proj-123', invalidConfig)).rejects.toThrow(
        'Invalid Jira configuration'
      );
    });
  });

  describe('validate', () => {
    it('should validate valid configuration', async () => {
      const config = {
        host: 'https://example.atlassian.net',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: 'secret-token',
        enabled: true,
      };

      const result = await JiraConfigManager.validate(config);

      expect(result.valid).toBe(true);
    });

    it('should fail for missing host', async () => {
      const config = {
        host: '',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: 'secret-token',
        enabled: true,
      };

      const result = await JiraConfigManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('host');
    });

    it('should fail for invalid host format', async () => {
      const config = {
        host: 'not-a-url',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: 'secret-token',
        enabled: true,
      };

      const result = await JiraConfigManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('http');
    });

    it('should fail for invalid email format', async () => {
      const config = {
        host: 'https://example.atlassian.net',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'not-an-email',
        apiToken: 'secret-token',
        enabled: true,
      };

      const result = await JiraConfigManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('email');
    });

    it('should fail for missing API token', async () => {
      const config = {
        host: 'https://example.atlassian.net',
        projectKey: 'PROJ',
        issueType: 'Bug',
        email: 'test@example.com',
        apiToken: '',
        enabled: true,
      };

      const result = await JiraConfigManager.validate(config);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('token');
    });
  });

  describe('deleteFromDatabase', () => {
    it('should delete configuration', async () => {
      mockRepository.deleteByProjectAndPlatform = vi.fn().mockResolvedValue(true);

      await configManager.deleteFromDatabase('proj-123');

      expect(mockRepository.deleteByProjectAndPlatform).toHaveBeenCalledWith('proj-123', 'jira');
    });
  });

  describe('setEnabled', () => {
    it('should enable integration', async () => {
      mockRepository.setEnabled = vi.fn().mockResolvedValue(true);

      await configManager.setEnabled('proj-123', true);

      expect(mockRepository.setEnabled).toHaveBeenCalledWith('proj-123', 'jira', true);
    });

    it('should throw error when integration not found', async () => {
      mockRepository.setEnabled = vi.fn().mockResolvedValue(false);

      await expect(configManager.setEnabled('proj-123', true)).rejects.toThrow('not found');
    });
  });
});
