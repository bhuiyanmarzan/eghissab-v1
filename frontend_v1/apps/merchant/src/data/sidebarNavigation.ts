import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  Blocks,
  CalendarDays,
  ChartPie,
  Chrome,
  CircleHelp,
  CloudUpload,
  Database,
  DollarSign,
  FileCheck,
  FileText,
  Headphones,
  History,
  IdCard,
  Gauge,
  LineChart,
  LogIn,
  MapPin,
  MessageSquare,
  Network,
  PanelsTopLeft,
  Phone,
  Rocket,
  ShoppingCart,
  StepForward,
  Table2,
  UserRound,
} from 'lucide-react';
import { titleFromPath } from '../lib/utils';
export type SidebarNode = {
  id: string;
  label: string;
  icon?: LucideIcon;
  to?: string;
  match?: string[];
  badge?: string;
  children?: SidebarNode[];
};
export type SidebarSection = {
  id: string;
  label?: string;
  divider?: boolean;
  nodes: SidebarNode[];
};
const link = (label: string, to: string, icon?: LucideIcon, match?: string[]): SidebarNode => ({
  id: to.split('/').filter(Boolean).join('-'),
  label,
  to,
  icon,
  match,
});
const branch = (
  id: string,
  label: string,
  icon: LucideIcon | undefined,
  children: SidebarNode[],
): SidebarNode => ({ id, label, icon, children });
const paths = (base: string, values: string[]) =>
  values.map((value) => link(titleFromPath(value), `${base}/${value}`));
