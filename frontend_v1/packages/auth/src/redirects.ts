export type PortalTarget = 'landing' | 'merchant' | 'consumer' | 'admin';

export function getPortalUrls(): Record<PortalTarget, string> {
  const isDev = import.meta.env.DEV;
  return {
    landing:
      import.meta.env.VITE_LANDING_URL ||
      (isDev ? 'http://localhost:3000' : 'https://example.com'),
    merchant:
      import.meta.env.VITE_MERCHANT_URL ||
      (isDev ? 'http://localhost:3001' : 'https://app.example.com'),
    consumer:
      import.meta.env.VITE_CONSUMER_URL ||
      (isDev ? 'http://localhost:3002' : 'https://me.example.com'),
    admin:
      import.meta.env.VITE_ADMIN_URL ||
      (isDev ? 'http://localhost:3003' : 'https://admin.example.com'),
  };
}

export function redirectToPortal(target: PortalTarget, path = ''): void {
  const urls = getPortalUrls();
  const base = urls[target].replace(/\/+$/, '');
  const cleanPath = path ? (path.startsWith('/') ? path : `/${path}`) : '';
  window.location.href = `${base}${cleanPath}`;
}
