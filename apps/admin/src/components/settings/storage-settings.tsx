/**
 * Storage Settings Section
 */

import { Input } from '../ui/input';
import { SettingsSection } from './settings-section';
import type { InstanceSettings } from '../../types';

interface StorageSettingsProps {
  formData: Partial<InstanceSettings>;
  updateField: <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => void;
}

export function StorageSettingsSection({ formData, updateField }: StorageSettingsProps) {
  return (
    <SettingsSection
      title="Storage Settings"
      description="Configure your storage backend"
      className="space-y-4"
    >
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">Storage Type</label>
        <div className="flex gap-4">
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="minio"
              checked={formData.storage_type === 'minio'}
              onChange={(e) => updateField('storage_type', e.target.value as 'minio')}
              className="mr-2"
            />
            MinIO
          </label>
          <label className="flex items-center cursor-pointer">
            <input
              type="radio"
              value="s3"
              checked={formData.storage_type === 's3'}
              onChange={(e) => updateField('storage_type', e.target.value as 's3')}
              className="mr-2"
            />
            AWS S3
          </label>
        </div>
      </div>

      {formData.storage_type === 'minio' && (
        <Input
          label="MinIO Endpoint"
          type="url"
          value={formData.storage_endpoint || ''}
          onChange={(e) => updateField('storage_endpoint', e.target.value)}
          placeholder="http://minio:9000"
          required
        />
      )}

      <Input
        label="Bucket Name"
        value={formData.storage_bucket || ''}
        onChange={(e) => updateField('storage_bucket', e.target.value)}
        placeholder="bugspotter-uploads"
        required
      />

      {formData.storage_type === 's3' && (
        <Input
          label="AWS Region"
          value={formData.storage_region || ''}
          onChange={(e) => updateField('storage_region', e.target.value)}
          placeholder="us-east-1"
          required
        />
      )}
    </SettingsSection>
  );
}
