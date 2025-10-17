/**
 * User Repository
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import type { User, UserInsert } from '../types.js';

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

  /**
   * List users with pagination and optional filtering
   */
  async listWithFilters(options: {
    page?: number;
    limit?: number;
    role?: 'admin' | 'user' | 'viewer';
    email?: string;
  }): Promise<{ users: Omit<User, 'password_hash'>[]; total: number }> {
    const { page = 1, limit = 20, role, email } = options;

    // Build WHERE clause
    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIndex = 1;

    if (role) {
      conditions.push(`role = $${paramIndex}`);
      params.push(role);
      paramIndex++;
    }

    if (email) {
      conditions.push(`email ILIKE $${paramIndex}`);
      params.push(`%${email}%`);
      paramIndex++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const offset = (page - 1) * limit;

    // Get total count
    const countResult = await this.pool.query(
      `SELECT COUNT(*) as total FROM users ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].total);

    // Get users (exclude password hash)
    const result = await this.pool.query<Omit<User, 'password_hash'>>(
      `SELECT id, email, name, role, oauth_provider, created_at
       FROM users
       ${whereClause}
       ORDER BY created_at DESC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      [...params, limit, offset]
    );

    return {
      users: result.rows,
      total,
    };
  }
}
