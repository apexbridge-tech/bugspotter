import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { BugReportList } from '../../components/bug-reports/bug-report-list';
import type { BugReport, Project } from '../../types';

describe('BugReportList', () => {
  const mockProjects: Project[] = [
    {
      id: 'project-1',
      name: 'Project Alpha',
      api_key: 'key-1',
      created_at: '2024-01-01T00:00:00Z',
      report_count: 10,
      owner_id: 'user-1',
    },
  ];

  const mockReports: BugReport[] = [
    {
      id: 'report-1',
      project_id: 'project-1',
      title: 'Critical Bug',
      description: 'Something is broken',
      screenshot_url: 'https://example.com/screenshot.png',
      replay_url: 'https://example.com/replay.json',
      metadata: {},
      status: 'open',
      priority: 'critical',
      deleted_at: null,
      deleted_by: null,
      legal_hold: false,
      created_at: '2024-01-15T10:00:00Z',
      updated_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'report-2',
      project_id: 'project-1',
      title: 'Minor Issue',
      description: null,
      screenshot_url: null,
      replay_url: null,
      metadata: {},
      status: 'resolved',
      priority: 'low',
      deleted_at: null,
      deleted_by: null,
      legal_hold: true,
      created_at: '2024-01-10T09:00:00Z',
      updated_at: '2024-01-12T11:00:00Z',
    },
  ];

  it('renders all bug reports', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Critical Bug')).toBeInTheDocument();
    expect(screen.getByText('Minor Issue')).toBeInTheDocument();
  });

  it('displays status badges correctly', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByText('Resolved')).toBeInTheDocument();
  });

  it('displays priority badges correctly', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Low')).toBeInTheDocument();
  });

  it('shows legal hold badge when applicable', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Legal Hold')).toBeInTheDocument();
  });

  it('shows screenshot and replay indicators', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('📸 Screenshot')).toBeInTheDocument();
    expect(screen.getByText('🎬 Replay')).toBeInTheDocument();
  });

  it('calls onViewDetails when View button is clicked', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    const viewButtons = screen.getAllByRole('button', { name: /view/i });
    await user.click(viewButtons[0]);

    expect(onViewDetails).toHaveBeenCalledWith(mockReports[0]);
  });

  it('requires double-click to delete', async () => {
    const user = userEvent.setup();
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    
    // First click shows confirmation
    await user.click(deleteButtons[0]);
    expect(screen.getByText(/confirm/i)).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    // Second click confirms deletion
    await user.click(screen.getByText(/confirm/i));
    expect(onDelete).toHaveBeenCalledWith('report-1');
  });

  it('disables delete button for reports with legal hold', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    const deleteButtons = screen.getAllByRole('button', { name: /delete/i });
    expect(deleteButtons[1]).toBeDisabled();
  });

  it('displays project names correctly', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    const projectLabels = screen.getAllByText(/project alpha/i);
    expect(projectLabels.length).toBeGreaterThan(0);
  });

  it('shows empty state when no reports', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={[]}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText(/no bug reports found/i)).toBeInTheDocument();
    expect(screen.getByText(/try adjusting your filters/i)).toBeInTheDocument();
  });

  it('displays description when available', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    expect(screen.getByText('Something is broken')).toBeInTheDocument();
  });

  it('formats dates correctly', () => {
    const onViewDetails = vi.fn();
    const onDelete = vi.fn();
    render(
      <BugReportList
        reports={mockReports}
        projects={mockProjects}
        onViewDetails={onViewDetails}
        onDelete={onDelete}
        isDeleting={false}
      />
    );

    // Check that formatted dates are present (format varies by locale)
    expect(screen.getByText(/jan/i)).toBeInTheDocument();
  });
});
