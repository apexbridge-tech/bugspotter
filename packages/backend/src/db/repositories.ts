/**
 * Entity Repositories
 * Specific repository implementations for each entity type
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import {
  MAX_BATCH_SIZE,
  DEFAULT_BATCH_SIZE,
  MIN_BATCH_SIZE,
  DEFAULT_PAGE,
  DEFAULT_PAGE_SIZE,
  SINGLE_ROW_LIMIT,
  DECIMAL_BASE,
} from './constants.js';
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
  ProjectMember,
  ProjectMemberInsert,
  BugReport,
  BugReportInsert,
  BugReportUpdate,
  BugReportFilters,
  BugReportSortOptions,
  PaginatedResult,
  PaginationOptions,
  User,
  UserInsert,
  Session,
  Ticket,
} from './types.js';
import {
  buildWhereClause,
  buildOrderByClause,
  buildPaginationClause,
  serializeJsonField,
} from './query-builder.js';

/**
 * Project Repository
 */
export class ProjectRepository extends BaseRepository<Project, ProjectInsert, ProjectUpdate> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'projects', ['settings']);
  }

  /**
   * Find project by API key (for authentication)
   */
  async findByApiKey(apiKey: string): Promise<Project | null> {
    return this.findBy('api_key', apiKey);
  }

  /**
   * Check if user has access to project
   * Returns true if user is the owner, an admin, or member of the project
   */
  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM projects p
      WHERE p.id = $1
        AND (
          p.created_by = $2
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = $2
          )
        )
      LIMIT ${SINGLE_ROW_LIMIT}
    `;

    const result = await this.getClient().query(query, [projectId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get user's role in project
   * Returns 'owner', 'admin', 'member', 'viewer', or null if no access
   */
  async getUserRole(projectId: string, userId: string): Promise<string | null> {
    // Check if owner
    const ownerQuery = `
      SELECT 'owner' as role FROM projects
      WHERE id = $1 AND created_by = $2
      LIMIT ${SINGLE_ROW_LIMIT}
    `;
    const ownerResult = await this.getClient().query(ownerQuery, [projectId, userId]);
    if (ownerResult.rows.length > 0) {
      return 'owner';
    }

    // Check project membership
    const memberQuery = `
      SELECT role FROM project_members
      WHERE project_id = $1 AND user_id = $2
      LIMIT ${SINGLE_ROW_LIMIT}
    `;
    const memberResult = await this.getClient().query(memberQuery, [projectId, userId]);
    if (memberResult.rows.length > 0) {
      return memberResult.rows[0].role;
    }

    return null;
  }

  /**
   * Find all projects (for retention service)
   */
  async findAll(): Promise<Project[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
    const result = await this.getClient().query(query);
    return this.deserializeMany(result.rows);
  }
}

/**
 * Bug Report Repository
 */
export class BugReportRepository extends BaseRepository<
  BugReport,
  BugReportInsert,
  BugReportUpdate
> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'bug_reports', ['metadata']);
  }

  /**
   * Override serialization to handle defaults
   */
  protected serializeForInsert(data: BugReportInsert): Record<string, unknown> {
    return {
      project_id: data.project_id,
      title: data.title,
      description: data.description ?? null,
      screenshot_url: data.screenshot_url ?? null,
      replay_url: data.replay_url ?? null,
      metadata: serializeJsonField(data.metadata),
      status: data.status ?? 'open',
      priority: data.priority ?? 'medium',
      deleted_at: data.deleted_at ?? null,
      deleted_by: data.deleted_by ?? null,
      legal_hold: data.legal_hold ?? false,
    };
  }

  /**
   * Create multiple bug reports in batch (single query, much faster)
   * @param dataArray - Array of bug reports to create
   * @throws Error if array exceeds maximum batch size (1000)
   * @throws Error if array contains invalid data
   */
  async createBatch(dataArray: BugReportInsert[]): Promise<BugReport[]> {
    if (dataArray.length === 0) {
      return [];
    }

    // Validate batch size to prevent DoS and PostgreSQL parameter limit
    if (dataArray.length > MAX_BATCH_SIZE) {
      throw new Error(
        `Batch size ${dataArray.length} exceeds maximum allowed (${MAX_BATCH_SIZE}). ` +
          `Split into smaller batches.`
      );
    }

    // Serialize all data first
    const serializedData = dataArray.map((data) => {
      return this.serializeForInsert(data);
    });

    // Use first row to determine columns (all rows must have same structure)
    const columns = Object.keys(serializedData[0]);
    const columnCount = columns.length;

    // Validate that we have columns
    if (columnCount === 0) {
      throw new Error('Cannot create batch: serialized data has no columns');
    }

    // Validate all column names to prevent SQL injection
    columns.forEach((col) => {
      if (!/^[a-zA-Z0-9_]+$/.test(col)) {
        throw new Error(`Invalid SQL identifier: ${col}`);
      }
    });

    // Build VALUES placeholders and collect all values
    const valuesPlaceholders: string[] = [];
    const allValues: unknown[] = [];
    let paramCount = 1;

    for (const data of serializedData) {
      const rowPlaceholders = Array.from({ length: columnCount }, () => {
        return `$${paramCount++}`;
      });
      valuesPlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      allValues.push(
        ...columns.map((col) => {
          return data[col];
        })
      );
    }

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES ${valuesPlaceholders.join(', ')}
      RETURNING *
    `;

    const result = await this.getClient().query(query, allValues);
    return this.deserializeMany(result.rows);
  }

  /**
   * Create bug reports in batches, automatically splitting large arrays
   * @param dataArray - Array of bug reports to create (any size)
   * @param batchSize - Size of each batch (default: 500, max: 1000)
   * @returns Array of all created bug reports
   * @example
   * // Create 5000 reports in batches of 500
   * const reports = await repo.createBatchAuto(hugeArray);
   */
  async createBatchAuto(
    dataArray: BugReportInsert[],
    batchSize: number = DEFAULT_BATCH_SIZE
  ): Promise<BugReport[]> {
    if (dataArray.length === 0) {
      return [];
    }

    // Validate batch size
    if (batchSize < MIN_BATCH_SIZE || batchSize > MAX_BATCH_SIZE) {
      throw new Error(
        `Batch size must be between ${MIN_BATCH_SIZE} and ${MAX_BATCH_SIZE}, got ${batchSize}`
      );
    }

    // If array fits in one batch, use regular createBatch
    if (dataArray.length <= batchSize) {
      return this.createBatch(dataArray);
    }

    // Split into chunks and process sequentially
    const results: BugReport[] = [];
    for (let i = 0; i < dataArray.length; i += batchSize) {
      const chunk = dataArray.slice(i, i + batchSize);
      const chunkResults = await this.createBatch(chunk);
      results.push(...chunkResults);
    }

    return results;
  }

  /**
   * Find bug reports older than cutoff date (for retention)
   * Excludes soft-deleted reports and those on legal hold
   */
  async findForRetention(
    projectId: string,
    cutoffDate: Date,
    includeDeleted = false
  ): Promise<BugReport[]> {
    const deletedClause = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE project_id = $1
        AND created_at < $2
        ${deletedClause}
        AND legal_hold = FALSE
      ORDER BY created_at ASC
    `;

    const result = await this.getClient().query<BugReport>(query, [projectId, cutoffDate]);
    return this.deserializeMany(result.rows);
  }

  /**
   * Soft delete bug reports
   */
  async softDelete(reportIds: string[], userId: string | null = null): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = CURRENT_TIMESTAMP,
          deleted_by = $1
      WHERE id = ANY($2)
        AND deleted_at IS NULL
        AND legal_hold = FALSE
    `;

    const result = await this.getClient().query(query, [userId, reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Update bug report metadata with thumbnail URL
   * Used by Screenshot worker after processing
   */
  async updateThumbnailUrl(bugReportId: string, thumbnailUrl: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{thumbnailUrl}',
        $1::jsonb,
        true
      )
      WHERE id = $2
    `;

    await this.getClient().query(query, [JSON.stringify(thumbnailUrl), bugReportId]);
  }

  /**
   * Update bug report metadata with replay manifest URL
   * Used by Replay worker after processing chunks
   */
  async updateReplayManifestUrl(bugReportId: string, manifestUrl: string): Promise<void> {
    const query = `
      UPDATE ${this.tableName}
      SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{replayManifestUrl}',
        $1::jsonb,
        true
      )
      WHERE id = $2
    `;

    await this.getClient().query(query, [JSON.stringify(manifestUrl), bugReportId]);
  }

  /**
   * Update bug report metadata with external integration IDs
   * Used by Integration worker after creating issues on external platforms
   */
  async updateExternalIntegration(
    bugReportId: string,
    externalId: string,
    externalUrl: string
  ): Promise<void> {
    // Use PostgreSQL's || operator for cleaner JSON merging
    // This atomically merges the new keys into existing metadata
    const query = `
      UPDATE ${this.tableName}
      SET metadata = COALESCE(metadata, '{}'::jsonb) || $1::jsonb
      WHERE id = $2
    `;

    await this.getClient().query(query, [
      JSON.stringify({ externalId, externalUrl }),
      bugReportId,
    ]);
  }

  /**
   * Restore soft-deleted bug reports
   */
  async restore(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      UPDATE ${this.tableName}
      SET deleted_at = NULL,
          deleted_by = NULL
      WHERE id = ANY($1)
        AND deleted_at IS NOT NULL
    `;

    const result = await this.getClient().query(query, [reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Hard delete bug reports (permanent deletion)
   */
  async hardDelete(reportIds: string[]): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      DELETE FROM ${this.tableName}
      WHERE id = ANY($1)
        AND legal_hold = FALSE
    `;

    const result = await this.getClient().query(query, [reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Set legal hold status on bug reports
   */
  async setLegalHold(reportIds: string[], hold: boolean): Promise<number> {
    if (reportIds.length === 0) {
      return 0;
    }

    const query = `
      UPDATE ${this.tableName}
      SET legal_hold = $1
      WHERE id = ANY($2)
    `;

    const result = await this.getClient().query(query, [hold, reportIds]);
    return result.rowCount ?? 0;
  }

  /**
   * Override list to exclude soft-deleted by default
   */
  async list(
    filters?: BugReportFilters & { includeDeleted?: boolean },
    sort?: BugReportSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<BugReport>> {
    // Build WHERE clause from filters
    const filterData: Record<string, unknown> = {};
    if (filters?.project_id) {
      filterData.project_id = filters.project_id;
    }
    if (filters?.status) {
      filterData.status = filters.status;
    }
    if (filters?.priority) {
      filterData.priority = filters.priority;
    }

    const { clause: whereClause, values, paramCount } = buildWhereClause(filterData);

    // Add soft-delete filter unless explicitly requesting deleted records
    const softDeleteClause = filters?.includeDeleted
      ? ''
      : whereClause
        ? ' AND deleted_at IS NULL'
        : ' WHERE deleted_at IS NULL';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}${softDeleteClause}`;
    const countResult = await this.getClient().query<{ count: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].count, DECIMAL_BASE);

    // Build ORDER BY clause
    const sortBy = sort?.sort_by ?? 'created_at';
    const order = sort?.order ?? 'desc';
    const orderClause = buildOrderByClause(sortBy, order);

    // Build pagination
    const page = pagination?.page ?? DEFAULT_PAGE;
    const limit = pagination?.limit ?? DEFAULT_PAGE_SIZE;
    const paginationClause = buildPaginationClause(page, limit, paramCount);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}${softDeleteClause}
      ${orderClause}
      ${paginationClause.clause}
    `;
    const dataValues = [...values, ...paginationClause.values];

    const dataResult = await this.getClient().query(dataQuery, dataValues);

    return {
      data: this.deserializeMany(dataResult.rows),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ============================================================================
  // RETENTION OPERATIONS
  // Consolidated from RetentionRepository to eliminate duplication
  // ============================================================================

  /**
   * Find bug reports eligible for deletion based on retention policy
   * Alias for findForRetention for backward compatibility
   */
  async findEligibleForDeletion(projectId: string, cutoffDate: Date): Promise<BugReport[]> {
    return this.findForRetention(projectId, cutoffDate, false);
  }

  /**
   * Hard delete reports within transaction and return details for certificate generation
   */
  async hardDeleteInTransaction(
    reportIds: string[]
  ): Promise<Array<{ id: string; project_id: string }>> {
    if (reportIds.length === 0) {
      return [];
    }

    // Get report details before deletion
    const reportsQuery = `
      SELECT id, project_id FROM ${this.tableName}
      WHERE id = ANY($1) AND legal_hold = FALSE
    `;
    const reportsResult = await this.getClient().query<{ id: string; project_id: string }>(
      reportsQuery,
      [reportIds]
    );
    const reports = reportsResult.rows;

    if (reports.length === 0) {
      return [];
    }

    // Delete from database (only reports that passed legal hold check)
    const deletableIds = reports.map((r) => r.id);
    await this.getClient().query(`DELETE FROM ${this.tableName} WHERE id = ANY($1)`, [
      deletableIds,
    ]);

    return reports;
  }

  /**
   * Count reports currently on legal hold
   */
  async countLegalHoldReports(): Promise<number> {
    const query = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE legal_hold = TRUE AND deleted_at IS NULL
    `;
    const result = await this.getClient().query<{ count: string }>(query);
    return parseInt(result.rows[0]?.count ?? '0', DECIMAL_BASE);
  }
}

