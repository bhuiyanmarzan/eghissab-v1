import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, redirectToPortal } from '@eghissab/auth';
import { logoutUser } from '@eghissab/api';
import { Button, Avatar, Badge } from '@eghissab/ui';
import { ShieldCheck, LogOut, Building, Users, Activity, ExternalLink } from 'lucide-react';

export function AdminLayout({ children }: { children: React.ReactNode }) {
  const { user, clearAuth } = useAuthStore();

  const handleLogout = async () => {
    try {
      await logoutUser();
    } catch {
      // Ignore
    } finally {
      clearAuth();
      redirectToPortal('landing', '/auth/login');
    }
  };

  return (
    <div className="min-h-screen bg-canvas">
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface">
        <div className="flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-amber-600 text-white font-bold">
                <ShieldCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-ink">EGHissab</span>
                <span className="text-[10px] text-muted -mt-0.5">Admin Console</span>
              </div>
            </Link>

            <Badge tone="amber">Platform Governance</Badge>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-muted">
            <Link to="/" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-amber-600 bg-amber-50 dark:bg-amber-950/40">
              <Building className="size-4" /> Organizations
            </Link>
            <span className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:text-ink cursor-pointer">
              <Users className="size-4" /> Users & Identities
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:text-ink cursor-pointer">
              <Activity className="size-4" /> System Audits
            </span>
          </nav>

          {/* User Profile & Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => redirectToPortal('merchant')}
              className="hidden lg:flex items-center gap-1 text-xs text-muted hover:text-primary transition-colors"
              title="Open Merchant Portal"
            >
              <span>Merchant View</span>
              <ExternalLink className="size-3" />
            </button>

            <div className="flex items-center gap-2.5 pl-3 border-l border-border">
              <Avatar name={user?.first_name || 'Admin'} size="sm" />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-ink">
                  {user ? `${user.first_name} ${user.last_name || ''}` : 'Administrator'}
                </span>
                <span className="text-[10px] text-muted">{user?.email || 'admin@example.com'}</span>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out">
              <LogOut className="size-4 text-muted hover:text-danger" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl p-6 lg:p-8">{children}</main>
    </div>
  );
}
