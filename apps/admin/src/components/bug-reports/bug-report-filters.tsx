import { useCallback } from 'react';
import { Card, CardContent } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Filter, X } from 'lucide-react';
import type { BugReportFilters, BugStatus, BugPriority, Project } from '../../types';

interface BugReportFiltersProps {
  filters: BugReportFilters;
  onFiltersChange: (filters: BugReportFilters) => void;
  projects: Project[];
}

const statusOptions: { value: BugStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in-progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
];

const priorityOptions: { value: BugPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'text-gray-600' },
  { value: 'medium', label: 'Medium', color: 'text-blue-600' },
  { value: 'high', label: 'High', color: 'text-orange-600' },
  { value: 'critical', label: 'Critical', color: 'text-red-600' },
];

export function BugReportFilters({ filters, onFiltersChange, projects }: BugReportFiltersProps) {
  const updateFilter = useCallback(
    <K extends keyof BugReportFilters>(key: K, value: BugReportFilters[K]) => {
      onFiltersChange({ ...filters, [key]: value });
    },
    [filters, onFiltersChange]
  );

  const clearFilters = useCallback(() => {
    onFiltersChange({});
  }, [onFiltersChange]);

  const hasActiveFilters = Object.keys(filters).length > 0;

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-4 h-4 text-gray-500" />
          <h3 className="font-semibold">Filters</h3>
          {hasActiveFilters && (
            <Button size="sm" variant="ghost" onClick={clearFilters} className="ml-auto">
              <X className="w-3 h-3 mr-1" />
              Clear All
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Project Filter */}
          <div>
            <label
              htmlFor="filter-project"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Project
            </label>
            <select
              id="filter-project"
              value={filters.project_id || ''}
              onChange={(e) => updateFilter('project_id', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="filter-status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="filter-status"
              value={filters.status || ''}
              onChange={(e) => updateFilter('status', (e.target.value as BugStatus) || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Statuses</option>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label
              htmlFor="filter-priority"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Priority
            </label>
            <select
              id="filter-priority"
              value={filters.priority || ''}
              onChange={(e) =>
                updateFilter('priority', (e.target.value as BugPriority) || undefined)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="">All Priorities</option>
              {priorityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Date From Filter */}
          <div>
            <label
              htmlFor="filter-from-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              From Date
            </label>
            <Input
              id="filter-from-date"
              type="date"
              value={filters.created_after || ''}
              onChange={(e) => updateFilter('created_after', e.target.value || undefined)}
            />
          </div>

          {/* Date To Filter */}
          <div>
            <label
              htmlFor="filter-to-date"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              To Date
            </label>
            <Input
              id="filter-to-date"
              type="date"
              value={filters.created_before || ''}
              onChange={(e) => updateFilter('created_before', e.target.value || undefined)}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