export const sidebarSections: SidebarSection[] = [
  {
    id: 'dashboards',
    label: 'Dashboard',
    nodes: [
      branch(
        'dashboard',
        'Dashboard',
        Gauge,
        paths('/dashboard', ['default', 'analytics', 'invoice']),
      ),
      { ...link('Components', '/components-overview', Network), badge: 'new' },
    ],
  },
  {
    id: 'widgets',
    label: 'Widgets',
    nodes: [
      link('Statistics', '/widget/statistics', IdCard),
      link('Data', '/widget/data', Database),
      link('Chart', '/widget/chart', LineChart),
    ],
  },
  {
    id: 'ai',
    label: 'AI',
    nodes: [
      { ...link('AI', '/ai', FileText), badge: 'new' },
      { ...link('Prompts Overview', '/prompts-overview', FileText), badge: 'AI' },
    ],
  },
  {
    id: 'applications',
    label: 'Applications',
    nodes: [
      link('Chat', '/apps/chat', MessageSquare),
      link('Calendar', '/apps/calendar', CalendarDays),
      link('Kanban', '/apps/kanban/board', Blocks, ['/apps/kanban']),
      branch('customer', 'Customer', Headphones, [
        link('List', '/apps/customer/customer-list'),
        link('Cards', '/apps/customer/customer-card'),
      ]),
      branch('invoice', 'Invoice', FileText, [
        link('Dashboard', '/apps/invoice/dashboard'),
        link('List', '/apps/invoice/list'),
        link('Create', '/apps/invoice/create'),
        link('Details', '/apps/invoice/details/1', undefined, ['/apps/invoice/details']),
        link('Edit', '/apps/invoice/edit/1', undefined, ['/apps/invoice/edit']),
      ]),
      branch('profile', 'Profile', UserRound, [
        branch(
          'account-profile',
          'Account Profile',
          undefined,
          paths('/apps/profiles/account', [
            'basic',
            'personal',
            'my-account',
            'password',
            'role',
            'settings',
          ]),
        ),
        branch(
          'user-profile',
          'User Profile',
          undefined,
          paths('/apps/profiles/user', ['personal', 'payment', 'password', 'settings']),
        ),
      ]),
      branch('e-commerce', 'E-commerce', ShoppingCart, [
        link('Products', '/apps/e-commerce/products'),
        link('Product List', '/apps/e-commerce/product-list'),
        link('Product Details', '/apps/e-commerce/product-details/1', undefined, [
          '/apps/e-commerce/product-details',
        ]),
        link('Add Product', '/apps/e-commerce/add-product'),
        link('Checkout', '/apps/e-commerce/checkout'),
      ]),
    ],
  },
  {
    id: 'forms-tables',
    label: 'Forms & Tables',
    nodes: [
      link('Forms Validation', '/forms/validation', FileCheck),
      link('Forms Wizard', '/forms/wizard', StepForward),
      branch(
        'form-layout',
        'Layout',
        PanelsTopLeft,
        paths('/forms/layout', ['basic', 'multi-column', 'action-bar', 'sticky-bar']),
      ),
      branch(
        'plugins',
        'Plugins',
        CloudUpload,
        paths('/forms/plugins', ['mask', 'clipboard', 're-captcha', 'editor', 'dropzone']),
      ),
      branch(
        'react-table',
        'React Table',
        Table2,
        paths('/tables/react-table', [
          'basic',
          'dense',
          'sorting',
          'filtering',
          'grouping',
          'pagination',
          'row-selection',
          'expanding',
          'editable',
          'drag-drop',
          'column-visibility',
          'column-resizing',
          'sticky-table',
          'umbrella',
          'empty',
          'virtualized',
        ]),
      ),
      branch(
        'mui-table',
        'MUI Table',
        Table2,
        paths('/tables/mui-table', [
          'basic',
          'dense',
          'enhanced',
          'datatable',
          'custom',
          'fixed-header',
          'collapse',
        ]),
      ),
    ],
  },
  {
    id: 'charts-map',
    label: 'Charts & Map',
    nodes: [
      branch('charts', 'Charts', ChartPie, [
        link('Apex Charts', '/charts/apexchart'),
        link('Organization Chart', '/charts/org-chart'),
      ]),
      link('Map', '/map', MapPin),
    ],
  },
  { id: 'sample', divider: true, nodes: [link('Sample Page', '/sample-page', Chrome)] },
  {
    id: 'pages',
    label: 'Pages',
    nodes: [
      branch(
        'authentication',
        'Authentication',
        LogIn,
        paths('/auth', [
          'login',
          'register',
          'forgot-password',
          'reset-password',
          'check-mail',
          'code-verification',
        ]),
      ),
      branch(
        'maintenance',
        'Maintenance',
        Rocket,
        paths('/maintenance', ['404', '500', 'under-construction', 'coming-soon', 'join-waitlist']),
      ),
      link('Notifications', '/notifications', Bell),
      link('Change Log', '/change-log', History),
      link('Contact US', '/contact-us', Phone),
      link('FAQs', '/faqs', CircleHelp),
      link('Pricing', '/pricing', DollarSign),
    ],
  },
];
export function matchesRoute(pathname: string, path: string) {
  return pathname === path || pathname.startsWith(`${path}/`);
}
// Prefer the most specific leaf, so parents and similarly named routes cannot steal selection.
export function activeSidebarPath(pathname: string): SidebarNode[] {
  let best: SidebarNode[] = [];
  let specificity = -1;
  const visit = (node: SidebarNode, ancestors: SidebarNode[]) => {
    const path = [...ancestors, node];
    if (node.children) node.children.forEach((child) => visit(child, path));
    else
      for (const prefix of node.match ?? (node.to ? [node.to] : [])) {
        if (matchesRoute(pathname, prefix) && prefix.length > specificity) {
          best = path;
          specificity = prefix.length;
        }
      }
  };
  sidebarSections.forEach((section) => section.nodes.forEach((node) => visit(node, [])));
  return best;
}
export function expandedSidebarPath(pathname: string): Record<number, string> {
  return Object.fromEntries(
    activeSidebarPath(pathname)
      .filter((node) => node.children)
      .map((node, depth) => [depth, node.id]),
  );
}
