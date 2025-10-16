import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { X, AlertCircle, Clock, CheckCircle, Image as ImageIcon, Code, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { bugReportService } from '../../services/api';
import { handleApiError } from '../../lib/api-client';
import { SessionReplayPlayer } from './session-replay-player';
import type { BugStatus, BugPriority } from '../../types';

interface BugReportDetailProps {
  reportId: string;
  onClose: () => void;
}

const statusOptions = [
  { value: 'open' as BugStatus, label: 'Open', icon: AlertCircle },
  { value: 'in-progress' as BugStatus, label: 'In Progress', icon: Clock },
  { value: 'resolved' as BugStatus, label: 'Resolved', icon: CheckCircle },
  { value: 'closed' as BugStatus, label: 'Closed', icon: CheckCircle },
];

const priorityOptions = [
  { value: 'low' as BugPriority, label: 'Low' },
  { value: 'medium' as BugPriority, label: 'Medium' },
  { value: 'high' as BugPriority, label: 'High' },
  { value: 'critical' as BugPriority, label: 'Critical' },
];

export function BugReportDetail({ reportId, onClose }: BugReportDetailProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'replay' | 'details' | 'logs'>('replay');
  const [editMode, setEditMode] = useState(false);
  const [formData, setFormData] = useState<{ status: BugStatus; priority: BugPriority }>({
    status: 'open',
    priority: 'medium',
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ['bugReport', reportId],
    queryFn: () => bugReportService.getById(reportId),
  });

  const { data: sessions } = useQuery({
    queryKey: ['bugReportSessions', reportId],
    queryFn: () => bugReportService.getSessions(reportId),
    enabled: !!report,
  });

  useEffect(() => {
    if (report) {
      setFormData({ status: report.status, priority: report.priority });
    }
  }, [report]);

  const updateMutation = useMutation({
    mutationFn: (data: { status?: BugStatus; priority?: BugPriority }) =>
      bugReportService.update(reportId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugReport', reportId] });
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      toast.success('Bug report updated successfully');
      setEditMode(false);
    },
    onError: (error) => {
      toast.error(handleApiError(error));
    },
  });

  const handleUpdate = useCallback(() => {
    if (!report) {
      return;
    }
    const changes: { status?: BugStatus; priority?: BugPriority } = {};
    if (formData.status !== report.status) {
      changes.status = formData.status;
    }
    if (formData.priority !== report.priority) {
      changes.priority = formData.priority;
    }

    if (Object.keys(changes).length > 0) {
      updateMutation.mutate(changes);
    } else {
      setEditMode(false);
    }
  }, [formData, report, updateMutation]);

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  if (isLoading || !report) {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8 max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden">
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        </div>
      </div>
    );
  }

  const session = sessions?.[0]; // Get the first session for replay

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b">
          <div className="flex-1">
            <h2 className="text-2xl font-bold mb-2">{report.title}</h2>
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>Created: {formatDate(report.created_at)}</span>
              {report.updated_at !== report.created_at && (
                <span>• Updated: {formatDate(report.updated_at)}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status and Priority Controls */}
        <div className="px-6 py-4 bg-gray-50 border-b flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Status:</label>
            {editMode ? (
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as BugStatus })}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                {statusOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-1 bg-white rounded-md text-sm font-medium">
                {statusOptions.find((s) => s.value === report.status)?.label}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">Priority:</label>
            {editMode ? (
              <select
                value={formData.priority}
                onChange={(e) =>
                  setFormData({ ...formData, priority: e.target.value as BugPriority })
                }
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              >
                {priorityOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className="px-3 py-1 bg-white rounded-md text-sm font-medium">
                {priorityOptions.find((p) => p.value === report.priority)?.label}
              </span>
            )}
          </div>

          <div className="ml-auto flex gap-2">
            {editMode ? (
              <>
                <Button size="sm" onClick={handleUpdate} isLoading={updateMutation.isPending}>
                  Save Changes
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEditMode(false)}>
                  Cancel
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={() => setEditMode(true)}>
                Edit Status/Priority
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b">
          <div className="flex px-6">
            <button
              onClick={() => setActiveTab('replay')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'replay'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Session Replay
            </button>
            <button
              onClick={() => setActiveTab('details')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'details'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Details & Metadata
            </button>
            <button
              onClick={() => setActiveTab('logs')}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'logs'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              Console Logs
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'replay' && (
            <div>
              {session ? (
                <SessionReplayPlayer session={session} />
              ) : (
                <div className="flex items-center justify-center h-[600px] bg-gray-100 rounded-lg">
                  <div className="text-center text-gray-500">
                    <p className="mb-2">📹 No session replay available</p>
                    <p className="text-sm">This bug report does not have recorded sessions</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              {/* Description */}
              {report.description && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Description</h3>
                  <p className="text-gray-700 whitespace-pre-wrap">{report.description}</p>
                </div>
              )}

              {/* Screenshot */}
              {report.screenshot_url && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <ImageIcon className="w-5 h-5" />
                    Screenshot
                  </h3>
                  <img
                    src={report.screenshot_url}
                    alt="Bug screenshot"
                    className="max-w-full rounded-lg border shadow-sm"
                  />
                </div>
              )}

              {/* Browser Metadata */}
              {report.metadata?.browserMetadata && (
                <div>
                  <h3 className="text-lg font-semibold mb-2 flex items-center gap-2">
                    <Globe className="w-5 h-5" />
                    Browser Information
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2 text-sm">
                    {report.metadata.browserMetadata.userAgent && (
                      <div>
                        <span className="font-medium">User Agent:</span>{' '}
                        <span className="text-gray-700">
                          {report.metadata.browserMetadata.userAgent}
                        </span>
                      </div>
                    )}
                    {report.metadata.browserMetadata.url && (
                      <div>
                        <span className="font-medium">URL:</span>{' '}
                        <a
                          href={report.metadata.browserMetadata.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline"
                        >
                          {report.metadata.browserMetadata.url}
                        </a>
                      </div>
                    )}
                    {report.metadata.browserMetadata.viewport && (
                      <div>
                        <span className="font-medium">Viewport:</span>{' '}
                        <span className="text-gray-700">
                          {report.metadata.browserMetadata.viewport.width} x{' '}
                          {report.metadata.browserMetadata.viewport.height}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Network Requests */}
              {report.metadata?.networkRequests && report.metadata.networkRequests.length > 0 && (
                <div>
                  <h3 className="text-lg font-semibold mb-2">Network Requests</h3>
                  <div className="bg-gray-50 rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-100">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                            Method
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                            URL
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-700">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {report.metadata.networkRequests.map((req, idx) => (
                          <tr key={idx}>
                            <td className="px-4 py-2 text-sm font-mono">{req.method}</td>
                            <td className="px-4 py-2 text-sm truncate max-w-md" title={req.url}>
                              {req.url}
                            </td>
                            <td className="px-4 py-2 text-sm">
                              <span
                                className={`px-2 py-1 rounded text-xs font-medium ${
                                  req.status >= 200 && req.status < 300
                                    ? 'bg-green-100 text-green-800'
                                    : req.status >= 400
                                    ? 'bg-red-100 text-red-800'
                                    : 'bg-gray-100 text-gray-800'
                                }`}
                              >
                                {req.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <div>
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Code className="w-5 h-5" />
                Console Logs
              </h3>
              {report.metadata?.consoleLogs && report.metadata.consoleLogs.length > 0 ? (
                <div className="bg-gray-900 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                  {report.metadata.consoleLogs.map((log, idx) => (
                    <div
                      key={idx}
                      className={`py-1 ${
                        log.level === 'error'
                          ? 'text-red-400'
                          : log.level === 'warn'
                          ? 'text-yellow-400'
                          : log.level === 'info'
                          ? 'text-blue-400'
                          : 'text-gray-300'
                      }`}
                    >
                      <span className="text-gray-500">
                        [{new Date(log.timestamp).toLocaleTimeString()}]
                      </span>{' '}
                      <span className="text-gray-400">[{log.level.toUpperCase()}]</span>{' '}
                      {log.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center h-64 bg-gray-100 rounded-lg">
                  <p className="text-gray-500">No console logs captured</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
