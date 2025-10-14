/**
 * Base Integration Service
 * Interface that all integration services must implement
 */

import type { BugReport } from '../db/types.js';

/**
 * Integration result returned by all integration services
 */
export interface IntegrationResult {
  externalId: string; // External platform ID (e.g., "BUG-123", "#456", "slack-msg-123")
  externalUrl: string; // URL to view the issue/message
  platform: string; // Platform name (jira, github, linear, slack)
  metadata?: Record<string, unknown>; // Additional platform-specific data
}

/**
 * Base interface for all integration services
 * Each platform (Jira, GitHub, Linear, Slack) implements this interface
 */
export interface IntegrationService {
  /**
   * Platform name (jira, github, linear, slack)
   */
  readonly platform: string;

  /**
   * Create issue/ticket/message on external platform from bug report
   * @param bugReport - Bug report to create issue from
   * @param projectId - Project ID for loading integration config
   * @returns Integration result with external ID and URL
   */
  createFromBugReport(bugReport: BugReport, projectId: string): Promise<IntegrationResult>;

  /**
   * Test connection to external platform
   * @param projectId - Project ID for loading integration config
   * @returns True if connection successful, false otherwise
   */
  testConnection(projectId: string): Promise<boolean>;
}
