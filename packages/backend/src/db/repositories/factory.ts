/**
 * Repository Factory
 * Single source of truth for creating repository instances
 */

import type { Pool, PoolClient } from 'pg';
import { ProjectRepository } from './project.repository.js';
import { ProjectMemberRepository } from './project-member.repository.js';
import { BugReportRepository } from './bug-report.repository.js';
import { UserRepository } from './user.repository.js';
import { SessionRepository } from './session.repository.js';
import { TicketRepository } from './ticket.repository.js';
import { SystemConfigRepository } from './system-config.repository.js';
import { AuditLogRepository } from './audit-log.repository.js';
import { ProjectIntegrationRepository } from '../project-integration.repository.js';

export interface RepositoryRegistry {
  projects: ProjectRepository;
  projectMembers: ProjectMemberRepository;
  bugReports: BugReportRepository;
  users: UserRepository;
  sessions: SessionRepository;
  tickets: TicketRepository;
  projectIntegrations: ProjectIntegrationRepository;
  systemConfig: SystemConfigRepository;
  auditLogs: AuditLogRepository;
  retention: BugReportRepository;
}

/**
 * Create all repository instances with the given database connection
 * Used by both DatabaseClient and transaction contexts
 */
export function createRepositories(pool: Pool | PoolClient): RepositoryRegistry {
  const bugReports = new BugReportRepository(pool);

  return {
    projects: new ProjectRepository(pool),
    projectMembers: new ProjectMemberRepository(pool),
    bugReports,
    users: new UserRepository(pool),
    sessions: new SessionRepository(pool),
    tickets: new TicketRepository(pool),
    projectIntegrations: new ProjectIntegrationRepository(pool),
    systemConfig: new SystemConfigRepository(pool),
    auditLogs: new AuditLogRepository(pool),
    // Retention operations consolidated into BugReportRepository
    retention: bugReports,
  };
}
