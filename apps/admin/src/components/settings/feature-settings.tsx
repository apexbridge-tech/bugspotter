/**
 * Feature Flags Settings Section
 */

import { SettingsSection } from './settings-section';
import type { InstanceSettings } from '../../types';

interface FeatureSettingsProps {
  formData: Partial<InstanceSettings>;
  updateField: <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => void;
}

export function FeatureSettingsSection({ formData, updateField }: FeatureSettingsProps) {
  return (
    <SettingsSection title="Feature Flags" description="Enable or disable features">
      <label className="flex items-center space-x-3 cursor-pointer">
        <input
          type="checkbox"
          checked={formData.session_replay_enabled || false}
          onChange={(e) => updateField('session_replay_enabled', e.target.checked)}
          className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
        />
        <div>
          <p className="font-medium">Session Replay</p>
          <p className="text-sm text-gray-500">Enable session replay recording for bug reports</p>
        </div>
      </label>
    </SettingsSection>
  );
}
