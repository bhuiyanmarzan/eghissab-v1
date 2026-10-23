import { useTranslation } from 'react-i18next';
import { translateString } from './lib/localization';
import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { PublicRoute } from './components/layout/PublicRoute';
import { NotificationsPage } from './pages/NotificationsPage';
import { ThemeProvider } from './components/layout/ThemeProvider';
import { allApplicationRoutes } from './data/navigation';
import { AiPage, ChartsPage, ContactPage, FaqPage, GenericPage } from './pages/MiscPage';
import { AuthPage, MaintenancePage, PricingPage } from './pages/PublicPages';
import { CalendarPage, ChatPage, CustomerPage, InvoicePage, KanbanPage, ProductsPage, ProfilePage } from './pages/AppsPage';
import { InvoiceListPage } from './pages/InvoiceListPage';
import { InvoiceRecordPage } from './pages/InvoiceRecordPage';
import { InvoiceCreatePage } from './pages/InvoiceCreatePage';
import { InvoiceDashboardPage } from './pages/InvoiceDashboardPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { DefaultDashboardPage } from './pages/DefaultDashboardPage';
import { DashboardPage } from './pages/DashboardPage';
import { PasswordForm, FormPage } from './pages/FormPage';
import { ComponentPage, ComponentsOverview } from './pages/ComponentPage';
import { ReactTablePage } from './pages/ReactTablePage';
import { reactTableFeatures, type ReactTableFeature } from './lib/reactTable';
import { CustomerListPage } from './pages/CustomerListPage';
import { TablePage } from './pages/TablePage';
import { titleFromPath } from './lib/utils';
import { useAuthStore } from './store/useAuthStore';
import { refreshSession, getCurrentUser } from './api/auth';

function RouteResolver() {
  useTranslation();
  const { pathname, search } = useLocation();
  if (pathname === '/dashboard/default') return <DefaultDashboardPage />;
  if (pathname.startsWith('/dashboard/')) return <DashboardPage />;
  if (pathname === '/widget/statistics') return <StatisticsPage />;
  if (pathname === '/notifications') return <NotificationsPage />;
  if (pathname === '/apps/chat') return <ChatPage />;
  if (pathname === '/apps/calendar') return <CalendarPage />;
  if (pathname.startsWith('/apps/kanban/')) return <KanbanPage />;
  if (pathname === '/apps/customer/customer-list') return <CustomerListPage />;
  if (pathname.startsWith('/apps/customer/')) return <CustomerPage />;
  if (pathname === '/apps/invoice/create') return <InvoiceCreatePage fresh={new URLSearchParams(search).has('new')} />;
  if (pathname === '/apps/invoice/list') return <InvoiceListPage />;
  if (pathname === '/apps/invoice/dashboard') return <InvoiceDashboardPage />;
  if (pathname.startsWith('/apps/invoice/')) return pathname.endsWith('/list') ? <TablePage /> : <InvoicePage />;
  if (pathname.startsWith('/apps/profiles/')) return pathname.endsWith('/password') ? <PasswordForm /> : <ProfilePage />;
  if (pathname.startsWith('/apps/e-commerce/')) return pathname.includes('product') ? <ProductsPage /> : <GenericPage title={translateString("Checkout")} category="E-commerce" />;
  if (pathname.startsWith('/tables/react-table/')) { const feature = pathname.split('/').at(-1) as ReactTableFeature; if (reactTableFeatures.includes(feature)) return <ReactTablePage feature={feature}/>; }
  if (pathname.startsWith('/tables/')) return <TablePage />;
  if (pathname.startsWith('/forms/')) return <FormPage kind={pathname.split('/').at(-1)} />;
  if (pathname.startsWith('/charts/')) return <ChartsPage />;
  if (pathname === '/pricing') return <PricingPage />;
  if (pathname === '/faqs') return <FaqPage />;
  if (pathname === '/contact-us') return <ContactPage />;
  if (pathname === '/ai') return <AiPage />;
  if (pathname === '/components-overview') return <ComponentsOverview />;
  if (pathname.startsWith('/components-overview/')) return <ComponentPage type={pathname.split('/').at(-1) ?? 'buttons'} />;
  return <GenericPage title={translateString(titleFromPath(pathname))} category={pathname.split('/').filter(Boolean)[0] ?? 'Dashboard'} />;
}

function AppRoutes() {
  useTranslation();
  const authModes = ['login', 'register', 'forgot-password', 'reset-password', 'check-mail', 'code-verification'];
  const maintenance = ['404', '500', 'under-construction', 'coming-soon', 'join-waitlist'];
  const privateRoutes = allApplicationRoutes.filter((route) => route !== '/' && !route.startsWith('/auth/') && !route.startsWith('/maintenance/') && !route.startsWith('/apps/invoice/details/') && !route.startsWith('/apps/invoice/edit/'));

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard/analytics" replace />} />
      {/* Public Guest-Only Routes */}
      <Route element={<PublicRoute />}>
        {authModes.map((mode) => (
          <Route key={mode} path={`/auth/${mode}`} element={<AuthPage mode={mode} />} />
        ))}
      </Route>
      {maintenance.map((type) => (
        <Route key={type} path={`/maintenance/${type}`} element={<MaintenancePage type={type} />} />
      ))}
      
      {/* Protected Private Routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/apps/invoice/details/:invoiceId" element={<InvoiceRecordPage />} />
          <Route path="/apps/invoice/edit/:invoiceId" element={<InvoiceRecordPage editing />} />
          {privateRoutes.map((path) => (
            <Route key={path} path={path} element={<RouteResolver />} />
          ))}
        </Route>
      </Route>

      <Route path="*" element={<MaintenancePage type="404" />} />
    </Routes>
  );
}

export function App() {
  useTranslation();
  const { setAuth, clearAuth, setInitialized } = useAuthStore();

  useEffect(() => {
    let mounted = true;
    const initAuth = async () => {
      try {
        const refreshRes = await refreshSession();
        if (!mounted) return;
        useAuthStore.getState().setAccessToken(refreshRes.access_token);
        const user = await getCurrentUser();
        if (!mounted) return;
        setAuth(user, refreshRes.access_token);
      } catch {
        if (!mounted) return;
        clearAuth();
      } finally {
        if (mounted) {
          setInitialized(true);
        }
      }
    };

    void initAuth();
    return () => {
      mounted = false;
    };
  }, [setAuth, clearAuth, setInitialized]);

  return (
    <>
      <ThemeProvider />
      <AppRoutes />
    </>
  );
}
