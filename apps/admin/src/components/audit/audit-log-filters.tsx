import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Search } from 'lucide-react';

interface FilterInputs {
  action: string;
  resource: string;
  userId: string;
  success: string;
  startDate: string;
  endDate: string;
}

interface AuditLogFiltersProps {
  filterInputs: FilterInputs;
  onFilterChange: (field: keyof FilterInputs, value: string) => void;
  onApplyFilters: () => void;
  onClearFilters: () => void;
}

export function AuditLogFilters({
  filterInputs,
  onFilterChange,
  onApplyFilters,
  onClearFilters,
}: AuditLogFiltersProps) {
  return (
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
                value={filterInputs.action}
                onChange={(e) => onFilterChange('action', e.target.value)}
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
                value={filterInputs.resource}
                onChange={(e) => onFilterChange('resource', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="filter-user-id" className="text-sm font-medium block mb-2">User ID</label>
              <Input
                id="filter-user-id"
                placeholder="Enter user ID"
                value={filterInputs.userId}
                onChange={(e) => onFilterChange('userId', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="filter-status" className="text-sm font-medium block mb-2">Status</label>
              <select
                id="filter-status"
                className="w-full border rounded-md px-3 py-2"
                value={filterInputs.success}
                onChange={(e) => onFilterChange('success', e.target.value)}
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
                value={filterInputs.startDate}
                onChange={(e) => onFilterChange('startDate', e.target.value)}
              />
            </div>

            <div>
              <label htmlFor="filter-end-date" className="text-sm font-medium block mb-2">End Date</label>
              <Input
                id="filter-end-date"
                type="datetime-local"
                value={filterInputs.endDate}
                onChange={(e) => onFilterChange('endDate', e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={onApplyFilters}>
              <Search className="w-4 h-4 mr-2" aria-hidden="true" />
              Apply Filters
            </Button>
            <Button variant="secondary" onClick={onClearFilters}>
              Clear
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export type { FilterInputs };
