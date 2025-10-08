/**
 * Transaction types and utilities
 */

import type { Pool, PoolClient } from 'pg';
import {
  ProjectRepository,
  BugReportRepository,
  UserRepository,
  SessionRepository,
  TicketRepository,
} from './repositories.js';

export interface RepositoryRegistry {
  projects: ProjectRepository;
  bugReports: BugReportRepository;
  users: UserRepository;
  sessions: SessionRepository;
  tickets: TicketRepository;
}

export type TransactionContext = RepositoryRegistry;

export type TransactionCallback<T> = (tx: TransactionContext) => Promise<T>;

export function createRepositories(pool: Pool | PoolClient): RepositoryRegistry {
  return {
    projects: new ProjectRepository(pool as Pool),
    bugReports: new BugReportRepository(pool as Pool),
    users: new UserRepository(pool as Pool),
    sessions: new SessionRepository(pool as Pool),
    tickets: new TicketRepository(pool as Pool),
  };
}
