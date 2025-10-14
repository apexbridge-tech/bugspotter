-- Add project integrations table
-- Stores encrypted integration credentials per project

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

-- Trigger to automatically update updated_at
CREATE TRIGGER update_project_integrations_updated_at
    BEFORE UPDATE ON project_integrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
