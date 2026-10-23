import { Card, CardHeader, CardContent, Button, Badge } from '@eghissab/ui';
import { Receipt, CreditCard, Store, TrendingUp, Download, Eye } from 'lucide-react';

export function ConsumerDashboardPage() {
  const stats = [
    { title: 'October Expenses', value: '$840.50', change: '-4.2% from Sep', icon: Receipt, tone: 'green' as const },
    { title: 'Linked Merchants', value: '6 Stores', change: 'Active verified', icon: Store, tone: 'blue' as const },
    { title: 'Pending Receipts', value: '2 Receipts', change: '$45.00 pending', icon: CreditCard, tone: 'amber' as const },
    { title: 'Top Category', value: 'Groceries (42%)', change: '$353.00', icon: TrendingUp, tone: 'cyan' as const },
  ];

  const receipts = [
    { id: 'RCPT-9821', store: 'Downtown Supermarket', date: '2026-10-22', category: 'Groceries', amount: '$64.20', status: 'Approved' },
    { id: 'RCPT-9818', store: 'Urban Coffee Roasters', date: '2026-10-21', category: 'Dining', amount: '$14.50', status: 'Approved' },
    { id: 'RCPT-9805', store: 'Apex Pharmacy', date: '2026-10-18', category: 'Health', amount: '$32.10', status: 'Approved' },
    { id: 'RCPT-9799', store: 'Tech Supplies Direct', date: '2026-10-15', category: 'Hardware', amount: '$120.00', status: 'Pending' },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Personal Expense Hub</h1>
          <p className="text-sm text-muted mt-1">
            Personal receipts and verified merchant purchase history (BR-003).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-4" /> Download Statement
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
                    <Icon className="size-4 text-green-600" />
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

      {/* Verified Merchant Receipts */}
      <Card>
        <CardHeader
          title="Verified Merchant Purchases"
          subtitle="Invoices automatically linked to your verified identity"
          action={
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary">
              <Eye className="size-3.5" /> View Full History
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-subtle text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Receipt / Ref</th>
                <th className="px-5 py-3">Store</th>
                <th className="px-5 py-3">Category</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {receipts.map((r) => (
                <tr key={r.id} className="hover:bg-subtle/50 transition-colors">
                  <td className="px-5 py-3.5 font-mono text-xs font-medium text-primary">{r.id}</td>
                  <td className="px-5 py-3.5 font-medium text-ink">{r.store}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{r.category}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{r.date}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-ink">{r.amount}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={r.status === 'Approved' ? 'green' : 'amber'}>{r.status}</Badge>
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
