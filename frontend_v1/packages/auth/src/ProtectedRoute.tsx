import * as React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './useAuthStore';
import { getPortalUrls } from './redirects';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  fallbackPath?: string;
  crossDomainLogin?: boolean;
}

export function ProtectedRoute({
  children,
  fallbackPath = '/auth/login',
  crossDomainLogin = false,
}: ProtectedRouteProps) {
  const { isAuthenticated, isInitialized } = useAuthStore();
  const location = useLocation();

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-sm text-muted">Checking authentication session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (crossDomainLogin) {
      const landingUrl = getPortalUrls().landing;
      window.location.href = `${landingUrl}/auth/login?from=${encodeURIComponent(window.location.href)}`;
      return null;
    }
    return <Navigate to={fallbackPath} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
