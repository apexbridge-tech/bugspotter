/**
 * Security Settings Section
 */

import { Input } from '../ui/input';
import { SettingsSection } from './settings-section';
import type { InstanceSettings } from '../../types';

interface SecuritySettingsProps {
  formData: Partial<InstanceSettings>;
  corsInput: string;
  updateField: <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => void;
  onCorsInputChange: (value: string) => void;
}

export function SecuritySettingsSection({
  formData,
  corsInput,
  updateField,
  onCorsInputChange,
}: SecuritySettingsProps) {
  const handleNumberChange = (field: keyof InstanceSettings, value: string, min: number = 0) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= min) {
      updateField(field, parsed as InstanceSettings[typeof field]);
    }
  };

  return (
    <SettingsSection
      title="Security Settings"
      description="Authentication and access control"
      className="space-y-4"
    >
      <Input
        label="JWT Access Token Expiry (seconds)"
        type="number"
        min="60"
        max="86400"
        value={formData.jwt_access_expiry || ''}
        onChange={(e) => handleNumberChange('jwt_access_expiry', e.target.value, 60)}
        placeholder="3600"
      />
      <Input
        label="JWT Refresh Token Expiry (seconds)"
        type="number"
        min="3600"
        max="2592000"
        value={formData.jwt_refresh_expiry || ''}
        onChange={(e) => handleNumberChange('jwt_refresh_expiry', e.target.value, 3600)}
        placeholder="604800"
      />
      <Input
        label="Rate Limit Max Requests"
        type="number"
        min="1"
        max="10000"
        value={formData.rate_limit_max || ''}
        onChange={(e) => handleNumberChange('rate_limit_max', e.target.value, 1)}
        placeholder="100"
      />
      <Input
        label="Rate Limit Window (seconds)"
        type="number"
        min="1"
        max="3600"
        value={formData.rate_limit_window || ''}
        onChange={(e) => handleNumberChange('rate_limit_window', e.target.value, 1)}
        placeholder="60"
      />
      <Input
        label="CORS Origins (comma-separated)"
        value={corsInput}
        onChange={(e) => onCorsInputChange(e.target.value)}
        placeholder="https://example.com, https://app.example.com"
      />
    </SettingsSection>
  );
}