/**
 * User Repository
 */
export class UserRepository extends BaseRepository<User, UserInsert, Partial<User>> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'users', []);
  }

  /**
   * Override serialization to handle defaults
   */
  protected serializeForInsert(data: UserInsert): Record<string, unknown> {
    return {
      email: data.email,
      password_hash: data.password_hash ?? null,
      role: data.role ?? 'user',
      oauth_provider: data.oauth_provider ?? null,
      oauth_id: data.oauth_id ?? null,
    };
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<User | null> {
    return this.findBy('email', email);
  }

  /**
   * Find user by OAuth credentials
   */
  async findByOAuth(provider: string, oauthId: string): Promise<User | null> {
    return this.findByMultiple({ oauth_provider: provider, oauth_id: oauthId });
  }
}

/**
 * Session Repository
 */
export class SessionRepository extends BaseRepository<Session, Partial<Session>, never> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'sessions', ['events']);
  }

  /**
   * Create session with required fields
   */
  async createSession(
    bugReportId: string,
    events: Record<string, unknown>,
    duration?: number
  ): Promise<Session> {
    return this.create({
      bug_report_id: bugReportId,
      events,
      duration: duration ?? null,
    });
  }

  /**
   * Find sessions by bug report ID
   */
  async findByBugReport(bugReportId: string): Promise<Session[]> {
    return this.findManyBy('bug_report_id', bugReportId);
  }
}

