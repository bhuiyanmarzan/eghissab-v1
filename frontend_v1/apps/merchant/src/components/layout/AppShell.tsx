import { QuickChatMenu } from './QuickChatMenu';
import { LanguageSelector } from './LanguageSelector';
import { useTranslation } from 'react-i18next';
import { translateNode, translateString } from '../../lib/localization';
import { useEffect } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Moon, PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, Sun } from 'lucide-react';
import { reactTableTitles, type ReactTableFeature } from '../../lib/reactTable';
import { cn, titleFromPath } from '../../lib/utils';
import { useAppStore } from '../../store/useAppStore';
import { Button } from '../ui/primitives';
import { Logo } from './Logo';
import { ProfileMenu } from './ProfileMenu';
import { GlobalSearch } from './GlobalSearch';
import { TenantSelector } from './TenantSelector';
import { useTenantStore } from '../../store/useTenantStore';
import { NotificationMenu } from './NotificationMenu';
import { ThemeCustomization } from './ThemeCustomization';
import { SharedNavigation } from './SharedNavigation';
import { useResolvedTheme } from '../../store/useResolvedTheme';

export function AppShell() {
  useTranslation();
  const location = useLocation();
  const { sidebarOpen, setSidebarOpen, layout, direction, colorScheme, toggleTheme } = useAppStore();
  const selectedTenantId = useTenantStore(state => state.selectedTenantId);
  const DrawerIcon = direction === 'rtl' ? (sidebarOpen ? PanelRightClose : PanelRightOpen) : (sidebarOpen ? PanelLeftClose : PanelLeftOpen);
  const theme = useResolvedTheme();
  useEffect(() => { if (window.innerWidth < 1024) setSidebarOpen(false); }, [location.pathname, setSidebarOpen]);
  useEffect(() => {
    const breakpoint = window.matchMedia('(min-width: 1024px)');
    const resize = () => { if (!breakpoint.matches) setSidebarOpen(false); };
    breakpoint.addEventListener('change', resize);
    return () => breakpoint.removeEventListener('change', resize);
  }, [setSidebarOpen]);
  const statistics = location.pathname === '/widget/statistics';
  const defaultDashboard = location.pathname === '/dashboard/default';
  const customerList = location.pathname === '/apps/customer/customer-list';
  const reactTable = location.pathname.startsWith('/tables/react-table/');
  const reactTableTitle = reactTableTitles[location.pathname.split('/').at(-1) as ReactTableFeature];
  const invoiceList = location.pathname === '/apps/invoice/list';
  const invoiceEdit = location.pathname.startsWith('/apps/invoice/edit/');
  const invoiceDetails = location.pathname.startsWith('/apps/invoice/details/');
  const invoiceRecord = invoiceList || invoiceEdit || invoiceDetails;
  const invoiceRecordTitle = invoiceList ? 'Invoice List' : invoiceEdit ? 'Edit Invoice' : 'Invoice Details';
  const invoiceCreate = location.pathname === '/apps/invoice/create';
  const invoiceDashboard = location.pathname === '/apps/invoice/dashboard';
  const crumbs = location.pathname.split('/').filter(Boolean);

  return <div data-color-scheme={colorScheme} data-tenant={selectedTenantId} className={cn("app-shell min-h-screen bg-canvas text-ink", `layout-${layout}`, sidebarOpen && "sidebar-expanded")}>
    <header className="app-header fixed inset-x-0 top-0 z-40 flex h-16 items-center border-b border-border bg-surface px-4 lg:px-6">
      <div className="app-header-logo"><Logo compact={layout !== "horizontal" && !sidebarOpen} /></div>
      <Button variant="ghost" size="icon" className="app-navigation-toggle" aria-label={translateString("Toggle navigation")} aria-controls="application-navigation" aria-expanded={sidebarOpen} title={translateString(sidebarOpen ? "Collapse navigation" : "Expand navigation")} onClick={() => setSidebarOpen(!sidebarOpen)}><DrawerIcon className="size-5" /></Button>
      <TenantSelector />
      <GlobalSearch />
      <div className="ms-auto flex items-center gap-1">
        <LanguageSelector />
        <NotificationMenu />
        <QuickChatMenu />
        <Button variant="ghost" size="icon" className="max-[400px]:hidden" onClick={toggleTheme} title={translateString("Toggle theme")}>{theme === 'light' ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}</Button>
        <ThemeCustomization />
        <ProfileMenu />
      </div>
    </header>
    <SharedNavigation />
    <main className="app-main">
      <div className="app-content">
        <div className="mb-6">
          {!defaultDashboard && <div className="mb-2 flex items-center gap-2 text-xs text-muted"><Link to="/dashboard/analytics">{translateNode("Home")}</Link>{statistics ? <><span>/</span><span className="font-semibold text-ink">{translateNode('Statistics')}</span></> : customerList ? <><span>/</span><span>{translateNode('Customer')}</span><span>/</span><span className="font-semibold text-ink">{translateNode('List')}</span></> : reactTable ? <><span>/</span><Link to="/tables/react-table/basic">{translateNode('React Table')}</Link><span>/</span><span className="font-semibold text-ink">{translateNode(reactTableTitle)}</span></> : invoiceRecord ? <><span>/</span><Link to="/apps/invoice/dashboard">{translateNode('Invoice')}</Link><span>/</span><span className="font-semibold text-ink">{translateNode(invoiceList ? 'List' : invoiceRecordTitle)}</span></> : invoiceCreate ? <><span>/</span><Link to="/apps/invoice/dashboard">{translateNode('Invoice')}</Link><span>/</span><span className="font-semibold text-ink">{translateNode('Create Invoice')}</span></> : invoiceDashboard ? <span>{translateNode('/ Invoice Summary')}</span> : crumbs.slice(0, -1).map((crumb) => <span key={crumb}>{translateNode("/ ")}{translateNode(titleFromPath(crumb))}</span>)}</div>}
          <h1 className={cn("font-semibold", defaultDashboard ? "text-base" : (invoiceCreate || invoiceRecord || reactTable || customerList || statistics) ? "text-3xl" : "text-2xl")}>{translateNode(defaultDashboard ? 'Dashboard' : customerList ? 'List' : reactTable ? reactTableTitle : invoiceRecord ? invoiceRecordTitle : invoiceCreate ? 'New Invoice' : invoiceDashboard ? 'My Dashboard' : titleFromPath(location.pathname))}</h1>
        </div>
        <Outlet />
      </div>
    </main>
  </div>;
}
