/**
 * Jira Integration Service
 * Orchestrates bug report to Jira ticket creation
 */

import type { BugReportRepository } from '../../db/repositories.js';
import type { ProjectIntegrationRepository } from '../../db/project-integration.repository.js';
import type { DatabaseClient } from '../../db/client.js';
import type { IStorageService } from '../../storage/types.js';
import type { BugReport, TicketStatus } from '../../db/types.js';
import type { IntegrationService } from '../base-integration.service.js';
import type { IntegrationResult } from '../base-integration.service.js';
import { getLogger } from '../../logger.js';
import { JiraConfigManager } from './config.js';
import { JiraClient } from './client.js';
import { JiraBugReportMapper } from './mapper.js';
import type { JiraIntegrationResult, JiraConfig } from './types.js';

const logger = getLogger();

// Constants
const PLATFORM_NAME = 'jira';
const DEFAULT_TICKET_STATUS: TicketStatus = 'open';
const DEFAULT_SCREENSHOT_FILENAME = 'screenshot.png';

/**
 * Jira Integration Service
 * Handles creating Jira issues from bug reports
 */
export class JiraIntegrationService implements IntegrationService {
  readonly platform = PLATFORM_NAME;

  private bugReportRepo: BugReportRepository;
  private db: DatabaseClient;
  private storage: IStorageService;
  private configManager: JiraConfigManager;

  constructor(
    bugReportRepo: BugReportRepository,
    integrationRepo: ProjectIntegrationRepository,
    db: DatabaseClient,
    storage: IStorageService
  ) {
    this.bugReportRepo = bugReportRepo;
    this.db = db;
    this.storage = storage;
    this.configManager = new JiraConfigManager(integrationRepo);
  }

  /**
   * Create Jira issue from bug report (implements IntegrationService interface)
   * @param bugReport - Bug report to create issue from
   * @param projectId - Project ID for loading integration config
   * @returns Integration result with external ID and URL
   */
  async createFromBugReport(bugReport: BugReport, projectId: string): Promise<IntegrationResult> {
    const result = await this.createTicketFromBugReportInternal(bugReport, projectId);
    return {
      externalId: result.issueKey,
      externalUrl: result.issueUrl,
      platform: PLATFORM_NAME,
      metadata: {
        issueId: result.issueId,
        attachments: result.attachments,
      },
    };
  }

  /**
   * Create Jira ticket from bug report (legacy method for backward compatibility)
   * @param bugReportId - Bug report ID
   * @returns Jira integration result with issue key and URL
   */
  async createTicketFromBugReport(bugReportId: string): Promise<JiraIntegrationResult> {
    logger.info('Creating Jira ticket from bug report', { bugReportId });

    // Fetch bug report
    const bugReport = await this.fetchBugReport(bugReportId);
    return this.createTicketFromBugReportInternal(bugReport, bugReport.project_id);
  }

