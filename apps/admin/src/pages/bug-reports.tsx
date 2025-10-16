import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Bug, ChevronLeft, ChevronRight } from 'lucide-react';
import { bugReportService, projectService } from '../services/api';
import { handleApiError } from '../lib/api-client';
import { Button } from '../components/ui/button';
import { BugReportFilters } from '../components/bug-reports/bug-report-filters';
import { BugReportList } from '../components/bug-reports/bug-report-list';
import { BugReportDetail } from '../components/bug-reports/bug-report-detail';
import type { BugReportFilters as Filters, BugReport } from '../types';

export default function BugReportsPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>({});
  const [page, setPage] = useState(1);
  const [selectedReport, setSelectedReport] = useState<BugReport | null>(null);
  const limit = 20;

  // Fetch projects for filter dropdown
  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectService.getAll,
  });

  // Fetch bug reports with filters and pagination
  const {
    data: reportData,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['bugReports', filters, page, limit],
    queryFn: () => bugReportService.getAll(filters, page, limit),
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: bugReportService.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bugReports'] });
      toast.success('Bug report deleted successfully');
    },
    onError: (apiError) => {
      toast.error(handleApiError(apiError));
    },
  });

  const handleFiltersChange = useCallback((newFilters: Filters) => {
    setFilters(newFilters);
    setPage(1); // Reset to first page when filters change
  }, []);

  const handleViewDetails = useCallback((report: BugReport) => {
    setSelectedReport(report);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedReport(null);
  }, []);

  const handleDelete = useCallback(
    (id: string) => {
      deleteMutation.mutate(id);
    },
    [deleteMutation]
  );

  const handlePreviousPage = useCallback(() => {
    setPage((prev) => Math.max(1, prev - 1));
  }, []);

  const handleNextPage = useCallback(() => {
    if (reportData?.pagination) {
      setPage((prev) => Math.min(reportData.pagination.totalPages, prev + 1));
    }
  }, [reportData]);

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Bug Reports</h1>
            <p className="text-gray-500 mt-1">View and manage bug reports from all projects</p>
          </div>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <p className="font-semibold">Error loading bug reports</p>
          <p className="text-sm mt-1">{handleApiError(error)}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Bug className="w-8 h-8" />
            Bug Reports
          </h1>
          <p className="text-gray-500 mt-1">View and manage bug reports from all projects</p>
        </div>
        {reportData?.pagination && (
          <div className="text-sm text-gray-600">
            Showing {(page - 1) * limit + 1}-{Math.min(page * limit, reportData.pagination.total)}{' '}
            of {reportData.pagination.total} reports
          </div>
        )}
      </div>

      {/* Filters */}
      <BugReportFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        projects={projects}
      />

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      )}

      {/* Bug Reports List */}
      {!isLoading && reportData && (
        <>
          {reportData.data.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <Bug className="w-16 h-16 text-gray-400 mb-4" />
              <h3 className="text-xl font-semibold text-gray-700 mb-2">No Bug Reports Yet</h3>
              <p className="text-gray-500 text-center max-w-md mb-6">
                {Object.keys(filters).length > 0
                  ? 'No bug reports match your current filters. Try adjusting the filters to see more results.'
                  : 'Start capturing bugs by integrating the BugSpotter SDK into your application. Create a project to get your API key.'}
              </p>
              {Object.keys(filters).length > 0 && (
                <Button variant="secondary" onClick={() => handleFiltersChange({})}>
                  Clear Filters
                </Button>
              )}
            </div>
          ) : (
            <>
              <BugReportList
                reports={reportData.data}
                projects={projects}
                onViewDetails={handleViewDetails}
                onDelete={handleDelete}
                isDeleting={deleteMutation.isPending}
              />

              {/* Pagination */}
              {reportData.pagination.totalPages > 1 && (
                <div className="flex items-center justify-center gap-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handlePreviousPage}
                    disabled={page === 1}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-600">
                    Page {page} of {reportData.pagination.totalPages}
                  </span>
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleNextPage}
                    disabled={page === reportData.pagination.totalPages}
                  >
                    Next
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Detail Modal */}
      {selectedReport && (
        <BugReportDetail reportId={selectedReport.id} onClose={handleCloseDetail} />
      )}
    </div>
  );
}
