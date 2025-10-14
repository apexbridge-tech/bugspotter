/**
 * Jira Configuration Manager
 * Handles loading, validation, and encryption of Jira credentials
 */

import type { DatabaseClient } from '../../db/client.js';
import { getLogger } from '../../logger.js';
import { getEncryptionService } from '../../utils/encryption.js';
import type {
  JiraConfig,
  JiraCredentials,
  JiraProjectConfig,
  JiraConnectionTestResult,
} from './types.js';
import { JiraClient } from './client.js';

const logger = getLogger();

/**
 * Database row for project_integrations table
 */
interface ProjectIntegrationRow {
  id: string;
  project_id: string;
  platform: string;
  enabled: boolean;
  config: Record<string, unknown>;
  encrypted_credentials: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Jira Configuration Manager
 * Manages Jira configuration storage and retrieval
 */
export class JiraConfigManager {
  private db: DatabaseClient;
  private encryptionService = getEncryptionService();

  constructor(db: DatabaseClient) {
    this.db = db;
  }

  /**
   * Load Jira configuration from environment variables
   * Used for global/default Jira integration
   */
  static fromEnvironment(): JiraConfig | null {
    const host = process.env.JIRA_HOST;
    const email = process.env.JIRA_EMAIL;
    const apiToken = process.env.JIRA_API_TOKEN;
    const projectKey = process.env.JIRA_PROJECT_KEY;

    // Return null if any required field is missing
    if (!host || !email || !apiToken || !projectKey) {
      logger.debug('Jira environment configuration incomplete', {
        hasHost: !!host,
        hasEmail: !!email,
        hasApiToken: !!apiToken,
        hasProjectKey: !!projectKey,
      });
      return null;
    }

    const config: JiraConfig = {
      host,
      email,
      apiToken,
      projectKey,
      issueType: process.env.JIRA_ISSUE_TYPE || 'Bug',
      enabled: true,
    };

    logger.info('Loaded Jira configuration from environment', {
      host,
      projectKey,
      issueType: config.issueType,
    });

    return config;
  }

