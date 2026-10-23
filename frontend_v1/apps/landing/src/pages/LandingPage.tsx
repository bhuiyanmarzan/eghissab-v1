import { Link } from 'react-router-dom';
import { Button, Card, CardHeader, CardContent, Badge } from '@eghissab/ui';
import { getPortalUrls } from '@eghissab/auth';
import { Store, UserCheck, ShieldCheck, ArrowRight, CheckCircle2, Building2 } from 'lucide-react';

export function LandingPage() {
  const portalUrls = getPortalUrls();

  const portals = [
    {
      name: 'Merchant Portal',
      domain: 'app.example.com',
      url: portalUrls.merchant,
      description: 'Manage organizations, branch stores, invoices, stock, and business analytics.',
      badge: 'Merchant Operations',
      icon: Store,
      color: 'blue' as const,
    },
    {
      name: 'Consumer Portal',
      domain: 'me.example.com',
      url: portalUrls.consumer,
      description: 'Track personal expenses, browse approved merchant receipts, and analyze personal spending.',
      badge: 'Consumer Expenses',
      icon: UserCheck,
      color: 'green' as const,
    },
    {
      name: 'Admin Console',
      domain: 'admin.example.com',
      url: portalUrls.admin,
      description: 'Superadmin governance: organization audits, user management, and platform billing quotas.',
      badge: 'Platform Administration',
      icon: ShieldCheck,
      color: 'amber' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-canvas">
      {/* Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-white font-bold shadow-sm">
              <Building2 className="size-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-ink">EGHissab</span>
              <span className="ml-2 rounded bg-primary-soft px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                v1
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/auth/login">
              <Button variant="outline" size="sm">
                Log In
              </Button>
            </Link>
            <Link to="/auth/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-20 lg:py-28">
        <div className="mx-auto max-w-5xl text-center">
          <Badge tone="blue" className="mb-4 px-3 py-1 text-xs">
            Multi-Tenant Enterprise Architecture
          </Badge>
          <h1 className="text-4xl font-extrabold tracking-tight text-ink sm:text-6xl">
            Unified Commerce & Expense Tracking Platform
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
            EGHissab provides isolated multi-store operations for merchants, transparent expense
            tracking for consumers, and centralized governance for platform administrators.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link to="/auth/register">
              <Button size="lg" className="gap-2">
                Create Free Account <ArrowRight className="size-4" />
              </Button>
            </Link>
            <a href="#portals">
              <Button variant="outline" size="lg">
                Explore Portals
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Subdomain Portals Section */}
      <section id="portals" className="border-t border-border bg-subtle/50 px-6 py-16">
        <div className="mx-auto max-w-7xl">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              Static Build Ecosystem
            </h2>
            <p className="mt-2 text-sm text-muted">
              Each portal operates as an independent, optimized static React application built with
              Turborepo.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {portals.map((portal) => {
              const Icon = portal.icon;
              return (
                <Card key={portal.domain} className="flex flex-col justify-between hover:border-primary/40 transition-colors">
                  <div>
                    <CardHeader
                      title={
                        <div className="flex items-center gap-2">
                          <Icon className="size-5 text-primary" />
                          <span>{portal.name}</span>
                        </div>
                      }
                      action={<Badge tone={portal.color}>{portal.badge}</Badge>}
                    />
                    <CardContent className="space-y-3 pt-4">
                      <p className="text-xs font-mono font-medium text-primary">
                        {portal.domain}
                      </p>
                      <p className="text-sm text-muted">{portal.description}</p>
                    </CardContent>
                  </div>
                  <div className="border-t border-border p-4 bg-surface/50">
                    <a href={portal.url} target="_blank" rel="noreferrer" className="block">
                      <Button variant="outline" size="sm" className="w-full justify-between">
                        Launch Portal <ArrowRight className="size-3.5" />
                      </Button>
                    </a>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Architecture Highlights */}
      <section className="px-6 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="rounded-xl border border-border bg-surface p-8 shadow-card">
            <h3 className="text-xl font-bold text-ink mb-6">Core Design Principles</h3>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Shared Identity & Authentication</h4>
                  <p className="text-xs text-muted mt-1">
                    One global user identity with secure session rotation and cross-subdomain
                    authorization.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Store-Level Data Isolation</h4>
                  <p className="text-xs text-muted mt-1">
                    Organizations contain billing boundaries; stores isolate operational items and
                    transactions with PostgreSQL RLS.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Consumer Invoice Visibility</h4>
                  <p className="text-xs text-muted mt-1">
                    Consumers view eligible receipts only after approved customer links,
                    protecting privacy.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle2 className="size-5 text-success shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-semibold text-ink">Turborepo Static Compilation</h4>
                  <p className="text-xs text-muted mt-1">
                    Shared UI primitives, typed API client, and fast local development with
                    independent CDN deployments.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-surface px-6 py-8 text-center text-xs text-muted">
        <p>© {new Date().getFullYear()} EGHissab. All rights reserved.</p>
      </footer>
    </div>
  );
}
