import { Card, CardHeader, CardContent, Button, Badge } from '@eghissab/ui';
import { DollarSign, ShoppingCart, Clock, AlertTriangle, Plus, FileText, Download } from 'lucide-react';

export function MerchantDashboardPage() {
  const stats = [
    { title: 'Total Revenue', value: '$24,850.00', change: '+12.4%', icon: DollarSign, tone: 'green' as const },
    { title: 'Active Invoices', value: '142', change: '+8.1%', icon: ShoppingCart, tone: 'blue' as const },
    { title: 'Pending Settlement', value: '$3,120.00', change: '5 orders', icon: Clock, tone: 'amber' as const },
    { title: 'Low Stock Alerts', value: '3 items', change: 'Requires action', icon: AlertTriangle, tone: 'red' as const },
  ];

  const recentInvoices = [
    { id: 'INV-2026-001', customer: 'Global Logistics Ltd', date: '2026-10-23', amount: '$1,450.00', status: 'Paid', tone: 'green' as const },
    { id: 'INV-2026-002', customer: 'Apex Retailers', date: '2026-10-22', amount: '$820.50', status: 'Pending', tone: 'amber' as const },
    { id: 'INV-2026-003', customer: 'Sarah Jenkins', date: '2026-10-21', amount: '$310.00', status: 'Paid', tone: 'green' as const },
    { id: 'INV-2026-004', customer: 'Metro Distributors', date: '2026-10-20', amount: '$4,900.00', status: 'Processing', tone: 'blue' as const },
  ];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">Merchant Operations</h1>
          <p className="text-sm text-muted mt-1">
            Store performance, active billing lifecycle, and operational transactions.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="gap-2">
            <Download className="size-4" /> Export Report
          </Button>
          <Button size="sm" className="gap-2">
            <Plus className="size-4" /> New Invoice
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
                    <Icon className="size-4 text-primary" />
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

      {/* Recent Invoices Table */}
      <Card>
        <CardHeader
          title="Recent Store Invoices"
          subtitle="Showing latest transactions processed under the active store"
          action={
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-primary">
              <FileText className="size-3.5" /> View All Invoices
            </Button>
          }
        />
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-subtle text-xs font-semibold uppercase text-muted">
              <tr>
                <th className="px-5 py-3">Invoice ID</th>
                <th className="px-5 py-3">Customer / Partner</th>
                <th className="px-5 py-3">Date</th>
                <th className="px-5 py-3 text-right">Amount</th>
                <th className="px-5 py-3 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recentInvoices.map((inv) => (
                <tr key={inv.id} className="hover:bg-subtle/50 transition-colors">
                  <td className="px-5 py-3.5 font-medium font-mono text-xs text-primary">{inv.id}</td>
                  <td className="px-5 py-3.5 text-ink font-medium">{inv.customer}</td>
                  <td className="px-5 py-3.5 text-muted text-xs">{inv.date}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-ink">{inv.amount}</td>
                  <td className="px-5 py-3.5 text-center">
                    <Badge tone={inv.tone}>{inv.status}</Badge>
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
