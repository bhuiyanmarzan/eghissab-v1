import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { createInstance } from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import i18n from '../i18n';
import { translateString, formatDate, localizeNumber } from './localization';
import { LanguageSelector } from '../components/layout/LanguageSelector';
import { AppShell } from '../components/layout/AppShell';
import { AuthPage } from '../pages/PublicPages';
import { FormPage } from '../pages/FormPage';
import { GlobalSearch } from '../components/layout/GlobalSearch';
import { searchPages, searchIndex } from './globalSearch';
import { navigation } from '../data/navigation';
import { useAppStore, defaultThemeSettings } from '../store/useAppStore';

beforeEach(async () => {
  await i18n.changeLanguage('en');
  vi.stubGlobal('matchMedia', () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  useAppStore.setState({ ...defaultThemeSettings, theme: 'light', sidebarOpen: true });
});
afterEach(async () => {
  cleanup();
  await i18n.changeLanguage('en');
  vi.unstubAllGlobals();
});
async function bangla() {
  await act(async () => {
    await i18n.changeLanguage('bn');
  });
}

describe('Bangla localization', () => {
  it('switches the whole header and navigation live and saves the preference', async () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/analytics']}>
        <AppShell />
      </MemoryRouter>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Change language' }), {
      button: 0,
      ctrlKey: false,
      pointerType: 'mouse',
    });
    fireEvent.click(await screen.findByRole('menuitem', { name: 'বাংলা' }));
    await screen.findByRole('heading', { name: 'বিশ্লেষণ' });
    expect(screen.getAllByRole('button', { name: 'ড্যাশবোর্ড' })).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'ভাষা পরিবর্তন করুন' })).toBeInTheDocument();
    expect(localStorage.getItem('i18nextLng')).toBe('bn');
    expect(document.documentElement.lang).toBe('bn');
    expect(
      screen.getByRole('button', { name: 'প্রতিষ্ঠান নির্বাচন করুন: Acme Corp' }),
    ).toBeInTheDocument();
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    expect(screen.getByRole('heading', { name: 'Analytics' })).toBeInTheDocument();
  });
  it('detects saved and browser language and falls back to English', async () => {
    async function detect(language: string, saved?: string) {
      if (saved) localStorage.setItem('i18nextLng', saved);
      else localStorage.removeItem('i18nextLng');
      vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue([language]);
      const instance = createInstance();
      await instance.use(LanguageDetector).init({ ...i18n.options, lng: undefined });
      return instance.resolvedLanguage;
    }
    expect(await detect('en-US', 'bn')).toBe('bn');
    expect(await detect('bn-BD')).toBe('bn');
    expect(await detect('fr-FR')).toBe('en');
    vi.restoreAllMocks();
  });
  it('translates authentication without changing entered data', async () => {
    render(
      <MemoryRouter>
        <AuthPage mode="login" />
      </MemoryRouter>,
    );
    const email = screen.getByDisplayValue('info@codedthemes.com');
    fireEvent.change(email, { target: { value: 'my.name@example.com' } });
    await bangla();
    expect(screen.getByRole('heading', { name: 'লগইন' })).toBeInTheDocument();
    expect(screen.getByText('ইমেইল ঠিকানা')).toBeInTheDocument();
    expect(email).toHaveValue('my.name@example.com');
    expect(screen.getByRole('button', { name: 'ভাষা পরিবর্তন করুন' })).toBeInTheDocument();
  });
  it('translates validation and preserves form values during switching', async () => {
    const { container } = render(<FormPage />);
    fireEvent.change(screen.getByDisplayValue('John'), { target: { value: 'J' } });
    fireEvent.submit(container.querySelector('form')!);
    await screen.findByText('Enter at least 2 characters');
    await bangla();
    expect(screen.getByText('অন্তত ২টি অক্ষর লিখুন')).toBeInTheDocument();
    expect(screen.getByDisplayValue('J')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'পরিবর্তন সংরক্ষণ করুন' })).toBeInTheDocument();
  });
  it('supports Bangla search and keeps English search available', async () => {
    await bangla();
    expect(searchPages('বিজ্ঞপ্তি').some((item) => item.to === '/notifications')).toBe(true);
    expect(searchPages('analytics').some((item) => item.to === '/dashboard/analytics')).toBe(true);
    render(
      <MemoryRouter>
        <GlobalSearch />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'গ্লোবাল অনুসন্ধান খুলুন' }));
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'বিজ্ঞপ্তি' } });
    expect(screen.getByRole('link', { name: /বিজ্ঞপ্তি/ })).toHaveAttribute(
      'href',
      '/notifications',
    );
    await act(async () => {
      await i18n.changeLanguage('en');
    });
    await waitFor(() => expect(screen.queryByRole('link')).not.toBeInTheDocument());
  });
  it('covers every navigation label and page search title', async () => {
    await bangla();
    const allowed = new Set(['AI', 'React Table', 'MUI Table', 'Apexchart']);
    for (const label of [
      ...navigation.flatMap((group) => [group.label, ...group.items.map((item) => item.label)]),
      ...searchIndex.map((item) => item.label),
    ]) {
      if (!allowed.has(label) && !/^\d+$/.test(label))
        expect(translateString(label), label).not.toBe(label);
    }
  });
  it('localizes dynamic counts and dates, preserving names and identifiers', async () => {
    await bangla();
    expect(localizeNumber(12500)).toBe('১২,৫০০');
    expect(translateString('Search 20 records...')).toBe('২০টি রেকর্ড অনুসন্ধান করুন...');
    expect(translateString('12 min ago')).toBe('১২ মিনিট আগে');
    expect(formatDate(new Date(2026, 9, 9), { month: 'long', year: 'numeric' })).toBe(
      'অক্টোবর ২০২৬',
    );
    expect(translateString('John Doe')).toBe('John Doe');
    expect(translateString('INV-1234')).toBe('INV-1234');
  });
  it('shows the language selector without requiring authentication', () => {
    render(<LanguageSelector />);
    expect(screen.getByRole('button', { name: 'Change language' })).toBeInTheDocument();
  });
});
