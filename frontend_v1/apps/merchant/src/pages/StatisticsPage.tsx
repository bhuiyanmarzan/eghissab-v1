import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  Clock3,
  ContactRound,
  Download,
  Eye,
  Facebook,
  FileCheck2,
  FileText,
  Linkedin,
  ListChecks,
  CircleDollarSign,
  ShoppingBag,
  Target,
  Twitter,
  Users,
  Youtube,
} from 'lucide-react';
import { Button, Card, Skeleton } from '../components/ui/primitives';
import { LearningWidget } from '../components/dashboard/LearningWidget';
import {
  statisticsSummary,
  revenueWidgets,
  socialWidgets,
  audienceWidgets,
  dailyWidgets,
  projectProgress,
} from '../data/statistics';
import { getStats } from '../api/client';
import { useTenantStore } from '../store/useTenantStore';
import { translateNode as t, translateString as ts } from '../lib/localization';
const icons = {
  earnings: BarChart3,
  task: CalendarDays,
  views: FileText,
  downloads: Download,
  revenue: CircleDollarSign,
  orders: ListChecks,
  sales: ShoppingBag,
  facebook: Facebook,
  twitter: Twitter,
  linkedin: Linkedin,
  youtube: Youtube,
  eye: Eye,
  goal: Target,
  impact: Clock3,
  user: ContactRound,
  page: FileCheck2,
  visitor: Users,
};
const colors = {
  blue: '#3b76ff',
  amber: '#faad24',
  green: '#52c41a',
  red: '#ff4d6b',
  gray: '#8c8c8c',
};
export function StatisticsPage() {
  useTranslation();
  const tenant = useTenantStore((s) => s.selectedTenantId);
  const query = useQuery({ queryKey: ['stats'], queryFn: getStats, retry: 1 });
  const summaries = [
    {
      label: 'Total Page Views',
      value: '4,42,236',
      change: 59.3,
      extra: '35,000',
      up: true,
      color: 'blue',
    },
    ...(['users', 'orders', 'sales'] as const).map((id, i) => {
      const stat = query.data?.find((r) => r.id === id);
      return {
        label: ['Total Users', 'Total Order', 'Total Sales'][i],
        value: stat?.value.replace(/^\$/, '') ?? '—',
        change: stat ? Math.abs(stat.change) : undefined,
        extra: ['8,900', '1,943', '20,395'][i],
        up: i === 0,
        color: ['green', 'amber', 'red'][i],
      };
    }),
  ];
  return (
    <div className="statistics-page space-y-6">
      <section
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={ts('Activity statistics')}
      >
        {statisticsSummary.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Card key={item.label} className="flex min-h-[100px] items-center justify-between p-5">
              <div>
                <p className="text-xl font-semibold">{t(item.value)}</p>
                <p className="mt-2 text-sm text-muted">{t(item.label)}</p>
              </div>
              <Icon className="size-7" style={{ color: colors[item.color] }} aria-hidden="true" />
            </Card>
          );
        })}
      </section>
      <section className="grid gap-6 md:grid-cols-3" aria-label={ts('Revenue statistics')}>
        {revenueWidgets.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Card
              key={item.label}
              className="statistics-color-card relative flex min-h-[178px] items-center justify-between overflow-hidden border-0 p-6 text-white"
              style={{ background: colors[item.color] }}
            >
              <Icon className="relative z-10 size-16 opacity-20" aria-hidden="true" />
              <div className="relative z-10 text-end">
                <h2 className="text-xl">{t(item.label)}</h2>
                <p className="mt-2 text-3xl font-semibold">{t(item.value)}</p>
                <p className="mt-5 text-base">{t(item.caption)}</p>
              </div>
            </Card>
          );
        })}
      </section>
      <section
        className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4"
        aria-label={ts('Social statistics')}
      >
        {socialWidgets.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Card
              key={item.label}
              className="flex min-h-[92px] items-center justify-between border-0 p-5 text-white"
              style={{ background: item.color }}
            >
              <div>
                <p className="text-2xl font-medium">{t(item.value)}</p>
                <h2 className="mt-1 text-xs">{t(item.label)}</h2>
              </div>
              <Icon className="size-8 opacity-40" aria-hidden="true" />
            </Card>
          );
        })}
      </section>
      <section className="grid gap-6 md:grid-cols-3" aria-label={ts('Audience statistics')}>
        {audienceWidgets.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Card key={item.label} className="flex min-h-[130px] items-center justify-between p-5">
              <div>
                <h2 className="text-base font-semibold">{t(item.label)}</h2>
                <p className="mt-2 text-2xl font-semibold">{t(item.value)}</p>
                <p className="mt-2 text-xs text-muted">{t(item.date)}</p>
              </div>
              <span
                className="grid size-10 place-items-center rounded"
                style={{ color: colors[item.color], background: colors[item.color] + '18' }}
              >
                <Icon className="size-5" aria-hidden="true" />
              </span>
            </Card>
          );
        })}
      </section>
      <section aria-label={ts('Summary statistics')}>
        {query.isError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between gap-3 rounded bg-red-50 p-3 text-sm text-danger"
          >
            <span>{t('Unable to load dashboard statistics.')}</span>
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
              {t('Retry')}
            </Button>
          </div>
        )}
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
          {query.isLoading
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[132px]" />)
            : summaries.map((item) => (
                <Card key={item.label} className="min-h-[132px] p-5">
                  <h2 className="text-sm text-muted">{t(item.label)}</h2>
                  <div className="mt-2 flex items-center gap-2">
                    <strong className="text-xl font-semibold">{t(item.value)}</strong>
                    {item.change !== undefined && (
                      <span
                        className="inline-flex items-center gap-1 rounded border px-2 py-1 text-xs"
                        style={{
                          color: colors[item.color as keyof typeof colors],
                          borderColor: colors[item.color as keyof typeof colors] + '66',
                          background: colors[item.color as keyof typeof colors] + '12',
                        }}
                      >
                        {item.up ? (
                          <ArrowUpRight className="size-3" />
                        ) : (
                          <ArrowDownRight className="size-3" />
                        )}
                        {t(item.change)}%
                      </span>
                    )}
                  </div>
                  <p className="mt-5 text-[11px] text-muted">
                    {t('You made an extra')}{' '}
                    <span style={{ color: colors[item.color as keyof typeof colors] }}>
                      {t(item.extra)}
                    </span>{' '}
                    {t('this year')}
                  </p>
                </Card>
              ))}
        </div>
      </section>
      <section className="grid gap-6 md:grid-cols-3" aria-label={ts('Daily statistics')}>
        {dailyWidgets.map((item) => {
          const Icon = icons[item.icon];
          return (
            <Card
              key={item.label}
              className="relative min-h-[102px] overflow-hidden border-0 p-5 text-center text-white"
              style={{ background: colors[item.color] }}
            >
              <Icon
                className="absolute -bottom-3 -start-2 size-24 -rotate-[25deg] opacity-30"
                aria-hidden="true"
              />
              <p className="relative text-2xl font-semibold">{t(item.value)}</p>
              <h2 className="relative mt-2 text-sm">{t(item.label)}</h2>
            </Card>
          );
        })}
      </section>
      <div className="grid items-start gap-6 xl:grid-cols-[1.4fr_1fr]">
        <LearningWidget key={tenant} tenant={tenant} />
        <Card className="p-5" aria-label={ts('Project progress')}>
          <div className="space-y-4">
            {projectProgress.map((item) => (
              <div
                key={item.label}
                className="grid grid-cols-[1fr_1fr_36px] items-center gap-3 text-sm"
              >
                <span>{t(item.label)}</span>
                <div
                  role="progressbar"
                  aria-label={ts(item.label)}
                  aria-valuenow={item.value}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: colors[item.tone] + '55' }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: item.value + '%', background: colors[item.tone] }}
                  />
                </div>
                <span className="text-xs text-muted">{t(item.value)}%</span>
              </div>
            ))}
          </div>
          <div className="mt-5 flex items-center gap-4 border-t border-border pt-5">
            <Target className="size-10 shrink-0 text-primary" />
            <div>
              <h2 className="text-sm font-medium">{t('Income Salaries & Budget')}</h2>
              <p className="mt-1 text-xs leading-5 text-muted">
                {t(
                  'All your income salaries and budget comes here, you can track them or manage them',
                )}
              </p>
            </div>
          </div>
        </Card>
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
    </div>
  );
}
