import { useQuery } from '@tanstack/react-query';
import { analyticsService } from '../services/api';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Activity, FolderKanban, Users, AlertCircle } from 'lucide-react';

export default function DashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: () => analyticsService.getDashboard(),
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg">Loading dashboard...</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-lg text-red-600">Failed to load dashboard data</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Analytics Dashboard</h1>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Total Bug Reports"
          value={data.bug_reports.by_status.total}
          icon={<Activity className="w-6 h-6 text-blue-600" />}
          subtitle={`${data.bug_reports.by_status.open} open`}
        />
        <MetricCard
          title="Projects"
          value={data.projects.total}
          icon={<FolderKanban className="w-6 h-6 text-green-600" />}
          subtitle={`${data.projects.total_reports} total reports`}
        />
        <MetricCard
          title="Users"
          value={data.users.total}
          icon={<Users className="w-6 h-6 text-purple-600" />}
        />
        <MetricCard
          title="Avg Reports/Project"
          value={data.projects.avg_reports_per_project.toFixed(1)}
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
              count={data.bug_reports.by_status.open}
              total={data.bug_reports.by_status.total}
              color="bg-blue-500"
            />
            <StatusBar
              label="In Progress"
              count={data.bug_reports.by_status.in_progress}
              total={data.bug_reports.by_status.total}
              color="bg-yellow-500"
            />
            <StatusBar
              label="Resolved"
              count={data.bug_reports.by_status.resolved}
              total={data.bug_reports.by_status.total}
              color="bg-green-500"
            />
            <StatusBar
              label="Closed"
              count={data.bug_reports.by_status.closed}
              total={data.bug_reports.by_status.total}
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
              count={data.bug_reports.by_priority.critical}
              total={data.bug_reports.by_status.total}
              color="bg-red-600"
            />
            <StatusBar
              label="High"
              count={data.bug_reports.by_priority.high}
              total={data.bug_reports.by_status.total}
              color="bg-orange-500"
            />
            <StatusBar
              label="Medium"
              count={data.bug_reports.by_priority.medium}
              total={data.bug_reports.by_status.total}
              color="bg-blue-500"
            />
            <StatusBar
              label="Low"
              count={data.bug_reports.by_priority.low}
              total={data.bug_reports.by_status.total}
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
            {data.top_projects.map((project) => (
              <div key={project.id} className="flex justify-between items-center">
                <div>
                  <div className="font-medium">{project.name}</div>
                  <div className="text-sm text-gray-600">{project.report_count} reports</div>
                </div>
                <div className="w-32 bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-primary h-2 rounded-full"
                    style={{
                      width: `${(project.report_count / data.projects.total_reports) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}
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
            {data.time_series.map((point, index) => {
              const maxCount = Math.max(...data.time_series.map((p) => p.count));
              const height = maxCount > 0 ? (point.count / maxCount) * 100 : 0;
              return (
                <div
                  key={index}
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
