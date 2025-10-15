/**
 * Base Repository
 * Abstract base class for all entity repositories
 * Provides common CRUD operations following DRY and SOLID principles
 */

import type { Pool, PoolClient } from 'pg';
import { getLogger } from '../../logger.js';
import { deserializeRow, serializeJsonField } from '../query-builder.js';

/**
 * Validate SQL identifier to prevent SQL injection
 * Only allows alphanumeric characters and underscores
 */
function validateSqlIdentifier(identifier: string): void {
  if (!/^[a-zA-Z0-9_]+$/.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }
}

/**
 * Base repository with common CRUD operations
 */
export abstract class BaseRepository<T, TInsert = Partial<T>, TUpdate = Partial<T>> {
  constructor(
    protected pool: Pool | PoolClient,
    protected tableName: string,
    protected jsonFields: string[] = []
  ) {}

  /**
   * Get the pool or client for queries
   * Allows using a transaction client when provided
   */
  protected getClient(): Pool | PoolClient {
    return this.pool;
  }

  /**
   * Find a single record by ID
   */
  async findById(id: string): Promise<T | null> {
    const query = `SELECT * FROM ${this.tableName} WHERE id = $1`;
    const result = await this.getClient().query(query, [id]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
  }

  /**
   * Create a new record
   */
  async create(data: TInsert): Promise<T> {
    const serialized = this.serializeForInsert(data);
    const columns = Object.keys(serialized);

    // Validate all column names to prevent SQL injection
    columns.forEach(validateSqlIdentifier);

    const placeholders = columns
      .map((_, i) => {
        return `$${i + 1}`;
      })
      .join(', ');
    const values = Object.values(serialized);

    const query = `
      INSERT INTO ${this.tableName} (${columns.join(', ')})
      VALUES (${placeholders})
      RETURNING *
    `;

    const result = await this.getClient().query(query, values);
    return this.deserialize(result.rows[0]);
  }

  /**
   * Update a record by ID
   */
  async update(id: string, data: TUpdate): Promise<T | null> {
    const serialized = this.serializeForUpdate(data);
    const entries = Object.entries(serialized);

    if (entries.length === 0) {
      return this.findById(id);
    }

    // Validate all column names to prevent SQL injection
    entries.forEach(([key]) => {
      return validateSqlIdentifier(key);
    });

    const setClauses = entries
      .map(([key], i) => {
        return `${key} = $${i + 1}`;
      })
      .join(', ');
    const values = [
      ...entries.map(([, value]) => {
        return value;
      }),
      id,
    ];

    const query = `
      UPDATE ${this.tableName}
      SET ${setClauses}
      WHERE id = $${entries.length + 1}
      RETURNING *
    `;

    const result = await this.getClient().query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
  }

  /**
   * Delete a record by ID
   */
  async delete(id: string): Promise<boolean> {
    const query = `DELETE FROM ${this.tableName} WHERE id = $1`;
    const result = await this.getClient().query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }

  /**
   * Deserialize a database row
   * Override in subclasses for custom deserialization
   */
  protected deserialize(row: unknown): T {
    return deserializeRow<T>(row, this.jsonFields);
  }

  /**
   * Serialize data for database operations (shared logic for insert/update)
   * Handles JSON field serialization and filters out undefined values
   */
  protected serialize(data: Record<string, unknown>): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        serialized[key] = this.jsonFields.includes(key) ? serializeJsonField(value) : value;
      }
    }

    return serialized;
  }

  /**
   * Serialize data for insert
   * Override in subclasses for custom serialization
   */
  protected serializeForInsert(data: TInsert): Record<string, unknown> {
    return this.serialize(data as Record<string, unknown>);
  }

  /**
   * Serialize data for update
   * Override in subclasses for custom serialization
   */
  protected serializeForUpdate(data: TUpdate): Record<string, unknown> {
    return this.serialize(data as Record<string, unknown>);
  }

  /**
   * Log repository actions
   */
  protected log(message: string, meta?: Record<string, unknown>): void {
    getLogger().debug(message, { table: this.tableName, ...meta });
  }

  /**
   * Find records by a single column value
   * Generic helper to eliminate repeated query patterns
   */
  protected async findBy(column: string, value: unknown): Promise<T | null> {
    validateSqlIdentifier(column);
    const query = `SELECT * FROM ${this.tableName} WHERE ${column} = $1`;
    const result = await this.getClient().query(query, [value]);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
  }

  /**
   * Find multiple records by a single column value
   * Generic helper for foreign key lookups
   */
  protected async findManyBy(column: string, value: unknown): Promise<T[]> {
    validateSqlIdentifier(column);
    const query = `SELECT * FROM ${this.tableName} WHERE ${column} = $1`;
    const result = await this.getClient().query(query, [value]);
    return this.deserializeMany(result.rows);
  }

  /**
   * Deserialize multiple rows
   * Eliminates repeated map patterns
   */
  protected deserializeMany(rows: unknown[]): T[] {
    return rows.map((row) => {
      return this.deserialize(row);
    });
  }

  /**
   * Find a record matching multiple column conditions
   * Useful for composite lookups like OAuth (provider + id)
   */
  protected async findByMultiple(conditions: Record<string, unknown>): Promise<T | null> {
    const entries = Object.entries(conditions);

    // Validate all column names to prevent SQL injection
    entries.forEach(([key]) => {
      return validateSqlIdentifier(key);
    });

    const whereClauses = entries.map(([key], i) => {
      return `${key} = $${i + 1}`;
    });
    const values = entries.map(([, value]) => {
      return value;
    });

    const query = `SELECT * FROM ${this.tableName} WHERE ${whereClauses.join(' AND ')}`;
    const result = await this.getClient().query(query, values);

    if (result.rows.length === 0) {
      return null;
    }

    return this.deserialize(result.rows[0]);
  }
}
