import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminService } from '../services/api';
import { handleApiError } from '../lib/api-client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Save } from 'lucide-react';
import type { InstanceSettings } from '../types';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InstanceSettings>>({});
  const [corsInput, setCorsInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: adminService.getSettings,
  });

  // Update form data when settings are loaded
  if (data && !formData.instance_name) {
    setFormData(data);
    setCorsInput(data.cors_origins?.join(', ') || '');
  }

  const updateMutation = useMutation({
    mutationFn: adminService.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const updateField = <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const dataToSend = {
      ...formData,
      cors_origins: corsInput.split(',').map((s) => s.trim()).filter(Boolean),
    };
    updateMutation.mutate(dataToSend);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-gray-500 mt-1">Configure your BugSpotter instance</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Instance Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Instance Configuration</CardTitle>
            <CardDescription>Basic settings for your BugSpotter instance</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Instance Name"
              value={formData.instance_name || ''}
              onChange={(e) => updateField('instance_name', e.target.value)}
            />
            <Input
              label="Instance URL"
              value={formData.instance_url || ''}
              onChange={(e) => updateField('instance_url', e.target.value)}
            />
            <Input
              label="Support Email"
              type="email"
              value={formData.support_email || ''}
              onChange={(e) => updateField('support_email', e.target.value)}
            />
          </CardContent>
        </Card>

        {/* Storage Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Storage Settings</CardTitle>
            <CardDescription>Configure your storage backend</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Storage Type
              </label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="minio"
                    checked={formData.storage_type === 'minio'}
                    onChange={(e) => updateField('storage_type', e.target.value as 'minio')}
                    className="mr-2"
                  />
                  MinIO
                </label>
                <label className="flex items-center">
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
                value={formData.storage_endpoint || ''}
                onChange={(e) => updateField('storage_endpoint', e.target.value)}
              />
            )}

            <Input
              label="Bucket Name"
              value={formData.storage_bucket || ''}
              onChange={(e) => updateField('storage_bucket', e.target.value)}
            />

            {formData.storage_type === 's3' && (
              <Input
                label="AWS Region"
                value={formData.storage_region || ''}
                onChange={(e) => updateField('storage_region', e.target.value)}
              />
            )}
          </CardContent>
        </Card>

        {/* Security Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Security Settings</CardTitle>
            <CardDescription>Authentication and access control</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="JWT Access Token Expiry (seconds)"
              type="number"
              value={formData.jwt_access_expiry || ''}
              onChange={(e) => updateField('jwt_access_expiry', parseInt(e.target.value))}
            />
            <Input
              label="JWT Refresh Token Expiry (seconds)"
              type="number"
              value={formData.jwt_refresh_expiry || ''}
              onChange={(e) => updateField('jwt_refresh_expiry', parseInt(e.target.value))}
            />
            <Input
              label="Rate Limit Max Requests"
              type="number"
              value={formData.rate_limit_max || ''}
              onChange={(e) => updateField('rate_limit_max', parseInt(e.target.value))}
            />
            <Input
              label="Rate Limit Window (seconds)"
              type="number"
              value={formData.rate_limit_window || ''}
              onChange={(e) => updateField('rate_limit_window', parseInt(e.target.value))}
            />
            <Input
              label="CORS Origins (comma-separated)"
              value={corsInput}
              onChange={(e) => setCorsInput(e.target.value)}
              placeholder="https://example.com, https://app.example.com"
            />
          </CardContent>
        </Card>

        {/* Retention Policies */}
        <Card>
          <CardHeader>
            <CardTitle>Retention Policies</CardTitle>
            <CardDescription>Data retention and limits</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              label="Retention Days"
              type="number"
              value={formData.retention_days || ''}
              onChange={(e) => updateField('retention_days', parseInt(e.target.value))}
            />
            <Input
              label="Max Reports Per Project"
              type="number"
              value={formData.max_reports_per_project || ''}
              onChange={(e) => updateField('max_reports_per_project', parseInt(e.target.value))}
            />
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card>
          <CardHeader>
            <CardTitle>Feature Flags</CardTitle>
            <CardDescription>Enable or disable features</CardDescription>
          </CardHeader>
          <CardContent>
            <label className="flex items-center space-x-3">
              <input
                type="checkbox"
                checked={formData.session_replay_enabled || false}
                onChange={(e) => updateField('session_replay_enabled', e.target.checked)}
                className="w-4 h-4 text-primary border-gray-300 rounded focus:ring-primary"
              />
              <div>
                <p className="font-medium">Session Replay</p>
                <p className="text-sm text-gray-500">
                  Enable session replay recording for bug reports
                </p>
              </div>
            </label>
          </CardContent>
        </Card>

        <div className="flex justify-end">
          <Button type="submit" isLoading={updateMutation.isPending} size="lg">
            <Save className="w-4 h-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </form>
    </div>
  );
}
