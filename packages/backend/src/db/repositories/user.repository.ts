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
}
