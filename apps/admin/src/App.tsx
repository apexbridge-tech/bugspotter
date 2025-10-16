import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './contexts/auth-context';
import { ProtectedRoute } from './components/protected-route';
import LoginPage from './pages/login';
import SetupWizard from './pages/setup';
import DashboardLayout from './components/dashboard-layout';
import SettingsPage from './pages/settings';
import ProjectsPage from './pages/projects';
import HealthPage from './pages/health';
import BugReportsPage from './pages/bug-reports';

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
            <Route index element={<Navigate to="/health" replace />} />
            <Route path="health" element={<HealthPage />} />
            <Route path="projects" element={<ProjectsPage />} />
            <Route path="bug-reports" element={<BugReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </Router>
  );
}

export default App;
