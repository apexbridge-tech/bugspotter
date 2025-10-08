/**
 * Base Repository
 * Abstract base class for all entity repositories
 * Provides common CRUD operations following DRY and SOLID principles
 */

import type { Pool, PoolClient } from 'pg';
import { getLogger } from '../logger.js';
import { deserializeRow, serializeJsonField } from './query-builder.js';

/**
 * Base repository with common CRUD operations
 */
export abstract class BaseRepository<T, TInsert = Partial<T>, TUpdate = Partial<T>> {
  constructor(
    protected pool: Pool,
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
   * Serialize data for insert
   * Override in subclasses for custom serialization
   */
  protected serializeForInsert(data: TInsert): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        serialized[key] = this.jsonFields.includes(key) ? serializeJsonField(value) : value;
      }
    }

    return serialized;
  }

  /**
   * Serialize data for update
   * Override in subclasses for custom serialization
   */
  protected serializeForUpdate(data: TUpdate): Record<string, unknown> {
    const serialized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      if (value !== undefined) {
        serialized[key] = this.jsonFields.includes(key) ? serializeJsonField(value) : value;
      }
    }

    return serialized;
  }

  /**
   * Log repository actions
   */
  protected log(message: string, meta?: Record<string, unknown>): void {
    getLogger().debug(message, { table: this.tableName, ...meta });
  }
}
