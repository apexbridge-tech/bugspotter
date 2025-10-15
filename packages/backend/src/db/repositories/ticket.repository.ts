/**
 * Ticket Repository
 */

import type { Pool, PoolClient } from 'pg';
import { BaseRepository } from './base-repository.js';
import type { Ticket, TicketStatus } from '../types.js';

export class TicketRepository extends BaseRepository<Ticket, Partial<Ticket>, never> {
  constructor(pool: Pool | PoolClient) {
    super(pool, 'tickets', []);
  }

  /**
   * Create ticket with required fields
   */
  async createTicket(
    bugReportId: string,
    externalId: string,
    platform: string,
    status?: TicketStatus
  ): Promise<Ticket> {
    return this.create({
      bug_report_id: bugReportId,
      external_id: externalId,
      platform,
      status: status ?? null,
    });
  }

  /**
   * Find tickets by bug report ID
   */
  async findByBugReport(bugReportId: string): Promise<Ticket[]> {
    return this.findManyBy('bug_report_id', bugReportId);
  }
}
