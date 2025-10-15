import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { setupService } from '../services/api';
import { useAuth } from '../contexts/auth-context';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import type { SetupRequest } from '../types';
import { handleApiError } from '../lib/api-client';

export default function SetupWizard() {
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [storageTestResult, setStorageTestResult] = useState<boolean | null>(null);
  const { login } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState<SetupRequest>({
    admin_email: '',
    admin_password: '',
    admin_name: '',
    instance_name: 'BugSpotter',
    instance_url: window.location.origin,
    storage_type: 'minio',
    storage_endpoint: 'http://minio:9000',
    storage_access_key: '',
    storage_secret_key: '',
    storage_bucket: 'bugspotter',
    storage_region: 'us-east-1',
  });

  useEffect(() => {
    checkSetupStatus();
  }, []);

  const checkSetupStatus = async () => {
    try {
      const status = await setupService.getStatus();
      if (status.initialized) {
        navigate('/login');
      }
    } catch {
      // Setup not complete, continue
    }
  };

  const updateFormData = (field: keyof SetupRequest, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const testStorageConnection = async () => {
    setIsTesting(true);
    setStorageTestResult(null);
    try {
      const result = await setupService.testStorageConnection({
        storage_type: formData.storage_type,
        storage_endpoint: formData.storage_endpoint,
        storage_access_key: formData.storage_access_key,
        storage_secret_key: formData.storage_secret_key,
        storage_bucket: formData.storage_bucket,
        storage_region: formData.storage_region,
      });
      setStorageTestResult(result.success);
      if (result.success) {
        toast.success('Storage connection successful');
      } else {
        toast.error(result.error || 'Storage connection failed');
      }
    } catch (error) {
      setStorageTestResult(false);
      toast.error(handleApiError(error));
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await setupService.initialize(formData);
      login(response.access_token, response.refresh_token, response.user);
      toast.success('Setup completed successfully');
      navigate('/');
    } catch (error) {
      toast.error(handleApiError(error));
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <Input
              label="Administrator Name"
              value={formData.admin_name}
              onChange={(e) => updateFormData('admin_name', e.target.value)}
              required
            />
            <Input
              label="Administrator Email"
              type="email"
              value={formData.admin_email}
              onChange={(e) => updateFormData('admin_email', e.target.value)}
              required
            />
            <Input
              label="Administrator Password"
              type="password"
              value={formData.admin_password}
              onChange={(e) => updateFormData('admin_password', e.target.value)}
              required
            />
            <Button onClick={() => setStep(2)} className="w-full">
              Continue
            </Button>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <Input
              label="Instance Name"
              value={formData.instance_name}
              onChange={(e) => updateFormData('instance_name', e.target.value)}
              required
            />
            <Input
              label="Instance URL"
              value={formData.instance_url}
              onChange={(e) => updateFormData('instance_url', e.target.value)}
              required
            />
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(1)} className="w-full">
                Back
              </Button>
              <Button onClick={() => setStep(3)} className="w-full">
                Continue
              </Button>
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Storage Type</label>
              <div className="flex gap-4">
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="minio"
                    checked={formData.storage_type === 'minio'}
                    onChange={(e) => updateFormData('storage_type', e.target.value as 'minio')}
                    className="mr-2"
                  />
                  MinIO
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    value="s3"
                    checked={formData.storage_type === 's3'}
                    onChange={(e) => updateFormData('storage_type', e.target.value as 's3')}
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
                onChange={(e) => updateFormData('storage_endpoint', e.target.value)}
                placeholder="http://minio:9000"
                required
              />
            )}

            <Input
              label="Access Key"
              value={formData.storage_access_key}
              onChange={(e) => updateFormData('storage_access_key', e.target.value)}
              required
            />
            <Input
              label="Secret Key"
              type="password"
              value={formData.storage_secret_key}
              onChange={(e) => updateFormData('storage_secret_key', e.target.value)}
              required
            />
            <Input
              label="Bucket Name"
              value={formData.storage_bucket}
              onChange={(e) => updateFormData('storage_bucket', e.target.value)}
              required
            />

            {formData.storage_type === 's3' && (
              <Input
                label="AWS Region"
                value={formData.storage_region || ''}
                onChange={(e) => updateFormData('storage_region', e.target.value)}
                placeholder="us-east-1"
                required
              />
            )}

            <Button
              type="button"
              variant="secondary"
              onClick={testStorageConnection}
              isLoading={isTesting}
              className="w-full"
            >
              Test Connection
            </Button>

            {storageTestResult !== null && (
              <div
                className={`p-3 rounded-lg flex items-center ${
                  storageTestResult ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                }`}
              >
                <CheckCircle2 className="w-5 h-5 mr-2" />
                {storageTestResult ? 'Connection successful' : 'Connection failed'}
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setStep(2)} className="w-full">
                Back
              </Button>
              <Button
                onClick={handleSubmit}
                isLoading={isLoading}
                disabled={storageTestResult !== true}
                className="w-full"
              >
                Complete Setup
              </Button>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>BugSpotter Setup Wizard</CardTitle>
          <CardDescription>
            Step {step} of 3: {step === 1 && 'Create Admin Account'}
            {step === 2 && 'Configure Instance'}
            {step === 3 && 'Configure Storage'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>{renderStep()}</form>
        </CardContent>
      </Card>
    </div>
  );
}