  /**
   * Internal method to create Jira ticket from bug report
   */
  private async createTicketFromBugReportInternal(
    bugReport: BugReport,
    projectId: string
  ): Promise<JiraIntegrationResult> {
    logger.info('Creating Jira ticket from bug report', { bugReportId: bugReport.id, projectId });

    // Get Jira configuration for project
    const config = await this.configManager.getConfig(bugReport.project_id);
    if (!config) {
      throw new Error(`Jira not configured for project: ${bugReport.project_id}`);
    }

    if (!config.enabled) {
      throw new Error(`Jira integration disabled for project: ${bugReport.project_id}`);
    }

    // Create Jira client and mapper
    const client = new JiraClient(config);
    const mapper = new JiraBugReportMapper(config, true);

    // Convert bug report to Jira issue
    const issueFields = mapper.toJiraIssue(bugReport);

    // Create Jira issue
    const issue = await client.createIssue(issueFields);
    const issueUrl = client.getIssueUrl(issue.key);

    logger.info('Jira issue created', {
      bugReportId: bugReport.id,
      issueKey: issue.key,
      issueUrl,
    });

    // Upload screenshot as attachment if present
    const attachments = [];
    if (bugReport.screenshot_url) {
      try {
        const attachment = await this.uploadScreenshotToJira(
          client,
          issue.key,
          bugReport.screenshot_url
        );
        attachments.push(attachment);
      } catch (error) {
        logger.warn('Failed to upload screenshot to Jira', {
          bugReportId: bugReport.id,
          issueKey: issue.key,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Save ticket reference to both tables atomically
    await this.saveTicketReference(bugReport.id, issue.key, issueUrl);

    return {
      issueKey: issue.key,
      issueUrl,
      issueId: issue.id,
      attachments,
    };
  }

  /**
   * Fetch bug report from database
   */
  private async fetchBugReport(bugReportId: string): Promise<BugReport> {
    const bugReport = await this.bugReportRepo.findById(bugReportId);

    if (!bugReport) {
      throw new Error(`Bug report not found: ${bugReportId}`);
    }

    return bugReport;
  }

  /**
   * Upload screenshot to Jira as attachment
   * Uses streaming to prevent memory issues with large files
   */
  private async uploadScreenshotToJira(
    client: JiraClient,
    issueKey: string,
    screenshotUrl: string
  ) {
    logger.debug('Uploading screenshot to Jira', { issueKey, screenshotUrl });

    // Extract storage key from URL
    // screenshotUrl format: http://localhost:3000/uploads/screenshots/proj-id/bug-id/filename.png
    // or S3: https://bucket.s3.region.amazonaws.com/screenshots/proj-id/bug-id/filename.png
    const key = this.extractStorageKey(screenshotUrl);

    // Get screenshot stream from storage (memory-efficient)
    const stream = await this.storage.getObject(key);

    // Extract filename from key
    const filename = key.split('/').pop() || DEFAULT_SCREENSHOT_FILENAME;

    // Upload to Jira using streaming (prevents buffering entire file in memory)
    return await client.uploadAttachment(issueKey, stream, filename);
  }

  /**
   * Extract storage key from URL
   */
  private extractStorageKey(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove leading slash and domain-specific prefix
      let path = urlObj.pathname;

      // Remove /uploads prefix if present (local storage)
      if (path.startsWith('/uploads/')) {
        path = path.substring('/uploads/'.length);
      } else if (path.startsWith('/')) {
        path = path.substring(1);
      }

      return path;
    } catch {
      // If URL parsing fails, assume it's already a key
      return url;
    }
  }

  /**
   * Save ticket reference to database
   * Atomically saves to both tickets table (for queries) and bug_reports metadata (for fast access)
   * Uses transaction to ensure both writes succeed or fail together
   */
  private async saveTicketReference(
    bugReportId: string,
    externalId: string,
    externalUrl: string
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      // Save to tickets table (queryable, relational)
      await tx.tickets.createTicket(bugReportId, externalId, PLATFORM_NAME, DEFAULT_TICKET_STATUS);

      // Save to bug_reports metadata (denormalized, fast access)
      await tx.bugReports.updateExternalIntegration(bugReportId, externalId, externalUrl);

      logger.debug('Saved Jira ticket reference to both tables', {
        bugReportId,
        externalId,
        externalUrl,
      });
    });
  }
  /**
   * Test Jira connection for project (implements IntegrationService interface)
   */
  async testConnection(projectId: string): Promise<boolean> {
    const config = await this.configManager.getConfig(projectId);
    if (!config) {
      return false;
    }
    const result = await JiraConfigManager.validate(config);
    return result.valid;
  }

  /**
   * Validate configuration object (implements IntegrationService interface)
   */
  async validateConfig(
    config: Record<string, unknown>
  ): Promise<{ valid: boolean; error?: string; details?: Record<string, unknown> }> {
    return JiraConfigManager.validate(config as unknown as JiraConfig);
  }

  /**
   * Test Jira connection with provided configuration (legacy method)
   */
  async testConnectionWithConfig(config: JiraConfig): Promise<{ valid: boolean; error?: string }> {
    return JiraConfigManager.validate(config);
  }

  /**
   * Save Jira configuration for project
   */
  async saveConfiguration(projectId: string, config: JiraConfig): Promise<void> {
    await this.configManager.saveToDatabase(projectId, config);
  }

  /**
   * Get Jira configuration for project
   */
  async getConfiguration(projectId: string): Promise<JiraConfig | null> {
    return await this.configManager.getConfig(projectId);
  }

  /**
   * Delete Jira configuration for project
   */
  async deleteConfiguration(projectId: string): Promise<void> {
    await this.configManager.deleteFromDatabase(projectId);
  }

  /**
   * Enable/disable Jira integration for project
   */
  async setEnabled(projectId: string, enabled: boolean): Promise<void> {
    await this.configManager.setEnabled(projectId, enabled);
  }
}
