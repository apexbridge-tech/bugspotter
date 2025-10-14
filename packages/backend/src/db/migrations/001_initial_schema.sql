-- Initial database schema for BugSpotter
-- Complete schema with all tables, indexes, and constraints

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table (created first as it's referenced by other tables)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'user',
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT unique_oauth_credentials UNIQUE (oauth_provider, oauth_id),
    CONSTRAINT check_auth_method CHECK (
        (password_hash IS NOT NULL AND oauth_provider IS NULL AND oauth_id IS NULL) OR
        (password_hash IS NULL AND oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_oauth_unique 
    ON users(oauth_provider, oauth_id) 
    WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);

COMMENT ON COLUMN projects.created_by IS 'User who created the project (owner)';

-- Project members table for multi-user access
CREATE TABLE IF NOT EXISTS project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_member UNIQUE (project_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user ON project_members(user_id);
CREATE INDEX IF NOT EXISTS idx_project_members_user_project ON project_members(user_id, project_id);

COMMENT ON TABLE project_members IS 'Users who have access to projects (owner, admin, member, viewer)';
COMMENT ON COLUMN project_members.role IS 'User role in project: owner, admin, member, viewer';

-- Bug reports table
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    screenshot_url TEXT,
    replay_url TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'open',
    priority VARCHAR(50) DEFAULT 'medium',
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    legal_hold BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bug_reports_project_created ON bug_reports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_project_status ON bug_reports(project_id, status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_deleted_at ON bug_reports(deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bug_reports_legal_hold ON bug_reports(legal_hold) WHERE legal_hold = TRUE;

COMMENT ON COLUMN bug_reports.deleted_at IS 'Timestamp when report was soft-deleted (NULL = active)';
COMMENT ON COLUMN bug_reports.deleted_by IS 'User who soft-deleted the report';
COMMENT ON COLUMN bug_reports.legal_hold IS 'Prevents automatic deletion by retention policies';

-- Archived bug reports table (long-term storage)
CREATE TABLE IF NOT EXISTS archived_bug_reports (
    id UUID PRIMARY KEY,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    screenshot_url TEXT,
    replay_url TEXT,
    metadata JSONB DEFAULT '{}',
    status VARCHAR(50) NOT NULL,
    priority VARCHAR(50),
    original_created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    original_updated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE NOT NULL,
    deleted_by UUID REFERENCES users(id) ON DELETE SET NULL,
    archived_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    archived_reason TEXT,
    CONSTRAINT check_archived_date CHECK (archived_at >= deleted_at)
);

CREATE INDEX IF NOT EXISTS idx_archived_bug_reports_project ON archived_bug_reports(project_id);
CREATE INDEX IF NOT EXISTS idx_archived_bug_reports_archived_at ON archived_bug_reports(archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_bug_reports_original_created ON archived_bug_reports(original_created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archived_bug_reports_deleted_by ON archived_bug_reports(deleted_by);

COMMENT ON TABLE archived_bug_reports IS 'Long-term storage for deleted bug reports (compliance/audit)';
COMMENT ON COLUMN archived_bug_reports.archived_reason IS 'Reason for archival (retention_policy, manual, gdpr_request, etc.)';
COMMENT ON COLUMN archived_bug_reports.project_id IS 'Project reference (CASCADE on delete)';
COMMENT ON COLUMN archived_bug_reports.deleted_by IS 'User who deleted the report (SET NULL on user delete)';

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    events JSONB NOT NULL,
    duration INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sessions_bug_report ON sessions(bug_report_id);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL,
    status VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_external_ticket UNIQUE (platform, external_id)
);

CREATE INDEX IF NOT EXISTS idx_tickets_bug_report ON tickets(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_tickets_external ON tickets(external_id);

-- Audit logs table (Enterprise only)
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Permissions table (Enterprise only)
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE (role, resource, action)
);

CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role);

-- Project integrations table (Jira, GitHub, Linear, Slack, etc.)
CREATE TABLE IF NOT EXISTS project_integrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    platform VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT TRUE NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    encrypted_credentials TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_project_platform UNIQUE (project_id, platform)
);

CREATE INDEX IF NOT EXISTS idx_project_integrations_project ON project_integrations(project_id);
CREATE INDEX IF NOT EXISTS idx_project_integrations_platform ON project_integrations(platform);
CREATE INDEX IF NOT EXISTS idx_project_integrations_enabled ON project_integrations(project_id, enabled) WHERE enabled = TRUE;

COMMENT ON TABLE project_integrations IS 'External platform integrations (Jira, GitHub, Linear, Slack) with encrypted credentials';
COMMENT ON COLUMN project_integrations.platform IS 'Integration platform: jira, github, linear, slack';
COMMENT ON COLUMN project_integrations.enabled IS 'Whether integration is active for this project';
COMMENT ON COLUMN project_integrations.config IS 'Non-sensitive configuration (project key, repository, channel, etc.)';
COMMENT ON COLUMN project_integrations.encrypted_credentials IS 'Encrypted sensitive credentials (API tokens, passwords)';

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update updated_at
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bug_reports_updated_at
    BEFORE UPDATE ON bug_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_project_integrations_updated_at
    BEFORE UPDATE ON project_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Insert default permissions
INSERT INTO permissions (role, resource, action) VALUES
    ('admin', 'bug_report', 'create'),
    ('admin', 'bug_report', 'read'),
    ('admin', 'bug_report', 'update'),
    ('admin', 'bug_report', 'delete'),
    ('admin', 'project', 'create'),
    ('admin', 'project', 'read'),
    ('admin', 'project', 'update'),
    ('admin', 'project', 'delete'),
    ('admin', 'user', 'create'),
    ('admin', 'user', 'read'),
    ('admin', 'user', 'update'),
    ('admin', 'user', 'delete'),
    ('admin', 'settings', 'read'),
    ('admin', 'settings', 'update'),
    ('user', 'bug_report', 'create'),
    ('user', 'bug_report', 'read'),
    ('user', 'bug_report', 'update'),
    ('user', 'project', 'read'),
    ('viewer', 'bug_report', 'read'),
    ('viewer', 'project', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;
