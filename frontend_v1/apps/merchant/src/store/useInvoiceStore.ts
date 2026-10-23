import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { initialInvoiceRecords } from '../data/invoices';
import type { InvoiceAddress, InvoiceValues } from '../lib/invoice';
import type { TenantId } from './useTenantStore';

type InvoiceState = {
  drafts: Partial<Record<TenantId, InvoiceValues>>;
  addresses: Partial<Record<TenantId, InvoiceAddress[]>>;
  records: Partial<Record<TenantId, InvoiceValues[]>>;
  deleted: Partial<Record<TenantId, InvoiceValues[]>>;
  saveDraft: (tenant: TenantId, invoice: InvoiceValues) => void;
  addAddress: (tenant: TenantId, address: InvoiceAddress) => void;
  deleteInvoice: (tenant: TenantId, id: string) => void;
  restoreInvoice: (tenant: TenantId, id: string) => void;
};
export function invoiceRecords(state: Pick<InvoiceState, 'records' | 'drafts'>, tenant: TenantId) {
  if (state.records[tenant]) return state.records[tenant]!;
  const draft = state.drafts[tenant];
  return draft
    ? [...initialInvoiceRecords.filter((invoice) => invoice.id !== draft.id), draft]
    : initialInvoiceRecords;
}
// Browser persistence follows the existing local demo stores; invoices are scoped by tenant.
export const useInvoiceStore = create<InvoiceState>()(
  persist(
    (set) => ({
      drafts: {},
      addresses: {},
      records: {},
      deleted: {},
      saveDraft: (tenant, invoice) =>
        set((state) => ({
          drafts: { ...state.drafts, [tenant]: structuredClone(invoice) },
          records: {
            ...state.records,
            [tenant]: [
              ...invoiceRecords(state, tenant).filter((item) => item.id !== invoice.id),
              structuredClone(invoice),
            ],
          },
          deleted: {
            ...state.deleted,
            [tenant]: (state.deleted[tenant] ?? []).filter((item) => item.id !== invoice.id),
          },
        })),
      addAddress: (tenant, address) =>
        set((state) => ({
          addresses: {
            ...state.addresses,
            [tenant]: [...(state.addresses[tenant] ?? []), { ...address }],
          },
        })),
      deleteInvoice: (tenant, id) =>
        set((state) => {
          const records = invoiceRecords(state, tenant);
          const invoice = records.find((item) => item.id === id);
          if (!invoice) return state;
          const drafts = { ...state.drafts };
          if (drafts[tenant]?.id === id) delete drafts[tenant];
          return {
            drafts,
            records: { ...state.records, [tenant]: records.filter((item) => item.id !== id) },
            deleted: {
              ...state.deleted,
              [tenant]: [
                ...(state.deleted[tenant] ?? []).filter((item) => item.id !== id),
                structuredClone(invoice),
              ],
            },
          };
        }),
      restoreInvoice: (tenant, id) =>
        set((state) => {
          const invoice = state.deleted[tenant]?.find((item) => item.id === id);
          if (!invoice) return state;
          return {
            records: {
              ...state.records,
              [tenant]: [
                ...invoiceRecords(state, tenant).filter((item) => item.id !== id),
                structuredClone(invoice),
              ],
            },
            deleted: {
              ...state.deleted,
              [tenant]: (state.deleted[tenant] ?? []).filter((item) => item.id !== id),
            },
          };
        }),
    }),
    { name: 'mantis-invoice-drafts', version: 1 },
  ),
);
