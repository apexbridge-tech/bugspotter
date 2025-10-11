/**
 * RetentionRepository Integration Tests
 * Tests retention repository methods against real PostgreSQL database
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createTestDatabase } from './setup.integration.js';
import type { DatabaseClient } from '../src/db/client.js';
import type { BugReportInsert, ProjectInsert, UserInsert } from '../src/db/types.js';

describe('RetentionRepository Integration Tests', () => {
  let db: DatabaseClient;
  let testProjectId: string;
  let testUserId: string;
  const createdBugReportIds: string[] = [];

  beforeAll(async () => {
    db = createTestDatabase();

    // Create test user
    const userData: UserInsert = {
      email: `retention-test-${Date.now()}@example.com`,
      password_hash: 'hash123',
      role: 'user',
    };
    const user = await db.users.create(userData);
    testUserId = user.id;

    // Create test project
    const projectData: ProjectInsert = {
      name: 'Retention Test Project',
      api_key: `test-retention-${Date.now()}`,
      created_by: testUserId,
    };
    const project = await db.projects.create(projectData);
    testProjectId = project.id;
  });

  afterAll(async () => {
    // Cleanup: Delete all created bug reports
    for (const reportId of createdBugReportIds) {
      try {
        await db.bugReports.delete(reportId);
      } catch {
        // Ignore if already deleted
      }
    }

    // Cleanup project and user
    if (testProjectId) {
      await db.projects.delete(testProjectId);
    }
    if (testUserId) {
      await db.users.delete(testUserId);
    }

    await db.close();
  });

  beforeEach(() => {
    createdBugReportIds.length = 0;
  });

  describe('findEligibleForDeletion()', () => {
    it('should find reports older than cutoff date', async () => {
      // Create an old report (100 days ago)
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Old Report',
        description: 'Should be deleted',
        priority: 'medium',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Manually update created_at to simulate old report
      await db.query('UPDATE bug_reports SET created_at = $1 WHERE id = $2', [oldDate, report.id]);

      // Find reports older than 90 days
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const eligible = await db.retention.findEligibleForDeletion(testProjectId, cutoffDate);

      expect(eligible.length).toBeGreaterThan(0);
      expect(eligible.some((r) => r.id === report.id)).toBe(true);
    });

    it('should not find reports with legal hold', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report with Legal Hold',
        description: 'Protected',
        priority: 'high',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Set legal hold
      await db.query('UPDATE bug_reports SET legal_hold = TRUE, created_at = $1 WHERE id = $2', [
        oldDate,
        report.id,
      ]);

      // Find eligible reports
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const eligible = await db.retention.findEligibleForDeletion(testProjectId, cutoffDate);

      expect(eligible.every((r) => r.id !== report.id)).toBe(true);
    });

    it('should not find already deleted reports', async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);

      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Deleted Report',
        description: 'Already deleted',
        priority: 'low',
        status: 'closed',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Mark as deleted
      await db.query(
        'UPDATE bug_reports SET deleted_at = CURRENT_TIMESTAMP, created_at = $1 WHERE id = $2',
        [oldDate, report.id]
      );

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - 90);

      const eligible = await db.retention.findEligibleForDeletion(testProjectId, cutoffDate);

      expect(eligible.every((r) => r.id !== report.id)).toBe(true);
    });
  });

  describe('softDeleteReports()', () => {
    it('should soft delete reports', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report to Soft Delete',
        description: 'Test',
        priority: 'medium',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      await db.retention.softDeleteReports([report.id], testUserId, 'retention_policy');

      const deleted = await db.bugReports.findById(report.id);
      expect(deleted?.deleted_at).toBeTruthy();
      expect(deleted?.deleted_by).toBe(testUserId);
    });

    it('should handle empty array', async () => {
      await expect(db.retention.softDeleteReports([], testUserId, 'manual')).resolves.not.toThrow();
    });

    it('should not delete reports with legal hold', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Protected Report',
        description: 'Has legal hold',
        priority: 'high',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Set legal hold
      await db.query('UPDATE bug_reports SET legal_hold = TRUE WHERE id = $1', [report.id]);

      await db.retention.softDeleteReports([report.id], testUserId, 'retention_policy');

      const notDeleted = await db.bugReports.findById(report.id);
      expect(notDeleted?.deleted_at).toBeNull();
    });
  });

  describe('archiveReports()', () => {
    it('should archive reports in transaction', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report to Archive',
        description: 'Test archiving',
        priority: 'medium',
        status: 'closed',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      await db.retention.archiveReports([report.id], testUserId);

      const archived = await db.bugReports.findById(report.id);
      expect(archived?.deleted_at).toBeTruthy();
      expect(archived?.deleted_by).toBe(testUserId);
    });

    it('should handle empty array', async () => {
      await expect(db.retention.archiveReports([], testUserId)).resolves.not.toThrow();
    });
  });

  describe('applyLegalHold()', () => {
    it('should apply legal hold to reports', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report for Legal Hold',
        description: 'Test legal hold',
        priority: 'high',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      await db.retention.applyLegalHold([report.id], 'litigation', testUserId);

      const result = await db.query<{ legal_hold: boolean; metadata: any }>(
        'SELECT legal_hold, metadata FROM bug_reports WHERE id = $1',
        [report.id]
      );

      expect(result.rows[0]?.legal_hold).toBe(true);
      expect(result.rows[0]?.metadata?.legal_hold).toBeTruthy();
    });

    it('should handle empty array', async () => {
      await expect(db.retention.applyLegalHold([], 'test', testUserId)).resolves.not.toThrow();
    });
  });

  describe('removeLegalHold()', () => {
    it('should remove legal hold from reports', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report with Legal Hold to Remove',
        description: 'Test removal',
        priority: 'medium',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Apply legal hold first
      await db.retention.applyLegalHold([report.id], 'test', testUserId);

      // Remove legal hold
      await db.retention.removeLegalHold([report.id]);

      const result = await db.query<{ legal_hold: boolean }>(
        'SELECT legal_hold FROM bug_reports WHERE id = $1',
        [report.id]
      );

      expect(result.rows[0]?.legal_hold).toBe(false);
    });

    it('should handle empty array', async () => {
      await expect(db.retention.removeLegalHold([])).resolves.not.toThrow();
    });
  });

  describe('countLegalHoldReports()', () => {
    it('should count reports on legal hold', async () => {
      const reportData1: BugReportInsert = {
        project_id: testProjectId,
        title: 'Legal Hold 1',
        description: 'Test',
        priority: 'high',
        status: 'open',
      };
      const reportData2: BugReportInsert = {
        project_id: testProjectId,
        title: 'Legal Hold 2',
        description: 'Test',
        priority: 'high',
        status: 'open',
      };

      const report1 = await db.bugReports.create(reportData1);
      const report2 = await db.bugReports.create(reportData2);
      createdBugReportIds.push(report1.id, report2.id);

      // Apply legal hold to both
      await db.retention.applyLegalHold([report1.id, report2.id], 'test', testUserId);

      const count = await db.retention.countLegalHoldReports();

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });

  describe('hardDeleteArchivedReports()', () => {
    it('should permanently delete archived reports', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report to Hard Delete',
        description: 'Will be permanently deleted',
        priority: 'low',
        status: 'closed',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // First archive it
      await db.retention.archiveReports([report.id], testUserId);

      // Check archive exists
      const archived = await db.query('SELECT id FROM archived_bug_reports WHERE id = $1', [
        report.id,
      ]);
      expect(archived.rows.length).toBe(1);

      // Hard delete from archive
      const deletedCount = await db.retention.hardDeleteArchivedReports([report.id]);

      expect(deletedCount).toBe(1);

      // Verify it's gone from archive
      const afterDelete = await db.query('SELECT id FROM archived_bug_reports WHERE id = $1', [
        report.id,
      ]);
      expect(afterDelete.rows.length).toBe(0);
    });

    it('should handle empty array', async () => {
      const count = await db.retention.hardDeleteArchivedReports([]);
      expect(count).toBe(0);
    });
  });

  describe('getStorageStats()', () => {
    it('should calculate storage statistics', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report with Data',
        description: 'Test storage calculation',
        priority: 'medium',
        status: 'open',
        metadata: { consoleLogs: ['log1', 'log2'], networkRequests: [] },
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      const stats = await db.retention.getStorageStats([report.id]);

      expect(stats.totalBytes).toBeGreaterThan(0);
    });

    it('should return zero for empty array', async () => {
      const stats = await db.retention.getStorageStats([]);
      expect(stats.totalBytes).toBe(0);
    });

    it('should sum multiple reports', async () => {
      const report1Data: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report 1',
        description: 'Data',
        priority: 'high',
        status: 'open',
        metadata: { consoleLogs: ['log1'] },
      };
      const report2Data: BugReportInsert = {
        project_id: testProjectId,
        title: 'Report 2',
        description: 'More data',
        priority: 'medium',
        status: 'open',
        metadata: { consoleLogs: ['log1', 'log2', 'log3'] },
      };

      const report1 = await db.bugReports.create(report1Data);
      const report2 = await db.bugReports.create(report2Data);
      createdBugReportIds.push(report1.id, report2.id);

      const stats = await db.retention.getStorageStats([report1.id, report2.id]);

      expect(stats.totalBytes).toBeGreaterThan(0);
    });
  });

  describe('Transaction Handling', () => {
    it('should rollback archive on error', async () => {
      const reportData: BugReportInsert = {
        project_id: testProjectId,
        title: 'Transaction Test',
        description: 'Test rollback',
        priority: 'medium',
        status: 'open',
      };
      const report = await db.bugReports.create(reportData);
      createdBugReportIds.push(report.id);

      // Try to archive with invalid data (should rollback)
      try {
        await db.retention.archiveReports(['invalid-uuid'], testUserId);
      } catch {
        // Expected to fail
      }

      // Original report should still be undeleted
      const notArchived = await db.bugReports.findById(report.id);
      expect(notArchived?.deleted_at).toBeNull();
    });
  });
});
