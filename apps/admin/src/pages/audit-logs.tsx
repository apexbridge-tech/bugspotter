import { useState, useCallback, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditLogService } from '../services/audit-logs';
import { handleApiError } from '../lib/api-client';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  XCircle,
  Eye,
} from 'lucide-react';
import type { AuditLog, AuditLogFilters } from '../types/audit';

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [filters, setFilters] = useState<AuditLogFilters>({});
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Filter inputs
  const [actionFilter, setActionFilter] = useState('');
  const [resourceFilter, setResourceFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [successFilter, setSuccessFilter] = useState<string>('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const {
    data,
    isLoading,
    error: logsError,
  } = useQuery({
    queryKey: ['audit-logs', page, filters],
    queryFn: () => auditLogService.getAuditLogs(filters, 'timestamp', 'desc', page, limit),
  });

  const { data: stats, error: statsError } = useQuery({
    queryKey: ['audit-statistics'],
    queryFn: () => auditLogService.getStatistics(),
  });

  // Focus management for modal
  useEffect(() => {
    if (selectedLog) {
      // Store previous focus
      previousFocusRef.current = document.activeElement as HTMLElement;
      // Focus modal
      modalRef.current?.focus();
      // Trap focus in modal
      document.body.style.overflow = 'hidden';
    } else {
      // Restore previous focus
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [selectedLog]);

  // Handle Escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedLog) {
        setSelectedLog(null);
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedLog]);

  const applyFilters = useCallback(() => {
    const newFilters: AuditLogFilters = {};
    if (actionFilter) {
      newFilters.action = actionFilter;
    }
    if (resourceFilter) {
      newFilters.resource = resourceFilter;
    }
    if (userIdFilter) {
      newFilters.user_id = userIdFilter;
    }
    if (successFilter) {
      newFilters.success = successFilter === 'true';
    }
    if (startDate) {
      newFilters.start_date = startDate;
    }
    if (endDate) {
      newFilters.end_date = endDate;
    }
    setFilters(newFilters);
    setPage(1);
  }, [actionFilter, resourceFilter, userIdFilter, successFilter, startDate, endDate]);

  const clearFilters = useCallback(() => {
    setActionFilter('');
    setResourceFilter('');
    setUserIdFilter('');
    setSuccessFilter('');
    setStartDate('');
    setEndDate('');
    setFilters({});
    setPage(1);
  }, []);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case 'POST':
        return 'bg-green-100 text-green-800';
      case 'PUT':
      case 'PATCH':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Show error state if logs fail to load
  if (logsError) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Audit Logs</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading audit logs</p>
          <p className="text-sm mt-1">{handleApiError(logsError)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
        <Button
          variant="secondary"
          onClick={() => setShowFilters(!showFilters)}
          aria-expanded={showFilters}
          aria-controls="audit-filters"
        >
          <Filter className="w-4 h-4 mr-2" aria-hidden="true" />
          {showFilters ? 'Hide Filters' : 'Show Filters'}
        </Button>
      </div>

      {/* Statistics Cards */}
      {stats?.data && !statsError && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="region" aria-label="Audit log statistics">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500" id="total-logs-label">Total Logs</p>
                <p className="text-3xl font-bold" aria-labelledby="total-logs-label">{stats.data.total || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500" id="successful-logs-label">Successful</p>
                <p className="text-3xl font-bold text-green-600" aria-labelledby="successful-logs-label">{stats.data.success || 0}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-gray-500" id="failed-logs-label">Failures</p>
                <p className="text-3xl font-bold text-red-600" aria-labelledby="failed-logs-label">{stats.data.failures || 0}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {showFilters && (
        <div id="audit-filters">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
            </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="filter-action" className="text-sm font-medium block mb-2">Action</label>
                <select
                  id="filter-action"
                  className="w-full border rounded-md px-3 py-2"
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                >
                  <option value="">All Actions</option>
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                  <option value="PATCH">PATCH</option>
                  <option value="DELETE">DELETE</option>
                </select>
              </div>

              <div>
                <label htmlFor="filter-resource" className="text-sm font-medium block mb-2">Resource</label>
                <Input
                  id="filter-resource"
                  placeholder="e.g., /api/v1/users"
                  value={resourceFilter}
                  onChange={(e) => setResourceFilter(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="filter-user-id" className="text-sm font-medium block mb-2">User ID</label>
                <Input
                  id="filter-user-id"
                  placeholder="Enter user ID"
                  value={userIdFilter}
                  onChange={(e) => setUserIdFilter(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="filter-status" className="text-sm font-medium block mb-2">Status</label>
                <select
                  id="filter-status"
                  className="w-full border rounded-md px-3 py-2"
                  value={successFilter}
                  onChange={(e) => setSuccessFilter(e.target.value)}
                >
                  <option value="">All</option>
                  <option value="true">Success</option>
                  <option value="false">Failed</option>
                </select>
              </div>

              <div>
                <label htmlFor="filter-start-date" className="text-sm font-medium block mb-2">Start Date</label>
                <Input
                  id="filter-start-date"
                  type="datetime-local"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label htmlFor="filter-end-date" className="text-sm font-medium block mb-2">End Date</label>
                <Input
                  id="filter-end-date"
                  type="datetime-local"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 mt-4">
              <Button onClick={applyFilters}>
                <Search className="w-4 h-4 mr-2" aria-hidden="true" />
                Apply Filters
              </Button>
              <Button variant="secondary" onClick={clearFilters}>
                Clear
              </Button>
            </div>
          </CardContent>
        </Card>
        </div>
      )}

      {/* Audit Logs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Audit Trail</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8" role="status" aria-live="polite">Loading audit logs...</div>
          ) : data?.data.length === 0 ? (
            <div className="text-center py-8 text-gray-500" role="status">No audit logs found</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <caption className="sr-only">Audit log entries with timestamp, action, resource, user, status, IP address, and details</caption>
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Timestamp</th>
                      <th className="text-left p-3 font-medium">Action</th>
                      <th className="text-left p-3 font-medium">Resource</th>
                      <th className="text-left p-3 font-medium">User</th>
                      <th className="text-left p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">IP Address</th>
                      <th className="text-right p-3 font-medium">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.data.map((log) => (
                      <tr key={log.id} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm">{formatDate(log.timestamp)}</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="p-3 text-sm font-mono">{log.resource}</td>
                        <td className="p-3 text-sm">{log.user_id || 'N/A'}</td>
                        <td className="p-3">
                          {log.success ? (
                            <>
                              <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                              <span className="sr-only">Success</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                              <span className="sr-only">Failed</span>
                            </>
                          )}
                        </td>
                        <td className="p-3 text-sm">{log.ip_address || 'N/A'}</td>
                        <td className="p-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedLog(log)}
                            aria-label={`View details for ${log.action} ${log.resource} at ${formatDate(log.timestamp)}`}
                          >
                            <Eye className="w-4 h-4" aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {data && data.pagination.total_pages > 1 && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-gray-500">
                    Page {data.pagination.page} of {data.pagination.total_pages} (
                    {data.pagination.total} total)
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      <ChevronLeft className="w-4 h-4" aria-hidden="true" />
                      Previous
                    </Button>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={page >= data.pagination.total_pages}
                      onClick={() => setPage(page + 1)}
                    >
                      Next
                      <ChevronRight className="w-4 h-4" aria-hidden="true" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Detail Modal */}
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="audit-log-modal-title"
            tabIndex={-1}
            className="focus:outline-none"
          >
            <Card className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <CardTitle>
                    <span id="audit-log-modal-title">Audit Log Details</span>
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedLog(null)}
                    aria-label="Close details modal"
                  >
                    ✕
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-gray-500">Timestamp</p>
                    <p className="text-sm">{formatDate(selectedLog.timestamp)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Action</p>
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(selectedLog.action)}`}
                    >
                      {selectedLog.action}
                    </span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Resource</p>
                    <p className="text-sm font-mono">{selectedLog.resource}</p>
                  </div>
                  {selectedLog.resource_id && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Resource ID</p>
                      <p className="text-sm font-mono">{selectedLog.resource_id}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-medium text-gray-500">User ID</p>
                    <p className="text-sm">{selectedLog.user_id || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">IP Address</p>
                    <p className="text-sm">{selectedLog.ip_address || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">User Agent</p>
                    <p className="text-sm break-all">{selectedLog.user_agent || 'N/A'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500">Status</p>
                    <div className="flex items-center gap-2">
                      {selectedLog.success ? (
                        <>
                          <CheckCircle className="w-5 h-5 text-green-600" aria-hidden="true" />
                          <span className="text-sm text-green-600">Success</span>
                        </>
                      ) : (
                        <>
                          <XCircle className="w-5 h-5 text-red-600" aria-hidden="true" />
                          <span className="text-sm text-red-600">Failed</span>
                        </>
                      )}
                    </div>
                  </div>
                  {selectedLog.error_message && (
                    <div>
                      <p className="text-sm font-medium text-gray-500">Error Message</p>
                      <p className="text-sm text-red-600">{selectedLog.error_message}</p>
                    </div>
                  )}
                  {selectedLog.details && (
                    <div>
                      <p className="text-sm font-medium text-gray-500 mb-2">Request Details</p>
                      <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                        {JSON.stringify(selectedLog.details, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
