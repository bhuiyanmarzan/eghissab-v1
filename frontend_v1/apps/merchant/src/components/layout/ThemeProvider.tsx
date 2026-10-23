import { useTranslation } from 'react-i18next';
import { useLayoutEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { colorSchemes } from '../../lib/theme';
import { useResolvedTheme } from '../../store/useResolvedTheme';

export function ThemeProvider() {
  useTranslation();
  const { direction, colorScheme, fontFamily, layout, layoutWidth } = useAppStore();
  const mode = useResolvedTheme();
  useLayoutEffect(() => {
    const root = document.documentElement;
    const scheme = colorSchemes[colorScheme] ?? colorSchemes[0];
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    root.dir = direction;
    root.style.setProperty('--color-primary', scheme.primary);
    root.style.setProperty('--color-primary-strong', scheme.strong);
    root.style.setProperty('--app-font', `"${fontFamily}", "Noto Sans Bengali", ui-sans-serif, system-ui, sans-serif`);
    root.dataset.layout = layout;
    root.dataset.width = layoutWidth;
  }, [mode, direction, colorScheme, fontFamily, layout, layoutWidth]);
  return null;
}
