/**
 * Jira Bug Report Mapper
 * Converts BugReport to Jira issue format
 */

import type { BugReport } from '../../db/types.js';
import type {
  JiraConfig,
  JiraIssueFields,
  JiraPriority,
  JiraDescription,
  JiraDescriptionNode,
} from './types.js';

/**
 * Map BugSpotter priority to Jira priority
 */
function mapPriorityToJira(priority?: string): JiraPriority {
  const priorityMap: Record<string, JiraPriority> = {
    critical: 'Highest',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    minor: 'Lowest',
  };

  return priorityMap[priority?.toLowerCase() || 'medium'] || 'Medium';
}

/**
 * Create Jira Atlassian Document Format (ADF) description
 * Used in newer Jira Cloud instances for rich text
 */
function createADFDescription(bugReport: BugReport): JiraDescription {
  const content: JiraDescriptionNode[] = [];

  // Add description if present
  if (bugReport.description) {
    content.push({
      type: 'paragraph',
      content: [
        {
          type: 'text',
          text: bugReport.description,
        },
      ],
    });

    // Add spacing
    content.push({
      type: 'paragraph',
      content: [],
    });
  }

  // Add metadata section
  content.push({
    type: 'heading',
    attrs: { level: 3 },
    content: [
      {
        type: 'text',
        text: 'Bug Report Details',
        marks: [{ type: 'strong' }],
      },
    ],
  });

  // Add bug report ID
  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Bug Report ID: ',
        marks: [{ type: 'strong' }],
      },
      {
        type: 'text',
        text: bugReport.id,
      },
    ],
  });

  // Add status
  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Status: ',
        marks: [{ type: 'strong' }],
      },
      {
        type: 'text',
        text: bugReport.status.toUpperCase(),
      },
    ],
  });

  // Add created timestamp
  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Created: ',
        marks: [{ type: 'strong' }],
      },
      {
        type: 'text',
        text: bugReport.created_at.toISOString(),
      },
    ],
  });

  // Add metadata if present
  if (bugReport.metadata && Object.keys(bugReport.metadata).length > 0) {
    content.push({
      type: 'paragraph',
      content: [],
    });

    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [
        {
          type: 'text',
          text: 'Additional Information',
          marks: [{ type: 'strong' }],
        },
      ],
    });

    // Add metadata as code block for readability
    content.push({
      type: 'codeBlock',
      content: [
        {
          type: 'text',
          text: JSON.stringify(bugReport.metadata, null, 2),
        },
      ],
    });
  }

  // Add URLs section
  if (bugReport.screenshot_url || bugReport.replay_url) {
    content.push({
      type: 'paragraph',
      content: [],
    });

    content.push({
      type: 'heading',
      attrs: { level: 3 },
      content: [
        {
          type: 'text',
          text: 'Attachments',
          marks: [{ type: 'strong' }],
        },
      ],
    });

    if (bugReport.screenshot_url) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '📸 Screenshot: ',
            marks: [{ type: 'strong' }],
          },
          {
            type: 'text',
            text: bugReport.screenshot_url,
            marks: [
              {
                type: 'link',
                attrs: { href: bugReport.screenshot_url },
              },
            ],
          },
        ],
      });
    }

    if (bugReport.replay_url) {
      content.push({
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: '🎥 Session Replay: ',
            marks: [{ type: 'strong' }],
          },
          {
            type: 'text',
            text: bugReport.replay_url,
            marks: [
              {
                type: 'link',
                attrs: { href: bugReport.replay_url },
              },
            ],
          },
        ],
      });
    }
  }

  // Add footer
  content.push({
    type: 'paragraph',
    content: [],
  });

  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: '---',
      },
    ],
  });

  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Automatically created by BugSpotter',
        marks: [{ type: 'em' }],
      },
    ],
  });

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

/**
 * Create plain text description (fallback for older Jira versions)
 */
function createPlainTextDescription(bugReport: BugReport): string {
  const lines: string[] = [];

  // Add description
  if (bugReport.description) {
    lines.push(bugReport.description);
    lines.push('');
  }

  // Add metadata
  lines.push('*Bug Report Details*');
  lines.push(`*Bug Report ID:* ${bugReport.id}`);
  lines.push(`*Status:* ${bugReport.status.toUpperCase()}`);
  lines.push(`*Created:* ${bugReport.created_at.toISOString()}`);
  lines.push('');

  // Add metadata if present
  if (bugReport.metadata && Object.keys(bugReport.metadata).length > 0) {
    lines.push('*Additional Information*');
    lines.push('{code:json}');
    lines.push(JSON.stringify(bugReport.metadata, null, 2));
    lines.push('{code}');
    lines.push('');
  }

  // Add URLs
  if (bugReport.screenshot_url || bugReport.replay_url) {
    lines.push('*Attachments*');
    if (bugReport.screenshot_url) {
      lines.push(`📸 Screenshot: ${bugReport.screenshot_url}`);
    }
    if (bugReport.replay_url) {
      lines.push(`🎥 Session Replay: ${bugReport.replay_url}`);
    }
    lines.push('');
  }

  // Add footer
  lines.push('---');
  lines.push('_Automatically created by BugSpotter_');

  return lines.join('\n');
}

/**
 * Jira Bug Report Mapper
 * Converts BugReport to Jira issue format
 */
export class JiraBugReportMapper {
  private config: JiraConfig;
  private useADF: boolean;

  constructor(config: JiraConfig, useADF = true) {
    this.config = config;
    this.useADF = useADF;
  }

  /**
   * Convert BugReport to Jira issue fields
   */
  toJiraIssue(bugReport: BugReport): JiraIssueFields {
    // Truncate title to Jira's 255 character limit
    const summary =
      bugReport.title.length > 255 ? bugReport.title.substring(0, 252) + '...' : bugReport.title;

    const issueFields: JiraIssueFields = {
      project: {
        key: this.config.projectKey,
      },
      issuetype: {
        name: this.config.issueType || 'Bug',
      },
      summary,
      description: this.useADF
        ? createADFDescription(bugReport)
        : createPlainTextDescription(bugReport),
      priority: {
        name: mapPriorityToJira(bugReport.priority),
      },
      labels: ['bugspotter', 'automated'],
    };

    return issueFields;
  }

  /**
   * Format description for Jira (convenience method)
   */
  formatDescription(bugReport: BugReport): string | JiraDescription {
    return this.useADF ? createADFDescription(bugReport) : createPlainTextDescription(bugReport);
  }
}
