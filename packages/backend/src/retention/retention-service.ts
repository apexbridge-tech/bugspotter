/**
 * Retention Service
 * Manages data retention policies and lifecycle operations
 */

import type { Pool } from 'pg';
import crypto from 'crypto';
import { getLogger } from '../logger.js';
import type { DatabaseClient } from '../db/client.js';
import type { BaseStorageService } from '../storage/base-storage-service.js';
import type {
  RetentionResult,
  RetentionPreview,
  DeletionCertificate,
  RetentionAuditLog,
  BatchOperationOptions,
  StorageCleanupResult,
  DeletionReason,
  ProjectRetentionSettings,
  DataClassification,
  ComplianceRegion,
} from './types.js';
import type { BugReport, ArchivedBugReport, Project } from '../db/types.js';
import {
  DEFAULT_BATCH_SIZE,
  MAX_BATCH_SIZE,
  DEFAULT_MAX_ERROR_RATE,
  DEFAULT_BATCH_DELAY_MS,
  calculateCutoffDate,
} from './retention-config.js';

const logger = getLogger();

/**
 * RetentionService - Orchestrates data retention and lifecycle management
 */
export class RetentionService {
  constructor(
    private db: DatabaseClient,
    private pool: Pool,
    private storage: BaseStorageService
  ) {}

