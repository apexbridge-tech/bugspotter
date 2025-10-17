/**
 * Retention Policy Settings Section
 */

import { Input } from '../ui/input';
import { SettingsSection } from './settings-section';
import type { InstanceSettings } from '../../types';

interface RetentionSettingsProps {
  formData: Partial<InstanceSettings>;
  updateField: <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => void;
}

export function RetentionSettingsSection({ formData, updateField }: RetentionSettingsProps) {
  const handleNumberChange = (field: keyof InstanceSettings, value: string, min: number = 1) => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= min) {
      updateField(field, parsed as InstanceSettings[typeof field]);
    }
  };

  return (
    <SettingsSection
      title="Retention Policies"
      description="Data retention and limits"
      className="space-y-4"
    >
      <Input
        label="Retention Days"
        type="number"
        min="1"
        max="3650"
        value={formData.retention_days || ''}
        onChange={(e) => handleNumberChange('retention_days', e.target.value, 1)}
        placeholder="90"
      />
      <Input
        label="Max Reports Per Project"
        type="number"
        min="1"
        max="1000000"
        value={formData.max_reports_per_project || ''}
        onChange={(e) => handleNumberChange('max_reports_per_project', e.target.value, 1)}
        placeholder="10000"
      />
    </SettingsSection>
  );
}
