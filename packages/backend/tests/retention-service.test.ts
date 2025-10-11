/**
 * Simple unit tests for RetentionService
 * Tests core orchestration logic with mocked dependencies
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RetentionService } from '../src/retention/retention-service.js';
import type { DatabaseClient } from '../src/db/client.js';
import type { Pool } from 'pg';

describe('RetentionService', () => {
  let service: RetentionService;
  let mockDb: DatabaseClient;
  let mockPool: Pool;
  let mockStorage: any;

  beforeEach(() => {
    // Mock database client with all required repos
    mockDb = {
      projects: {
        findAll: vi.fn(),
      },
      bugReports: {
        softDelete: vi.fn(),
        hardDelete: vi.fn(),
        restore: vi.fn(),
      },
      sessions: {
        findByBugReport: vi.fn(),
        deleteByIds: vi.fn(),
      },
      close: vi.fn(),
    } as any;

    // Mock pool
    mockPool = {
      query: vi.fn(),
      connect: vi.fn(),
      end: vi.fn(),
    } as any;

    // Mock storage
    mockStorage = {
      deleteScreenshot: vi.fn(),
      deleteSessionReplay: vi.fn(),
    };

    service = new RetentionService(mockDb, mockPool, mockStorage);
  });

  describe('applyRetentionPolicies()', () => {
    it('should process projects and return summary', async () => {
      // Mock projects
      vi.mocked(mockDb.projects.findAll).mockResolvedValue([
        {
          id: 'project-1',
          name: 'Test Project',
          compliance_region: 'us',
          data_classification: 'standard',
          retention_days: 90,
        },
      ] as any);

      const result = await service.applyRetentionPolicies();

      expect(result.projectsProcessed).toBe(1);
      expect(result.totalDeleted).toBeGreaterThanOrEqual(0);
      expect(result.errors).toEqual([]);
      expect(mockDb.projects.findAll).toHaveBeenCalled();
    });

    it('should handle empty project list', async () => {
      vi.mocked(mockDb.projects.findAll).mockResolvedValue([]);

      const result = await service.applyRetentionPolicies();

      expect(result.projectsProcessed).toBe(0);
      expect(result.totalDeleted).toBe(0);
      expect(result.errors).toEqual([]);
    });

    it('should respect dry-run mode', async () => {
      vi.mocked(mockDb.projects.findAll).mockResolvedValue([
        {
          id: 'project-1',
          name: 'Test Project',
          compliance_region: 'us',
          data_classification: 'standard',
          retention_days: 90,
        },
      ] as any);

      const result = await service.applyRetentionPolicies({ dryRun: true });

      expect(result.projectsProcessed).toBe(1);
      // In dry-run, no actual deletions occur
      expect(mockDb.bugReports.softDelete).not.toHaveBeenCalled();
    });

    it('should respect batch size', async () => {
      vi.mocked(mockDb.projects.findAll).mockResolvedValue([
        {
          id: 'project-1',
          compliance_region: 'us',
          data_classification: 'standard',
          retention_days: 90,
        },
      ] as any);

      await service.applyRetentionPolicies({ batchSize: 50 });

      expect(mockDb.projects.findAll).toHaveBeenCalled();
    });
  });

  describe('hardDeleteReports()', () => {
    it('should delete reports and return certificate', async () => {
      const reportIds = ['report-1', 'report-2'];
      const mockClient = {
        query: vi
          .fn()
          .mockResolvedValueOnce(undefined) // BEGIN
          .mockResolvedValueOnce({ rows: [{ id: 'report-1', project_id: 'proj-1' }] }) // SELECT
          .mockResolvedValueOnce({ rowCount: 1 }) // DELETE
          .mockResolvedValueOnce(undefined), // COMMIT
        release: vi.fn(),
      };
      vi.mocked(mockPool.connect).mockResolvedValue(mockClient as any);

      const certificate = await service.hardDeleteReports(reportIds, 'user-1');

      expect(certificate).toBeTruthy();
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    });

    it('should handle empty array', async () => {
      const certificate = await service.hardDeleteReports([], 'user-1');

      expect(certificate).toBeNull();
      expect(mockPool.connect).not.toHaveBeenCalled();
    });
  });

  describe('restoreReports()', () => {
    it('should restore deleted reports', async () => {
      const reportIds = ['report-1', 'report-2'];
      vi.mocked(mockPool.query).mockResolvedValue({ rowCount: 2 } as any);

      const count = await service.restoreReports(reportIds);

      expect(count).toBe(2);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });

  describe('setLegalHold()', () => {
    it('should set legal hold flag', async () => {
      const reportIds = ['report-1'];
      vi.mocked(mockPool.query).mockResolvedValue({ rowCount: 1 } as any);

      const count = await service.setLegalHold(reportIds, true, 'user-1');

      expect(count).toBe(1);
      expect(mockPool.query).toHaveBeenCalled();
    });

    it('should remove legal hold flag', async () => {
      const reportIds = ['report-1'];
      vi.mocked(mockPool.query).mockResolvedValue({ rowCount: 1 } as any);

      const count = await service.setLegalHold(reportIds, false, 'user-1');

      expect(count).toBe(1);
      expect(mockPool.query).toHaveBeenCalled();
    });
  });
});
