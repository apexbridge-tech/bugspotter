import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Image as ImageIcon } from 'lucide-react';
import { bugReportService } from '../../services/api';
import { SessionReplayPlayer } from './session-replay-player';
import { BugReportStatusControls } from './bug-report-status-controls';
import { BugReportBrowserMetadata } from './bug-report-browser-metadata';
import { BugReportNetworkTable } from './bug-report-network-table';
import { BugReportConsoleLogs } from './bug-report-console-logs';

interface BugReportDetailProps {
  reportId: string;
  onClose: () => void;
}

export function BugReportDetail({ reportId, onClose }: BugReportDetailProps) {
  const [activeTab, setActiveTab] = useState<'replay' | 'details' | 'logs'>('replay');

  const { data: report, isLoading } = useQuery({
    queryKey: ['bugReport', reportId],
    queryFn: () => bugReportService.getById(reportId),
  });

  const { data: sessions } = useQuery({
    queryKey: ['bugReportSessions', reportId],
    queryFn: () => bugReportService.getSessions(reportId),
    enabled: !!report,
  });

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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Status and Priority Controls */}
        <BugReportStatusControls report={report} />

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
                <BugReportBrowserMetadata metadata={report.metadata.browserMetadata} />
              )}

              {/* Network Requests */}
              {report.metadata?.networkRequests && (
                <BugReportNetworkTable requests={report.metadata.networkRequests} />
              )}
            </div>
          )}

          {activeTab === 'logs' && (
            <BugReportConsoleLogs logs={report.metadata?.consoleLogs || []} />
          )}
        </div>
      </div>
    </div>
  );
}
