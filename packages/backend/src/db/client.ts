/**
 * Database Client
 * Facade providing backward-compatible API delegating to repositories
 */

import pg from 'pg';
import { config } from '../config.js';
import { getLogger } from '../logger.js';
import {
  ProjectRepository,
  BugReportRepository,
  UserRepository,
  SessionRepository,
  TicketRepository,
} from './repositories.js';
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
  retryAttempts?: number; // Number of retry attempts for connection failures
  retryDelayMs?: number; // Delay between retries in milliseconds
}

/**
 * Database client for PostgreSQL operations
 * Delegates to repositories while maintaining backward compatibility
 */
export class DatabaseClient {
  private pool: pg.Pool;
  private retryAttempts: number;
  private retryDelay: number;

  // Repositories
  public readonly projects: ProjectRepository;
  public readonly bugReports: BugReportRepository;
  public readonly users: UserRepository;
  public readonly sessions: SessionRepository;
  public readonly tickets: TicketRepository;

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.max ?? 10,
      min: config.min ?? 2,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 30000,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    });

    this.retryAttempts = config.retryAttempts ?? 3;
    this.retryDelay = config.retryDelayMs ?? 1000;

    // Initialize repositories
    this.projects = new ProjectRepository(this.pool);
    this.bugReports = new BugReportRepository(this.pool);
    this.users = new UserRepository(this.pool);
    this.sessions = new SessionRepository(this.pool);
    this.tickets = new TicketRepository(this.pool);

    // Handle pool errors
    this.pool.on('error', (err) => {
      getLogger().error('Unexpected database error', { error: err.message, stack: err.stack });
    });
  }

  /**
   * Check if an error is retryable (connection-related)
   */
  private isRetryableError(error: unknown): boolean {
    if (!(error instanceof Error)) {
      return false;
    }

    const pgError = error as Error & { code?: string };

    // Node.js network error codes
    const nodeErrorCodes = [
      'ECONNREFUSED',
      'ECONNRESET',
      'ETIMEDOUT',
      'EPIPE',
      'ENOTFOUND',
      'ENETUNREACH',
      'EAI_AGAIN',
    ];

    if (pgError.code && nodeErrorCodes.includes(pgError.code)) {
      return true;
    }

    // PostgreSQL connection-related error codes
    const pgConnectionErrors = [
      '08000', // connection_exception
      '08003', // connection_does_not_exist
      '08006', // connection_failure
      '57P01', // admin_shutdown
      '57P02', // crash_shutdown
      '57P03', // cannot_connect_now
    ];

    if (pgError.code && pgConnectionErrors.includes(pgError.code)) {
      return true;
    }

    // Fallback to message checking (less reliable but covers edge cases)
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes('connection terminated') ||
      errorMessage.includes('server closed the connection') ||
      errorMessage.includes('connection reset') ||
      errorMessage.includes('socket hang up')
    );
  }

  /**
   * Execute a query with automatic retry on connection failures
   * Uses exponential backoff with jitter to avoid thundering herd
   */
  private async executeWithRetry<T>(queryFn: () => Promise<T>, attempt: number = 1): Promise<T> {
    try {
      return await queryFn();
    } catch (error) {
      if (attempt >= this.retryAttempts) {
        throw error;
      }

      if (this.isRetryableError(error)) {
        // Exponential backoff: baseDelay * 2^(attempt-1)
        // With jitter: add random 0-50% of the delay to avoid thundering herd
        const exponentialDelay = this.retryDelay * Math.pow(2, attempt - 1);
        const jitter = Math.random() * exponentialDelay * 0.5;
        const totalDelay = Math.min(exponentialDelay + jitter, 30000); // Cap at 30s

        getLogger().warn('Database connection error, retrying', {
          attempt,
          maxAttempts: this.retryAttempts,
          delayMs: Math.round(totalDelay),
        });

        await this.delay(totalDelay);
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
      getLogger().error('Database connection test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Execute multiple operations in a transaction
   * Automatically rolls back on error, commits on success
   * @example
   * await db.transaction(async (client) => {
   *   const bug = await client.createBugReport({...});
   *   await client.createSession(bug.id, events);
   *   return bug;
   * });
   */
  async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
    const poolClient = await this.pool.connect();

    try {
      await poolClient.query('BEGIN');
      getLogger().debug('Transaction started');

      // Create a new DatabaseClient that uses this specific connection
      const transactionClient = new DatabaseClient({
        connectionString: '', // Not used - we override the pool
      });

      // Override the pool with a single-client pool
      const mockPool = {
        query: poolClient.query.bind(poolClient),
        connect: async () => {
          return poolClient;
        },
        end: async () => {}, // Prevent closing during transaction
        on: () => {},
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).pool = mockPool;

      // Re-initialize repositories with the transaction pool
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).projects = new ProjectRepository(mockPool as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).bugReports = new BugReportRepository(mockPool as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).users = new UserRepository(mockPool as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).sessions = new SessionRepository(mockPool as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (transactionClient as any).tickets = new TicketRepository(mockPool as any);

      const result = await callback(transactionClient);

      await poolClient.query('COMMIT');
      getLogger().debug('Transaction committed');

      return result;
    } catch (error) {
      await poolClient.query('ROLLBACK');
      getLogger().warn('Transaction rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      poolClient.release();
    }
  }

  // ==================== PROJECT METHODS ====================

  /**
   * Create a new project
   */
  async createProject(data: ProjectInsert): Promise<Project> {
    return this.executeWithRetry(() => {
      return this.projects.create(data);
    });
  }

  /**
   * Get project by ID
   */
  async getProject(id: string): Promise<Project | null> {
    return this.executeWithRetry(() => {
      return this.projects.findById(id);
    });
  }

  /**
   * Get project by API key (for authentication)
   */
  async getProjectByApiKey(apiKey: string): Promise<Project | null> {
    return this.executeWithRetry(() => {
      return this.projects.findByApiKey(apiKey);
    });
  }

  /**
   * Update project
   */
  async updateProject(id: string, data: ProjectUpdate): Promise<Project | null> {
    return this.executeWithRetry(() => {
      return this.projects.update(id, data);
    });
  }

  /**
   * Delete project
   */
  async deleteProject(id: string): Promise<boolean> {
    return this.executeWithRetry(() => {
      return this.projects.delete(id);
    });
  }

  // ==================== BUG REPORT METHODS ====================

  /**
   * Create a new bug report
   */
  async createBugReport(data: BugReportInsert): Promise<BugReport> {
    return this.executeWithRetry(() => {
      return this.bugReports.create(data);
    });
  }

  /**
   * Get bug report by ID
   */
  async getBugReport(id: string): Promise<BugReport | null> {
    return this.executeWithRetry(() => {
      return this.bugReports.findById(id);
    });
  }

  /**
   * Update bug report
   */
  async updateBugReport(id: string, data: BugReportUpdate): Promise<BugReport | null> {
    return this.executeWithRetry(() => {
      return this.bugReports.update(id, data);
    });
  }

  /**
   * List bug reports with filters, sorting, and pagination
   */
  async listBugReports(
    filters?: BugReportFilters,
    sort?: BugReportSortOptions,
    pagination?: PaginationOptions
  ): Promise<PaginatedResult<BugReport>> {
    return this.executeWithRetry(() => {
      return this.bugReports.list(filters, sort, pagination);
    });
  }

  /**
   * Delete bug report
   */
  async deleteBugReport(id: string): Promise<boolean> {
    return this.executeWithRetry(() => {
      return this.bugReports.delete(id);
    });
  }

  /**
   * Create multiple bug reports in a single transaction
   * More efficient than calling createBugReport multiple times
   */
  async createBugReports(data: BugReportInsert[]): Promise<BugReport[]> {
    if (data.length === 0) {
      return [];
    }

    return this.transaction(async (client) => {
      // Use the transaction client's repositories for batch operations
      return client.bugReports.createBatch(data);
    });
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
    return this.executeWithRetry(() => {
      return this.sessions.createSession(bugReportId, events, duration);
    });
  }

  /**
   * Get sessions for a bug report
   */
  async getSessionsByBugReport(bugReportId: string): Promise<Session[]> {
    return this.executeWithRetry(() => {
      return this.sessions.findByBugReport(bugReportId);
    });
  }

  // ==================== USER METHODS ====================

  /**
   * Create a new user
   */
  async createUser(data: UserInsert): Promise<User> {
    return this.executeWithRetry(() => {
      return this.users.create(data);
    });
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.executeWithRetry(() => {
      return this.users.findByEmail(email);
    });
  }

  /**
   * Get user by OAuth credentials
   */
  async getUserByOAuth(provider: string, oauthId: string): Promise<User | null> {
    return this.executeWithRetry(() => {
      return this.users.findByOAuth(provider, oauthId);
    });
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
    return this.executeWithRetry(() => {
      return this.tickets.createTicket(bugReportId, externalId, platform, status);
    });
  }

  /**
   * Get tickets for a bug report
   */
  async getTicketsByBugReport(bugReportId: string): Promise<Ticket[]> {
    return this.executeWithRetry(() => {
      return this.tickets.findByBugReport(bugReportId);
    });
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
    retryAttempts: config.database.retryAttempts,
    retryDelayMs: config.database.retryDelayMs,
  });
}
