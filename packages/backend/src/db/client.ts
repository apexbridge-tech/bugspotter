/**
 * Database Client
 * Manages PostgreSQL connection pool and provides repository access with automatic retry logic
 */

import pg from 'pg';
import { config } from '../config.js';
import { getLogger } from '../logger.js';
import { executeWithRetry, type RetryConfig, DEFAULT_RETRY_CONFIG } from './retry.js';
import {
  createRepositories,
  type RepositoryRegistry,
  type TransactionCallback,
} from './transaction.js';

const { Pool } = pg;

export interface DatabaseConfig {
  connectionString: string;
  max?: number;
  min?: number;
  connectionTimeoutMillis?: number;
  idleTimeoutMillis?: number;
  retryAttempts?: number;
  retryDelayMs?: number;
}

/**
 * Database client for PostgreSQL operations with automatic retry logic
 */
export class DatabaseClient implements RepositoryRegistry {
  /**
   * Methods that are safe to retry (idempotent read operations)
   * Shared across all instances to avoid unnecessary memory allocation
   */
  private static readonly RETRYABLE_METHODS = new Set([
    'findById',
    'findBy',
    'findManyBy',
    'findByMultiple',
    'findByApiKey',
    'findByEmail',
    'findByOAuth',
    'findByBugReport',
    'list',
  ]);

  private pool: pg.Pool;
  private retryConfig: RetryConfig;
  private repositories: RepositoryRegistry;

  public readonly projects: RepositoryRegistry['projects'];
  public readonly bugReports: RepositoryRegistry['bugReports'];
  public readonly users: RepositoryRegistry['users'];
  public readonly sessions: RepositoryRegistry['sessions'];
  public readonly tickets: RepositoryRegistry['tickets'];

  constructor(config: DatabaseConfig) {
    this.pool = new Pool({
      connectionString: config.connectionString,
      max: config.max ?? 10,
      min: config.min ?? 2,
      connectionTimeoutMillis: config.connectionTimeoutMillis ?? 30000,
      idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
    });

    this.retryConfig = {
      maxAttempts: config.retryAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      baseDelay: config.retryDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelay,
      strategy: DEFAULT_RETRY_CONFIG.strategy,
    };

    this.repositories = createRepositories(this.pool);

    this.projects = this.wrapWithRetry(this.repositories.projects);
    this.bugReports = this.wrapWithRetry(this.repositories.bugReports);
    this.users = this.wrapWithRetry(this.repositories.users);
    this.sessions = this.wrapWithRetry(this.repositories.sessions);
    this.tickets = this.wrapWithRetry(this.repositories.tickets);

    this.pool.on('error', (err) => {
      getLogger().error('Unexpected database error', { error: err.message, stack: err.stack });
    });
  }

  /**
   * Wrap repository methods with automatic retry logic using Proxy pattern
   * Only wraps read operations - write operations should not be auto-retried
   * as they may not be idempotent and could cause data corruption
   */
  private wrapWithRetry<T extends object>(target: T): T {
    return new Proxy(target, {
      get: (obj, prop) => {
        const value = obj[prop as keyof T];

        // Only wrap functions
        if (typeof value !== 'function') {
          return value;
        }

        const methodName = String(prop);

        // Only retry safe, idempotent read operations (use class-level constant)
        if (DatabaseClient.RETRYABLE_METHODS.has(methodName)) {
          return (...args: unknown[]) => {
            return executeWithRetry(() => {
              return value.apply(obj, args);
            }, this.retryConfig);
          };
        }

        // Write operations are NOT retried automatically
        // User must implement retry logic if needed (with proper idempotency)
        return (...args: unknown[]) => {
          return value.apply(obj, args);
        };
      },
    });
  }

  async testConnection(): Promise<boolean> {
    try {
      const result = await executeWithRetry(() => {
        return this.pool.query('SELECT NOW()');
      }, this.retryConfig);
      return result.rows.length > 0;
    } catch (error) {
      getLogger().error('Database connection test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Execute multiple operations in a transaction
   * @example
   * await db.transaction(async (tx) => {
   *   const bug = await tx.bugReports.create({...});
   *   await tx.sessions.createSession(bug.id, events);
   *   return bug;
   * });
   */
  async transaction<T>(callback: TransactionCallback<T>): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');
      getLogger().debug('Transaction started');

      // Create repositories using the transaction client
      const transactionContext = createRepositories(client);
      const result = await callback(transactionContext);

      await client.query('COMMIT');
      getLogger().debug('Transaction committed');

      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      getLogger().warn('Transaction rolled back', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    } finally {
      client.release();
    }
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
