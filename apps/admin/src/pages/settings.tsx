import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { adminService } from '../services/api';
import { handleApiError } from '../lib/api-client';
import { Button } from '../components/ui/button';
import { Save } from 'lucide-react';
import { InstanceSettingsSection } from '../components/settings/instance-settings';
import { StorageSettingsSection } from '../components/settings/storage-settings';
import { SecuritySettingsSection } from '../components/settings/security-settings';
import { RetentionSettingsSection } from '../components/settings/retention-settings';
import { FeatureSettingsSection } from '../components/settings/feature-settings';
import type { InstanceSettings } from '../types';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<Partial<InstanceSettings>>({});
  const [corsInput, setCorsInput] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: adminService.getSettings,
  });

  // Initialize form data when settings are loaded (proper useEffect)
  useEffect(() => {
    if (data) {
      setFormData(data);
      setCorsInput(data.cors_origins?.join(', ') || '');
    }
  }, [data]);

  const updateMutation = useMutation({
    mutationFn: adminService.updateSettings,
    onSuccess: (updatedSettings) => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      // Reset form to server values after successful update
      setFormData(updatedSettings);
      setCorsInput(updatedSettings.cors_origins?.join(', ') || '');
      toast.success('Settings updated successfully');
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  // Memoize updateField to prevent unnecessary re-renders
  const updateField = useCallback(
    <K extends keyof InstanceSettings>(field: K, value: InstanceSettings[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    []
  );

  const handleCorsInputChange = useCallback((value: string) => {
    setCorsInput(value);
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const dataToSend = {
        ...formData,
        cors_origins: corsInput
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      updateMutation.mutate(dataToSend);
    },
    [formData, corsInput, updateMutation]
  );

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
        <InstanceSettingsSection formData={formData} updateField={updateField} />

        <StorageSettingsSection formData={formData} updateField={updateField} />

        <SecuritySettingsSection
          formData={formData}
          corsInput={corsInput}
          updateField={updateField}
          onCorsInputChange={handleCorsInputChange}
        />

        <RetentionSettingsSection formData={formData} updateField={updateField} />

        <FeatureSettingsSection formData={formData} updateField={updateField} />

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
