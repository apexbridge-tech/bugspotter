# Jira Integration

Complete Jira Cloud integration for BugSpotter. Automatically creates Jira issues from bug reports with screenshots and session replay links.

## Features

- ✅ **Automatic Ticket Creation**: Creates Jira issues from bug reports via job queue
- ✅ **Secure Credential Storage**: Encrypts API tokens using AES-256-GCM
- ✅ **Per-Project Configuration**: Each project can have its own Jira settings
- ✅ **Screenshot Attachments**: Uploads screenshots directly to Jira issues
- ✅ **Rich Descriptions**: Uses Atlassian Document Format (ADF) for rich text
- ✅ **Connection Testing**: Validates credentials before saving
- ✅ **Extensible Architecture**: Generic integration service registry supports future integrations (GitHub, Linear, Slack)

## Architecture

The Jira integration follows a **decoupled, service-based architecture** to support multiple integration platforms:

```
Integration Worker (Generic)
    ↓
Integration Service Registry
    ↓
Platform-Specific Services (Jira, GitHub, Linear, Slack...)
    ↓
Platform API Clients
```

### Key Components

1. **Base Integration Service** (`src/integrations/base-integration.service.ts`)
   - Interface that all integration services implement
   - Ensures consistent API across platforms

2. **Integration Service Registry** (`src/integrations/integration-registry.ts`)
   - Factory for creating and managing integration services
   - Dynamically routes jobs to the correct platform service

3. **Jira Integration Service** (`src/integrations/jira/service.ts`)
   - Implements `IntegrationService` interface
   - Orchestrates bug report → Jira ticket creation
   - Handles screenshot uploads and external ID storage

4. **Jira Client** (`src/integrations/jira/client.ts`)
   - Pure HTTP client using Node.js `https` module (no dependencies)
   - Handles Jira REST API v3 communication
   - Implements connection testing, issue creation, attachment uploads

5. **Jira Config Manager** (`src/integrations/jira/config.ts`)
   - Loads configuration from environment or database
   - Encrypts/decrypts credentials
   - Validates configuration and tests connection

6. **Bug Report Mapper** (`src/integrations/jira/mapper.ts`)
   - Converts BugReport to Jira issue format
   - Creates rich descriptions with ADF (Atlassian Document Format)
   - Maps priorities (critical → Highest, high → High, etc.)

7. **Encryption Utilities** (`src/utils/encryption.ts`)
   - AES-256-GCM encryption for credentials
   - Scrypt key derivation from master key
   - Authenticated encryption with random IVs and salts

## Setup

### 1. Generate Encryption Key

```bash
# Generate a secure encryption key
openssl rand -base64 32
```

Add to `.env`:

```bash
ENCRYPTION_KEY=your-generated-key-here
```

### 2. Run Database Migration

```bash
pnpm --filter @bugspotter/backend migrate
```

This creates the `project_integrations` table for storing encrypted credentials.

### 3. Configure Jira (Optional Global Config)

Add to `.env` for global/default Jira configuration:

```bash
JIRA_HOST=https://yourcompany.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-api-token
JIRA_PROJECT_KEY=BUG
JIRA_ISSUE_TYPE=Bug
```

**Or** configure per-project via API (recommended for multi-tenant).

### 4. Get Jira API Token

