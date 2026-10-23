import { useId, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import * as Dropdown from '@radix-ui/react-dropdown-menu';
import { Ellipsis } from 'lucide-react';
import { Button, Card, Select } from '../ui/primitives';
import { chartTick, translateNode as t, translateString as ts } from '../../lib/localization';
import {
  analyticsData,
  analyticsPeriods,
  analyticsValues,
  monthVisitors,
  salesData,
  salesPeriods,
  salesProfit,
  weekVisitors,
  weeklyIncome,
  type AnalyticsPeriod,
  type SalesPeriod,
} from '../../data/defaultDashboard';
const grid = 'var(--color-border)';
const tipStyle = {
  background: 'var(--color-surface)',
  border: '1px solid var(--color-border)',
  borderRadius: 6,
  color: 'var(--color-ink)',
  fontSize: 12,
};
const valueTip = (value: unknown, name: unknown) => [chartTick(String(value)), ts(String(name))];
export function VisitorChart() {
  const [period, setPeriod] = useState<'Month' | 'Week'>('Month');
  const [visible, setVisible] = useState({ pageViews: true, sessions: true });
  const id = useId().replaceAll(':', '');
  const rows = period === 'Month' ? monthVisitors : weekVisitors;
  return (
    <section>
      <div className="mb-3 flex h-9 items-center justify-between">
        <h2 className="text-base font-semibold">{t('Unique Visitor')}</h2>
        <div className="flex gap-1">
          {(['Month', 'Week'] as const).map((p) => (
            <Button
              key={p}
              variant={period === p ? 'outline' : 'ghost'}
              size="sm"
              className={period === p ? 'border-primary text-primary' : ''}
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
            >
              {t(p)}
            </Button>
          ))}
        </div>
      </div>
      <Card className="p-4 pt-6">
        <div
          role="img"
          aria-label={ts('Unique Visitor') + ' — ' + ts(period)}
          className="h-[390px] w-full"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 10, right: 20, bottom: 4, left: -15 }}>
              <defs>
                <linearGradient id={'views-' + id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#408cff" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#408cff" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={'sessions-' + id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#3949ab" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#3949ab" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={chartTick}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <YAxis
                domain={[0, period === 'Month' ? 160 : 120]}
                tickFormatter={chartTick}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(v) => chartTick(String(v))}
                formatter={valueTip}
              />
              <Area
                dataKey="pageViews"
                name={ts('Page views')}
                type="monotone"
                hide={!visible.pageViews}
                stroke="#408cff"
                strokeWidth={2}
                fill={'url(#views-' + id + ')'}
                isAnimationActive={false}
              />
              <Area
                dataKey="sessions"
                name={ts('Sessions')}
                type="monotone"
                hide={!visible.sessions}
                stroke="#3949ab"
                strokeWidth={2}
                fill={'url(#sessions-' + id + ')'}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-4 pt-3">
          {(['pageViews', 'sessions'] as const).map((key) => (
            <button
              key={key}
              className={'flex items-center gap-2 text-xs ' + (!visible[key] ? 'opacity-40' : '')}
              aria-pressed={visible[key]}
              onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
            >
              <i
                className="size-2.5 rounded-full"
                style={{ background: key === 'pageViews' ? '#408cff' : '#3949ab' }}
              />
              {t(key === 'pageViews' ? 'Page views' : 'Sessions')}
            </button>
          ))}
        </div>
        <table className="sr-only" aria-label={ts('Visitor chart data')}>
          <thead>
            <tr>
              <th>{t(period)}</th>
              <th>{t('Page views')}</th>
              <th>{t('Sessions')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.period}>
                <td>{t(r.period)}</td>
                <td>{t(r.pageViews)}</td>
                <td>{t(r.sessions)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
export function IncomeChart() {
  return (
    <section>
      <h2 className="mb-3 flex h-9 items-center text-base font-semibold">{t('Income Overview')}</h2>
      <Card className="p-5">
        <p className="text-sm text-muted">{t('This Week Statistics')}</p>
        <p className="mt-4 text-2xl font-semibold">{t('$7,650')}</p>
        <div role="img" aria-label={ts('Weekly income')} className="mt-5 h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyIncome} margin={{ top: 10, left: 0, right: 0, bottom: 0 }}>
              <XAxis
                dataKey="period"
                axisLine={false}
                tickLine={false}
                tickFormatter={chartTick}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <Tooltip
                contentStyle={tipStyle}
                cursor={{ fill: 'var(--color-subtle)' }}
                labelFormatter={(v) => chartTick(String(v))}
                formatter={valueTip}
              />
              <Bar
                dataKey="income"
                name={ts('Income')}
                fill="#5cd3cb"
                radius={[4, 4, 0, 0]}
                maxBarSize={28}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
export function AnalyticsChart() {
  const [period, setPeriod] = useState<AnalyticsPeriod>('Weekly');
  const [metric, setMetric] = useState(0);
  const labels = ['Company Finance Growth', 'Company Expenses Ratio', 'Business Risk Cases'];
  const id = useId().replaceAll(':', '');
  const rows = analyticsData[period].map((value, i) => ({
    period: monthVisitors[i].period,
    value: metric === 1 ? Math.round(value * 0.6) : metric === 2 ? Math.round(value * 0.35) : value,
  }));
  return (
    <section>
      <div className="mb-3 flex h-9 items-center justify-between">
        <h2 className="text-base font-semibold">{t('Analytics Report')}</h2>
        <Dropdown.Root>
          <Dropdown.Trigger asChild>
            <Button variant="ghost" size="icon" aria-label={ts('Analytics Report actions')}>
              <Ellipsis className="size-4" />
            </Button>
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              className="z-50 min-w-36 rounded-md border border-border bg-surface p-1 text-sm text-ink shadow-lg"
              align="end"
            >
              <Dropdown.RadioGroup
                value={period}
                onValueChange={(v) => setPeriod(v as AnalyticsPeriod)}
              >
                {analyticsPeriods.map((p) => (
                  <Dropdown.RadioItem
                    key={p}
                    value={p}
                    className="cursor-pointer rounded px-3 py-2 outline-none data-[highlighted]:bg-subtle data-[state=checked]:text-primary"
                  >
                    {t(p)}
                  </Dropdown.RadioItem>
                ))}
              </Dropdown.RadioGroup>
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
      <Card>
        <div className="p-5">
          {labels.map((label, i) => (
            <button
              key={label}
              className={
                'flex w-full items-center justify-between gap-3 rounded px-1 py-3 text-start text-sm hover:bg-subtle ' +
                (metric === i ? 'text-ink' : 'text-muted')
              }
              aria-pressed={metric === i}
              onClick={() => setMetric(i)}
            >
              <span>{t(label)}</span>
              <strong className={i === 0 ? 'text-success' : i === 1 ? 'text-warning' : 'text-ink'}>
                {t(analyticsValues[period][i])}
              </strong>
            </button>
          ))}
        </div>
        <div
          role="img"
          aria-label={ts(labels[metric]) + ' — ' + ts(period)}
          className="h-[235px] px-4 pb-4"
        >
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} margin={{ top: 8, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id={'analytics-' + id} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor="#faad14" stopOpacity={0.35} />
                  <stop offset="1" stopColor="#faad14" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={chartTick}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(v) => chartTick(String(v))}
                formatter={valueTip}
              />
              <Area
                dataKey="value"
                name={ts(labels[metric])}
                type="monotone"
                stroke="#faad14"
                strokeWidth={2}
                fill={'url(#analytics-' + id + ')'}
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
export function SalesChart() {
  const [period, setPeriod] = useState<SalesPeriod>('Today');
  const [visible, setVisible] = useState({ income: true, cost: true });
  return (
    <section>
      <div className="mb-3 flex h-9 items-center justify-between">
        <h2 className="text-base font-semibold">{t('Sales Report')}</h2>
        <Select
          aria-label={ts('Sales Report period')}
          value={period}
          onChange={(e) => setPeriod(e.target.value as SalesPeriod)}
        >
          {salesPeriods.map((p) => (
            <option key={p} value={p}>
              {t(p)}
            </option>
          ))}
        </Select>
      </div>
      <Card className="p-5">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted">{t('Net Profit')}</p>
            <p className="mt-3 text-xl font-semibold">{t('$' + salesProfit[period])}</p>
          </div>
          <div className="flex gap-3">
            {(['income', 'cost'] as const).map((key) => (
              <button
                key={key}
                className={'flex items-center gap-2 text-xs ' + (!visible[key] ? 'opacity-40' : '')}
                aria-pressed={visible[key]}
                onClick={() => setVisible((v) => ({ ...v, [key]: !v[key] }))}
              >
                <i
                  className="size-2 rounded-full"
                  style={{ background: key === 'income' ? '#faad14' : '#408cff' }}
                />
                {t(key === 'income' ? 'Income' : 'Cost of Sales')}
              </button>
            ))}
          </div>
        </div>
        <div role="img" aria-label={ts('Sales Report') + ' — ' + ts(period)} className="h-[330px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={salesData[period]} margin={{ left: -20, right: 5, top: 5, bottom: 0 }}>
              <CartesianGrid stroke={grid} strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="period"
                tickFormatter={chartTick}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <YAxis
                tickFormatter={chartTick}
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: 'var(--color-muted)' }}
              />
              <Tooltip
                contentStyle={tipStyle}
                labelFormatter={(v) => chartTick(String(v))}
                formatter={valueTip}
              />
              <Bar
                dataKey="income"
                name={ts('Income')}
                hide={!visible.income}
                fill="#faad14"
                radius={[3, 3, 0, 0]}
                maxBarSize={12}
                isAnimationActive={false}
              />
              <Bar
                dataKey="cost"
                name={ts('Cost of Sales')}
                hide={!visible.cost}
                fill="#408cff"
                radius={[3, 3, 0, 0]}
                maxBarSize={12}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <table className="sr-only" aria-label={ts('Sales chart data')}>
          <thead>
            <tr>
              <th>{t('Period')}</th>
              <th>{t('Income')}</th>
              <th>{t('Cost of Sales')}</th>
            </tr>
          </thead>
          <tbody>
            {salesData[period].map((r) => (
              <tr key={r.period}>
                <td>{t(r.period)}</td>
                <td>{t(r.income)}</td>
                <td>{t(r.cost)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </section>
  );
}
