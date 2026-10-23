import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatisticsPage } from './StatisticsPage';
import { getStats } from '../api/client';
import { useStatisticsStore } from '../store/useStatisticsStore';
import { useTenantStore } from '../store/useTenantStore';
import i18n from '../i18n';
vi.mock('../api/client', () => ({ getStats: vi.fn() }));
const stats = [
  { id: 'users', label: 'Total Users', value: '78,250', change: 70.5, color: 'blue' },
  { id: 'orders', label: 'Total Order', value: '18,800', change: -27.4, color: 'red' },
  { id: 'sales', label: 'Total Sales', value: '$35,078', change: 27.4, color: 'amber' },
];
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(getStats).mockResolvedValue(stats);
  useStatisticsStore.setState({ members: {} });
  useTenantStore.setState({ selectedTenantId: 'acme' });
});
afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  await i18n.changeLanguage('en');
});
async function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <StatisticsPage />
    </QueryClientProvider>,
  );
  await screen.findByText('78,250');
  return view;
}
describe('Statistics widgets', () => {
  it('renders every reference widget group and the learning illustration', async () => {
    await setup();
    for (const name of [
      'Activity statistics',
      'Revenue statistics',
      'Social statistics',
      'Audience statistics',
      'Summary statistics',
      'Daily statistics',
    ])
      expect(screen.getByRole('region', { name })).toBeInTheDocument();
    for (const text of [
      'All Earnings',
      'Task',
      'Page Views',
      'Downloads',
      'Revenue',
      'Orders Received',
      'Facebook Users',
      'Twitter Users',
      'Linked In Users',
      'Youtube Videos',
      'Impressions',
      'Goal',
      'Impact',
      'Daily user',
      'Daily page view',
      'Last month visitor',
      'Income Salaries & Budget',
    ])
      expect(screen.getByText(text)).toBeInTheDocument();
    expect(document.querySelector('img[src="/statistics/reader.svg"]')).toBeInTheDocument();
    expect(screen.queryByText('Recent Activity')).not.toBeInTheDocument();
  });
  it('uses existing API statistics without changing the other widget values', async () => {
    vi.mocked(getStats).mockResolvedValue([{ ...stats[0], value: '99,123' }, stats[1], stats[2]]);
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StatisticsPage />
      </QueryClientProvider>,
    );
    await screen.findByText('99,123');
    expect(screen.getByText('$30200')).toBeInTheDocument();
    expect(screen.getByText('1641')).toBeInTheDocument();
  });
  it('exposes accurate learning and project progress values', async () => {
    await setup();
    for (const [label, value] of [
      ['Learning completion', 35],
      ['Published Project', 30],
      ['Completed Task', 90],
      ['Pending Task', 50],
      ['Issues', 55],
    ] as const)
      expect(screen.getByRole('progressbar', { name: label })).toHaveAttribute(
        'aria-valuenow',
        String(value),
      );
  });
  it('cancels a team edit without changing saved members', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Manage learning team' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cindy Baker' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useStatisticsStore.getState().members.acme).toBeUndefined();
    expect(
      within(screen.getByLabelText('Learning team')).getByAltText('Cindy Baker'),
    ).toBeInTheDocument();
  });
  it('saves team changes and restores them on remount', async () => {
    const view = await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Manage learning team' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Cindy Baker' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Emily Taylor' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(useStatisticsStore.getState().members.acme).toEqual([
      'travis',
      'remy',
      'agnes',
      'ian',
      'emily',
    ]);
    view.unmount();
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Manage learning team' }));
    expect(screen.getByRole('checkbox', { name: 'Emily Taylor' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Cindy Baker' })).not.toBeChecked();
  });
  it('keeps saved teams separate when changing tenants', async () => {
    await setup();
    useStatisticsStore.getState().saveMembers('acme', []);
    await waitFor(() => expect(screen.getByText('No team members')).toBeInTheDocument());
    act(() => useTenantStore.getState().selectTenant('globex'));
    expect(screen.queryByText('No team members')).not.toBeInTheDocument();
    expect(
      within(screen.getByLabelText('Learning team')).getByAltText('Cindy Baker'),
    ).toBeInTheDocument();
  });
  it('handles a statistics API failure and retries', async () => {
    vi.mocked(getStats).mockRejectedValue(new Error('offline'));
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StatisticsPage />
      </QueryClientProvider>,
    );
    await screen.findByText('Unable to load dashboard statistics.', {}, { timeout: 4000 });
    expect(screen.getByText('$30200')).toBeInTheDocument();
    vi.mocked(getStats).mockResolvedValue(stats);
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText('78,250');
  });
  it('translates widgets and interactive controls to Bangla', async () => {
    await i18n.changeLanguage('bn');
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <StatisticsPage />
      </QueryClientProvider>,
    );
    expect(screen.getByText('মোট আয়')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'শেখার দল পরিচালনা করুন' })).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: 'শেখার কাজ সম্পন্ন' })).toHaveAttribute(
      'aria-valuenow',
      '35',
    );
  });
});
