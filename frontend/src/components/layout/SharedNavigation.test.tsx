import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { SharedNavigation } from './SharedNavigation';
import { AppShell } from './AppShell';
import { defaultThemeSettings, useAppStore } from '../../store/useAppStore';
import { activeSidebarPath } from '../../data/sidebarNavigation';
import { allApplicationRoutes } from '../../data/navigation';
import i18n from '../../i18n';
beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  useAppStore.setState({ ...defaultThemeSettings, sidebarOpen: true });
});
afterEach(async () => {
  cleanup();
  vi.unstubAllGlobals();
  await i18n.changeLanguage('en');
});
function Destination() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <h1>{pathname}</h1>
      <button onClick={() => navigate('/apps/profiles/account/personal')}>
        Go to personal profile
      </button>
      <button onClick={() => navigate(-1)}>Go back</button>
    </>
  );
}
function setup(path = '/dashboard/analytics') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <SharedNavigation />
      <Destination />
    </MemoryRouter>,
  );
}
function sidebar() {
  return within(screen.getByRole('complementary', { name: 'Sidebar navigation' }));
}

describe('Shared navigation', () => {
  it('uses reference sections and marks Analytics as the single selected row', () => {
    const { container } = setup();
    const nav = sidebar();
    expect(nav.getByRole('heading', { name: 'Widgets' })).toBeInTheDocument();
    expect(nav.getByRole('heading', { name: 'Forms & Tables' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Statistics' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Analytics' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Analytics' })).toHaveClass('is-current');
    expect(nav.getByRole('button', { name: 'Dashboard' })).toHaveClass('is-ancestor');
    expect(container.querySelectorAll('.app-sidebar a[aria-current="page"]')).toHaveLength(1);
  });
  it('allows the active branch to collapse and opens only one sibling branch at a time', () => {
    setup();
    const nav = sidebar();
    const dashboard = nav.getByRole('button', { name: 'Dashboard' });
    fireEvent.click(dashboard);
    expect(dashboard).toHaveAttribute('aria-expanded', 'false');
    expect(nav.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
    fireEvent.click(dashboard);
    fireEvent.click(nav.getByRole('button', { name: 'Customer' }));
    expect(dashboard).toHaveAttribute('aria-expanded', 'false');
    expect(nav.getByRole('button', { name: 'Customer' })).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(nav.getByRole('link', { name: 'Cards' }));
    expect(
      screen.getByRole('heading', { name: '/apps/customer/customer-card' }),
    ).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'Cards' })).toHaveAttribute('aria-current', 'page');
  });
  it('opens all ancestors for a deep URL and updates the selected leaf on browser navigation', () => {
    setup('/apps/profiles/account/settings');
    const nav = sidebar();
    expect(nav.getByRole('button', { name: 'Profile' })).toHaveAttribute('aria-expanded', 'true');
    expect(nav.getByRole('button', { name: 'Account Profile' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
    fireEvent.click(screen.getByRole('button', { name: 'Go to personal profile' }));
    expect(nav.getByRole('link', { name: 'Personal' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('link', { name: 'Settings' })).not.toHaveAttribute('aria-current');
    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
    expect(nav.getByRole('link', { name: 'Settings' })).toHaveAttribute('aria-current', 'page');
  });
  it('opens mini drawer submenus on hover and closes them after navigation', () => {
    useAppStore.setState({ sidebarOpen: false });
    const { container } = setup();
    fireEvent.mouseEnter(sidebar().getByRole('button', { name: 'Customer' }));
    const popup = within(screen.getByRole('navigation', { name: 'Customer submenu' }));
    fireEvent.click(popup.getByRole('link', { name: 'Cards' }));
    expect(
      screen.getByRole('heading', { name: '/apps/customer/customer-card' }),
    ).toBeInTheDocument();
    expect(container.querySelector('.nav-flyout')).not.toBeInTheDocument();
    expect(sidebar().getByRole('button', { name: 'Customer' })).toHaveClass('is-ancestor');
  });
  it('supports keyboard entry and Escape focus restoration in the icon rail', async () => {
    useAppStore.setState({ sidebarOpen: false });
    setup();
    const button = sidebar().getByRole('button', { name: 'Customer' });
    fireEvent.keyDown(button, { key: 'ArrowRight' });
    const popup = within(screen.getByRole('navigation', { name: 'Customer submenu' }));
    await waitFor(() => expect(popup.getByRole('link', { name: 'List' })).toHaveFocus());
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('navigation', { name: 'Customer submenu' })).not.toBeInTheDocument();
    expect(button).toHaveFocus();
  });
  it('keeps horizontal dropdowns and deep-route parent styling working', () => {
    useAppStore.setState({ layout: 'horizontal' });
    setup('/apps/profiles/account/personal');
    const nav = within(screen.getByRole('navigation', { name: 'Horizontal navigation' }));
    expect(nav.getByRole('button', { name: 'Applications' })).toHaveClass('text-primary');
    fireEvent.mouseEnter(nav.getByRole('button', { name: 'Applications' }));
    expect(nav.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(nav.queryByRole('link', { name: 'Chat' })).not.toBeInTheDocument();
  });
  it('dismisses mobile navigation after selecting a page and restores hamburger focus', () => {
    vi.stubGlobal('innerWidth', 320);
    render(
      <MemoryRouter initialEntries={['/dashboard/analytics']}>
        <AppShell />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    fireEvent.click(toggle);
    expect(sidebar().getByRole('link', { name: 'Analytics' })).toHaveFocus();
    fireEvent.click(sidebar().getByRole('link', { name: 'Default' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveFocus();
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  });
  it('translates section headings, menu items, and the fixed profile footer to Bangla', async () => {
    setup();
    await act(async () => {
      await i18n.changeLanguage('bn');
    });
    const nav = within(screen.getByRole('complementary', { name: 'পার্শ্ব নেভিগেশন' }));
    expect(nav.getByRole('link', { name: 'বিশ্লেষণ' })).toHaveAttribute('aria-current', 'page');
    expect(nav.getByRole('heading', { name: 'ফর্ম ও টেবিল' })).toBeInTheDocument();
    expect(nav.getByRole('link', { name: 'অ্যাকাউন্ট প্রোফাইল খুলুন' })).toHaveTextContent(
      'John Doe',
    );
  });
  it('covers the full route catalog and avoids partial-name URL matches', () => {
    for (const route of allApplicationRoutes.filter((route) => route !== '/'))
      expect(activeSidebarPath(route).length, route).toBeGreaterThan(0);
    expect(activeSidebarPath('/dashboard/analytics-copy')).toEqual([]);
    expect(activeSidebarPath('/apps/customer/customer-listing')).toEqual([]);
    expect(activeSidebarPath('/apps/invoice/details/42').at(-1)?.label).toBe('Details');
    expect(activeSidebarPath('/components-overview/buttons').at(-1)?.label).toBe('Components');
  });
});
