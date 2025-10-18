/**
 * Audit Log Repository
 * Handles database operations for audit logs
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import type { AuditLog, AuditLogInsert, PaginatedResult } from '../types.js';

export interface AuditLogFilters {
  user_id?: string;
  action?: string;
  resource?: string;
  success?: boolean;
  start_date?: Date;
  end_date?: Date;
}

export interface AuditLogSortOptions {
  sort_by?: 'timestamp' | 'action' | 'resource';
  order?: 'asc' | 'desc';
}

export class AuditLogRepository extends BaseRepository<AuditLog, AuditLogInsert> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'audit_logs', ['details']);
  }

  /**
   * Create a new audit log entry
   */
  async create(data: AuditLogInsert): Promise<AuditLog> {
    const query = `
      INSERT INTO audit_logs (
        user_id, action, resource, resource_id, 
        ip_address, user_agent, details, success, error_message
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const values = [
      data.user_id ?? null,
      data.action,
      data.resource,
      data.resource_id ?? null,
      data.ip_address ?? null,
      data.user_agent ?? null,
      data.details ? JSON.stringify(data.details) : null,
      data.success ?? true,
      data.error_message ?? null,
    ];

    const result = await this.getClient().query(query, values);
    return result.rows[0];
  }

  /**
   * List audit logs with filters, sorting, and pagination
   */
  async list(
    filters: AuditLogFilters = {},
    sortOptions: AuditLogSortOptions = {},
    page = 1,
    limit = 50
  ): Promise<PaginatedResult<AuditLog>> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    // Build WHERE clauses
    if (filters.user_id) {
      conditions.push(`user_id = $${++paramCount}`);
      values.push(filters.user_id);
    }

    if (filters.action) {
      conditions.push(`action = $${++paramCount}`);
      values.push(filters.action);
    }

    if (filters.resource) {
      // Use prefix matching instead of contains to leverage text_pattern_ops index
      // This allows index usage for patterns like '/api/v1/users%'
      conditions.push(`resource ILIKE $${++paramCount}`);
      values.push(`${filters.resource}%`);
    }

    if (filters.success !== undefined) {
      conditions.push(`success = $${++paramCount}`);
      values.push(filters.success);
    }

    if (filters.start_date) {
      conditions.push(`timestamp >= $${++paramCount}`);
      values.push(filters.start_date);
    }

    if (filters.end_date) {
      conditions.push(`timestamp <= $${++paramCount}`);
      values.push(filters.end_date);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM audit_logs ${whereClause}`;
    const countResult = await this.getClient().query(countQuery, values);
    const total = parseInt(countResult.rows[0].total, 10);

    // Build ORDER BY clause with SQL injection prevention
    const sortBy = sortOptions.sort_by || 'timestamp';
    const order = sortOptions.order || 'desc';

    // Validate sort column (whitelist)
    const validSortColumns = ['timestamp', 'action', 'resource'];
    if (!validSortColumns.includes(sortBy)) {
      throw new Error(`Invalid sort column: ${sortBy}`);
    }

    // Validate sort order (whitelist)
    const validOrders = ['asc', 'desc'];
    if (!validOrders.includes(order.toLowerCase())) {
      throw new Error(`Invalid sort order: ${order}`);
    }

    const orderClause = `ORDER BY ${sortBy} ${order.toUpperCase()}`;

    // Get paginated data
    const offset = (page - 1) * limit;
    const dataQuery = `
      SELECT * FROM audit_logs
      ${whereClause}
      ${orderClause}
      LIMIT $${++paramCount} OFFSET $${++paramCount}
    `;
    values.push(limit, offset);

    const dataResult = await this.getClient().query(dataQuery, values);

    return {
      data: dataResult.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get audit log by ID
   */
  async findById(id: string): Promise<AuditLog | null> {
    const query = 'SELECT * FROM audit_logs WHERE id = $1';
    const result = await this.getClient().query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Get audit logs for a specific user
   */
  async findByUserId(userId: string, limit = 100): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs
      WHERE user_id = $1
      ORDER BY timestamp DESC
      LIMIT $2
    `;
    const result = await this.getClient().query(query, [userId, limit]);
    return result.rows;
  }

  /**
   * Get audit logs for a specific resource
   */
  async findByResource(resource: string, resourceId?: string, limit = 100): Promise<AuditLog[]> {
    let query = `
      SELECT * FROM audit_logs
      WHERE resource = $1
    `;
    const values: unknown[] = [resource];

    if (resourceId) {
      query += ` AND resource_id = $2`;
      values.push(resourceId);
    }

    query += ` ORDER BY timestamp DESC LIMIT $${values.length + 1}`;
    values.push(limit);

    const result = await this.getClient().query(query, values);
    return result.rows;
  }

  /**
   * Get recent audit logs
   */
  async getRecent(limit = 100): Promise<AuditLog[]> {
    const query = `
      SELECT * FROM audit_logs
      ORDER BY timestamp DESC
      LIMIT $1
    `;
    const result = await this.getClient().query(query, [limit]);
    return result.rows;
  }

  /**
   * Delete old audit logs (for retention/cleanup)
   */
  async deleteOlderThan(date: Date): Promise<number> {
    const query = 'DELETE FROM audit_logs WHERE timestamp < $1';
    const result = await this.getClient().query(query, [date]);
    return result.rowCount || 0;
  }

  /**
   * Get audit log statistics
   */
  async getStatistics(
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    total: number;
    success: number;
    failures: number;
    by_action: Array<{ action: string; count: number }>;
    by_user: Array<{ user_id: string; count: number }>;
  }> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    let paramCount = 0;

    if (startDate) {
      conditions.push(`timestamp >= $${++paramCount}`);
      values.push(startDate);
    }

    if (endDate) {
      conditions.push(`timestamp <= $${++paramCount}`);
      values.push(endDate);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT
        COUNT(*) as total,
        COALESCE(SUM(CASE WHEN success = true THEN 1 ELSE 0 END), 0) as success,
        COALESCE(SUM(CASE WHEN success = false THEN 1 ELSE 0 END), 0) as failures
      FROM audit_logs
      ${whereClause}
    `;

    const statsResult = await this.getClient().query(query, values);
    const stats = statsResult.rows[0];

    // Get action breakdown (reuse same parameter values)
    const actionQuery = `
      SELECT action, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      GROUP BY action
      ORDER BY count DESC
      LIMIT 10
    `;
    const actionResult = await this.getClient().query(actionQuery, values);

    // Get user breakdown (reuse same parameter values)
    const userQuery = `
      SELECT user_id, COUNT(*) as count
      FROM audit_logs
      ${whereClause}
      ${whereClause ? 'AND' : 'WHERE'} user_id IS NOT NULL
      GROUP BY user_id
      ORDER BY count DESC
      LIMIT 10
    `;
    const userResult = await this.getClient().query(userQuery, values);

    return {
      total: parseInt(stats.total, 10),
      success: parseInt(stats.success, 10),
      failures: parseInt(stats.failures, 10),
      by_action: actionResult.rows.map((row: { action: string; count: string }) => ({
        action: row.action,
        count: parseInt(row.count, 10),
      })),
      by_user: userResult.rows.map((row: { user_id: string; count: string }) => ({
        user_id: row.user_id,
        count: parseInt(row.count, 10),
      })),
    };
  }
}
