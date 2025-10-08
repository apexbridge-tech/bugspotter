/**
 * Database Client
 * PostgreSQL connection and query methods with connection pooling
 */

import pg from 'pg';
import { config } from '../config.js';
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
  Session,
  Ticket,
  User,
  UserInsert,
} from './types.js';

const { Pool } = pg;

/**
 * Database client configuration
 */
export interface DatabaseConfig {
  connectionString: string;
  max?: number; // Maximum number of clients in the pool
  min?: number; // Minimum number of clients in the pool
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
}

/**
 * Database client for PostgreSQL operations
 */
export class DatabaseClient {
  private pool: pg.Pool;
  private retryAttempts: number = 3;
  private retryDelay: number = 1000; // milliseconds

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.max ?? 10,
      min: config.min ?? 2,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 30000,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database error:', err);
    });
  }

  /**
   * Execute a query with automatic retry on connection failures
   */
  private async executeWithRetry<T>(queryFn: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      // Retry on connection errors
      const isConnectionError =
        error instanceof Error &&
        (error.message.includes('ECONNREFUSED') ||
          error.message.includes('ETIMEDOUT') ||
          error.message.includes('connection terminated'));

      if (isConnectionError) {
        console.warn(`Database connection error, retrying (${attempt}/${this.retryAttempts})...`);
        await this.delay(this.retryDelay * attempt);
        return this.executeWithRetry(queryFn, attempt + 1);
      }

      throw error;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => {
      return setTimeout(resolve, ms);
    });
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const result = await this.executeWithRetry(() => {
        return this.pool.query('SELECT NOW()');
      });
      return result.rows.length > 0;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  // ==================== PROJECT METHODS ====================

  /**
   * Create a new project
   */
  async createProject(data: ProjectInsert): Promise<Project> {
    const query = `
      INSERT INTO projects (name, api_key, settings)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [data.name, data.api_key, JSON.stringify(data.settings ?? {})];

    const result = await this.executeWithRetry(() => {
      return this.pool.query<Project>(query, values);
    });

    return this.deserializeProject(result.rows[0]);
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<Project>(query, [id]);
    });

    return result.rows.length > 0 ? this.deserializeProject(result.rows[0]) : null;
  }

  /**
   * Get project by API key (for authentication)
   */
  async getProjectByApiKey(apiKey: string): Promise<Project | null> {
    const query = 'SELECT * FROM projects WHERE api_key = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<Project>(query, [apiKey]);
    });

    return result.rows.length > 0 ? this.deserializeProject(result.rows[0]) : null;
  }

  /**
   * Update project
   */
  async updateProject(id: string, data: ProjectUpdate): Promise<Project | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (data.name !== undefined) {
      updates.push(`name = $${paramCount++}`);
      values.push(data.name);
    }
    if (data.api_key !== undefined) {
      updates.push(`api_key = $${paramCount++}`);
      values.push(data.api_key);
    }
    if (data.settings !== undefined) {
      updates.push(`settings = $${paramCount++}`);
      values.push(JSON.stringify(data.settings));
    }

    if (updates.length === 0) {
      return this.getProject(id);
    }

    values.push(id);
    const query = `
      UPDATE projects
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.executeWithRetry(() => {
      return this.pool.query<Project>(query, values);
    });

    return result.rows.length > 0 ? this.deserializeProject(result.rows[0]) : null;
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<boolean> {
    const query = 'DELETE FROM projects WHERE id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query(query, [id]);
    });

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ==================== BUG REPORT METHODS ====================

  /**
   * Create a new bug report
   */
  async createBugReport(data: BugReportInsert): Promise<BugReport> {
    const query = `
      INSERT INTO bug_reports (
        project_id, title, description, screenshot_url, replay_url,
        metadata, status, priority
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;

    const values = [
      data.project_id,
      data.title,
      data.description ?? null,
      data.screenshot_url ?? null,
      data.replay_url ?? null,
      JSON.stringify(data.metadata ?? {}),
      data.status ?? 'open',
      data.priority ?? 'medium',
    ];

    const result = await this.executeWithRetry(() => {
      return this.pool.query<BugReport>(query, values);
    });

    return this.deserializeBugReport(result.rows[0]);
  }

  /**
   * Get bug report by ID
   */
  async getBugReport(id: string): Promise<BugReport | null> {
    const query = 'SELECT * FROM bug_reports WHERE id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<BugReport>(query, [id]);
    });

    return result.rows.length > 0 ? this.deserializeBugReport(result.rows[0]) : null;
  }

  /**
   * Update bug report
   */
  async updateBugReport(id: string, data: BugReportUpdate): Promise<BugReport | null> {
    const updates: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(data.title);
    }
    if (data.description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(data.description);
    }
    if (data.screenshot_url !== undefined) {
      updates.push(`screenshot_url = $${paramCount++}`);
      values.push(data.screenshot_url);
    }
    if (data.replay_url !== undefined) {
      updates.push(`replay_url = $${paramCount++}`);
      values.push(data.replay_url);
    }
    if (data.metadata !== undefined) {
      updates.push(`metadata = $${paramCount++}`);
      values.push(JSON.stringify(data.metadata));
    }
    if (data.status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(data.status);
    }
    if (data.priority !== undefined) {
      updates.push(`priority = $${paramCount++}`);
      values.push(data.priority);
    }

    if (updates.length === 0) {
      return this.getBugReport(id);
    }

    values.push(id);
    const query = `
      UPDATE bug_reports
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `;

    const result = await this.executeWithRetry(() => {
      return this.pool.query<BugReport>(query, values);
    });

    return result.rows.length > 0 ? this.deserializeBugReport(result.rows[0]) : null;
  }

  /**
   * List bug reports with filters, sorting, and pagination
   */
  async listBugReports(
    filters?: BugReportFilters,
    sort?: BugReportSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<BugReport>> {
    const whereClauses: string[] = [];
    const values: unknown[] = [];
    let paramCount = 1;

    // Build WHERE clause
    if (filters?.project_id) {
      whereClauses.push(`project_id = $${paramCount++}`);
      values.push(filters.project_id);
    }
    if (filters?.status) {
      whereClauses.push(`status = $${paramCount++}`);
      values.push(filters.status);
    }
    if (filters?.priority) {
      whereClauses.push(`priority = $${paramCount++}`);
      values.push(filters.priority);
    }
    if (filters?.created_after) {
      whereClauses.push(`created_at >= $${paramCount++}`);
      values.push(filters.created_after);
    }
    if (filters?.created_before) {
      whereClauses.push(`created_at <= $${paramCount++}`);
      values.push(filters.created_before);
    }

    const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM bug_reports ${whereClause}`;
    const countResult = await this.executeWithRetry(() => {
      return this.pool.query<{ count: string }>(countQuery, values);
    });
    const total = parseInt(countResult.rows[0].count, 10);

    // Build ORDER BY clause
    const sortBy = sort?.sort_by ?? 'created_at';
    const order = sort?.order ?? 'desc';
    const orderClause = `ORDER BY ${sortBy} ${order.toUpperCase()}`;

    // Build LIMIT and OFFSET
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const offset = (page - 1) * limit;

    // Get paginated results
    const dataQuery = `
      SELECT * FROM bug_reports
      ${whereClause}
      ${orderClause}
      LIMIT $${paramCount++} OFFSET $${paramCount++}
    `;
    values.push(limit, offset);

    const dataResult = await this.executeWithRetry(() => {
      return this.pool.query<BugReport>(dataQuery, values);
    });

    return {
      data: dataResult.rows.map((row) => {
        return this.deserializeBugReport(row);
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
   * Delete bug report
   */
  async deleteBugReport(id: string): Promise<boolean> {
    const query = 'DELETE FROM bug_reports WHERE id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query(query, [id]);
    });

    return result.rowCount !== null && result.rowCount > 0;
  }

  // ==================== SESSION METHODS ====================

  /**
   * Create a session for a bug report
   */
  async createSession(
    bugReportId: string,
    events: Record<string, unknown>,
    duration?: number
  ): Promise<Session> {
    const query = `
      INSERT INTO sessions (bug_report_id, events, duration)
      VALUES ($1, $2, $3)
      RETURNING *
    `;
    const values = [bugReportId, JSON.stringify(events), duration ?? null];

    const result = await this.executeWithRetry(() => {
      return this.pool.query<Session>(query, values);
    });

    return this.deserializeSession(result.rows[0]);
  }

  /**
   * Get sessions for a bug report
   */
  async getSessionsByBugReport(bugReportId: string): Promise<Session[]> {
    const query = 'SELECT * FROM sessions WHERE bug_report_id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<Session>(query, [bugReportId]);
    });

    return result.rows.map((row) => {
      return this.deserializeSession(row);
    });
  }

  // ==================== USER METHODS ====================

  /**
   * Create a new user
   */
  async createUser(data: UserInsert): Promise<User> {
    const query = `
      INSERT INTO users (email, password_hash, role, oauth_provider, oauth_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      data.email,
      data.password_hash ?? null,
      data.role ?? 'user',
      data.oauth_provider ?? null,
      data.oauth_id ?? null,
    ];

    const result = await this.executeWithRetry(() => {
      return this.pool.query<User>(query, values);
    });

    return result.rows[0];
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE email = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<User>(query, [email]);
    });

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Get user by OAuth credentials
   */
  async getUserByOAuth(provider: string, oauthId: string): Promise<User | null> {
    const query = 'SELECT * FROM users WHERE oauth_provider = $1 AND oauth_id = $2';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<User>(query, [provider, oauthId]);
    });

    return result.rows.length > 0 ? result.rows[0] : null;
  }

  // ==================== TICKET METHODS ====================

  /**
   * Create a ticket (external integration)
   */
  async createTicket(
    bugReportId: string,
    externalId: string,
    platform: string,
    status?: string
  ): Promise<Ticket> {
    const query = `
      INSERT INTO tickets (bug_report_id, external_id, platform, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const values = [bugReportId, externalId, platform, status ?? null];

    const result = await this.executeWithRetry(() => {
      return this.pool.query<Ticket>(query, values);
    });

    return result.rows[0];
  }

  /**
   * Get tickets for a bug report
   */
  async getTicketsByBugReport(bugReportId: string): Promise<Ticket[]> {
    const query = 'SELECT * FROM tickets WHERE bug_report_id = $1';
    const result = await this.executeWithRetry(() => {
      return this.pool.query<Ticket>(query, [bugReportId]);
    });

    return result.rows;
  }

  // ==================== SERIALIZATION HELPERS ====================

  private deserializeProject(row: unknown): Project {
    const r = row as Record<string, unknown>;
    return {
      ...r,
      settings: typeof r.settings === 'string' ? JSON.parse(r.settings) : r.settings,
    } as Project;
  }

  private deserializeBugReport(row: unknown): BugReport {
    const r = row as Record<string, unknown>;
    return {
      ...r,
      metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
    } as BugReport;
  }

  private deserializeSession(row: unknown): Session {
    const r = row as Record<string, unknown>;
    return {
      ...r,
      events: typeof r.events === 'string' ? JSON.parse(r.events) : r.events,
    } as Session;
  }
}

/**
 * Create a database client instance
 */
export function createDatabaseClient(databaseUrl?: string): DatabaseClient {
  const connectionString = databaseUrl ?? config.database.url;

  if (!connectionString) {
    throw new Error('DATABASE_URL is required. Set it in environment variables or .env file');
  }

  return new DatabaseClient({
    connectionString,
    max: config.database.poolMax,
    min: config.database.poolMin,
    connectionTimeoutMillis: config.database.connectionTimeout,
    idleTimeoutMillis: config.database.idleTimeout,
  });
}
