import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { DatabaseClient } from '../src/db/client.js';
import type { ProjectInsert, BugReportInsert } from '../src/db/types.js';

// Test database configuration - use DATABASE_URL set by testcontainers
const TEST_DATABASE_URL =
  process.env.DATABASE_URL ||
  process.env.TEST_DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/bugspotter_test';

describe('DatabaseClient', () => {
  let db: DatabaseClient;
  let testProjectId: string;

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
    // Clean up and close connection
    await db.close();
  });

  beforeEach(async () => {
    // Create a test project before each test
    const projectData: ProjectInsert = {
      name: 'Test Project',
      api_key: `test-key-${Date.now()}`,
      settings: { theme: 'dark' },
    };
    const project = await db.createProject(projectData);
    testProjectId = project.id;
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
        api_key: `api-key-${Date.now()}`,
        settings: { color: 'blue' },
      };

      const project = await db.createProject(data);

      expect(project).toBeDefined();
      expect(project.id).toBeDefined();
      expect(project.name).toBe(data.name);
      expect(project.api_key).toBe(data.api_key);
      expect(project.settings).toEqual(data.settings);
      expect(project.created_at).toBeInstanceOf(Date);
    });

    it('should get project by ID', async () => {
      const project = await db.getProject(testProjectId);

      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
      expect(project?.name).toBe('Test Project');
    });

    it('should get project by API key', async () => {
      const created = await db.getProject(testProjectId);
      const project = await db.getProjectByApiKey(created!.api_key);

      expect(project).toBeDefined();
      expect(project?.id).toBe(testProjectId);
    });

    it('should update project', async () => {
      const updated = await db.updateProject(testProjectId, {
        name: 'Updated Project',
        settings: { theme: 'light' },
      });

      expect(updated).toBeDefined();
      expect(updated?.name).toBe('Updated Project');
      expect(updated?.settings).toEqual({ theme: 'light' });
    });

    it('should delete project', async () => {
      const result = await db.deleteProject(testProjectId);
      expect(result).toBe(true);

      const project = await db.getProject(testProjectId);
      expect(project).toBeNull();
    });

    it('should return null for non-existent project', async () => {
      const project = await db.getProject('00000000-0000-0000-0000-000000000000');
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

      const bugReport = await db.createBugReport(data);

      expect(bugReport).toBeDefined();
      expect(bugReport.id).toBeDefined();
      expect(bugReport.title).toBe(data.title);
      expect(bugReport.project_id).toBe(testProjectId);
      expect(bugReport.status).toBe('open');
      expect(bugReport.priority).toBe('high');
      expect(bugReport.metadata).toEqual(data.metadata);
    });

    it('should get bug report by ID', async () => {
      const created = await db.createBugReport({
        project_id: testProjectId,
        title: 'Get Test Bug',
      });

      const bugReport = await db.getBugReport(created.id);

      expect(bugReport).toBeDefined();
      expect(bugReport?.id).toBe(created.id);
      expect(bugReport?.title).toBe('Get Test Bug');
    });

    it('should update bug report', async () => {
      const created = await db.createBugReport({
        project_id: testProjectId,
        title: 'Original Title',
        status: 'open',
      });

      const updated = await db.updateBugReport(created.id, {
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
        await db.createBugReport({
          project_id: testProjectId,
          title: `Bug ${i}`,
          priority: i <= 2 ? 'high' : 'low',
        });
      }

      const result = await db.listBugReports(
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
      await db.createBugReport({
        project_id: testProjectId,
        title: 'Open Bug',
        status: 'open',
      });

      await db.createBugReport({
        project_id: testProjectId,
        title: 'Resolved Bug',
        status: 'resolved',
      });

      const result = await db.listBugReports({ project_id: testProjectId, status: 'open' });

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((bug) => {
        expect(bug.status).toBe('open');
      });
    });

    it('should filter bug reports by priority', async () => {
      await db.createBugReport({
        project_id: testProjectId,
        title: 'Critical Bug',
        priority: 'critical',
      });

      const result = await db.listBugReports({ project_id: testProjectId, priority: 'critical' });

      expect(result.data.length).toBeGreaterThan(0);
      result.data.forEach((bug) => {
        expect(bug.priority).toBe('critical');
      });
    });

    it('should delete bug report', async () => {
      const created = await db.createBugReport({
        project_id: testProjectId,
        title: 'To Delete',
      });

      const result = await db.deleteBugReport(created.id);
      expect(result).toBe(true);

      const bugReport = await db.getBugReport(created.id);
      expect(bugReport).toBeNull();
    });
  });

  describe('Sessions', () => {
    let bugReportId: string;

    beforeEach(async () => {
      const bugReport = await db.createBugReport({
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

      const session = await db.createSession(bugReportId, events, 5000);

      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.bug_report_id).toBe(bugReportId);
      expect(session.events).toEqual(events);
      expect(session.duration).toBe(5000);
    });

    it('should get sessions by bug report', async () => {
      await db.createSession(bugReportId, { event: 1 }, 1000);
      await db.createSession(bugReportId, { event: 2 }, 2000);

      const sessions = await db.getSessionsByBugReport(bugReportId);

      expect(sessions).toHaveLength(2);
      expect(sessions[0].bug_report_id).toBe(bugReportId);
    });
  });

  describe('Users', () => {
    it('should create a user', async () => {
      const email = `test-${Date.now()}@example.com`;
      const user = await db.createUser({
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
      await db.createUser({
        email,
        password_hash: 'hashed_password',
      });

      const user = await db.getUserByEmail(email);

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });

    it('should create OAuth user', async () => {
      const email = `oauth-${Date.now()}@example.com`;
      const user = await db.createUser({
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
      await db.createUser({
        email,
        oauth_provider: 'github',
        oauth_id: 'gh123',
      });

      const user = await db.getUserByOAuth('github', 'gh123');

      expect(user).toBeDefined();
      expect(user?.email).toBe(email);
    });
  });

  describe('Tickets', () => {
    let bugReportId: string;

    beforeEach(async () => {
      const bugReport = await db.createBugReport({
        project_id: testProjectId,
        title: 'Bug with Ticket',
      });
      bugReportId = bugReport.id;
    });

    it('should create a ticket', async () => {
      const ticket = await db.createTicket(bugReportId, 'JIRA-123', 'jira', 'open');

      expect(ticket).toBeDefined();
      expect(ticket.id).toBeDefined();
      expect(ticket.bug_report_id).toBe(bugReportId);
      expect(ticket.external_id).toBe('JIRA-123');
      expect(ticket.platform).toBe('jira');
    });

    it('should get tickets by bug report', async () => {
      await db.createTicket(bugReportId, 'JIRA-789', 'jira');
      await db.createTicket(bugReportId, 'LIN-456', 'linear');

      const tickets = await db.getTicketsByBugReport(bugReportId);

      expect(tickets).toHaveLength(2);
      expect(tickets[0].bug_report_id).toBe(bugReportId);
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid project ID gracefully', async () => {
      // PostgreSQL will throw an error for invalid UUID format
      await expect(db.getProject('invalid-id')).rejects.toThrow();
    });

    it('should handle duplicate API key', async () => {
      const apiKey = `duplicate-${Date.now()}`;

      await db.createProject({
        name: 'First',
        api_key: apiKey,
      });

      await expect(
        db.createProject({
          name: 'Second',
          api_key: apiKey,
        })
      ).rejects.toThrow();
    });
  });
});
