import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from '@eghissab/auth';
import { ConsumerLayout } from './components/ConsumerLayout';
import { ConsumerDashboardPage } from './pages/ConsumerDashboardPage';

export function App() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <ProtectedRoute crossDomainLogin>
            <ConsumerLayout>
              <ConsumerDashboardPage />
            </ConsumerLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
