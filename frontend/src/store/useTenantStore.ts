import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Tenant {
  id: string;
  name: string;
  plan: string | null;
  symbol: string;
}

export const tenants: Tenant[] = [
  { id: 'acme', name: 'Acme Corp', plan: 'Free', symbol: 'briefcase' },
  { id: 'globex', name: 'Globex Inc.', plan: 'Pro', symbol: 'sphere' },
  { id: 'stellar', name: 'Stellar Labs', plan: null, symbol: 'atom' },
];

export type TenantId = string;

interface TenantState {
  selectedTenantId: string;
  selectedStoreId: string | null;
  selectTenant: (id: string) => void;
  selectStore: (storeId: string | null) => void;
}

export const useTenantStore = create<TenantState>()(
  persist(
    (set) => ({
      selectedTenantId: 'acme',
      selectedStoreId: null,
      selectTenant: (id: string) => set({ selectedTenantId: id }),
      selectStore: (storeId: string | null) => set({ selectedStoreId: storeId }),
    }),
    { name: 'mantis-tenant' }
  )
);
