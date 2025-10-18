import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Activity, FolderKanban, Users, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async () => {
      console.log('🔍 Fetching analytics dashboard...');
      try {
        const result = await analyticsService.getDashboard();
        console.log('✅ Analytics data received:', result);
        return result;
      } catch (err) {
        console.error('❌ Analytics fetch failed:', err);
        throw err;
      }
    },
    refetchInterval: 60000, // Refresh every minute
    retry: 1, // Only retry once
  });

  console.log('Dashboard state:', { isLoading, hasData: !!data, hasError: !!error, data });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (error) {
    console.error('Dashboard error state:', { error, data });
    return (
      <div className="flex items-center justify-center h-64">
        <div className="space-y-2">
          <div className="text-lg text-red-600">Failed to load dashboard data</div>
          <div className="text-sm text-gray-500">
            {error instanceof Error ? error.message : 'Unknown error occurred'}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-gray-500">No data available</div>
      </div>
    );
  }

  // Handle missing or incomplete data gracefully
  const bugReports = data.bug_reports?.by_status || {
    open: 0,
    in_progress: 0,
    resolved: 0,
    closed: 0,
    total: 0,
  };
  const bugPriority = data.bug_reports?.by_priority || {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  const projects = data.projects || {
    total: 0,
    total_reports: 0,
    avg_reports_per_project: 0,
  };
  const users = data.users || { total: 0 };
  const timeSeries = data.time_series || [];
  const topProjects = data.top_projects || [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bug Reports"
          value={bugReports.total}
          icon={<Activity className="w-6 h-6 text-blue-600" />}
          subtitle={`${bugReports.open} open`}
        />
        <MetricCard
          title="Projects"
          value={projects.total}
          icon={<FolderKanban className="w-6 h-6 text-green-600" />}
          subtitle={`${projects.total_reports} total reports`}
        />
        <MetricCard
          title="Users"
          value={users.total}
          icon={<Users className="w-6 h-6 text-purple-600" />}
        />
        <MetricCard
          title="Avg Reports/Project"
          value={projects.avg_reports_per_project.toFixed(1)}
          icon={<AlertCircle className="w-6 h-6 text-orange-600" />}
        />
      </div>

      {/* Status Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Reports by Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusBar
              label="Open"
              count={bugReports.open}
              total={bugReports.total}
              color="bg-blue-500"
            />
            <StatusBar
              label="In Progress"
              count={bugReports.in_progress}
              total={bugReports.total}
              color="bg-yellow-500"
            />
            <StatusBar
              label="Resolved"
              count={bugReports.resolved}
              total={bugReports.total}
              color="bg-green-500"
            />
            <StatusBar
              label="Closed"
              count={bugReports.closed}
              total={bugReports.total}
              color="bg-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Priority Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Reports by Priority</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusBar
              label="Critical"
              count={bugPriority.critical}
              total={bugReports.total}
              color="bg-red-600"
            />
            <StatusBar
              label="High"
              count={bugPriority.high}
              total={bugReports.total}
              color="bg-orange-500"
            />
            <StatusBar
              label="Medium"
              count={bugPriority.medium}
              total={bugReports.total}
              color="bg-blue-500"
            />
            <StatusBar
              label="Low"
              count={bugPriority.low}
              total={bugReports.total}
              color="bg-gray-500"
            />
          </div>
        </CardContent>
      </Card>

      {/* Top Projects */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Projects by Reports</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topProjects.map((project) => {
              const percentage =
                projects.total_reports > 0
                  ? (project.report_count / projects.total_reports) * 100
                  : 0;
              return (
                <div key={project.id} className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{project.name}</div>
                    <div className="text-sm text-gray-600">{project.report_count} reports</div>
                  </div>
                  <div className="w-32 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-primary h-2 rounded-full"
                      style={{
                        width: `${percentage}%`,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Time Series Chart (Simple) */}
      <Card>
        <CardHeader>
          <CardTitle>Report Trend (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64 flex items-end space-x-1">
            {timeSeries.map((point) => {
              const maxCount = Math.max(...timeSeries.map((p) => p.count));
              const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
              return (
                <div
                  key={point.date}
                  className="flex-1 bg-primary rounded-t hover:bg-primary/80 transition-colors"
                  style={{ height: `${height}%`, minHeight: point.count > 0 ? '4px' : '0' }}
                  title={`${point.date}: ${point.count} reports`}
                />
              );
            })}
          </div>
          <div className="text-xs text-gray-500 text-center mt-2">
            Showing daily report counts
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  icon,
  subtitle,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-600">{title}</div>
            <div className="text-3xl font-bold mt-1">{value}</div>
            {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
          </div>
          <div>{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const percentage = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span>{label}</span>
        <span className="font-medium">
          {count} ({percentage.toFixed(1)}%)
        </span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-2">
        <div className={`${color} h-2 rounded-full`} style={{ width: `${percentage}%` }} />
      </div>
    </div>
  );
}
