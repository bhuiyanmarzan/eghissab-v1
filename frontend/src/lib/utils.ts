import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function titleFromPath(pathname: string) {
  const segment = pathname.split('/').filter(Boolean).at(-1) ?? 'analytics';
  return segment
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
    .replace(/^Mui /, 'MUI ');
}
