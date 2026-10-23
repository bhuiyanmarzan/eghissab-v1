import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const tenants = [
  { id: 'acme', name: 'Acme Corp', plan: 'Free', symbol: 'briefcase' },
  { id: 'globex', name: 'Globex Inc.', plan: 'Pro', symbol: 'sphere' },
  { id: 'stellar', name: 'Stellar Labs', plan: null, symbol: 'atom' },
] as const;
export type Tenant = typeof tenants[number];
export type TenantId = Tenant['id'];
export const useTenantStore = create<{ selectedTenantId: TenantId; selectTenant: (id: string) => void }>()(persist((set) => ({
  selectedTenantId: 'acme',
  selectTenant: id => {
    const tenant = tenants.find(item => item.id === id);
    if (tenant) set({ selectedTenantId: tenant.id });
  },
}), { name: 'mantis-tenant' }));
