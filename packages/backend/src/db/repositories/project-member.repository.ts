/**
 * Project Member Repository
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import type { ProjectMember, ProjectMemberInsert } from '../types.js';

export class ProjectMemberRepository extends BaseRepository<
  ProjectMember,
  ProjectMemberInsert,
  never
> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'project_members', []);
  }

  /**
   * Add user to project
   */
  async addMember(
    projectId: string,
    userId: string,
    role: 'owner' | 'admin' | 'member' | 'viewer' = 'member'
  ): Promise<ProjectMember> {
    return this.create({
      project_id: projectId,
      user_id: userId,
      role,
    });
  }

  /**
   * Remove user from project
   */
  async removeMember(projectId: string, userId: string): Promise<void> {
    const query = `DELETE FROM ${this.tableName} WHERE project_id = $1 AND user_id = $2`;
    await this.getClient().query(query, [projectId, userId]);
  }

  /**
   * Get all members of a project
   */
  async getProjectMembers(projectId: string): Promise<ProjectMember[]> {
    return this.findManyBy('project_id', projectId);
  }

  /**
   * Get all projects for a user
   */
  async getUserProjects(userId: string): Promise<ProjectMember[]> {
    return this.findManyBy('user_id', userId);
  }
}
