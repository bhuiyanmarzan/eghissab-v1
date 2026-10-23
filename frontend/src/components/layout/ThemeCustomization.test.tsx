import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { useAppStore, defaultThemeSettings } from '../../store/useAppStore';
import { ThemeCustomization } from './ThemeCustomization';
import { ThemeProvider } from './ThemeProvider';
import { colorSchemes } from '../../lib/theme';

let systemDark = false;
const listeners = new Set<() => void>();
beforeEach(() => {
  systemDark = false;
  vi.stubGlobal('matchMedia', () => ({ matches: systemDark, addEventListener: (_: string, cb: () => void) => listeners.add(cb), removeEventListener: (_: string, cb: () => void) => listeners.delete(cb) }));
  useAppStore.setState({ ...defaultThemeSettings, sidebarOpen: true });
});
afterEach(() => { cleanup(); listeners.clear(); vi.unstubAllGlobals(); });
function setup() {
  render(<MemoryRouter><ThemeProvider /><ThemeCustomization /></MemoryRouter>);
  fireEvent.click(screen.getByRole('button', { name: 'Theme Customization' }));
  return within(screen.getByRole('dialog'));
}

describe('Theme customization', () => {
  it('applies all layout, direction, width and font settings and saves them', async () => {
    const panel = setup();
    for (const [label, value] of [['Horizontal', 'horizontal'], ['Mini Drawer', 'mini'], ['Default', 'default']]) {
      fireEvent.click(panel.getByRole('group', { name: 'Theme Layout' }).querySelector(`input[aria-label="${label}"]`)!);
      expect(document.documentElement.dataset.layout).toBe(value);
    }
    fireEvent.click(panel.getByRole('radio', { name: 'RTL' }));
    expect(document.documentElement.dir).toBe('rtl');
    for (const value of ['Fluid', 'Container']) {
      fireEvent.click(panel.getByRole('radio', { name: value }));
      expect(document.documentElement.dataset.width).toBe(value.toLowerCase());
    }
    for (const value of ['Inter', 'Roboto', 'Poppins', 'Public Sans']) {
      fireEvent.click(panel.getByRole('radio', { name: value }));
      expect(document.documentElement.style.getPropertyValue('--app-font')).toContain(`"${value}"`);
    }
    const saved = JSON.parse(localStorage.getItem('mantis-ui')!);
    expect(saved.state.direction).toBe('rtl');
    expect(saved.state.fontFamily).toBe('Public Sans');
    act(() => { useAppStore.setState({ direction: 'ltr' }); });
    localStorage.setItem('mantis-ui', JSON.stringify(saved));
    await act(async () => { await useAppStore.persist.rehydrate(); });
    expect(document.documentElement.dir).toBe('rtl');
  }, 30_000);
  it('applies each primary palette to the document', () => {
    const panel = setup();
    for (const [index, scheme] of colorSchemes.entries()) {
      fireEvent.click(panel.getByRole('group', { name: 'Color Scheme' }).querySelector(`input[value="${index}"]`)!);
      expect(document.documentElement.style.getPropertyValue('--color-primary')).toBe(scheme.primary);
    }
  });
  it('follows system changes only in system mode', () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('radio', { name: 'Dark' }));
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(panel.getByRole('radio', { name: 'Light' }));
    expect(document.documentElement).not.toHaveClass('dark');
    fireEvent.click(panel.getByRole('radio', { name: 'System' }));
    act(() => { systemDark = true; listeners.forEach(cb => cb()); });
    expect(document.documentElement).toHaveClass('dark');
    fireEvent.click(panel.getByRole('radio', { name: 'Light' }));
    act(() => { systemDark = false; listeners.forEach(cb => cb()); systemDark = true; listeners.forEach(cb => cb()); });
    expect(document.documentElement).not.toHaveClass('dark');
  });
  it('resets all customization values and closes on Escape', () => {
    const panel = setup();
    fireEvent.click(panel.getByRole('radio', { name: 'RTL' }));
    fireEvent.click(panel.getByRole('radio', { name: 'Poppins' }));
    fireEvent.click(panel.getByRole('button', { name: 'Reset to defaults' }));
    expect(useAppStore.getState()).toMatchObject(defaultThemeSettings);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
