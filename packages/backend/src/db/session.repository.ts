/**
 * Session Repository
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import type { Session } from './types.js';

export class SessionRepository extends BaseRepository<Session, Partial<Session>, never> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'sessions', ['events']);
  }

  /**
   * Create session with required fields
   */
  async createSession(
    bugReportId: string,
    events: Record<string, unknown>,
    duration?: number
  ): Promise<Session> {
    return this.create({
      bug_report_id: bugReportId,
      events,
      duration: duration ?? null,
    });
  }

  /**
   * Find sessions by bug report ID
   */
  async findByBugReport(bugReportId: string): Promise<Session[]> {
    return this.findManyBy('bug_report_id', bugReportId);
  }
}
