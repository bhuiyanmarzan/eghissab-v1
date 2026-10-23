import { useSyncExternalStore } from 'react';
import { useAppStore } from './useAppStore';

function subscribe(callback: () => void) {
  if (!window.matchMedia) return () => {};
  const query = window.matchMedia('(prefers-color-scheme: dark)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
}
function getSystemDark() { return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false; }
export function useResolvedTheme() {
  const mode = useAppStore((state) => state.theme);
  const systemDark = useSyncExternalStore(subscribe, getSystemDark, () => false);
  return mode === 'system' ? (systemDark ? 'dark' : 'light') : mode;
}

