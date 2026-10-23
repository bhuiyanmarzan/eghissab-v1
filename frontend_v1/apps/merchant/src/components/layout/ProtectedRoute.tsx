import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuthStore, getPortalUrls } from '@eghissab/auth';
import { Loader2 } from 'lucide-react';

export function ProtectedRoute({
  children,
  crossDomainLogin = false,
}: {
  children?: React.ReactNode;
  crossDomainLogin?: boolean;
}) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="grid min-h-screen place-items-center bg-canvas text-ink">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted">Checking authentication session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (crossDomainLogin && typeof window !== 'undefined' && !window.location.hostname.includes('localhost')) {
      const landingUrl = getPortalUrls().landing;
      window.location.href = `${landingUrl}/auth/login?from=${encodeURIComponent(window.location.href)}`;
      return null;
    }
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
