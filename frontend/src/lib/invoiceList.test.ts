import { describe, expect, it } from 'vitest';
import { initialInvoiceRecords } from '../data/invoices';
import { invoiceBalance, invoiceCsv, invoiceOverdue } from './invoiceList';
import { invoiceRecords, useInvoiceStore } from '../store/useInvoiceStore';

describe('invoice list data', () => {
  it('keeps currency balances separate and detects unpaid overdue invoices', () => {
    expect(
      invoiceBalance([initialInvoiceRecords[0], { ...initialInvoiceRecords[0], currency: 'GBP' }]),
    ).toEqual([
      ['USD', 2030],
      ['GBP', 2030],
    ]);
    expect(invoiceOverdue(initialInvoiceRecords[0], '2026-10-10')).toBe(true);
    expect(invoiceOverdue(initialInvoiceRecords[1], '2026-10-10')).toBe(false);
  });
  it('exports every filtered row with escaped CSV values', () => {
    const csv = invoiceCsv([
      {
        ...initialInvoiceRecords[0],
        recipient: {
          ...initialInvoiceRecords[0].recipient!,
          name: '=SUM(1,2)',
          email: 'a"b@example.com',
        },
      },
    ]);
    expect(csv).toContain('"\'=SUM(1,2)"');
    expect(csv).toContain('"a""b@example.com"');
    expect(csv).toContain('"2030.00","USD"');
  });
  it('retains an existing saved draft when upgrading to the invoice list', () => {
    expect(
      invoiceRecords(
        { records: {}, drafts: { acme: { ...initialInvoiceRecords[0], id: 'existing-draft' } } },
        'acme',
      ),
    ).toHaveLength(6);
  });
  it('updates records by id, persists deletions and restores the same invoice', () => {
    useInvoiceStore.setState({ drafts: {}, records: {}, deleted: {}, addresses: {} });
    const store = useInvoiceStore.getState();
    store.saveDraft('acme', { ...initialInvoiceRecords[0], notes: 'Updated' });
    expect(useInvoiceStore.getState().records.acme).toHaveLength(5);
    store.deleteInvoice('acme', '2');
    expect(useInvoiceStore.getState().records.acme).toHaveLength(4);
    expect(useInvoiceStore.getState().drafts.acme).toBeUndefined();
    store.restoreInvoice('acme', '2');
    expect(
      useInvoiceStore.getState().records.acme?.find((invoice) => invoice.id === '2')?.notes,
    ).toBe('Updated');
    expect(useInvoiceStore.getState().deleted.acme).toHaveLength(0);
    expect(
      JSON.parse(localStorage.getItem('mantis-invoice-drafts')!).state.records.acme,
    ).toHaveLength(5);
  });
});