1. Go to https://id.atlassian.com/manage-profile/security/api-tokens
2. Create API token
3. Copy token (you won't see it again)

## API Endpoints

### Test Jira Connection

```http
POST /api/integrations/jira/test
Content-Type: application/json
Authorization: Bearer <jwt-token>

{
  "host": "https://yourcompany.atlassian.net",
  "email": "user@company.com",
  "apiToken": "your-api-token",
  "projectKey": "BUG"
}
```

Response:

```json
{
  "success": true,
  "data": {
    "valid": true,
    "details": {
      "host": "https://yourcompany.atlassian.net",
      "projectExists": true,
      "userHasAccess": true
    }
  }
}
```

### Save Jira Configuration

```http
POST /api/integrations/jira
Content-Type: application/json
Authorization: Bearer <jwt-token>
X-Project-ID: <project-id>

{
  "host": "https://yourcompany.atlassian.net",
  "email": "user@company.com",
  "apiToken": "your-api-token",
  "projectKey": "BUG",
  "issueType": "Bug",
  "enabled": true
}
```

### Get Jira Configuration

```http
GET /api/integrations/jira
Authorization: Bearer <jwt-token>
X-Project-ID: <project-id>
```

Response:

```json
{
  "success": true,
  "data": {
    "host": "https://yourcompany.atlassian.net",
    "projectKey": "BUG",
    "issueType": "Bug",
    "enabled": true
  }
}
```

### Delete Jira Configuration

```http
DELETE /api/integrations/jira
Authorization: Bearer <jwt-token>
X-Project-ID: <project-id>
```

## Usage

### Automatic Integration (Queue-Based)

When a bug report is created, the integration worker automatically creates a Jira ticket if:

1. Jira integration is configured for the project
2. Integration is enabled

The worker:

1. Fetches bug report from database
2. Loads Jira configuration
3. Creates Jira issue with mapped fields
4. Uploads screenshot as attachment (if present)
5. Updates bug report metadata with Jira link

### Manual Integration

```typescript
import { JiraIntegrationService } from './integrations/jira';
import { createDatabaseClient } from './db';
import { createStorage } from './storage';

const db = createDatabaseClient();
const storage = createStorage();
const jiraService = new JiraIntegrationService(db, storage);

// Create ticket from bug report
const result = await jiraService.createTicketFromBugReport(bugReportId);

console.log(`Created Jira issue: ${result.issueKey}`);
console.log(`View at: ${result.issueUrl}`);
```

## Security

### Encryption

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key Derivation**: Scrypt with random salt per encryption
- **IV**: Random 128-bit initialization vector per encryption
- **Auth Tag**: 128-bit authentication tag for integrity

### Credential Storage

Credentials are stored in the `project_integrations` table:

- `config` (JSONB): Non-sensitive configuration (host, projectKey, issueType)
- `encrypted_credentials` (TEXT): Encrypted JSON with `{email, apiToken}`

### Defense in Depth

1. **Encryption at rest**: Credentials encrypted in database
2. **Encryption in transit**: HTTPS for Jira API calls
3. **Access control**: Project ownership/membership checked
4. **JWT authentication**: API endpoints require valid JWT
5. **Input validation**: All inputs validated before use

## Adding New Integration Platforms

The architecture supports adding new platforms (GitHub, Linear, Slack) easily:

### 1. Implement `IntegrationService` Interface

```typescript
// src/integrations/github/service.ts
import { IntegrationService, IntegrationResult } from '../base-integration.service';

export class GitHubIntegrationService implements IntegrationService {
  readonly platform = 'github';

  async createFromBugReport(bugReport: BugReport, projectId: string): Promise<IntegrationResult> {
    // 1. Load GitHub config from database
    // 2. Create GitHub issue
    // 3. Return result
  }

  async testConnection(projectId: string): Promise<boolean> {
    // Test GitHub API connection
  }
}
```

### 2. Register in Integration Registry

```typescript
// src/integrations/integration-registry.ts
private registerDefaultServices(): void {
  this.register(new JiraIntegrationService(this.db, this.storage));
  this.register(new GitHubIntegrationService(this.db, this.storage)); // Add here
}
```

### 3. Create API Routes

```typescript
// src/api/routes/integrations.ts
fastify.post('/api/integrations/github', async (request, reply) => {
  // Save GitHub configuration
});
```

That's it! The integration worker will automatically route jobs to the correct service.

## Troubleshooting

### "ENCRYPTION_KEY environment variable is required"

Generate encryption key:

```bash
openssl rand -base64 32
```

Add to `.env`:

```bash
ENCRYPTION_KEY=<generated-key>
```

### "Project not found or you don't have access"

1. Verify project key is correct (uppercase, 2-10 characters)
2. Ensure Jira user has access to project
3. Check API token is valid (not expired)

### "Failed to connect to Jira"

1. Verify Jira host URL (must include `https://`)
2. Check network connectivity
3. Verify API token is valid
4. Check Jira email matches API token owner

### Screenshot Upload Fails

1. Verify storage service is configured correctly
2. Check screenshot URL is accessible
3. Ensure Jira user has permission to add attachments
4. Check file size limits (Jira has 10MB default limit)

## Testing

```bash
# Run all tests
pnpm --filter @bugspotter/backend test

# Run integration tests only
pnpm --filter @bugspotter/backend test:integration
```

## Example Jira Issue

When a bug report is created with:

- Title: "Login button not working"
- Description: "Users can't log in on mobile"
- Priority: "high"
- Screenshot: uploaded

Jira issue will be created with:

- **Summary**: "Login button not working"
- **Description**: Rich ADF format with bug details, metadata, and attachment links
- **Priority**: High
- **Labels**: ["bugspotter", "automated"]
- **Attachments**: Screenshot uploaded directly

## License

MIT