/**
 * Ticket Repository
 */
export class TicketRepository extends BaseRepository<Ticket, Partial<Ticket>, never> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'tickets', []);
  }

  /**
   * Create ticket with required fields
   */
  async createTicket(
    bugReportId: string,
    externalId: string,
    platform: string,
    status?: string
  ): Promise<Ticket> {
    return this.create({
      bug_report_id: bugReportId,
      external_id: externalId,
      platform,
      status: status ?? null,
    });
  }

  /**
   * Find tickets by bug report ID
   */
  async findByBugReport(bugReportId: string): Promise<Ticket[]> {
    return this.findManyBy('bug_report_id', bugReportId);
  }
}

/**
 * Project Member Repository
 */
export class ProjectMemberRepository extends BaseRepository<
  ProjectMember,
  ProjectMemberInsert,
  never
> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'project_members', []);
  }

  /**
   * Add user to project
   */
  async addMember(
    projectId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
  ): Promise<ProjectMember> {
    return this.create({
      project_id: projectId,
      user_id: userId,
      role,
    });
  }

  /**
   * Remove user from project
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE project_id = $1 AND user_id = $2`;
    await this.getClient().query(query, [projectId, userId]);
  }

  /**
   * Get all members of a project
   */
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return this.findManyBy('project_id', projectId);
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<ProjectMember[]> {
    return this.findManyBy('user_id', userId);
  }
}
