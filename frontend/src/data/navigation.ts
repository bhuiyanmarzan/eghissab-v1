import type { LucideIcon } from 'lucide-react';
import { BarChart3, Boxes, CalendarDays, Component, FileText, FormInput, LayoutDashboard, MessageSquare, Package, PanelsTopLeft, Table2, Users } from 'lucide-react';

export type NavItem = { label: string; to: string; icon?: LucideIcon };
export type NavGroup = { label: string; icon: LucideIcon; items: NavItem[] };

export const navigation: NavGroup[] = [
  { label: 'Dashboard', icon: LayoutDashboard, items: [
    { label: 'Default', to: '/dashboard/default' },
    { label: 'Analytics', to: '/dashboard/analytics' },
    { label: 'Invoice', to: '/dashboard/invoice' },
  ] },
  { label: 'Widgets', icon: Boxes, items: [
    { label: 'Statistics', to: '/widget/statistics' }, { label: 'Data', to: '/widget/data' }, { label: 'Chart', to: '/widget/chart' },
  ] },
  { label: 'Applications', icon: PanelsTopLeft, items: [
    { label: 'Chat', to: '/apps/chat', icon: MessageSquare }, { label: 'Calendar', to: '/apps/calendar', icon: CalendarDays },
    { label: 'Kanban', to: '/apps/kanban/board' }, { label: 'Customers', to: '/apps/customer/customer-list', icon: Users },
    { label: 'Invoices', to: '/apps/invoice/list', icon: FileText }, { label: 'Account Profile', to: '/apps/profiles/account/basic' },
    { label: 'User Profile', to: '/apps/profiles/user/personal' }, { label: 'Products', to: '/apps/e-commerce/product-list', icon: Package },
    { label: 'Checkout', to: '/apps/e-commerce/checkout' },
  ] },
  { label: 'Forms', icon: FormInput, items: [
    { label: 'Validation', to: '/forms/validation' }, { label: 'Wizard', to: '/forms/wizard' },
    { label: 'Basic Layout', to: '/forms/layout/basic' }, { label: 'Multi Column', to: '/forms/layout/multi-column' },
    { label: 'Action Bar', to: '/forms/layout/action-bar' }, { label: 'Sticky Bar', to: '/forms/layout/sticky-bar' },
    { label: 'Input Mask', to: '/forms/plugins/mask' }, { label: 'Clipboard', to: '/forms/plugins/clipboard' },
    { label: 'Editor', to: '/forms/plugins/editor' }, { label: 'Dropzone', to: '/forms/plugins/dropzone' },
  ] },
  { label: 'Tables', icon: Table2, items: [
    { label: 'Basic', to: '/tables/react-table/basic' }, { label: 'Dense', to: '/tables/react-table/dense' },
    { label: 'Sorting', to: '/tables/react-table/sorting' }, { label: 'Filtering', to: '/tables/react-table/filtering' },
    { label: 'Grouping', to: '/tables/react-table/grouping' }, { label: 'Pagination', to: '/tables/react-table/pagination' },
    { label: 'Row Selection', to: '/tables/react-table/row-selection' }, { label: 'Editable', to: '/tables/react-table/editable' },
    { label: 'Drag & Drop', to: '/tables/react-table/drag-drop' }, { label: 'Virtualized', to: '/tables/react-table/virtualized' },
    { label: 'MUI Tables', to: '/tables/mui-table/basic' },
  ] },
  { label: 'Charts', icon: BarChart3, items: [
    { label: 'Apex Charts', to: '/charts/apexchart' }, { label: 'Organization', to: '/charts/org-chart' }, { label: 'Map', to: '/map' },
  ] },
  { label: 'Pages', icon: FileText, items: [
    { label: 'Notifications', to: '/notifications' }, { label: 'Pricing', to: '/pricing' }, { label: 'FAQ', to: '/faqs' }, { label: 'Contact', to: '/contact-us' },
    { label: 'AI', to: '/ai' }, { label: 'Change Log', to: '/change-log' }, { label: 'Sample Page', to: '/sample-page' },
  ] },
  { label: 'Components', icon: Component, items: [
    { label: 'Overview', to: '/components-overview' }, { label: 'Buttons', to: '/components-overview/buttons' },
    { label: 'Inputs', to: '/components-overview/textfield' }, { label: 'Data Display', to: '/components-overview/avatars' },
    { label: 'Feedback', to: '/components-overview/alert' }, { label: 'Navigation', to: '/components-overview/tabs' },
  ] },
];

export const allApplicationRoutes = [
  '/', '/dashboard/default', '/dashboard/analytics', '/dashboard/invoice', '/widget/statistics', '/widget/data', '/widget/chart',
  '/apps/chat', '/apps/calendar', '/apps/kanban/backlogs', '/apps/kanban/board', '/apps/customer/customer-list', '/apps/customer/customer-card',
  '/apps/invoice/dashboard', '/apps/invoice/create', '/apps/invoice/details/1', '/apps/invoice/edit/1', '/apps/invoice/list',
  '/apps/profiles/account/basic', '/apps/profiles/account/personal', '/apps/profiles/account/my-account', '/apps/profiles/account/password', '/apps/profiles/account/role', '/apps/profiles/account/settings',
  '/apps/profiles/user/personal', '/apps/profiles/user/payment', '/apps/profiles/user/password', '/apps/profiles/user/settings',
  '/apps/e-commerce/products', '/apps/e-commerce/product-details/1', '/apps/e-commerce/product-list', '/apps/e-commerce/add-product', '/apps/e-commerce/checkout',
  '/forms/validation', '/forms/wizard', '/forms/layout/basic', '/forms/layout/multi-column', '/forms/layout/action-bar', '/forms/layout/sticky-bar',
  '/forms/plugins/mask', '/forms/plugins/clipboard', '/forms/plugins/re-captcha', '/forms/plugins/editor', '/forms/plugins/dropzone',
  ...['basic','dense','sorting','filtering','grouping','pagination','row-selection','expanding','editable','drag-drop','column-visibility','column-resizing','sticky-table','umbrella','empty','virtualized'].map((v) => `/tables/react-table/${v}`),
  ...['basic','dense','enhanced','datatable','custom','fixed-header','collapse'].map((v) => `/tables/mui-table/${v}`),
  '/charts/apexchart', '/charts/org-chart', '/map', '/sample-page', '/pricing',
  '/maintenance/404', '/maintenance/500', '/maintenance/under-construction', '/maintenance/coming-soon', '/maintenance/join-waitlist',
  '/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/check-mail', '/auth/code-verification',
  '/notifications', '/change-log', '/faqs', '/ai', '/contact-us', '/components-overview',
  ...['autocomplete','buttons','checkbox','radio','rating','switch','select','slider','textfield','avatars','badges','chips','lists','tooltip','typography','alert','dialogs','progress','snackbar','breadcrumbs','pagination','speeddial','stepper','tabs','accordion','cards','color','date-time-picker','modal','shadows','timeline','treeview'].map((v) => `/components-overview/${v}`),
  '/prompts-overview', '/prompts-overview/free', '/prompts-overview/pro', '/prompts-overview/category/auth/remove-authentication-free', '/prompts-overview/free/category/auth/remove-authentication-free',
];
