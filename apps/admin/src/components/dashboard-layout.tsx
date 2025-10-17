import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/auth-context';
import { Activity, Settings, FolderKanban, LogOut, Bug, LayoutDashboard, Users } from 'lucide-react';

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  const isActive = (path: string) => location.pathname === path;

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
            {/* Admin-only: Dashboard (Analytics) */}
            {user?.role === 'admin' && (
              <Link
                to="/dashboard"
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive('/dashboard') ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <LayoutDashboard className="w-5 h-5 mr-3" />
                Dashboard
              </Link>
            )}

            {/* Admin-only: User Management */}
            {user?.role === 'admin' && (
              <Link
                to="/users"
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive('/users') ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Users className="w-5 h-5 mr-3" />
                User Management
              </Link>
            )}

            {/* Admin-only: System Health */}
            {user?.role === 'admin' && (
              <Link
                to="/health"
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive('/health') ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Activity className="w-5 h-5 mr-3" />
                System Health
              </Link>
            )}

            {/* All users: Projects */}
            <Link
              to="/projects"
              className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive('/projects') ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <FolderKanban className="w-5 h-5 mr-3" />
              Projects
            </Link>

            {/* All users: Bug Reports */}
            <Link
              to="/bug-reports"
              className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                isActive('/bug-reports')
                  ? 'bg-primary text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Bug className="w-5 h-5 mr-3" />
              Bug Reports
            </Link>

            {/* Admin-only: Settings (Instance Configuration) */}
            {user?.role === 'admin' && (
              <Link
                to="/settings"
                className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                  isActive('/settings') ? 'bg-primary text-white' : 'text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Settings className="w-5 h-5 mr-3" />
                Settings
              </Link>
            )}
          </nav>

          {/* User Info */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-gray-900 truncate">{user?.name || 'User'}</p>
                  <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                    user?.role === 'admin' 
                      ? 'bg-red-100 text-red-700' 
                      : user?.role === 'viewer'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
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
