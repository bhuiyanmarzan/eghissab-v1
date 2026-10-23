import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import * as Dialog from '@radix-ui/react-dialog';
import { ArrowDownRight, ArrowUpRight, Gift, MessageCircle, Settings, X } from 'lucide-react';
import { getStats } from '../api/client';
import { Avatar, Button, Card, Skeleton } from '../components/ui/primitives';
import {
  AnalyticsChart,
  IncomeChart,
  SalesChart,
  VisitorChart,
} from '../components/dashboard/DefaultCharts';
import { RecentOrders } from '../components/dashboard/RecentOrders';
import { transactions } from '../data/defaultDashboard';
import { translateNode as t, translateString as ts } from '../lib/localization';
export function DefaultDashboardPage() {
  useTranslation();
  const query = useQuery({ queryKey: ['stats'], queryFn: getStats, retry: 1 });
  const [transaction, setTransaction] = useState<(typeof transactions)[number] | null>(null);
  const stats = [
    { label: 'Total Page Views', value: '4,42,236', change: 59.3, extra: '35,000', up: true },
    ...(['users', 'orders', 'sales'] as const).map((id, i) => {
      const record = query.data?.find((s) => s.id === id);
      return {
        label: ['Total Users', 'Total Order', 'Total Sales'][i],
        value: record?.value.replace(/^\$/, '') ?? '—',
        change: record ? Math.abs(record.change) : undefined,
        extra: ['8,900', '1,943', '20,395'][i],
        up: i === 0,
      };
    }),
  ];
  return (
    <div className="default-dashboard space-y-7">
      {query.isError && (
        <div
          role="alert"
          className="flex items-center justify-between gap-3 rounded border border-danger/20 bg-red-50 px-4 py-3 text-sm text-danger"
        >
          <span>{t('Unable to load dashboard statistics.')}</span>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t('Retry')}
          </Button>
        </div>
      )}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {query.isLoading
          ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px]" />)
          : stats.map((stat) => (
              <Card key={stat.label} className="default-stat p-5">
                <p className="text-sm text-muted">{t(stat.label)}</p>
                <div className="mt-2 flex items-center gap-2">
                  <strong className="text-xl font-semibold">{t(stat.value)}</strong>
                  {stat.change !== undefined && (
                    <span
                      className={
                        'inline-flex items-center gap-1 rounded border px-2 py-1 text-xs ' +
                        (stat.up
                          ? 'border-primary/40 bg-primary-soft text-primary'
                          : 'border-warning/40 bg-amber-50 text-warning')
                      }
                    >
                      {stat.up ? (
                        <ArrowUpRight className="size-3" />
                      ) : (
                        <ArrowDownRight className="size-3" />
                      )}
                      {t(stat.change)}%
                    </span>
                  )}
                </div>
                <p className="mt-5 text-[11px] text-muted">
                  {t('You made an extra')}{' '}
                  <span className={stat.up ? 'text-primary' : 'text-warning'}>{t(stat.extra)}</span>{' '}
                  {t('this year')}
                </p>
              </Card>
            ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-[2fr_1fr]">
        <VisitorChart />
        <IncomeChart />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
        <RecentOrders />
        <AnalyticsChart />
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[2fr_1fr]">
        <SalesChart />
        <div className="space-y-5">
          <section>
            <h2 className="mb-3 flex h-9 items-center text-base font-semibold">
              {t('Transaction History')}
            </h2>
            <Card>
              {transactions.map((item) => {
                const Icon =
                  item.icon === 'gift' ? Gift : item.icon === 'message' ? MessageCircle : Settings;
                return (
                  <button
                    key={item.id}
                    className="flex w-full items-center gap-4 border-b border-border p-5 text-start last:border-0 hover:bg-subtle"
                    onClick={() => setTransaction(item)}
                  >
                    <span
                      className={
                        'grid size-9 shrink-0 place-items-center rounded-full ' +
                        (item.tone === 'green'
                          ? 'bg-green-50 text-success'
                          : item.tone === 'blue'
                            ? 'bg-primary-soft text-primary'
                            : 'bg-red-50 text-danger')
                      }
                    >
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">
                        {t('Order')} #{item.id}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{t(item.time)}</span>
                    </span>
                    <span className="ms-auto text-end">
                      <span className="block text-sm font-semibold">
                        {t('+ $' + item.amount.toLocaleString('en-US'))}
                      </span>
                      <span className="mt-1 block text-xs text-muted">{t(item.percentage)}%</span>
                    </span>
                  </button>
                );
              })}
            </Card>
          </section>
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold">{t('Help & Support Chat')}</h2>
                <p className="mt-1 text-xs text-muted">{t('Typical reply within 5 min')}</p>
              </div>
              <div className="flex -space-x-2" aria-label={ts('Support team')}>
                {['Agnes Walker', 'Cindy Baker', 'Travis Howard', 'Remy Sharp'].map((name) => (
                  <span key={name} className="rounded-full border-2 border-surface" title={name}>
                    <Avatar name={name} size="sm" />
                  </span>
                ))}
              </div>
            </div>
            <Button asChild className="mt-5 w-full">
              <Link to="/apps/chat">{t('Need Help?')}</Link>
            </Button>
          </Card>
        </div>
      </div>
      <footer className="flex flex-wrap items-center justify-between gap-3 px-3 pt-1 text-xs text-muted">
        <span>
          {t('© All rights reserved')}{' '}
          <a
            href="https://codedthemes.com/"
            target="_blank"
            rel="noreferrer"
            className="text-primary"
          >
            CodedThemes
          </a>
        </span>
        <div className="flex flex-wrap gap-4">
          {[
            ['Hire us', 'https://codedthemes.com/hire-us/'],
            ['License', 'https://mui.com/store/license/'],
            ['Terms', 'https://mui.com/store/terms/'],
            ['Figma Design System', 'https://links.codedthemes.com/dAAOP'],
          ].map(([label, url]) => (
            <a
              key={label}
              href={url}
              target="_blank"
              rel="noreferrer"
              className="hover:text-primary"
            >
              {t(label)}
            </a>
          ))}
        </div>
      </footer>
      <Dialog.Root
        open={!!transaction}
        onOpenChange={(open) => {
          if (!open) setTransaction(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/40" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed left-1/2 top-1/2 z-[90] w-[440px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 text-ink shadow-xl"
          >
            <div className="mb-5 flex items-center justify-between">
              <Dialog.Title className="text-xl font-semibold">
                {t('Transaction Details')}
              </Dialog.Title>
              <Dialog.Close asChild>
                <Button variant="ghost" size="icon" aria-label={ts('Close dialog')}>
                  <X className="size-4" />
                </Button>
              </Dialog.Close>
            </div>
            {transaction && (
              <dl className="space-y-4 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">{t('Order')}</dt>
                  <dd>#{transaction.id}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('Time')}</dt>
                  <dd>{t(transaction.time)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('Amount')}</dt>
                  <dd>{t('+ $' + transaction.amount.toLocaleString('en-US'))}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">{t('Progress')}</dt>
                  <dd>{t(transaction.percentage)}%</dd>
                </div>
              </dl>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
