/**
 * Entity Repositories
 * Specific repository implementations for each entity type
 */

import type { Pool } from 'pg';
import { BaseRepository } from './base-repository.js';
import type {
  Project,
  ProjectInsert,
  ProjectUpdate,
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
  constructor(pool: Pool) {
    super(pool, 'projects', ['settings']);
  }

  /**
   * Find project by API key (for authentication)
   */
  async findByApiKey(apiKey: string): Promise<Project | null> {
    return this.findBy('api_key', apiKey);
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
  constructor(pool: Pool) {
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
    };
  }

  /**
   * List bug reports with filters, sorting, and pagination
   */
  async list(
    filters?: BugReportFilters,
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
    // Note: created_after/before need operator support (future enhancement)

    const { clause: whereClause, values, paramCount } = buildWhereClause(filterData);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ${this.tableName} ${whereClause}`;
    const countResult = await this.getClient().query<{ count: string }>(countQuery, values);
    const total = parseInt(countResult.rows[0].count, 10);

    // Build ORDER BY clause
    const sortBy = sort?.sort_by ?? 'created_at';
    const order = sort?.order ?? 'desc';
    const orderClause = buildOrderByClause(sortBy, order);

    // Build pagination
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const paginationClause = buildPaginationClause(page, limit, paramCount);

    // Get paginated results
    const dataQuery = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
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
    // PostgreSQL limit: 65,535 parameters. With 8 columns = max 8,191 rows
    // We set a conservative limit of 1000 for safety and performance
    const MAX_BATCH_SIZE = 1000;
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
    batchSize: number = 500
  ): Promise<BugReport[]> {
    if (dataArray.length === 0) {
      return [];
    }

    // Validate batch size
    if (batchSize < 1 || batchSize > 1000) {
      throw new Error(`Batch size must be between 1 and 1000, got ${batchSize}`);
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
}

/**
 * User Repository
 */
export class UserRepository extends BaseRepository<User, UserInsert, Partial<User>> {
  constructor(pool: Pool) {
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
  constructor(pool: Pool) {
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
  constructor(pool: Pool) {
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
