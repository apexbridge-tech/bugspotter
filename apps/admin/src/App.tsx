import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/auth-context';
import { ProtectedRoute } from './components/protected-route';
import { AdminRoute } from './components/admin-route';
import { DefaultRedirect } from './components/default-redirect';
import LoginPage from './pages/login';
import SetupWizard from './pages/setup';
import DashboardLayout from './components/dashboard-layout';
import DashboardPage from './pages/dashboard';
import UsersPage from './pages/users';
import SettingsPage from './pages/settings';
import ProjectsPage from './pages/projects';
import HealthPage from './pages/health';
import BugReportsPage from './pages/bug-reports';
import AuditLogsPage from './pages/audit-logs';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/setup" element={<SetupWizard />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }
          >
            {/* Default route: admin -> dashboard, user -> projects */}
            <Route index element={<DefaultRedirect />} />
            
            {/* Admin-only routes */}
            <Route path="dashboard" element={<AdminRoute><DashboardPage /></AdminRoute>} />
            <Route path="users" element={<AdminRoute><UsersPage /></AdminRoute>} />
            <Route path="health" element={<AdminRoute><HealthPage /></AdminRoute>} />
            <Route path="settings" element={<AdminRoute><SettingsPage /></AdminRoute>} />
            <Route path="audit-logs" element={<AdminRoute><AuditLogsPage /></AdminRoute>} />
            
            {/* All users */}
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="bug-reports" element={<BugReportsPage />} />
          </Route>
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
  );
}

export default App;
