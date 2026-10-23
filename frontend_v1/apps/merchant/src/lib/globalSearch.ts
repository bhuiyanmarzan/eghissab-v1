import { translateString } from './localization';
import { BarChart3, Bell, Blocks, CalendarDays, ChartPie, Chrome, CircleHelp, CloudUpload, Component, ContactRound, Copy, Database, DollarSign, FileCheck, FileText, Headphones, Highlighter, History, LayoutDashboard, LineChart, MapPin, MessageCircle, Minus, Network, PanelsTopLeft, Phone, ShoppingCart, Sparkles, SquareCheck, StepForward, Table2, UserRound, type LucideIcon } from 'lucide-react';
import { allApplicationRoutes, navigation } from '../data/navigation';
import { titleFromPath } from './utils';

export type SearchItem = { label: string; to: string; group: string; icon: LucideIcon };
function group(name: string, items: [string, string, LucideIcon][]): SearchItem[] {
  return items.map(([label, to, icon]) => ({ label, to, icon, group: name }));
}
export const searchShortcuts: SearchItem[] = [
  ...group('Dashboards', [['Default', '/dashboard/default', LayoutDashboard], ['Analytics', '/dashboard/analytics', BarChart3], ['Invoice', '/dashboard/invoice', FileText]]),
  ...group('Widgets', [['Statistics', '/widget/statistics', ContactRound], ['Data', '/widget/data', Database], ['Chart', '/widget/chart', LineChart]]),
  ...group('Applications', [['Chat', '/apps/chat', MessageCircle], ['Calendar', '/apps/calendar', CalendarDays], ['Kanban', '/apps/kanban/board', Blocks], ['Customer', '/apps/customer/customer-list', Headphones], ['Invoice', '/apps/invoice/list', FileText], ['Profile', '/apps/profiles/account/basic', UserRound], ['E-commerce', '/apps/e-commerce/product-list', ShoppingCart]]),
  ...group('Forms & Tables', [['Forms Validation', '/forms/validation', FileCheck], ['Forms Wizard', '/forms/wizard', StepForward], ['Layout', '/forms/layout/basic', PanelsTopLeft], ['React Table', '/tables/react-table/basic', Table2], ['MUI Table', '/tables/mui-table/basic', Table2]]),
  ...group('Plugins', [['Mask', '/forms/plugins/mask', Minus], ['Clipboard', '/forms/plugins/clipboard', Copy], ['ReCaptcha', '/forms/plugins/re-captcha', SquareCheck], ['Editor', '/forms/plugins/editor', Highlighter], ['Dropzone', '/forms/plugins/dropzone', CloudUpload]]),
  ...group('Charts & Map', [['Apexchart', '/charts/apexchart', ChartPie], ['Organization Chart', '/charts/org-chart', Network], ['Map', '/map', MapPin]]),
  ...group('Pages', [['Sample Page', '/sample-page', Chrome], ['Change Log', '/change-log', History], ['Contact US', '/contact-us', Phone], ['Faqs', '/faqs', CircleHelp], ['Pricing', '/pricing', DollarSign], ['Notifications', '/notifications', Bell], ['AI', '/ai', Sparkles], ['Components', '/components-overview', Component]]),
];
const byPath = new Map(searchShortcuts.map(item => [item.to, item]));
for (const path of allApplicationRoutes) {
  if (path === '/' || path.startsWith('/auth/') || path.startsWith('/maintenance/') || byPath.has(path)) continue;
  const navGroup = navigation.find(item => item.items.some(link => link.to === path) || path.startsWith(item.items[0]?.to.split('/').slice(0, 2).join('/') + '/'));
  const navItem = navGroup?.items.find(item => item.to === path);
  const readablePath = path.replace(/\/\d+$/, '');
  byPath.set(path, { label: navItem?.label ?? titleFromPath(readablePath), to: path, group: navGroup?.label ?? titleFromPath(path.split('/')[1] ?? 'Pages'), icon: navItem?.icon ?? navGroup?.icon ?? FileText });
}
const aliases = navigation.flatMap(item => item.items);
export const searchIndex = [...byPath.values()];
export function searchPages(query: string) {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return searchShortcuts;
  return searchIndex.filter(item => {
    const searchable = `${item.label} ${translateString(item.label)} ${item.group} ${translateString(item.group)} ${item.to} ${aliases.find(alias => alias.to === item.to)?.label ?? ''}`.toLowerCase().replace(/[-/]/g, ' ');
    return words.every(word => searchable.includes(word));
  });
}