  /**
   * Apply retention policies across all projects
   * Main orchestrator method - runs daily via scheduler
   */
  async applyRetentionPolicies(options?: BatchOperationOptions): Promise<RetentionResult> {
    const startedAt = new Date();
    const result: RetentionResult = {
      totalDeleted: 0,
      totalArchived: 0,
      storageFreed: 0,
      screenshotsDeleted: 0,
      replaysDeleted: 0,
      projectsProcessed: 0,
      errors: [],
      durationMs: 0,
      startedAt,
      completedAt: new Date(),
    };

    const dryRun = options?.dryRun ?? false;
    const batchSize = Math.min(options?.batchSize ?? DEFAULT_BATCH_SIZE, MAX_BATCH_SIZE);
    const maxErrorRate = options?.maxErrorRate ?? DEFAULT_MAX_ERROR_RATE;
    const delayMs = options?.delayMs ?? DEFAULT_BATCH_DELAY_MS;

    logger.info('Starting retention policy application', {
      dryRun,
      batchSize,
      maxErrorRate,
    });

    try {
      // Get all projects
      const projects = await this.db.projects.findAll();

      for (const project of projects) {
        try {
          const projectResult = await this.applyProjectRetentionPolicy(project, {
            ...options,
            batchSize,
            dryRun,
          });

          result.totalDeleted += projectResult.reportsDeleted;
          result.totalArchived += projectResult.reportsArchived;
          result.storageFreed += projectResult.storageFreed;
          result.screenshotsDeleted += projectResult.screenshotsDeleted;
          result.replaysDeleted += projectResult.replaysDeleted;
          result.projectsProcessed++;

          // Check error rate and stop if exceeded
          const errorRate = (result.errors.length / result.totalDeleted) * 100;
          if (errorRate > maxErrorRate && result.totalDeleted > 10) {
            logger.error('Error rate exceeded maximum threshold', {
              errorRate,
              maxErrorRate,
              errors: result.errors.length,
            });
            break;
          }

          // Delay between projects if configured
          if (delayMs > 0) {
            await this.delay(delayMs);
          }
        } catch (error) {
          logger.error('Error processing project retention', {
            projectId: project.id,
            error: error instanceof Error ? error.message : String(error),
          });
          result.errors.push({
            projectId: project.id,
            error: error instanceof Error ? error.message : String(error),
            timestamp: new Date(),
          });
        }
      }

      result.completedAt = new Date();
      result.durationMs = result.completedAt.getTime() - startedAt.getTime();

      logger.info('Retention policy application completed', {
        ...result,
        dryRun,
      });

      return result;
    } catch (error) {
      logger.error('Fatal error during retention policy application', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Apply retention policy for a single project
   */
  private async applyProjectRetentionPolicy(
    project: Project,
    options?: BatchOperationOptions
  ): Promise<{
    reportsDeleted: number;
    reportsArchived: number;
    storageFreed: number;
    screenshotsDeleted: number;
    replaysDeleted: number;
  }> {
    const settings = project.settings as unknown as ProjectRetentionSettings;
    const retentionPolicy = settings?.retention;

    if (!retentionPolicy) {
      logger.debug('No retention policy configured for project', {
        projectId: project.id,
      });
      return {
        reportsDeleted: 0,
        reportsArchived: 0,
        storageFreed: 0,
        screenshotsDeleted: 0,
        replaysDeleted: 0,
      };
    }

    const cutoffDate = calculateCutoffDate(retentionPolicy.bugReportRetentionDays);
    const dryRun = options?.dryRun ?? false;

    logger.info('Applying retention policy for project', {
      projectId: project.id,
      retentionDays: retentionPolicy.bugReportRetentionDays,
      cutoffDate,
      dryRun,
    });

    // Find reports older than cutoff date (excluding those on legal hold)
    const oldReports = await this.findReportsForDeletion(project.id, cutoffDate);

    if (oldReports.length === 0) {
      return {
        reportsDeleted: 0,
        reportsArchived: 0,
        storageFreed: 0,
        screenshotsDeleted: 0,
        replaysDeleted: 0,
      };
    }

    let storageFreed = 0;
    let screenshotsDeleted = 0;
    let replaysDeleted = 0;
    let reportsArchived = 0;

    if (!dryRun) {
      // Archive reports if configured
      if (retentionPolicy.archiveBeforeDelete) {
        await this.archiveReports(oldReports, 'retention_policy');
        reportsArchived = oldReports.length;
      }

      // Delete storage files
      for (const report of oldReports) {
        const cleanup = await this.deleteReportStorage(report);
        storageFreed += cleanup.bytesFreed;
        if (report.screenshot_url) {
          screenshotsDeleted++;
        }
        if (report.replay_url) {
          replaysDeleted++;
        }
      }

      // Soft delete reports
      const reportIds = oldReports.map((r) => r.id);
      await this.softDeleteReports(reportIds, null, 'retention_policy');

      // Audit log
      await this.createAuditLog({
        action: 'soft_delete',
        projectId: project.id,
        bugReportIds: reportIds,
        reason: 'retention_policy',
        userId: null,
        metadata: {
          retentionDays: retentionPolicy.bugReportRetentionDays,
          storageFreed,
        },
        timestamp: new Date(),
      });
    }

    return {
      reportsDeleted: oldReports.length,
      reportsArchived,
      storageFreed,
      screenshotsDeleted,
      replaysDeleted,
    };
  }

  /**
   * Find bug reports eligible for deletion
   */
  private async findReportsForDeletion(projectId: string, cutoffDate: Date): Promise<BugReport[]> {
    const query = `
      SELECT * FROM bug_reports
      WHERE project_id = $1
        AND created_at < $2
        AND deleted_at IS NULL
        AND legal_hold = FALSE
      ORDER BY created_at ASC
    `;

    const result = await this.pool.query<BugReport>(query, [projectId, cutoffDate]);
    return result.rows;
  }

  /**
   * Soft delete bug reports
   */
  private async softDeleteReports(
    reportIds: string[],
    userId: string | null,
    reason: DeletionReason
  ): Promise<void> {
    if (reportIds.length === 0) {
      return;
    }

    const query = `
      UPDATE bug_reports
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
      WHERE id = ANY($2)
        AND deleted_at IS NULL
        AND legal_hold = FALSE
    `;

    await this.pool.query(query, [userId, reportIds]);
    logger.info('Soft deleted bug reports', {
      count: reportIds.length,
      reason,
      userId,
    });
  }

  /**
   * Hard delete bug reports (permanent deletion)
   */
  async hardDeleteReports(
    reportIds: string[],
    userId: string | null,
    generateCertificate = true
  ): Promise<DeletionCertificate | null> {
    if (reportIds.length === 0) {
      return null;
    }

    const client = await this.pool.connect();
    let certificate: DeletionCertificate | null = null;

    try {
      await client.query('BEGIN');

      // Get report details before deletion
      const reportsQuery = `
        SELECT id, project_id FROM bug_reports
        WHERE id = ANY($1)
        AND legal_hold = FALSE
      `;
      const reportsResult = await client.query<BugReport>(reportsQuery, [reportIds]);
      const reports = reportsResult.rows;

      if (reports.length === 0) {
        await client.query('ROLLBACK');
        return null;
      }

      // Delete from database
      await client.query('DELETE FROM bug_reports WHERE id = ANY($1)', [reportIds]);

      await client.query('COMMIT');

      // Generate deletion certificate if required
      if (generateCertificate && reports.length > 0) {
        certificate = this.generateDeletionCertificate(
          reports[0].project_id,
          reports.map((r) => r.id),
          userId,
          'manual'
        );
      }

      logger.info('Hard deleted bug reports', {
        count: reports.length,
        userId,
        certificateGenerated: !!certificate,
      });

      return certificate;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Error hard deleting bug reports', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Archive bug reports to long-term storage
   */
  async archiveReports(reports: BugReport[], reason: DeletionReason): Promise<ArchivedBugReport[]> {
    if (reports.length === 0) {
      return [];
    }

    const archived: ArchivedBugReport[] = [];

    for (const report of reports) {
      const archivedReport: Omit<ArchivedBugReport, 'archived_at'> = {
        id: report.id,
        project_id: report.project_id,
        title: report.title,
        description: report.description,
        screenshot_url: report.screenshot_url,
        replay_url: report.replay_url,
        metadata: report.metadata,
        status: report.status,
        priority: report.priority,
        original_created_at: report.created_at,
        original_updated_at: report.updated_at,
        deleted_at: report.deleted_at ?? new Date(),
        deleted_by: report.deleted_by,
        archived_reason: reason,
      };

      const query = `
        INSERT INTO archived_bug_reports (
          id, project_id, title, description, screenshot_url, replay_url,
          metadata, status, priority, original_created_at, original_updated_at,
          deleted_at, deleted_by, archived_reason
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id) DO NOTHING
        RETURNING *
      `;

      const values = [
        archivedReport.id,
        archivedReport.project_id,
        archivedReport.title,
        archivedReport.description,
        archivedReport.screenshot_url,
        archivedReport.replay_url,
        JSON.stringify(archivedReport.metadata),
        archivedReport.status,
        archivedReport.priority,
        archivedReport.original_created_at,
        archivedReport.original_updated_at,
        archivedReport.deleted_at,
        archivedReport.deleted_by,
        archivedReport.archived_reason,
      ];

      const result = await this.pool.query<ArchivedBugReport>(query, values);
      if (result.rows.length > 0) {
        archived.push(result.rows[0]);
      }
    }

    logger.info('Archived bug reports', {
      count: archived.length,
      reason,
    });

    return archived;
  }

  /**
   * Restore soft-deleted bug reports
   */
  async restoreReports(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      UPDATE bug_reports
      SET deleted_at = NULL,
          deleted_by = NULL
      WHERE id = ANY($1)
        AND deleted_at IS NOT NULL
    `;

    const result = await this.pool.query(query, [reportIds]);
    const restoredCount = result.rowCount ?? 0;

    logger.info('Restored bug reports', { count: restoredCount });

    return restoredCount;
  }

  /**
   * Delete storage files for a bug report
   */
  private async deleteReportStorage(report: BugReport): Promise<StorageCleanupResult> {
    const result: StorageCleanupResult = {
      filesDeleted: 0,
      bytesFreed: 0,
      errors: [],
    };

    const filesToDelete: string[] = [];

    if (report.screenshot_url) {
      filesToDelete.push(report.screenshot_url);
    }
    if (report.replay_url) {
      filesToDelete.push(report.replay_url);
    }

    for (const url of filesToDelete) {
      try {
        // Extract storage key from URL
        const key = this.extractStorageKey(url);

        // Get file size before deletion
        const size = await this.getFileSize(key);

        // Delete from storage
        await this.storage.deleteObject(key);

        result.filesDeleted++;
        result.bytesFreed += size;
      } catch (error) {
        result.errors.push({
          key: url,
          error: error instanceof Error ? error.message : String(error),
        });
        logger.error('Error deleting storage file', {
          url,
          reportId: report.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Extract storage key from URL
   */
  private extractStorageKey(url: string): string {
    try {
      const urlObj = new URL(url);
      return urlObj.pathname.substring(1); // Remove leading slash
    } catch {
      // If not a valid URL, assume it's already a key
      return url;
    }
  }

  /**
   * Get file size from storage
   * Uses storage backend's headObject method (S3 HeadObjectCommand or fs.stat for local)
   */
  private async getFileSize(key: string): Promise<number> {
    try {
      const object = await this.storage.headObject(key);
      return object?.size ?? 0;
    } catch (error) {
      logger.debug('Failed to get file size', {
        key,
        error: error instanceof Error ? error.message : String(error),
      });
      return 0;
    }
  }

  /**
   * Generate deletion certificate for compliance and audit purposes
   * Required by various regulatory frameworks (GDPR, Kazakhstan law, etc.)
   */
  private generateDeletionCertificate(
    projectId: string,
    reportIds: string[],
    userId: string | null,
    reason: DeletionReason,
    dataClassification: DataClassification = 'general',
    complianceRegion: ComplianceRegion = 'none'
  ): DeletionCertificate {
    const certificateId = crypto.randomUUID();
    const deletedAt = new Date();

    // Generate verification hash for integrity
    const hashData = JSON.stringify({
      certificateId,
      projectId,
      reportIds: reportIds.sort(),
      deletedAt: deletedAt.toISOString(),
      complianceRegion,
    });
    const verificationHash = crypto.createHash('sha256').update(hashData).digest('hex');

    return {
      certificateId,
      projectId,
      reportIds,
      deletedAt,
      deletedBy: userId ?? 'system',
      reason,
      dataClassification,
      complianceRegion,
      verificationHash,
      issuedAt: new Date(),
    };
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(log: Omit<RetentionAuditLog, 'id'>): Promise<void> {
    const query = `
      INSERT INTO audit_logs (action, resource, resource_id, user_id, details, timestamp)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    const values = [
      log.action,
      'bug_report',
      log.projectId,
      log.userId,
      JSON.stringify({
        bugReportIds: log.bugReportIds,
        reason: log.reason,
        ...log.metadata,
      }),
      log.timestamp,
    ];

    await this.pool.query(query, values);
  }

  /**
   * Preview retention policy (dry-run)
   */
  async previewRetentionPolicy(projectId?: string): Promise<RetentionPreview> {
    const preview: RetentionPreview = {
      affectedProjects: [],
      totalReports: 0,
      totalStorageBytes: 0,
      legalHoldCount: 0,
    };

    const projects = projectId
      ? [await this.db.projects.findById(projectId)]
      : await this.db.projects.findAll();

    for (const project of projects) {
      if (!project) {
        continue;
      }

      const settings = project.settings as unknown as ProjectRetentionSettings;
      const retentionPolicy = settings?.retention;

      if (!retentionPolicy) {
        continue;
      }

      const cutoffDate = calculateCutoffDate(retentionPolicy.bugReportRetentionDays);
      const reports = await this.findReportsForDeletion(project.id, cutoffDate);

      if (reports.length > 0) {
        const estimatedStorage = reports.reduce((sum, r) => {
          // Estimate 100KB per screenshot, 500KB per replay
          let size = 0;
          if (r.screenshot_url) {
            size += 100 * 1024;
          }
          if (r.replay_url) {
            size += 500 * 1024;
          }
          return sum + size;
        }, 0);

        preview.affectedProjects.push({
          projectId: project.id,
          projectName: project.name,
          reportsToDelete: reports.length,
          estimatedStorageFreed: estimatedStorage,
          oldestReportDate: reports[0].created_at,
        });

        preview.totalReports += reports.length;
        preview.totalStorageBytes += estimatedStorage;
      }
    }

    // Count legal hold reports
    const legalHoldQuery = 'SELECT COUNT(*) FROM bug_reports WHERE legal_hold = TRUE';
    const legalHoldResult = await this.pool.query<{ count: string }>(legalHoldQuery);
    preview.legalHoldCount = parseInt(legalHoldResult.rows[0].count, 10);

    return preview;
  }

  /**
   * Apply or remove legal hold on bug reports
   */
  async setLegalHold(reportIds: string[], hold: boolean, userId: string): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      UPDATE bug_reports
      SET legal_hold = $1
      WHERE id = ANY($2)
    `;

    const result = await this.pool.query(query, [hold, reportIds]);
    const updatedCount = result.rowCount ?? 0;

    await this.createAuditLog({
      action: hold ? 'legal_hold_applied' : 'legal_hold_released',
      projectId: '', // Will be fetched if needed
      bugReportIds: reportIds,
      reason: 'manual',
      userId,
      metadata: {},
      timestamp: new Date(),
    });

    logger.info(`Legal hold ${hold ? 'applied' : 'released'}`, {
      count: updatedCount,
      userId,
    });

    return updatedCount;
  }

  /**
   * Utility method to delay execution
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
