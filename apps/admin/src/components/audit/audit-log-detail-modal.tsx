import { useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { CheckCircle, XCircle } from 'lucide-react';
import { formatDate, getActionBadgeColor } from '../../utils/audit-utils';
import type { AuditLog } from '../../types/audit';

interface AuditLogDetailModalProps {
  log: AuditLog;
  onClose: () => void;
}

export function AuditLogDetailModal({ log, onClose }: AuditLogDetailModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Focus management
  useEffect(() => {
    // Store previous focus
    previousFocusRef.current = document.activeElement as HTMLElement;
    // Focus modal
    modalRef.current?.focus();
    // Trap focus in modal
    document.body.style.overflow = 'hidden';

    return () => {
      // Restore previous focus and overflow
      document.body.style.overflow = '';
      previousFocusRef.current?.focus();
    };
  }, []);

  // Handle Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
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
                onClick={onClose}
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
                <p className="text-sm">{formatDate(log.timestamp)}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Action</p>
                <span
                  className={`inline-block px-2 py-1 rounded text-xs font-medium ${getActionBadgeColor(log.action)}`}
                >
                  {log.action}
                </span>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Resource</p>
                <p className="text-sm font-mono">{log.resource}</p>
              </div>
              {log.resource_id && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Resource ID</p>
                  <p className="text-sm font-mono">{log.resource_id}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-gray-500">User ID</p>
                <p className="text-sm">{log.user_id || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">IP Address</p>
                <p className="text-sm">{log.ip_address || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">User Agent</p>
                <p className="text-sm break-all">{log.user_agent || 'N/A'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Status</p>
                <div className="flex items-center gap-2">
                  {log.success ? (
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
              {log.error_message && (
                <div>
                  <p className="text-sm font-medium text-gray-500">Error Message</p>
                  <p className="text-sm text-red-600">{log.error_message}</p>
                </div>
              )}
              {log.details && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Request Details</p>
                  <pre className="bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
