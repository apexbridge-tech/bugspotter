/**
 * Transaction types and utilities
 */

import type { Pool, PoolClient } from 'pg';
import {
  ProjectRepository,
  ProjectMemberRepository,
  BugReportRepository,
  UserRepository,
  SessionRepository,
  TicketRepository,
} from './repositories.js';

export interface RepositoryRegistry {
  projects: ProjectRepository;
  projectMembers: ProjectMemberRepository;
  bugReports: BugReportRepository;
  users: UserRepository;
  sessions: SessionRepository;
  tickets: TicketRepository;
  retention: BugReportRepository;
}

export type TransactionContext = RepositoryRegistry;

export type TransactionCallback<T> = (tx: TransactionContext) => Promise<T>;

export function createRepositories(pool: Pool | PoolClient): RepositoryRegistry {
  const bugReports = new BugReportRepository(pool);

  return {
    projects: new ProjectRepository(pool),
    projectMembers: new ProjectMemberRepository(pool),
    bugReports,
    users: new UserRepository(pool),
    sessions: new SessionRepository(pool),
    tickets: new TicketRepository(pool),
    // Retention operations consolidated into BugReportRepository
    retention: bugReports,
  };
}
