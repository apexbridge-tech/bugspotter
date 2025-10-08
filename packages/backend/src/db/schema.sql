-- BugSpotter Database Schema
-- PostgreSQL 12+

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
-- Stores project configurations and API keys for authentication
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for API key lookups (used frequently for authentication)
CREATE INDEX IF NOT EXISTS idx_projects_api_key ON projects(api_key);

-- Users table
-- Stores user accounts with both traditional and OAuth authentication
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- NULL for OAuth users
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- user, admin, viewer
    oauth_provider VARCHAR(50), -- google, github, etc.
    oauth_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_oauth UNIQUE (oauth_provider, oauth_id)
);

-- Index for email lookups during login
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);

-- Bug reports table
-- Main table storing all bug reports
CREATE TABLE IF NOT EXISTS bug_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    screenshot_url TEXT,
    replay_url TEXT,
    metadata JSONB DEFAULT '{}', -- Stores browser info, device info, custom metadata, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'open', -- open, in-progress, resolved, closed
    priority VARCHAR(50) DEFAULT 'medium', -- low, medium, high, critical
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_bug_reports_project_created ON bug_reports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bug_reports_status ON bug_reports(status);
CREATE INDEX IF NOT EXISTS idx_bug_reports_priority ON bug_reports(priority);
CREATE INDEX IF NOT EXISTS idx_bug_reports_project_status ON bug_reports(project_id, status);

-- Sessions table
-- Stores session replay data for bug reports
CREATE TABLE IF NOT EXISTS sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    events JSONB NOT NULL, -- Array of rrweb events
    duration INTEGER, -- Session duration in milliseconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Index for looking up sessions by bug report
CREATE INDEX IF NOT EXISTS idx_sessions_bug_report ON sessions(bug_report_id);

-- Tickets table
-- Stores integration data with external ticket systems (Jira, Linear, etc.)
CREATE TABLE IF NOT EXISTS tickets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bug_report_id UUID NOT NULL REFERENCES bug_reports(id) ON DELETE CASCADE,
    external_id VARCHAR(255) NOT NULL, -- ID in the external system
    platform VARCHAR(50) NOT NULL, -- jira, linear, github, etc.
    status VARCHAR(100), -- Status in the external system
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_external_ticket UNIQUE (platform, external_id)
);

-- Index for looking up tickets by bug report
CREATE INDEX IF NOT EXISTS idx_tickets_bug_report ON tickets(bug_report_id);
CREATE INDEX IF NOT EXISTS idx_tickets_external ON tickets(external_id);

-- Audit logs table (Enterprise only)
-- Tracks all actions for compliance and security
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL, -- create, update, delete, view, export, etc.
    resource VARCHAR(100) NOT NULL, -- bug_report, project, user, etc.
    resource_id UUID, -- ID of the affected resource
    details JSONB DEFAULT '{}', -- Additional context about the action
    ip_address INET, -- IP address of the user
    user_agent TEXT, -- Browser/client user agent
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for audit log queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- Permissions table (Enterprise only)
-- Role-based access control
CREATE TABLE IF NOT EXISTS permissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    role VARCHAR(50) NOT NULL, -- admin, user, viewer, custom roles
    resource VARCHAR(100) NOT NULL, -- bug_report, project, user, settings, etc.
    action VARCHAR(50) NOT NULL, -- create, read, update, delete, export, etc.
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_permission UNIQUE (role, resource, action)
);

-- Index for permission lookups
CREATE INDEX IF NOT EXISTS idx_permissions_role ON permissions(role);

-- Migrations history table
-- Tracks applied database migrations
CREATE TABLE IF NOT EXISTS migrations_history (
    id SERIAL PRIMARY KEY,
    migration_name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

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

-- Insert default permissions for basic roles
INSERT INTO permissions (role, resource, action) VALUES
    -- Admin permissions
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
    -- User permissions
    ('user', 'bug_report', 'create'),
    ('user', 'bug_report', 'read'),
    ('user', 'bug_report', 'update'),
    ('user', 'project', 'read'),
    -- Viewer permissions
    ('viewer', 'bug_report', 'read'),
    ('viewer', 'project', 'read')
ON CONFLICT (role, resource, action) DO NOTHING;
