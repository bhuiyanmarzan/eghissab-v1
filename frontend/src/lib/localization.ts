import type { ReactNode } from 'react';
import i18n from '../i18n';
import bn from '../locales/bn.json';
const canonical = new Map(Object.keys(bn).map((key) => [key.toLowerCase(), key]));
export function isBangla() {
  return i18n.resolvedLanguage === 'bn';
}
export function localizeNumber(value: number) {
  return new Intl.NumberFormat(isBangla() ? 'bn-BD' : 'en-US').format(value);
}
export function translateString(value: string): string;
export function translateString(value: string | undefined): string | undefined;
export function translateString(value: string | undefined): string | undefined {
  if (value === undefined || !isBangla()) return value;
  const trimmed = value.trim();
  const key =
    canonical.get(trimmed.toLowerCase()) ?? canonical.get(trimmed.replace(/-/g, ' ').toLowerCase());
  if (key) return value.replace(trimmed, String(i18n.t(key)));
  const interpolate = (key: string, options: Record<string, string>) =>
    String(i18n.t(key, options));
  let match: RegExpMatchArray | null;
  if ((match = trimmed.match(/^Search (\d+) records\.\.\.$/)))
    return interpolate('Search {{count}} records...', { count: localizeNumber(Number(match[1])) });
  if ((match = trimmed.match(/^Global search \((.+)\)$/)))
    return interpolate('Global search ({{shortcut}})', { shortcut: match[1] });
  if ((match = trimmed.match(/^(\d+) unread notifications$/)))
    return interpolate('{{count}} unread notifications', {
      count: localizeNumber(Number(match[1])),
    });
  if ((match = trimmed.match(/^(All|Unread|Mentions) notifications$/)))
    return interpolate('{{filter}} notifications', { filter: translateString(match[1]) });
  if ((match = trimmed.match(/^Select tenant: (.+)$/)))
    return interpolate('Select tenant: {{name}}', { name: match[1] });
  if ((match = trimmed.match(/^(\d+)\s*(min|m|h|hour|hours|d|day|days) ago$/))) {
    const unit = ['min', 'm'].includes(match[2])
      ? 'min'
      : ['h', 'hour', 'hours'].includes(match[2])
        ? 'hour'
        : 'day';
    return interpolate('{{count}} ' + unit + ' ago', { count: localizeNumber(Number(match[1])) });
  }
  if ((match = trimmed.match(/^(.+) - (Basic|Variants)$/)))
    return interpolate('{{title}} - ' + match[2], { title: translateString(match[1]) });
  if ((match = trimmed.match(/^(Invoice|Payment from|Pending from) (#[A-Z\d-]+)$/)))
    return interpolate(match[1] + ' {{id}}', { id: match[2] });
  if (/^[$€£][\d,. ]+\([\d.,% ]+\)$/.test(trimmed))
    return value.replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
  if (/^[\d$€£%,. +−-]+$/.test(trimmed) && /\d/.test(trimmed))
    return value.replace(/[0-9]/g, (digit) => '০১২৩৪৫৬৭৮৯'[Number(digit)]);
  return value;
}
export function translateNode(value: ReactNode): ReactNode {
  if (typeof value === 'string') return translateString(value);
  if (typeof value === 'number') return isBangla() ? localizeNumber(value) : value;
  return value;
}
export function chartTick(value: string | number) {
  return typeof value === 'number' ? localizeNumber(value) : translateString(value);
}
export function formatDate(value: Date, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(isBangla() ? 'bn-BD' : 'en-US', options).format(value);
}
