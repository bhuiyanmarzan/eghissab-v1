import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ThemeLayout = 'default' | 'horizontal' | 'mini';
export type FontFamily = 'Inter' | 'Roboto' | 'Poppins' | 'Public Sans';
export type ThemeSettings = {
  theme: ThemeMode;
  layout: ThemeLayout;
  direction: 'ltr' | 'rtl';
  colorScheme: number;
  layoutWidth: 'fluid' | 'container';
  fontFamily: FontFamily;
};
export const defaultThemeSettings: ThemeSettings = {
  theme: 'system', layout: 'default', direction: 'ltr', colorScheme: 0,
  layoutWidth: 'container', fontFamily: 'Public Sans',
};

type AppState = ThemeSettings & {
  sidebarOpen: boolean;
  compact: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleCompact: () => void;
  toggleTheme: () => void;
  setThemeSettings: (settings: Partial<ThemeSettings>) => void;
  resetThemeSettings: () => void;
};

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      ...defaultThemeSettings,
      sidebarOpen: true,
      compact: false,
      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
      toggleCompact: () => set((state) => ({ compact: !state.compact })),
      toggleTheme: () => set((state) => {
        const dark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
        return { theme: dark ? 'light' : 'dark' };
      }),
      setThemeSettings: (settings) => set((state) => ({
        ...settings,
        sidebarOpen: settings.layout ? settings.layout !== 'mini' : state.sidebarOpen,
      })),
      resetThemeSettings: () => set({ ...defaultThemeSettings, sidebarOpen: true }),
    }),
    { name: 'mantis-ui' },
  ),
);
