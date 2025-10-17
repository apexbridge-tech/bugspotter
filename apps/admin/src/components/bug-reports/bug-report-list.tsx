import { useState, useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Eye, Trash2, AlertCircle, Clock, CheckCircle } from 'lucide-react';
import type { BugReport, Project } from '../../types';

interface BugReportListProps {
  reports: BugReport[];
  projects: Project[];
  onViewDetails: (report: BugReport) => void;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const statusConfig = {
  open: { label: 'Open', color: 'bg-blue-100 text-blue-800', icon: AlertCircle },
  'in-progress': { label: 'In Progress', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  resolved: { label: 'Resolved', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  closed: { label: 'Closed', color: 'bg-gray-100 text-gray-800', icon: CheckCircle },
};

const priorityConfig = {
  low: { label: 'Low', color: 'bg-gray-100 text-gray-700' },
  medium: { label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  high: { label: 'High', color: 'bg-orange-100 text-orange-700' },
  critical: { label: 'Critical', color: 'bg-red-100 text-red-700' },
};

export function BugReportList({
  reports,
  projects,
  onViewDetails,
  onDelete,
  isDeleting,
}: BugReportListProps) {
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const getProjectName = useCallback(
    (projectId: string) => {
      return projects.find((p) => p.id === projectId)?.name || 'Unknown';
    },
    [projects]
  );

  const handleDelete = useCallback(
    (id: string) => {
      if (deleteConfirm === id) {
        onDelete(id);
        setDeleteConfirm(null);
      } else {
        setDeleteConfirm(id);
        setTimeout(() => setDeleteConfirm(null), 3000);
      }
    },
    [deleteConfirm, onDelete]
  );

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  return (
    <div className="space-y-3">
      {reports.map((report) => {
        const StatusIcon = statusConfig[report.status].icon;
        const statusStyle = statusConfig[report.status];
        const priorityStyle = priorityConfig[report.priority];

        return (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-start justify-between gap-4">
                {/* Main Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold truncate">{report.title}</h3>
                    {report.legal_hold && (
                      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">
                        Legal Hold
                      </span>
                    )}
                  </div>

                  {report.description && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{report.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    {/* Project */}
                    <span className="text-gray-600">
                      Project:{' '}
                      <span className="font-medium">{getProjectName(report.project_id)}</span>
                    </span>

                    {/* Status Badge */}
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${statusStyle.color}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {statusStyle.label}
                    </span>

                    {/* Priority Badge */}
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${priorityStyle.color}`}
                    >
                      {priorityStyle.label}
                    </span>

                    {/* Date */}
                    <span className="text-gray-500 text-xs">{formatDate(report.created_at)}</span>

                    {/* Screenshots */}
                    {report.screenshot_url && (
                      <span className="inline-flex items-center text-xs text-gray-500">
                        📸 Screenshot
                      </span>
                    )}

                    {/* Session Replay */}
                    {report.replay_url && (
                      <span className="inline-flex items-center text-xs text-gray-500">
                        🎬 Replay
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-shrink-0">
                  <Button size="sm" variant="secondary" onClick={() => onViewDetails(report)}>
                    <Eye className="w-4 h-4 mr-1" />
                    View
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleDelete(report.id)}
                    isLoading={isDeleting && deleteConfirm === report.id}
                    disabled={report.legal_hold}
                    title={report.legal_hold ? 'Cannot delete reports with legal hold' : ''}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    {deleteConfirm === report.id ? 'Confirm?' : 'Delete'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
