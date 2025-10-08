import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseClient } from '../src/db/client.js';
import type { ProjectInsert, BugReportInsert } from '../src/db/types.js';

// Test database configuration - use DATABASE_URL set by testcontainers
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/bugspotter_test';

// Generate unique identifiers for tests to avoid collisions
let uniqueCounter = 0;
function generateUniqueId(): string {
  return `${Date.now()}-${process.hrtime.bigint()}-${++uniqueCounter}`;
}

describe('DatabaseClient', () => {
  let db: DatabaseClient;
  let testProjectId: string;
  const createdProjectIds: string[] = [];

  beforeAll(async () => {
    // Create database client
    db = new DatabaseClient({
      connectionString: TEST_DATABASE_URL,
    });

    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      throw new Error('Failed to connect to test database');
    }
  });

  afterAll(async () => {
    // Clean up all created projects (will cascade delete related records)
    for (const projectId of createdProjectIds) {
      try {
        await db.projects.delete(projectId);
      } catch (error) {
        // Ignore errors if already deleted
      }
    }
    // Close connection
    await db.close();
  });

  beforeEach(async () => {
    // Create a test project before each test
    const projectData: ProjectInsert = {
      name: 'Test Project',
      api_key: `test-key-${generateUniqueId()}`,
      settings: { theme: 'dark' },
    };
    const project = await db.projects.create(projectData);
    testProjectId = project.id;
    createdProjectIds.push(project.id);
  });

  describe('Connection', () => {
    it('should successfully connect to database', async () => {
      const result = await db.testConnection();
      expect(result).toBe(true);
    });
  });

  describe('Projects', () => {
    it('should create a project', async () => {
      const data: ProjectInsert = {
        name: 'New Project',
        api_key: `api-key-${generateUniqueId()}`,
        settings: { color: 'blue' },
      };

      const project = await db.projects.create(data);
      createdProjectIds.push(project.id); // Track for cleanup

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe(data.name);
      expect(project.api_key).toBe(data.api_key);
      expect(project.settings).toEqual(data.settings);
      expect(project.created_at).toBeInstanceOf(Date);
    });

    it('should get project by ID', async () => {
      const project = await db.projects.findById(testProjectId);

      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
      expect(project?.name).toBe('Test Project');
    });

    it('should get project by API key', async () => {
      const created = await db.projects.findById(testProjectId);
      const project = await db.projects.findByApiKey(created!.api_key);

      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
    });

    it('should update project', async () => {
      const updated = await db.projects.update(testProjectId, {
        name: 'Updated Project',
        settings: { theme: 'light' },
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Project');
      expect(updated?.settings).toEqual({ theme: 'light' });
    });

    it('should delete project', async () => {
      const result = await db.projects.delete(testProjectId);
      expect(result).toBe(true);

      const project = await db.projects.findById(testProjectId);
      expect(project).toBeNull();
    });

    it('should return null for non-existent project', async () => {
      const project = await db.projects.findById('00000000-0000-0000-0000-000000000000');
      expect(project).toBeNull();
    });
  });

  describe('Bug Reports', () => {
    it('should create a bug report', async () => {
      const data: BugReportInsert = {
        project_id: testProjectId,
        title: 'Test Bug',
        description: 'This is a test bug',
        metadata: { browser: 'Chrome', version: '120' },
        status: 'open',
        priority: 'high',
      };

      const bugReport = await db.bugReports.create(data);

      expect(bugReport).toBeDefined();
      expect(bugReport.id).toBeDefined();
      expect(bugReport.title).toBe(data.title);
      expect(bugReport.project_id).toBe(testProjectId);
      expect(bugReport.status).toBe('open');
      expect(bugReport.priority).toBe('high');
      expect(bugReport.metadata).toEqual(data.metadata);
    });

    it('should get bug report by ID', async () => {
      const created = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Get Test Bug',
      });

      const bugReport = await db.bugReports.findById(created.id);

      expect(bugReport).toBeDefined();
      expect(bugReport?.id).toBe(created.id);
      expect(bugReport?.title).toBe('Get Test Bug');
    });

    it('should update bug report', async () => {
      const created = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Original Title',
        status: 'open',
      });

      const updated = await db.bugReports.update(created.id, {
        title: 'Updated Title',
        status: 'in-progress',
        priority: 'critical',
      });

      expect(updated).toBeDefined();
      expect(updated?.title).toBe('Updated Title');
      expect(updated?.status).toBe('in-progress');
      expect(updated?.priority).toBe('critical');
    });

    it('should list bug reports with pagination', async () => {
      // Create multiple bug reports
      for (let i = 1; i <= 5; i++) {
        await db.bugReports.create({
          project_id: testProjectId,
          title: `Bug ${i}`,
          priority: i <= 2 ? 'high' : 'low',
        });
      }

      const result = await db.bugReports.list(
        { project_id: testProjectId },
        { sort_by: 'created_at', order: 'desc' },
        { page: 1, limit: 3 }
      );

      expect(result.data).toHaveLength(3);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(3);
      expect(result.pagination.total).toBeGreaterThanOrEqual(5);
    });

    it('should filter bug reports by status', async () => {
      await db.bugReports.create({
        project_id: testProjectId,
        title: 'Open Bug',
        status: 'open',
      });

      await db.bugReports.create({
        project_id: testProjectId,
        title: 'Resolved Bug',
        status: 'resolved',
      });

      const result = await db.bugReports.list({ project_id: testProjectId, status: 'open' });

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((bug) => {
        expect(bug.status).toBe('open');
      });
    });

    it('should filter bug reports by priority', async () => {
      await db.bugReports.create({
        project_id: testProjectId,
        title: 'Critical Bug',
        priority: 'critical',
      });

      const result = await db.bugReports.list({ project_id: testProjectId, priority: 'critical' });

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((bug) => {
        expect(bug.priority).toBe('critical');
      });
    });

    it('should delete bug report', async () => {
      const created = await db.bugReports.create({
        project_id: testProjectId,
        title: 'To Delete',
      });

      const result = await db.bugReports.delete(created.id);
      expect(result).toBe(true);

      const bugReport = await db.bugReports.findById(created.id);
      expect(bugReport).toBeNull();
    });
  });

  describe('Sessions', () => {
    let bugReportId: string;

    beforeEach(async () => {
      const bugReport = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Bug with Session',
      });
      bugReportId = bugReport.id;
    });

    it('should create a session', async () => {
      const events = {
        type: 'rrweb',
        events: [{ type: 'FullSnapshot', data: {} }],
      };

      const session = await db.sessions.createSession(bugReportId, events, 5000);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.bug_report_id).toBe(bugReportId);
      expect(session.events).toEqual(events);
      expect(session.duration).toBe(5000);
    });

    it('should get sessions by bug report', async () => {
      await db.sessions.createSession(bugReportId, { event: 1 }, 1000);
      await db.sessions.createSession(bugReportId, { event: 2 }, 2000);

      const sessions = await db.sessions.findByBugReport(bugReportId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].bug_report_id).toBe(bugReportId);
    });
  });

  describe('Users', () => {
    it('should create a user', async () => {
      const email = `test-${Date.now()}@example.com`;
      const user = await db.users.create({
        email,
        password_hash: 'hashed_password',
        role: 'user',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.role).toBe('user');
    });

    it('should get user by email', async () => {
      const email = `test-${Date.now()}@example.com`;
      await db.users.create({
        email,
        password_hash: 'hashed_password',
      });

      const user = await db.users.findByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should create OAuth user', async () => {
      const email = `oauth-${Date.now()}@example.com`;
      const user = await db.users.create({
        email,
        oauth_provider: 'google',
        oauth_id: '12345',
        role: 'user',
      });

      expect(user).toBeDefined();
      expect(user.oauth_provider).toBe('google');
      expect(user.oauth_id).toBe('12345');
    });

    it('should get user by OAuth credentials', async () => {
      const email = `oauth-${Date.now()}@example.com`;
      await db.users.create({
        email,
        oauth_provider: 'github',
        oauth_id: 'gh123',
      });

      const user = await db.users.findByOAuth('github', 'gh123');

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should enforce unique email addresses', async () => {
      const email = `duplicate-${Date.now()}@example.com`;

      await db.users.create({
        email,
        password_hash: 'password1',
      });

      // Try to create another user with same email (different auth method)
      await expect(
        db.users.create({
          email,
          oauth_provider: 'google',
          oauth_id: 'google123',
        })
      ).rejects.toThrow();
    });

    it('should enforce unique OAuth credentials', async () => {
      const email1 = `oauth1-${Date.now()}@example.com`;
      const email2 = `oauth2-${Date.now()}@example.com`;

      await db.users.create({
        email: email1,
        oauth_provider: 'google',
        oauth_id: 'same-id-123',
      });

      // Try to create another user with same OAuth credentials
      await expect(
        db.users.create({
          email: email2,
          oauth_provider: 'google',
          oauth_id: 'same-id-123',
        })
      ).rejects.toThrow();
    });

    it('should reject users with both password and OAuth', async () => {
      const email = `invalid-${Date.now()}@example.com`;

      // This violates the check_auth_method constraint
      await expect(
        db.users.create({
          email,
          password_hash: 'password123',
          oauth_provider: 'google',
          oauth_id: 'google123',
        })
      ).rejects.toThrow();
    });

    it('should reject users with neither password nor OAuth', async () => {
      const email = `invalid2-${Date.now()}@example.com`;

      // This violates the check_auth_method constraint
      await expect(
        db.users.create({
          email,
          // No password_hash, no oauth_provider/oauth_id
        })
      ).rejects.toThrow();
    });
  });

  describe('Tickets', () => {
    let bugReportId: string;

    beforeEach(async () => {
      const bugReport = await db.bugReports.create({
        project_id: testProjectId,
        title: 'Bug with Ticket',
      });
      bugReportId = bugReport.id;
    });

    it('should create a ticket', async () => {
      const ticket = await db.tickets.createTicket(bugReportId, 'JIRA-123', 'jira', 'open');

      expect(ticket).toBeDefined();
      expect(ticket.id).toBeDefined();
      expect(ticket.bug_report_id).toBe(bugReportId);
      expect(ticket.external_id).toBe('JIRA-123');
      expect(ticket.platform).toBe('jira');
    });

    it('should get tickets by bug report', async () => {
      await db.tickets.createTicket(bugReportId, 'JIRA-789', 'jira');
      await db.tickets.createTicket(bugReportId, 'LIN-456', 'linear');

      const tickets = await db.tickets.findByBugReport(bugReportId);

      expect(tickets).toHaveLength(2);
      expect(tickets[0].bug_report_id).toBe(bugReportId);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project ID gracefully', async () => {
      // PostgreSQL will throw an error for invalid UUID format
      await expect(db.projects.findById('invalid-id')).rejects.toThrow();
    });

    it('should handle duplicate API key', async () => {
      const apiKey = `duplicate-${generateUniqueId()}`;

      const firstProject = await db.projects.create({
        name: 'First',
        api_key: apiKey,
      });
      createdProjectIds.push(firstProject.id); // Track for cleanup

      await expect(
        db.projects.create({
          name: 'Second',
          api_key: apiKey,
        })
      ).rejects.toThrow();
    });
  });

  describe('Transactions', () => {
    it('should commit transaction on success', async () => {
      const result = await db.transaction(async (tx) => {
        const bug = await tx.bugReports.create({
          project_id: testProjectId,
          title: 'Transaction Test Bug',
        });

        const session = await tx.sessions.createSession(bug.id, { events: [] });

        return { bug, session };
      });

      expect(result.bug).toBeDefined();
      expect(result.session).toBeDefined();
      expect(result.session.bug_report_id).toBe(result.bug.id);

      // Verify data persisted
      const bug = await db.bugReports.findById(result.bug.id);
      expect(bug).toBeDefined();
    });

    it('should rollback transaction on error', async () => {
      let createdBugId: string | null = null;

      await expect(
        db.transaction(async (tx) => {
          const bug = await tx.bugReports.create({
            project_id: testProjectId,
            title: 'Rollback Test Bug',
          });
          createdBugId = bug.id;

          // Intentionally cause an error
          throw new Error('Test error - should rollback');
        })
      ).rejects.toThrow('Test error - should rollback');

      // Verify data was rolled back
      if (createdBugId) {
        const bug = await db.bugReports.findById(createdBugId);
        expect(bug).toBeNull();
      }
    });
  });

  describe('Batch Operations', () => {
    it('should create multiple bug reports in batch', async () => {
      const bugData: BugReportInsert[] = [
        {
          project_id: testProjectId,
          title: 'Batch Bug 1',
          priority: 'high',
        },
        {
          project_id: testProjectId,
          title: 'Batch Bug 2',
          priority: 'low',
        },
        {
          project_id: testProjectId,
          title: 'Batch Bug 3',
          priority: 'medium',
        },
      ];

      const results = await db.bugReports.createBatch(bugData);

      expect(results).toHaveLength(3);
      expect(results[0].title).toBe('Batch Bug 1');
      expect(results[1].title).toBe('Batch Bug 2');
      expect(results[2].title).toBe('Batch Bug 3');

      // Verify all were created
      for (const bug of results) {
        const found = await db.bugReports.findById(bug.id);
        expect(found).toBeDefined();
      }
    });

    it('should return empty array for empty batch', async () => {
      const results = await db.bugReports.createBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in ORDER BY clause', async () => {
      // Attempt SQL injection through sort parameter
      await expect(
        db.bugReports.list(
          { project_id: testProjectId },
          // @ts-expect-error - Testing runtime injection attempt
          { sort_by: 'created_at; DROP TABLE bug_reports--', order: 'desc' },
          { page: 1, limit: 10 }
        )
      ).rejects.toThrow('Invalid SQL identifier');
    });

    it('should allow valid column names in ORDER BY', async () => {
      // Valid column names should work
      const result = await db.bugReports.list(
        { project_id: testProjectId },
        { sort_by: 'created_at', order: 'desc' },
        { page: 1, limit: 10 }
      );

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
    });
  });
});
