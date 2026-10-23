import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@eghissab/auth';
import { AdminLayout } from './components/AdminLayout';
import { AdminDashboardPage } from './pages/AdminDashboardPage';

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute crossDomainLogin>
            <AdminLayout>
              <AdminDashboardPage />
            </AdminLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
