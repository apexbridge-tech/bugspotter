/**
 * Jira Mapper Tests
 */

import { describe, it, expect } from 'vitest';
import { JiraBugReportMapper } from '../../../src/integrations/jira/mapper.js';
import type { BugReport } from '../../../src/db/types.js';
import type { JiraConfig, JiraDescription } from '../../../src/integrations/jira/types.js';
import type { BugPriority } from '@bugspotter/types';

describe('JiraBugReportMapper', () => {
  const mockConfig: JiraConfig = {
    host: 'https://example.atlassian.net',
    email: 'test@example.com',
    apiToken: 'test-token',
    projectKey: 'PROJ',
    issueType: 'Bug',
    enabled: true,
  };

  const mockBugReport: BugReport = {
    id: 'bug-123',
    project_id: 'proj-456',
    title: 'Application crashes on login',
    description: 'The app crashes when user tries to login with email',
    priority: 'critical' as BugPriority,
    status: 'open',
    screenshot_url: null,
    replay_url: null,
    metadata: {
      browser: 'Chrome 120.0.0',
      os: 'Windows 11',
      custom_data: { feature_flag: 'new_auth' },
    },
    deleted_at: null,
    deleted_by: null,
    legal_hold: false,
    created_at: new Date('2025-01-15T10:30:00Z'),
    updated_at: new Date('2025-01-15T10:30:00Z'),
  };

  describe('toJiraIssue', () => {
    it('should convert bug report to Jira issue format', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(mockBugReport);

      expect(issue.project.key).toBe('PROJ');
      expect(issue.issuetype.name).toBe('Bug');
      expect(issue.summary).toBe('Application crashes on login');
    });

    it('should format description in ADF format by default', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(mockBugReport);

      expect(typeof issue.description).toBe('object');
      if (typeof issue.description !== 'string') {
        expect(issue.description.type).toBe('doc');
        expect(issue.description.version).toBe(1);
        expect(issue.description.content).toBeDefined();
      }
    });

    it('should include bug report details in ADF description', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(mockBugReport);
      const descStr = JSON.stringify(issue.description);

      expect(descStr).toContain('Bug Report Details');
      expect(descStr).toContain('bug-123');
      expect(descStr).toContain('OPEN');
    });

    it('should include metadata when present', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(mockBugReport);
      const descStr = JSON.stringify(issue.description);

      expect(descStr).toContain('Additional Information');
      expect(descStr).toContain('browser');
      expect(descStr).toContain('Chrome 120.0.0');
    });

    it('should include URLs when present', () => {
      const bugWithUrls: BugReport = {
        ...mockBugReport,
        screenshot_url: 'https://example.com/screenshot.png',
        replay_url: 'https://example.com/replay.json',
      };

      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(bugWithUrls);
      const descStr = JSON.stringify(issue.description);

      expect(descStr).toContain('Attachments');
      expect(descStr).toContain('screenshot.png');
      expect(descStr).toContain('replay.json');
    });

    it('should handle missing optional fields', () => {
      const minimalBugReport: BugReport = {
        id: 'bug-456',
        project_id: 'proj-789',
        title: 'Simple bug',
        description: 'Description',
        priority: 'medium' as BugPriority,
        status: 'open',
        screenshot_url: null,
        replay_url: null,
        metadata: {},
        deleted_at: null,
        deleted_by: null,
        legal_hold: false,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(minimalBugReport);

      expect(issue.summary).toBe('Simple bug');
      expect(issue.description).toBeDefined();
    });

    it('should map priority to Jira priority names', () => {
      const mapper = new JiraBugReportMapper(mockConfig);

      const criticalBug = { ...mockBugReport, priority: 'critical' as BugPriority };
      const highBug = { ...mockBugReport, priority: 'high' as BugPriority };
      const mediumBug = { ...mockBugReport, priority: 'medium' as BugPriority };
      const lowBug = { ...mockBugReport, priority: 'low' as BugPriority };

      expect(mapper.toJiraIssue(criticalBug).priority?.name).toBe('Highest');
      expect(mapper.toJiraIssue(highBug).priority?.name).toBe('High');
      expect(mapper.toJiraIssue(mediumBug).priority?.name).toBe('Medium');
      expect(mapper.toJiraIssue(lowBug).priority?.name).toBe('Low');
    });

    it('should include bugspotter and automated labels', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const issue = mapper.toJiraIssue(mockBugReport);

      expect(issue.labels).toContain('bugspotter');
      expect(issue.labels).toContain('automated');
    });

    it('should truncate long titles to 255 characters', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const longTitle = 'A'.repeat(300);
      const bugWithLongTitle = { ...mockBugReport, title: longTitle };

      const issue = mapper.toJiraIssue(bugWithLongTitle);

      expect(issue.summary.length).toBeLessThanOrEqual(255);
      expect(issue.summary).toContain('...');
    });
  });

  describe('formatDescription', () => {
    it('should return ADF format when useADF is true', () => {
      const mapper = new JiraBugReportMapper(mockConfig, true);
      const description = mapper.formatDescription(mockBugReport);

      expect(typeof description).toBe('object');
      if (typeof description !== 'string') {
        expect(description.type).toBe('doc');
      }
    });

    it('should return plain text when useADF is false', () => {
      const mapper = new JiraBugReportMapper(mockConfig, false);
      const description = mapper.formatDescription(mockBugReport);

      expect(typeof description).toBe('string');
    });
  });

  describe('ADF formatting', () => {
    it('should create proper paragraph nodes', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const description = mapper.formatDescription(mockBugReport) as JiraDescription;

      const paragraphs = description.content.filter((node) => node.type === 'paragraph');
      expect(paragraphs.length).toBeGreaterThan(0);
    });

    it('should create proper heading nodes', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const description = mapper.formatDescription(mockBugReport) as JiraDescription;

      const headings = description.content.filter((node) => node.type === 'heading');
      expect(headings.length).toBeGreaterThan(0);
      expect(headings[0].attrs?.level).toBeDefined();
    });

    it('should create code blocks for metadata JSON', () => {
      const mapper = new JiraBugReportMapper(mockConfig);
      const description = mapper.formatDescription(mockBugReport) as JiraDescription;

      const codeBlocks = description.content.filter((node) => node.type === 'codeBlock');
      expect(codeBlocks.length).toBeGreaterThan(0);
    });
  });
});
