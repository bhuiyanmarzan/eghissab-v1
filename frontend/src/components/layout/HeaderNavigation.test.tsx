import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from './AppShell';
import { defaultThemeSettings, useAppStore } from '../../store/useAppStore';

beforeEach(() => {
  vi.stubGlobal('innerWidth', 1280);
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  useAppStore.setState({ ...defaultThemeSettings, theme: 'light', sidebarOpen: true });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function setup() { return render(<MemoryRouter initialEntries={['/dashboard/analytics']}><AppShell /></MemoryRouter>); }

describe('Header navigation', () => {
  it('toggles between expanded sidebar and icon rail and saves the choice', async () => {
    const { container } = setup(); const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('.app-shell')).not.toHaveClass('sidebar-expanded');
    const saved = localStorage.getItem('mantis-ui')!;
    act(() => { useAppStore.setState({ sidebarOpen: true }); });
    localStorage.setItem('mantis-ui', saved);
    await act(async () => { await useAppStore.persist.rehydrate(); });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(toggle);
    expect(container.querySelector('.app-shell')).toHaveClass('sidebar-expanded');
  });
  it('opens mobile navigation, focuses it, and closes on Escape', () => {
    vi.stubGlobal('innerWidth', 390); setup();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false'); fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(within(screen.getByRole('complementary', { name: 'Sidebar navigation' })).getByRole('link', { name: 'Analytics' })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false'); expect(toggle).toHaveFocus();
  });
  it('dismisses the mobile overlay and restores hamburger focus', () => {
    vi.stubGlobal('innerWidth', 390); setup();
    const toggle = screen.getByRole('button', { name: 'Toggle navigation' }); fireEvent.click(toggle);
    fireEvent.click(screen.getByRole('button', { name: 'Close navigation' }));
    expect(toggle).toHaveAttribute('aria-expanded', 'false'); expect(toggle).toHaveFocus();
  });
});
