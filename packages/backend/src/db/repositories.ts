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
    const query = `SELECT * FROM ${this.tableName} WHERE api_key = $1`;
    const result = await this.getClient().query(query, [apiKey]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
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
      data: dataResult.rows.map((row) => {
        return this.deserialize(row);
      }),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Create multiple bug reports in batch (uses transaction)
   */
  async createBatch(dataArray: BugReportInsert[]): Promise<BugReport[]> {
    const results: BugReport[] = [];
    for (const data of dataArray) {
      const result = await this.create(data);
      results.push(result);
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
    const query = `SELECT * FROM ${this.tableName} WHERE email = $1`;
    const result = await this.getClient().query(query, [email]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
  }

  /**
   * Find user by OAuth credentials
   */
  async findByOAuth(provider: string, oauthId: string): Promise<User | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE oauth_provider = $1 AND oauth_id = $2`;
    const result = await this.getClient().query(query, [provider, oauthId]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
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
    const query = `SELECT * FROM ${this.tableName} WHERE bug_report_id = $1`;
    const result = await this.getClient().query(query, [bugReportId]);

    return result.rows.map((row) => {
      return this.deserialize(row);
    });
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
    const query = `SELECT * FROM ${this.tableName} WHERE bug_report_id = $1`;
    const result = await this.getClient().query(query, [bugReportId]);

    return result.rows;
  }
}
