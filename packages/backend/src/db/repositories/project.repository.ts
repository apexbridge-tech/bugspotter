/**
 * Project Repository
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import { SINGLE_ROW_LIMIT } from '../constants.js';
import type { Project, ProjectInsert, ProjectUpdate } from '../types.js';

export class ProjectRepository extends BaseRepository<Project, ProjectInsert, ProjectUpdate> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'projects', ['settings']);
  }

  /**
   * Find project by API key (for authentication)
   */
  async findByApiKey(apiKey: string): Promise<Project | null> {
    return this.findBy('api_key', apiKey);
  }

  /**
   * Check if user has access to project
   * Returns true if user is the owner, an admin, or member of the project
   */
  async hasAccess(projectId: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM projects p
      WHERE p.id = $1
        AND (
          p.created_by = $2
          OR EXISTS (
            SELECT 1 FROM project_members pm
            WHERE pm.project_id = p.id
              AND pm.user_id = $2
          )
        )
      LIMIT ${SINGLE_ROW_LIMIT}
    `;

    const result = await this.getClient().query(query, [projectId, userId]);
    return result.rows.length > 0;
  }

  /**
   * Get user's role in project
   * Returns 'owner', 'admin', 'member', 'viewer', or null if no access
   */
  async getUserRole(projectId: string, userId: string): Promise<string | null> {
    // Check if owner
    const ownerQuery = `
      SELECT 'owner' as role FROM projects
      WHERE id = $1 AND created_by = $2
      LIMIT ${SINGLE_ROW_LIMIT}
    `;
    const ownerResult = await this.getClient().query(ownerQuery, [projectId, userId]);
    if (ownerResult.rows.length > 0) {
      return 'owner';
    }

    // Check project membership
    const memberQuery = `
      SELECT role FROM project_members
      WHERE project_id = $1 AND user_id = $2
      LIMIT ${SINGLE_ROW_LIMIT}
    `;
    const memberResult = await this.getClient().query(memberQuery, [projectId, userId]);
    if (memberResult.rows.length > 0) {
      return memberResult.rows[0].role;
    }

    return null;
  }

  /**
   * Find all projects (for retention service)
   */
  async findAll(): Promise<Project[]> {
    const query = `SELECT * FROM ${this.tableName} ORDER BY created_at DESC`;
    const result = await this.getClient().query(query);
    return this.deserializeMany(result.rows);
  }
}
