import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Activity, Settings, FolderKanban, LogOut, Bug, LayoutDashboard, Users, FileText, LucideIcon } from 'lucide-react';

interface NavItem {
  path: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, adminOnly: true },
  { path: '/users', label: 'User Management', icon: Users, adminOnly: true },
  { path: '/health', label: 'System Health', icon: Activity, adminOnly: true },
  { path: '/audit-logs', label: 'Audit Logs', icon: FileText, adminOnly: true },
  { path: '/projects', label: 'Projects', icon: FolderKanban },
  { path: '/bug-reports', label: 'Bug Reports', icon: Bug },
  { path: '/settings', label: 'Settings', icon: Settings, adminOnly: true },
];

const getRoleBadgeStyles = (role?: string) => {
  switch (role) {
    case 'admin':
      return 'bg-red-100 text-red-700';
    case 'viewer':
      return 'bg-blue-100 text-blue-700';
    default:
      return 'bg-green-100 text-green-700';
  }
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;
  const isAdmin = user?.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200">
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-gray-200">
            <h1 className="text-2xl font-bold text-primary">BugSpotter</h1>
            <p className="text-sm text-gray-500 mt-1">Admin Panel</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1">
            {NAV_ITEMS.map((item) => {
              // Skip admin-only items for non-admin users
              if (item.adminOnly && !isAdmin) {
                return null;
              }

              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    isActive(item.path)
                      ? 'bg-primary text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-3" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name || 'User'}
                  </p>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${getRoleBadgeStyles(user?.role)}`}
                  >
                    {user?.role}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{user?.email}</p>
              </div>
              <button
                onClick={logout}
                className="ml-2 p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="ml-64">
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