  /**
   * Load Jira configuration from database for specific project
   */
  async fromDatabase(projectId: string): Promise<JiraConfig | null> {
    try {
      const result = await this.db.query<ProjectIntegrationRow>(
        `SELECT * FROM project_integrations 
         WHERE project_id = $1 AND platform = 'jira' AND enabled = TRUE
         LIMIT 1`,
        [projectId]
      );

      if (!result.rows || result.rows.length === 0) {
        logger.debug('No Jira integration found for project', { projectId });
        return null;
      }

      const row = result.rows[0];

      // Decrypt credentials
      if (!row.encrypted_credentials) {
        logger.error('Jira integration missing encrypted credentials', { projectId });
        return null;
      }

      let credentials: JiraCredentials;
      try {
        const decrypted = this.encryptionService.decrypt(row.encrypted_credentials);
        credentials = JSON.parse(decrypted);
      } catch (error) {
        logger.error('Failed to decrypt Jira credentials', {
          projectId,
          error: error instanceof Error ? error.message : String(error),
        });
        return null;
      }

      // Extract config
      const config = row.config as unknown as JiraProjectConfig;

      const jiraConfig: JiraConfig = {
        host: config.host,
        email: credentials.email,
        apiToken: credentials.apiToken,
        projectKey: config.projectKey,
        issueType: config.issueType || 'Bug',
        enabled: row.enabled,
      };

      logger.debug('Loaded Jira configuration from database', {
        projectId,
        host: jiraConfig.host,
        projectKey: jiraConfig.projectKey,
      });

      return jiraConfig;
    } catch (error) {
      logger.error('Error loading Jira configuration from database', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Save Jira configuration to database
   */
  async saveToDatabase(projectId: string, config: JiraConfig): Promise<void> {
    try {
      // Validate configuration first
      const validation = await JiraConfigManager.validate(config);
      if (!validation.valid) {
        throw new Error(`Invalid Jira configuration: ${validation.error}`);
      }

      // Separate credentials from config
      const credentials: JiraCredentials = {
        email: config.email,
        apiToken: config.apiToken,
      };

      const projectConfig: JiraProjectConfig = {
        host: config.host,
        projectKey: config.projectKey,
        issueType: config.issueType || 'Bug',
        autoCreate: true,
        syncStatus: false,
        syncComments: false,
      };

      // Encrypt credentials
      const encryptedCredentials = this.encryptionService.encrypt(JSON.stringify(credentials));

      // Upsert to database
      await this.db.query(
        `INSERT INTO project_integrations 
         (project_id, platform, enabled, config, encrypted_credentials)
         VALUES ($1, 'jira', $2, $3, $4)
         ON CONFLICT (project_id, platform)
         DO UPDATE SET
           enabled = EXCLUDED.enabled,
           config = EXCLUDED.config,
           encrypted_credentials = EXCLUDED.encrypted_credentials,
           updated_at = CURRENT_TIMESTAMP`,
        [projectId, config.enabled, JSON.stringify(projectConfig), encryptedCredentials]
      );

      logger.info('Saved Jira configuration to database', {
        projectId,
        host: config.host,
        projectKey: config.projectKey,
        enabled: config.enabled,
      });
    } catch (error) {
      logger.error('Failed to save Jira configuration', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Delete Jira configuration for project
   */
  async deleteFromDatabase(projectId: string): Promise<void> {
    try {
      await this.db.query(
        `DELETE FROM project_integrations 
         WHERE project_id = $1 AND platform = 'jira'`,
        [projectId]
      );

      logger.info('Deleted Jira configuration from database', { projectId });
    } catch (error) {
      logger.error('Failed to delete Jira configuration', {
        projectId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Enable/disable Jira integration for project
   */
  async setEnabled(projectId: string, enabled: boolean): Promise<void> {
    try {
      const result = await this.db.query(
        `UPDATE project_integrations 
         SET enabled = $1, updated_at = CURRENT_TIMESTAMP
         WHERE project_id = $2 AND platform = 'jira'`,
        [enabled, projectId]
      );

      if (result.rowCount === 0) {
        throw new Error('Jira integration not found for project');
      }

      logger.info('Updated Jira integration status', { projectId, enabled });
    } catch (error) {
      logger.error('Failed to update Jira integration status', {
        projectId,
        enabled,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Validate Jira configuration
   * Checks that all required fields are present and tests connection
   */
  static async validate(config: JiraConfig): Promise<JiraConnectionTestResult> {
    // Validate required fields
    if (!config.host) {
      return { valid: false, error: 'Jira host is required' };
    }

    if (!config.email) {
      return { valid: false, error: 'Jira email is required' };
    }

    if (!config.apiToken) {
      return { valid: false, error: 'Jira API token is required' };
    }

    if (!config.projectKey) {
      return { valid: false, error: 'Jira project key is required' };
    }

    // Validate host format
    if (!config.host.startsWith('http://') && !config.host.startsWith('https://')) {
      return {
        valid: false,
        error: 'Jira host must start with http:// or https://',
      };
    }

    // Validate email format (basic check)
    if (!config.email.includes('@')) {
      return { valid: false, error: 'Invalid email format' };
    }

    // Validate project key format (alphanumeric, 2-10 characters)
    if (!/^[A-Z0-9]{2,10}$/.test(config.projectKey)) {
      return {
        valid: false,
        error: 'Project key must be 2-10 uppercase alphanumeric characters',
      };
    }

    // Test connection to Jira
    try {
      const client = new JiraClient(config);
      const testResult = await client.testConnection(config.projectKey);

      if (!testResult.valid) {
        return testResult;
      }

      // Check project access
      if (testResult.details && !testResult.details.projectExists) {
        return {
          valid: false,
          error: `Project "${config.projectKey}" not found or you don't have access`,
        };
      }

      logger.info('Jira configuration validated successfully', {
        host: config.host,
        projectKey: config.projectKey,
      });

      return { valid: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Jira configuration validation failed', {
        host: config.host,
        error: errorMessage,
      });

      return {
        valid: false,
        error: `Connection test failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Get Jira configuration for project (tries database first, then environment)
   */
  async getConfig(projectId: string): Promise<JiraConfig | null> {
    // Try database first
    const dbConfig = await this.fromDatabase(projectId);
    if (dbConfig) {
      return dbConfig;
    }

    // Fall back to environment variables
    const envConfig = JiraConfigManager.fromEnvironment();
    if (envConfig) {
      logger.debug('Using environment Jira configuration', { projectId });
      return envConfig;
    }

    return null;
  }
}
