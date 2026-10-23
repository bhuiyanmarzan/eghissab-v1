import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { InvoiceRecordPage } from './InvoiceRecordPage';
import { useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore } from '../store/useTenantStore';

beforeEach(() => {
  useInvoiceStore.setState({ drafts: {}, records: {}, deleted: {}, addresses: {} });
  useTenantStore.setState({ selectedTenantId: 'acme' });
});
afterEach(cleanup);
const renderPage = (id: string, editing = false) =>
  render(
    <MemoryRouter initialEntries={[`/apps/invoice/${editing ? 'edit' : 'details'}/${id}`]}>
      <Routes>
        <Route path="/apps/invoice/details/:invoiceId" element={<InvoiceRecordPage />} />
        <Route path="/apps/invoice/edit/:invoiceId" element={<InvoiceRecordPage editing />} />
      </Routes>
    </MemoryRouter>,
  );
describe('invoice row actions', () => {
  it('shows the invoice belonging to the selected identifier', () => {
    renderPage('5');
    expect(screen.getByText('Mickie Melmoth')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invoice #5' })).toBeInTheDocument();
  });
  it('edits and saves the existing record without creating a duplicate', async () => {
    renderPage('5', true);
    fireEvent.change(screen.getByLabelText('Item name 1'), {
      target: { value: 'Updated services' },
    });
    fireEvent.change(screen.getByLabelText('Price 1'), { target: { value: '2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() =>
      expect(
        useInvoiceStore.getState().records.acme?.find((invoice) => invoice.id === '5')?.items[0]
          .price,
      ).toBe(2),
    );
    expect(useInvoiceStore.getState().records.acme).toHaveLength(5);
  });
  it('handles a missing invoice with a link back to the list', () => {
    renderPage('missing');
    expect(screen.getByText('Invoice not found')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to invoice list' })).toHaveAttribute(
      'href',
      '/apps/invoice/list',
    );
  });
});
