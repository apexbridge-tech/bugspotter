/**
 * Analytics Service
 * Handles complex cross-entity analytics queries for dashboard and reporting
 */

import type { Pool } from 'pg';

export interface DashboardMetrics {
  bug_reports: {
    by_status: {
      open: number;
      in_progress: number;
      resolved: number;
      closed: number;
      total: number;
    };
    by_priority: {
      low: number;
      medium: number;
      high: number;
      critical: number;
    };
  };
  projects: {
    total: number;
    total_reports: number;
    avg_reports_per_project: number;
  };
  users: {
    total: number;
  };
  time_series: Array<{
    date: string;
    count: number;
  }>;
  top_projects: Array<{
    id: string;
    name: string;
    report_count: number;
  }>;
}

export interface ReportTrendData {
  days: number;
  trend: Array<{
    date: string;
    total: number;
    open: number;
    in_progress: number;
    resolved: number;
    closed: number;
  }>;
}

export interface ProjectStats {
  id: string;
  name: string;
  created_at: Date;
  total_reports: number;
  open_reports: number;
  in_progress_reports: number;
  resolved_reports: number;
  closed_reports: number;
  critical_reports: number;
  last_report_at: Date | null;
}

export class AnalyticsService {
  constructor(private pool: Pool) {}

  /**
   * Get dashboard overview metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    // Get bug report counts by status
    const statusResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'closed') as closed,
        COUNT(*) as total
      FROM bug_reports
      WHERE deleted_at IS NULL
    `);

    // Get bug report counts by priority
    const priorityResult = await this.pool.query(`
      SELECT 
        COUNT(*) FILTER (WHERE priority = 'low') as low,
        COUNT(*) FILTER (WHERE priority = 'medium') as medium,
        COUNT(*) FILTER (WHERE priority = 'high') as high,
        COUNT(*) FILTER (WHERE priority = 'critical') as critical
      FROM bug_reports
      WHERE deleted_at IS NULL
    `);

    // Get project statistics
    const projectsResult = await this.pool.query(`
      SELECT 
        COUNT(DISTINCT p.id) as total_projects,
        COALESCE(SUM(subq.report_count), 0) as total_reports,
        COALESCE(AVG(subq.report_count), 0) as avg_reports_per_project
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*) as report_count
        FROM bug_reports
        WHERE deleted_at IS NULL
        GROUP BY project_id
      ) subq ON p.id = subq.project_id
    `);

    // Get user count
    const usersResult = await this.pool.query(`
      SELECT COUNT(*) as total_users
      FROM users
    `);

    // Get time series data (last 30 days)
    const timeSeriesResult = await this.pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM bug_reports
      WHERE created_at >= NOW() - INTERVAL '30 days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);

    // Get top projects by report count
    const topProjectsResult = await this.pool.query(`
      SELECT 
        p.id,
        p.name,
        COUNT(br.id) as report_count
      FROM projects p
      LEFT JOIN bug_reports br ON p.id = br.project_id AND br.deleted_at IS NULL
      GROUP BY p.id, p.name
      ORDER BY report_count DESC
      LIMIT 5
    `);

    return {
      bug_reports: {
        by_status: {
          open: parseInt(statusResult.rows[0].open),
          in_progress: parseInt(statusResult.rows[0].in_progress),
          resolved: parseInt(statusResult.rows[0].resolved),
          closed: parseInt(statusResult.rows[0].closed),
          total: parseInt(statusResult.rows[0].total),
        },
        by_priority: {
          low: parseInt(priorityResult.rows[0].low),
          medium: parseInt(priorityResult.rows[0].medium),
          high: parseInt(priorityResult.rows[0].high),
          critical: parseInt(priorityResult.rows[0].critical),
        },
      },
      projects: {
        total: parseInt(projectsResult.rows[0].total_projects),
        total_reports: parseInt(projectsResult.rows[0].total_reports),
        avg_reports_per_project: parseFloat(projectsResult.rows[0].avg_reports_per_project),
      },
      users: {
        total: parseInt(usersResult.rows[0].total_users),
      },
      time_series: timeSeriesResult.rows.map((row) => ({
        date: row.date,
        count: parseInt(row.count),
      })),
      top_projects: topProjectsResult.rows.map((row) => ({
        id: row.id,
        name: row.name,
        report_count: parseInt(row.report_count),
      })),
    };
  }

  /**
   * Get report trend data for specified time period
   */
  async getReportTrend(days: number): Promise<ReportTrendData> {
    // Validate days parameter (1-365)
    const validDays = Math.min(Math.max(days, 1), 365);

    const trendResult = await this.pool.query(
      `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'open') as open,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved,
        COUNT(*) FILTER (WHERE status = 'closed') as closed
      FROM bug_reports
      WHERE created_at >= NOW() - INTERVAL '${validDays} days'
        AND deleted_at IS NULL
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `
    );

    return {
      days: validDays,
      trend: trendResult.rows.map((row) => ({
        date: row.date,
        total: parseInt(row.count),
        open: parseInt(row.open),
        in_progress: parseInt(row.in_progress),
        resolved: parseInt(row.resolved),
        closed: parseInt(row.closed),
      })),
    };
  }

  /**
   * Get per-project statistics
   */
  async getProjectStats(): Promise<ProjectStats[]> {
    const statsResult = await this.pool.query(`
      SELECT 
        p.id,
        p.name,
        p.created_at,
        COUNT(br.id) as total_reports,
        COUNT(*) FILTER (WHERE br.status = 'open') as open_reports,
        COUNT(*) FILTER (WHERE br.status = 'in_progress') as in_progress_reports,
        COUNT(*) FILTER (WHERE br.status = 'resolved') as resolved_reports,
        COUNT(*) FILTER (WHERE br.status = 'closed') as closed_reports,
        COUNT(*) FILTER (WHERE br.priority = 'critical') as critical_reports,
        MAX(br.created_at) as last_report_at
      FROM projects p
      LEFT JOIN bug_reports br ON p.id = br.project_id AND br.deleted_at IS NULL
      GROUP BY p.id, p.name, p.created_at
      ORDER BY total_reports DESC
    `);

    return statsResult.rows.map((row) => ({
      id: row.id,
      name: row.name,
      created_at: row.created_at,
      total_reports: parseInt(row.total_reports),
      open_reports: parseInt(row.open_reports),
      in_progress_reports: parseInt(row.in_progress_reports),
      resolved_reports: parseInt(row.resolved_reports),
      closed_reports: parseInt(row.closed_reports),
      critical_reports: parseInt(row.critical_reports),
      last_report_at: row.last_report_at,
    }));
  }
}
