/**
 * Retention Repository
 * Handles data retention and lifecycle queries
 */

import type { Pool, PoolClient } from 'pg';
import type { BugReport } from './types.js';
import type { DeletionReason } from '../retention/types.js';

export class RetentionRepository {
  constructor(private readonly pool: Pool | PoolClient) {}

  /**
   * Find bug reports eligible for deletion based on retention policy
   */
  async findEligibleForDeletion(projectId: string, cutoffDate: Date): Promise<BugReport[]> {
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
  async softDeleteReports(
    reportIds: string[],
    userId: string | null,
    _reason: DeletionReason
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
  }

  /**
   * Archive bug reports before deletion (for compliance)
   */
  async archiveReports(reportIds: string[], userId: string | null): Promise<void> {
    if (reportIds.length === 0) {
      return;
    }

    // Check if pool is actually a Pool (has connect method) or already a PoolClient
    const isPool = 'connect' in this.pool;
    const client = isPool ? await (this.pool as Pool).connect() : (this.pool as PoolClient);
    const shouldManageTransaction = isPool;

    try {
      if (shouldManageTransaction) {
        await client.query('BEGIN');
      }

      // Copy to archive table
      const archiveQuery = `
        INSERT INTO archived_bug_reports (id, project_id, title, description, screenshot_url, replay_url, metadata, status, priority, original_created_at, original_updated_at, deleted_at, deleted_by, archived_at, archived_reason)
        SELECT id, project_id, title, description, screenshot_url, replay_url, metadata, status, priority, created_at, updated_at, CURRENT_TIMESTAMP, $1, CURRENT_TIMESTAMP, 'retention_policy'
        FROM bug_reports
        WHERE id = ANY($2)
      `;
      await client.query(archiveQuery, [userId, reportIds]);

      // Mark as archived
      const updateQuery = `
        UPDATE bug_reports
        SET deleted_at = CURRENT_TIMESTAMP,
            deleted_by = $1
        WHERE id = ANY($2)
      `;
      await client.query(updateQuery, [userId, reportIds]);

      if (shouldManageTransaction) {
        await client.query('COMMIT');
      }
    } catch (error) {
      if (shouldManageTransaction) {
        await client.query('ROLLBACK');
      }
      throw error;
    } finally {
      if (isPool) {
        client.release();
      }
    }
  }

  /**
   * Restore archived reports
   */
  async restoreArchivedReports(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      DELETE FROM archived_bug_reports
      WHERE id = ANY($1)
    `;

    const result = await this.pool.query(query, [reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Hard delete archived reports (permanent deletion)
   */
  async hardDeleteArchivedReports(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      DELETE FROM archived_bug_reports
      WHERE id = ANY($1)
    `;

    const result = await this.pool.query(query, [reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Apply legal hold to reports
   */
  async applyLegalHold(reportIds: string[], reason: string, appliedBy: string): Promise<void> {
    if (reportIds.length === 0) {
      return;
    }

    const holdMetadata = {
      appliedAt: new Date().toISOString(),
      appliedBy,
      reason,
    };

    const query = `
      UPDATE bug_reports
      SET legal_hold = TRUE,
          metadata = metadata || $1::jsonb
      WHERE id = ANY($2)
    `;

    await this.pool.query(query, [JSON.stringify({ legal_hold: holdMetadata }), reportIds]);
  }

  /**
   * Remove legal hold from reports
   */
  async removeLegalHold(reportIds: string[]): Promise<void> {
    if (reportIds.length === 0) {
      return;
    }

    const query = `
      UPDATE bug_reports
      SET legal_hold = FALSE,
          metadata = metadata - 'legal_hold'
      WHERE id = ANY($1)
    `;

    await this.pool.query(query, [reportIds]);
  }

  /**
   * Count reports on legal hold
   */
  async countLegalHoldReports(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM bug_reports
      WHERE legal_hold = TRUE
        AND deleted_at IS NULL
    `;

    const result = await this.pool.query<{ count: string }>(query);
    return parseInt(result.rows[0]?.count ?? '0', 10);
  }

  /**
   * Get storage statistics for reports
   */
  async getStorageStats(reportIds: string[]): Promise<{ totalBytes: number }> {
    if (reportIds.length === 0) {
      return { totalBytes: 0 };
    }

    const query = `
      SELECT COALESCE(SUM(
        COALESCE(octet_length(metadata::text), 0) +
        COALESCE(octet_length(description), 0) +
        COALESCE(octet_length(screenshot_url), 0) +
        COALESCE(octet_length(replay_url), 0)
      ), 0)::bigint as total_bytes
      FROM bug_reports
      WHERE id = ANY($1)
    `;

    const result = await this.pool.query<{ total_bytes: string }>(query, [reportIds]);
    return { totalBytes: parseInt(result.rows[0]?.total_bytes ?? '0', 10) };
  }

  /**
   * Hard delete reports within a transaction
   * Returns report details for certificate generation
   */
  async hardDeleteReportsInTransaction(
    reportIds: string[]
  ): Promise<Array<{ id: string; project_id: string }>> {
    if (reportIds.length === 0) {
      return [];
    }

    // Check if we're using a PoolClient (in transaction) or Pool
    const isPoolClient = 'release' in this.pool;

    if (!isPoolClient) {
      throw new Error('hardDeleteReportsInTransaction must be called within a transaction context');
    }

    // Get report details before deletion
    const reportsQuery = `
      SELECT id, project_id FROM bug_reports
      WHERE id = ANY($1)
      AND legal_hold = FALSE
    `;
    const reportsResult = await this.pool.query<{ id: string; project_id: string }>(reportsQuery, [
      reportIds,
    ]);
    const reports = reportsResult.rows;

    if (reports.length === 0) {
      return [];
    }

    // Delete from database
    await this.pool.query('DELETE FROM bug_reports WHERE id = ANY($1)', [reportIds]);

    return reports;
  }
}
