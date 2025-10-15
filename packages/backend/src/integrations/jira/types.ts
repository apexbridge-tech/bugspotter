/**
 * Jira Integration Types
 * Type definitions for Jira REST API v3
 */

/**
 * Jira configuration for a project
 */
export interface JiraConfig {
  host: string; // https://company.atlassian.net
  email: string; // user@company.com
  apiToken: string; // Jira API token (never password)
  projectKey: string; // Default project (e.g., "BUG")
  issueType?: string; // Default: "Bug"
  enabled: boolean;
}

/**
 * Jira credentials (sensitive data that gets encrypted)
 */
export interface JiraCredentials {
  email: string;
  apiToken: string;
}

/**
 * Jira configuration (non-sensitive data)
 */
export interface JiraProjectConfig {
  host: string;
  projectKey: string;
  issueType: string;
  autoCreate: boolean;
  syncStatus: boolean;
  syncComments: boolean;
  customFields?: Record<string, unknown>;
}

/**
 * Jira issue priority mapping
 */
export type JiraPriority = 'Highest' | 'High' | 'Medium' | 'Low' | 'Lowest';

/**
 * Jira issue type
 */
export type JiraIssueType = 'Bug' | 'Task' | 'Story' | 'Epic' | 'Subtask';

/**
 * Jira issue fields for creation
 * Matches Jira REST API v3 format
 */
export interface JiraIssueFields {
  project: {
    key: string; // Project key (e.g., "BUG")
  };
  issuetype: {
    name: string; // Issue type (e.g., "Bug")
  };
  summary: string; // Issue title (max 255 characters)
  description: JiraDescription | string; // Issue description (ADF or text)
  priority?: {
    name: JiraPriority; // Priority name
  };
  labels?: string[]; // Issue labels
  assignee?: {
    accountId?: string; // Assignee account ID
    emailAddress?: string; // Assignee email (deprecated)
  };
  reporter?: {
    accountId?: string; // Reporter account ID
    emailAddress?: string; // Reporter email (deprecated)
  };
  customfield_?: unknown; // Custom fields (customfield_10000, etc.)
}

/**
 * Jira Atlassian Document Format (ADF) for rich text
 * Used in newer Jira Cloud instances
 */
export interface JiraDescription {
  type: 'doc';
  version: 1;
  content: JiraDescriptionNode[];
}

export interface JiraDescriptionNode {
  type: string;
  content?: JiraDescriptionNode[];
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

/**
 * Jira issue response from API
 */
export interface JiraIssue {
  id: string;
  key: string; // Issue key (e.g., "BUG-123")
  self: string; // API URL to issue
  fields: {
    summary: string;
    description: JiraDescription | string;
    status: {
      name: string;
    };
    priority?: {
      name: string;
    };
    created: string;
    updated: string;
  };
}

/**
 * Jira attachment upload response
 */
export interface JiraAttachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  content: string; // URL to attachment
  thumbnail?: string; // URL to thumbnail
}

/**
 * Jira API error response
 */
export interface JiraError {
  errorMessages?: string[];
  errors?: Record<string, string>;
  statusCode?: number;
}

/**
 * Jira connection test result
 */
export interface JiraConnectionTestResult {
  valid: boolean;
  error?: string;
  details?: {
    host: string;
    projectExists: boolean;
    userHasAccess: boolean;
  };
}

/**
 * Jira integration result
 */
export interface JiraIntegrationResult {
  issueKey: string; // Jira issue key (e.g., "BUG-123")
  issueUrl: string; // URL to issue
  issueId: string; // Jira internal ID
  attachments: JiraAttachment[];
}
