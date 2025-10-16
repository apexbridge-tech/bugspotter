/**
 * Instance Configuration Settings Section
 */

import { Input } from '../ui/input';
import { SettingsSection } from './settings-section';
import type { InstanceSettings } from '../../types';

interface InstanceSettingsProps {
  formData: Partial<InstanceSettings>;
  updateField: <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => void;
}

export function InstanceSettingsSection({ formData, updateField }: InstanceSettingsProps) {
  return (
    <SettingsSection
      title="Instance Configuration"
      description="Basic settings for your BugSpotter instance"
      className="space-y-4"
    >
      <Input
        label="Instance Name"
        value={formData.instance_name || ''}
        onChange={(e) => updateField('instance_name', e.target.value)}
        required
      />
      <Input
        label="Instance URL"
        type="url"
        value={formData.instance_url || ''}
        onChange={(e) => updateField('instance_url', e.target.value)}
        placeholder="https://bugspotter.example.com"
        required
      />
      <Input
        label="Support Email"
        type="email"
        value={formData.support_email || ''}
        onChange={(e) => updateField('support_email', e.target.value)}
        placeholder="support@example.com"
        required
      />
    </SettingsSection>
  );
}
