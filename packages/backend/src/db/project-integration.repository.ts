/**
 * Project Integration Repository
 * Handles database operations for external integrations (Jira, GitHub, etc.)
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './repositories/base-repository.js';

/**
 * Project integration entity
 */
export interface ProjectIntegration {
  id: string;
  project_id: string;
  platform: string;
  enabled: boolean;
  config: Record<string, unknown>;
  encrypted_credentials: string | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * Insert data for project integration
 */
export interface ProjectIntegrationInsert {
  id?: string;
  project_id: string;
  platform: string;
  enabled?: boolean;
  config: Record<string, unknown>;
  encrypted_credentials?: string | null;
}

/**
 * Update data for project integration
 */
export interface ProjectIntegrationUpdate {
  enabled?: boolean;
  config?: Record<string, unknown>;
  encrypted_credentials?: string | null;
}

/**
 * Project Integration Repository
 */
export class ProjectIntegrationRepository extends BaseRepository<
  ProjectIntegration,
  ProjectIntegrationInsert,
  ProjectIntegrationUpdate
> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'project_integrations', ['config']);
  }

  /**
   * Find integration by project ID and platform
   */
  async findByProjectAndPlatform(
    projectId: string,
    platform: string
  ): Promise<ProjectIntegration | null> {
    return this.findByMultiple({
      project_id: projectId,
      platform: platform.toLowerCase(),
    });
  }

  /**
   * Find enabled integration by project ID and platform
   */
  async findEnabledByProjectAndPlatform(
    projectId: string,
    platform: string
  ): Promise<ProjectIntegration | null> {
    return this.findByMultiple({
      project_id: projectId,
      platform: platform.toLowerCase(),
      enabled: true,
    });
  }

  /**
   * Upsert integration configuration
   * Creates or updates integration for a project
   */
  async upsert(
    projectId: string,
    platform: string,
    data: {
      enabled: boolean;
      config: Record<string, unknown>;
      encrypted_credentials: string;
    }
  ): Promise<ProjectIntegration> {
    const query = `
      INSERT INTO ${this.tableName} 
        (project_id, platform, enabled, config, encrypted_credentials)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id, platform)
      DO UPDATE SET
        enabled = EXCLUDED.enabled,
        config = EXCLUDED.config,
        encrypted_credentials = EXCLUDED.encrypted_credentials,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await this.getClient().query<ProjectIntegration>(query, [
      projectId,
      platform.toLowerCase(),
      data.enabled,
      JSON.stringify(data.config),
      data.encrypted_credentials,
    ]);

    return this.deserialize(result.rows[0]);
  }

  /**
   * Delete integration by project ID and platform
   */
  async deleteByProjectAndPlatform(projectId: string, platform: string): Promise<boolean> {
    const query = `
      DELETE FROM ${this.tableName}
      WHERE project_id = $1 AND platform = $2
    `;

    const result = await this.getClient().query(query, [projectId, platform.toLowerCase()]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Set enabled status for integration
   */
  async setEnabled(projectId: string, platform: string, enabled: boolean): Promise<boolean> {
    const query = `
      UPDATE ${this.tableName}
      SET enabled = $1, updated_at = CURRENT_TIMESTAMP
      WHERE project_id = $2 AND platform = $3
    `;

    const result = await this.getClient().query(query, [
      enabled,
      projectId,
      platform.toLowerCase(),
    ]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Get all integrations for a project
   */
  async findAllByProject(projectId: string): Promise<ProjectIntegration[]> {
    return this.findManyBy('project_id', projectId);
  }

  /**
   * Get all enabled integrations for a project
   */
  async findEnabledByProject(projectId: string): Promise<ProjectIntegration[]> {
    const query = `
      SELECT * FROM ${this.tableName}
      WHERE project_id = $1 AND enabled = TRUE
      ORDER BY created_at DESC
    `;

    const result = await this.getClient().query<ProjectIntegration>(query, [projectId]);
    return this.deserializeMany(result.rows);
  }
}
