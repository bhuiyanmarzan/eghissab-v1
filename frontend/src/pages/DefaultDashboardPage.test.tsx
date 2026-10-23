import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DefaultDashboardPage } from './DefaultDashboardPage';
import { getOrders, getStats, type Order } from '../api/client';
import { downloadOrders } from '../lib/orderExport';
import i18n from '../i18n';
vi.mock('../api/client', () => ({ getOrders: vi.fn(), getStats: vi.fn() }));
vi.mock('../lib/orderExport', () => ({ downloadOrders: vi.fn() }));
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: ReactNode }) => children,
  AreaChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  BarChart: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Area: ({ name, hide }: { name: string; hide: boolean }) => (
    <span data-testid={'series-' + name} data-hidden={Boolean(hide)} />
  ),
  Bar: () => null,
  CartesianGrid: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
}));
const orders: Order[] = [
  { id: '13256498', product: 'Keyboard', quantity: 125, status: 'Rejected', amount: 70999 },
  {
    id: '13286564',
    product: 'Computer Accessories',
    quantity: 100,
    status: 'Approved',
    amount: 83348,
  },
];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getOrders).mockResolvedValue(orders);
  vi.mocked(getStats).mockResolvedValue([
    { id: 'users', label: 'Total Users', value: '78,250', change: 70.5, color: '#1677ff' },
    { id: 'orders', label: 'Total Order', value: '18,800', change: -27.4, color: '#ff7875' },
    { id: 'sales', label: 'Total Sales', value: '$35,078', change: 27.4, color: '#faad14' },
  ]);
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <DefaultDashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByText('78,250');
  await screen.findByRole('table', { name: 'Recent Orders' });
}
async function menu(name: string) {
  fireEvent.keyDown(screen.getByRole('button', { name }), { key: 'Enter' });
  await screen.findByRole('menu');
}
describe('Default dashboard', () => {
  it('renders all four metrics and reference panels using existing order records', async () => {
    await setup();
    for (const title of ['Total Page Views', 'Total Users', 'Total Order', 'Total Sales'])
      expect(screen.getByText(title)).toBeInTheDocument();
    for (const title of [
      'Unique Visitor',
      'Income Overview',
      'Recent Orders',
      'Analytics Report',
      'Sales Report',
      'Transaction History',
      'Help & Support Chat',
    ])
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    expect(screen.queryByText('Welcome to Mantis')).not.toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Recent Orders' })).getAllByRole('row'),
    ).toHaveLength(3);
  });
  it('changes visitor data with Month and Week and toggles both series', async () => {
    await setup();
    expect(
      within(screen.getByRole('table', { name: 'Visitor chart data' })).getAllByRole('row'),
    ).toHaveLength(13);
    fireEvent.click(screen.getByRole('button', { name: 'Week' }));
    expect(screen.getByRole('img', { name: 'Unique Visitor — Week' })).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Visitor chart data' })).getAllByRole('row'),
    ).toHaveLength(8);
    fireEvent.click(screen.getByRole('button', { name: 'Page views' }));
    expect(screen.getByTestId('series-Page views')).toHaveAttribute('data-hidden', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Sessions' }));
    expect(screen.getByTestId('series-Sessions')).toHaveAttribute('data-hidden', 'true');
  });
  it('changes sales periods, profit and chart records', async () => {
    await setup();
    fireEvent.change(screen.getByRole('combobox', { name: 'Sales Report period' }), {
      target: { value: 'This Month' },
    });
    expect(screen.getByRole('img', { name: 'Sales Report — This Month' })).toBeInTheDocument();
    expect(screen.getByText('$8100')).toBeInTheDocument();
    expect(
      within(screen.getByRole('table', { name: 'Sales chart data' })).getAllByRole('row'),
    ).toHaveLength(7);
    fireEvent.change(screen.getByRole('combobox', { name: 'Sales Report period' }), {
      target: { value: 'This Year' },
    });
    expect(screen.getByText('$104000')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cost of Sales' }));
    expect(screen.getByRole('button', { name: 'Cost of Sales' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
  it('updates analytics period and selected metric', async () => {
    await setup();
    await menu('Analytics Report actions');
    fireEvent.click(screen.getByRole('menuitemradio', { name: 'Monthly' }));
    expect(screen.getByText('+38.72%')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Company Expenses Ratio/ }));
    expect(
      screen.getByRole('img', { name: 'Company Expenses Ratio — Monthly' }),
    ).toBeInTheDocument();
  });
  it('selects rows with click and keyboard and exports selected rows', async () => {
    await setup();
    const rows = within(screen.getByRole('table', { name: 'Recent Orders' })).getAllByRole('row');
    fireEvent.click(rows[1]);
    expect(rows[1]).toHaveAttribute('aria-selected', 'true');
    await menu('Recent Orders actions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as CSV' }));
    expect(downloadOrders).toHaveBeenCalledWith([orders[0]], 'csv');
    fireEvent.keyDown(rows[2], { key: ' ' });
    expect(screen.getByText('2 order(s) selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(rows[1]).toHaveAttribute('aria-selected', 'false');
  });
  it('exports all orders as a real workbook when none are selected', async () => {
    await setup();
    await menu('Recent Orders actions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Export as Excel' }));
    expect(downloadOrders).toHaveBeenCalledWith(orders, 'xlsx');
  });
  it('prints only the selected orders through an accessible preview', async () => {
    await setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select order 13256498' }));
    await menu('Recent Orders actions');
    fireEvent.click(screen.getByRole('menuitem', { name: 'Print Table' }));
    const preview = screen.getByRole('dialog');
    expect(within(preview).getByText('Keyboard')).toBeInTheDocument();
    expect(within(preview).queryByText('Computer Accessories')).not.toBeInTheDocument();
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    fireEvent.click(within(preview).getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(within(preview).getByRole('button', { name: 'Close dialog' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens transaction details and links support to the existing chat page', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: /Order #002434/ }));
    expect(within(screen.getByRole('dialog')).getByText('#002434')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(screen.getByRole('link', { name: 'Need Help?' })).toHaveAttribute('href', '/apps/chat');
  });
  it('handles empty orders and disables exports', async () => {
    vi.mocked(getOrders).mockResolvedValue([]);
    await setup();
    expect(screen.getByText('No recent orders')).toBeInTheDocument();
    await menu('Recent Orders actions');
    expect(screen.getByRole('menuitem', { name: 'Export as CSV' })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
  });
  it('shows API failures and supports retry without silently replacing records', async () => {
    vi.mocked(getStats).mockRejectedValue(new Error('offline'));
    vi.mocked(getOrders).mockRejectedValue(new Error('offline'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DefaultDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await screen.findByText('Unable to load dashboard statistics.', {}, { timeout: 4000 });
    await screen.findByText('Unable to load recent orders.');
    expect(screen.getAllByRole('button', { name: 'Retry' })).toHaveLength(2);
    vi.mocked(getStats).mockResolvedValue([
      { id: 'users', label: 'Total Users', value: '100', change: 1, color: 'blue' },
    ]);
    fireEvent.click(screen.getAllByRole('button', { name: 'Retry' })[0]);
    await screen.findByText('100');
  });
  it('translates dashboard controls while preserving order product names', async () => {
    await i18n.changeLanguage('bn');
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <DefaultDashboardPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    await waitFor(() => expect(screen.getByText('Keyboard')).toBeInTheDocument());
    expect(screen.getByText('মোট পৃষ্ঠা দর্শন')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'সপ্তাহ' })).toBeInTheDocument();
  });
});
