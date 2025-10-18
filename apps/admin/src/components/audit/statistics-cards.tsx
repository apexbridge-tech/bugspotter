import { Card, CardContent } from '../ui/card';
import type { AuditLogStatistics } from '../../types/audit';

interface StatisticsCardsProps {
  statistics: AuditLogStatistics;
}

export function StatisticsCards({ statistics }: StatisticsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4" role="region" aria-label="Audit log statistics">
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-500" id="total-logs-label">Total Logs</p>
            <p className="text-3xl font-bold" aria-labelledby="total-logs-label">{statistics.total || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-500" id="successful-logs-label">Successful</p>
            <p className="text-3xl font-bold text-green-600" aria-labelledby="successful-logs-label">{statistics.success || 0}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="pt-6">
          <div className="text-center">
            <p className="text-sm text-gray-500" id="failed-logs-label">Failures</p>
            <p className="text-3xl font-bold text-red-600" aria-labelledby="failed-logs-label">{statistics.failures || 0}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
