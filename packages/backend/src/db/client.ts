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

/**
 * Default connection pool configuration
 */
const DEFAULT_POOL_CONFIG = {
  MAX_CONNECTIONS: 10,
  MIN_CONNECTIONS: 2,
  CONNECTION_TIMEOUT_MS: 30000,
  IDLE_TIMEOUT_MS: 30000,
} as const;

/**
 * SQL commands for transaction control
 */
const TRANSACTION_COMMANDS = {
  BEGIN: 'BEGIN',
  COMMIT: 'COMMIT',
  ROLLBACK: 'ROLLBACK',
  TEST_CONNECTION: 'SELECT NOW()',
} as const;

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

  private _projects!: RepositoryRegistry['projects'];
  private _bugReports!: RepositoryRegistry['bugReports'];
  private _users!: RepositoryRegistry['users'];
  private _sessions!: RepositoryRegistry['sessions'];
  private _tickets!: RepositoryRegistry['tickets'];

  constructor(config: DatabaseConfig) {
    this.pool = this.createConnectionPool(config);
    this.retryConfig = this.createRetryConfig(config);
    this.repositories = createRepositories(this.pool);

    // Wrap all repositories with retry logic
    this.initializeRepositories();

    // Set up connection monitoring
    this.setupConnectionMonitoring();

    this.logConnectionInitialized(config);
  }

  /**
   * Create PostgreSQL connection pool with configuration
   */
  private createConnectionPool(config: DatabaseConfig): pg.Pool {
    return new Pool({
      connectionString: config.connectionString,
      max: config.max ?? DEFAULT_POOL_CONFIG.MAX_CONNECTIONS,
      min: config.min ?? DEFAULT_POOL_CONFIG.MIN_CONNECTIONS,
      connectionTimeoutMillis:
        config.connectionTimeoutMillis ?? DEFAULT_POOL_CONFIG.CONNECTION_TIMEOUT_MS,
      idleTimeoutMillis: config.idleTimeoutMillis ?? DEFAULT_POOL_CONFIG.IDLE_TIMEOUT_MS,
    });
  }

  /**
   * Create retry configuration from database config
   */
  private createRetryConfig(config: DatabaseConfig): RetryConfig {
    return {
      maxAttempts: config.retryAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      baseDelay: config.retryDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelay,
      strategy: DEFAULT_RETRY_CONFIG.strategy,
    };
  }

  /**
   * Initialize all repositories with retry wrapping
   */
  private initializeRepositories(): void {
    this._projects = this.wrapWithRetry(this.repositories.projects);
    this._bugReports = this.wrapWithRetry(this.repositories.bugReports);
    this._users = this.wrapWithRetry(this.repositories.users);
    this._sessions = this.wrapWithRetry(this.repositories.sessions);
    this._tickets = this.wrapWithRetry(this.repositories.tickets);
  }

  /**
   * Public getters for repositories
   */
  get projects(): RepositoryRegistry['projects'] {
    return this._projects;
  }

  get bugReports(): RepositoryRegistry['bugReports'] {
    return this._bugReports;
  }

  get users(): RepositoryRegistry['users'] {
    return this._users;
  }

  get sessions(): RepositoryRegistry['sessions'] {
    return this._sessions;
  }

  get tickets(): RepositoryRegistry['tickets'] {
    return this._tickets;
  }

  /**
   * Set up connection pool event monitoring
   */
  private setupConnectionMonitoring(): void {
    const logger = getLogger();

    this.pool.on('error', (err) => {
      logger.error('Unexpected database error', {
        error: err.message,
        stack: err.stack,
        type: 'pool_error',
      });
    });

    this.pool.on('connect', () => {
      logger.debug('New database connection established', {
        type: 'pool_connect',
      });
    });

    this.pool.on('remove', () => {
      logger.debug('Database connection removed from pool', {
        type: 'pool_remove',
      });
    });
  }

  /**
   * Log successful connection initialization
   */
  private logConnectionInitialized(config: DatabaseConfig): void {
    getLogger().info('Database client initialized', {
      maxConnections: config.max ?? DEFAULT_POOL_CONFIG.MAX_CONNECTIONS,
      minConnections: config.min ?? DEFAULT_POOL_CONFIG.MIN_CONNECTIONS,
      retryAttempts: config.retryAttempts ?? DEFAULT_RETRY_CONFIG.maxAttempts,
      retryDelay: config.retryDelayMs ?? DEFAULT_RETRY_CONFIG.baseDelay,
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
        const method = obj[prop as keyof T];

        // Only wrap functions
        if (!this.isFunction(method)) {
          return method;
        }

        const methodName = String(prop);

        // Return wrapped or unwrapped method based on retry safety
        return this.isRetryableMethod(methodName)
          ? this.wrapMethodWithRetry(method, obj)
          : this.wrapMethodWithoutRetry(method, obj);
      },
    });
  }

  /**
   * Check if a value is a function
   */
  private isFunction(value: unknown): value is (...args: unknown[]) => unknown {
    return typeof value === 'function';
  }

  /**
   * Check if a method should be retried automatically
   */
  private isRetryableMethod(methodName: string): boolean {
    return DatabaseClient.RETRYABLE_METHODS.has(methodName);
  }

  /**
   * Wrap a method with retry logic
   */
  private wrapMethodWithRetry<T extends object>(
    method: (...args: unknown[]) => unknown,
    context: T
  ): (...args: unknown[]) => Promise<unknown> {
    return (...args: unknown[]): Promise<unknown> => {
      return executeWithRetry(() => {
        return method.apply(context, args) as Promise<unknown>;
      }, this.retryConfig);
    };
  }

  /**
   * Wrap a method without retry logic (for write operations)
   */
  private wrapMethodWithoutRetry<T extends object>(
    method: (...args: unknown[]) => unknown,
    context: T
  ): (...args: unknown[]) => unknown {
    return (...args: unknown[]): unknown => {
      return method.apply(context, args) as unknown;
    };
  }

  /**
   * Test database connection health
   * Returns true if connection is healthy, false otherwise
   */
  async testConnection(): Promise<boolean> {
    const logger = getLogger();

    try {
      logger.debug('Testing database connection');

      const result = await executeWithRetry(() => {
        return this.pool.query(TRANSACTION_COMMANDS.TEST_CONNECTION);
      }, this.retryConfig);

      const isHealthy = result.rows.length > 0;
      logger.debug('Database connection test completed', { healthy: isHealthy });

      return isHealthy;
    } catch (error) {
      logger.error('Database connection test failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  /**
   * Get connection pool statistics for monitoring
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
    };
  }

  /**
   * Close all database connections gracefully
   */
  async close(): Promise<void> {
    const logger = getLogger();

    try {
      logger.info('Closing database connection pool', this.getPoolStats());
      await this.pool.end();
      logger.info('Database connection pool closed successfully');
    } catch (error) {
      logger.error('Error closing database connection pool', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
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
    const logger = getLogger();
    const client = await this.pool.connect();
    const transactionId = this.generateTransactionId();

    try {
      logger.debug('Transaction starting', { transactionId });
      await client.query(TRANSACTION_COMMANDS.BEGIN);

      // Create repositories using the transaction client
      const transactionContext = createRepositories(client);
      const result = await callback(transactionContext);

      await client.query(TRANSACTION_COMMANDS.COMMIT);
      logger.debug('Transaction committed', { transactionId });

      return result;
    } catch (error) {
      logger.warn('Transaction rolling back', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });

      await this.safeRollback(client, transactionId);
      throw error;
    } finally {
      client.release();
      logger.debug('Transaction client released', { transactionId });
    }
  }

  /**
   * Generate a unique transaction ID for logging
   */
  private generateTransactionId(): string {
    return `tx_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Safely rollback a transaction with error handling
   */
  private async safeRollback(client: pg.PoolClient, transactionId: string): Promise<void> {
    try {
      await client.query(TRANSACTION_COMMANDS.ROLLBACK);
      getLogger().debug('Transaction rolled back successfully', { transactionId });
    } catch (rollbackError) {
      getLogger().error('Failed to rollback transaction', {
        transactionId,
        error: rollbackError instanceof Error ? rollbackError.message : String(rollbackError),
      });
      // Don't throw - we're already in an error state
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
