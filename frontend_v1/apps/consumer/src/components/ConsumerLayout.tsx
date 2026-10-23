import * as React from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore, redirectToPortal } from '@eghissab/auth';
import { logoutUser } from '@eghissab/api';
import { Button, Avatar, Badge } from '@eghissab/ui';
import { UserCheck, LogOut, Receipt, PieChart, Store, ExternalLink } from 'lucide-react';

export function ConsumerLayout({ children }: { children: React.ReactNode }) {
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
              <div className="flex size-9 items-center justify-center rounded-lg bg-green-600 text-white font-bold">
                <UserCheck className="size-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-ink">EGHissab</span>
                <span className="text-[10px] text-muted -mt-0.5">Consumer Portal</span>
              </div>
            </Link>

            <Badge tone="green">Verified Consumer</Badge>
          </div>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center gap-1 text-xs font-medium text-muted">
            <Link to="/" className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-green-600 bg-green-50 dark:bg-green-950/40">
              <Receipt className="size-4" /> My Expenses
            </Link>
            <span className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:text-ink cursor-pointer">
              <Store className="size-4" /> Linked Merchants
            </span>
            <span className="flex items-center gap-1.5 rounded-md px-3 py-1.5 hover:text-ink cursor-pointer">
              <PieChart className="size-4" /> Spending Analytics
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
              <Avatar name={user?.first_name || 'Consumer'} size="sm" />
              <div className="hidden sm:flex flex-col text-left">
                <span className="text-xs font-semibold text-ink">
                  {user ? `${user.first_name} ${user.last_name || ''}` : 'Consumer'}
                </span>
                <span className="text-[10px] text-muted">{user?.email || 'consumer@example.com'}</span>
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
