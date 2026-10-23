import { Card, CardHeader, CardContent, Button, Badge } from '@eghissab/ui';
import { Building, Users, Server, ShieldCheck, CheckCircle2 } from 'lucide-react';

export function AdminDashboardPage() {
  const stats = [
    { title: 'Total Organizations', value: '48', change: '+3 this week', icon: Building, tone: 'blue' as const },
    { title: 'Registered Users', value: '1,280', change: '+45 this month', icon: Users, tone: 'green' as const },
    { title: 'Active DB Sessions', value: '18', change: 'PostgreSQL 17 pool', icon: Server, tone: 'amber' as const },
    { title: 'RLS Security State', value: 'Enforced', change: 'NOBYPASSRLS active', icon: ShieldCheck, tone: 'cyan' as const },
  ];

  const audits = [
    { id: 'AUD-8801', actor: 'system@eghissab.local', action: 'Migration 000005 Applied', resource: 'Refresh Token Grace Table', time: '10 mins ago', status: 'Success' },
    { id: 'AUD-8800', actor: 'marzan@example.com', action: 'User Registration & Verification', resource: 'Identity Module', time: '2 hours ago', status: 'Success' },
    { id: 'AUD-8799', actor: 'eghissab_app', action: 'Transaction Scoped RLS Check', resource: 'CheckRuntime', time: '4 hours ago', status: 'Success' },
    { id: 'AUD-8798', actor: 'auth-service', action: 'Session Family Rotation', resource: 'Session #4412', time: '6 hours ago', status: 'Success' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Platform Administration</h1>
          <p className="text-sm text-muted mt-1">
            Superadmin governance, system health audits, and organization quotas (PLAT-001).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <CheckCircle2 className="size-4 text-success" /> API Health: Healthy
          </Button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.title}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted uppercase tracking-wider">{s.title}</span>
                  <div className="flex size-8 items-center justify-center rounded-md bg-subtle text-ink">
                    <Icon className="size-4 text-amber-600" />
                  </div>
                </div>
                <div className="mt-3">
                  <span className="text-2xl font-bold text-ink">{s.value}</span>
                </div>
                <div className="mt-2">
                  <Badge tone={s.tone}>{s.change}</Badge>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Recent System Audits */}
      <Card>
        <CardHeader
          title="System Audit Log"
          subtitle="Real-time security events and administrative actions"
          action={<Badge tone="amber">Audit Trail Active</Badge>}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-subtle text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Audit ID</th>
                <th className="px-5 py-3">Actor</th>
                <th className="px-5 py-3">Action</th>
                <th className="px-5 py-3">Resource</th>
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-5 py-3 text-center">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {audits.map((a) => (
                <tr key={a.id} className="hover:bg-subtle/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-amber-600">{a.id}</td>
                  <td className="px-5 py-3.5 font-medium text-ink text-xs">{a.actor}</td>
                  <td className="px-5 py-3.5 text-ink font-medium">{a.action}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{a.resource}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{a.time}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone="green">{a.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
