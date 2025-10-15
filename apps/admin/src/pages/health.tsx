import { useQuery } from '@tanstack/react-query';
import { adminService } from '../services/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Database, HardDrive, Server, CheckCircle, XCircle } from 'lucide-react';

export default function HealthPage() {
  const { data: health, isLoading, refetch } = useQuery({
    queryKey: ['health'],
    queryFn: adminService.getHealth,
    refetchInterval: 30000, // Refresh every 30s
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'up':
      case 'healthy':
        return 'text-green-600';
      case 'degraded':
        return 'text-yellow-600';
      default:
        return 'text-red-600';
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'up' || status === 'healthy') {
      return <CheckCircle className="w-6 h-6" />;
    }
    return <XCircle className="w-6 h-6" />;
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">System Health</h1>
          <p className="text-gray-500 mt-1">Monitor your BugSpotter instance status</p>
        </div>
        <button
          onClick={() => refetch()}
          className="px-4 py-2 bg-white border rounded-lg hover:bg-gray-50 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Overall Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Overall Status</CardTitle>
              <CardDescription>System is {health?.status}</CardDescription>
            </div>
            <div className={getStatusColor(health?.status || '')}>
              {getStatusIcon(health?.status || '')}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Services */}
      <div className="grid gap-6 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(health?.services.database.status || '')}`}>
              {health?.services.database.status?.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              Response: {health?.services.database.response_time}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Redis</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(health?.services.redis.status || '')}`}>
              {health?.services.redis.status?.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              Response: {health?.services.redis.response_time}ms
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Storage</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${getStatusColor(health?.services.storage.status || '')}`}>
              {health?.services.storage.status?.toUpperCase()}
            </div>
            <p className="text-xs text-muted-foreground">
              Response: {health?.services.storage.response_time}ms
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Metrics */}
      <Card>
        <CardHeader>
          <CardTitle>System Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <p className="text-sm font-medium text-gray-500">Disk Space</p>
              <p className="text-2xl font-bold">
                {formatBytes(health?.system.disk_space_available || 0)}
              </p>
              <p className="text-xs text-gray-500">
                of {formatBytes(health?.system.disk_space_total || 0)}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Worker Queue</p>
              <p className="text-2xl font-bold">{health?.system.worker_queue_depth || 0}</p>
              <p className="text-xs text-gray-500">pending jobs</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Uptime</p>
              <p className="text-2xl font-bold">
                {formatUptime(health?.system.uptime || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
