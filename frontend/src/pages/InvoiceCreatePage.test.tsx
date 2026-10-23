import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceCreatePage } from './InvoiceCreatePage';
import { newInvoice } from '../lib/invoice';
import { useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore } from '../store/useTenantStore';

beforeEach(() => {
  useInvoiceStore.setState({ drafts: {}, addresses: {}, records: {}, deleted: {} });
  useTenantStore.setState({ selectedTenantId: 'acme' });
});
afterEach(cleanup);
const change = (name: string, value: string) =>
  fireEvent.change(screen.getByLabelText(name), { target: { value } });
async function completeInvoice() {
  change('Status', 'Unpaid');
  change('Due Date', '2099-12-31');
  change('Item name 1', 'Website design');
  change('Description 1', 'Design services');
  fireEvent.click(screen.getByRole('button', { name: 'Add recipient address' }));
  const dialog = screen.getByRole('dialog');
  fireEvent.click(within(dialog).getByRole('button', { name: /Ian Carpenter/ }));
  fireEvent.click(within(dialog).getByRole('button', { name: 'Add' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
}
describe('Create Invoice', () => {
  it('recalculates totals, handles item removal, currency changes and notes', () => {
    render(<InvoiceCreatePage />);
    expect(screen.getByRole('button', { name: 'Preview' })).toBeDisabled();
    change('Qty 1', '2');
    change('Price 1', '100');
    change('Discount(%)', '10');
    change('Tax(%)', '20');
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$220.00');
    fireEvent.click(screen.getByRole('button', { name: 'Add Item' }));
    change('Price 2', '50');
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$275.00');
    fireEvent.click(screen.getByRole('button', { name: 'Remove Item 1' }));
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('$55.00');
    change('Set Currency*', 'GBP');
    expect(screen.getByTestId('invoice-total')).toHaveTextContent('£55.00');
    change('Notes', 'Thank you');
    expect(screen.getByText('9 / 500')).toBeInTheDocument();
  });
  it('validates the required fields before saving', async () => {
    render(<InvoiceCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Select a recipient')).toBeInTheDocument();
    expect(screen.getByText('Select a valid due date')).toBeInTheDocument();
    expect(useInvoiceStore.getState().drafts.acme).toBeUndefined();
  });
  it('searches and changes addresses without applying cancelled selections', () => {
    render(<InvoiceCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Change sender address' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox', { name: 'Search addresses' }), {
      target: { value: 'Ritika' },
    });
    expect(within(dialog).queryByText('Ian Carpenter')).not.toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: /Ritika Yohannan/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Belle J. Richter')).toBeInTheDocument();
    expect(screen.queryByText('Ritika Yohannan')).not.toBeInTheDocument();
  });
  it('adds a custom address without submitting the invoice form', async () => {
    render(<InvoiceCreatePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Add recipient address' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add New' }));
    const dialog = screen.getByRole('dialog');
    for (const [label, value] of [
      ['Name', 'New Client'],
      ['Address', '20 Main Street'],
      ['Phone', '12345678'],
      ['Email address', 'client@example.com'],
    ])
      fireEvent.change(within(dialog).getByLabelText(label), {
        target: { value },
      });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Add Address' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByText('New Client')).toBeInTheDocument();
    expect(useInvoiceStore.getState().addresses.acme?.[0].email).toBe('client@example.com');
    expect(screen.queryByText('Select a valid due date')).not.toBeInTheDocument();
  });
  it('previews the entered invoice, prints, saves and restores the same invoice', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {});
    const view = render(<InvoiceCreatePage />);
    await completeInvoice();
    expect(screen.getByRole('button', { name: 'Preview' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Preview' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Website design')).toBeInTheDocument();
    expect(within(dialog).getByText('Ian Carpenter')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Print' }));
    expect(print).toHaveBeenCalledOnce();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close invoice preview' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Invoice saved in this browser.');
    const id = useInvoiceStore.getState().drafts.acme?.id;
    view.unmount();
    render(<InvoiceCreatePage />);
    expect(screen.getByLabelText('Item name 1')).toHaveValue('Website design');
    expect(screen.getByLabelText('Invoice Id')).toHaveValue(id);
    print.mockRestore();
  });
  it('prepares an email draft without reporting delivery', async () => {
    render(<InvoiceCreatePage />);
    await completeInvoice();
    fireEvent.click(screen.getByRole('button', { name: 'Create & Send' }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getByRole('heading', { name: 'Invoice ready to send' }),
    ).toBeInTheDocument();
    const link = within(dialog).getByRole('link', { name: 'Open email draft' });
    expect(link.getAttribute('href')).toMatch(/^mailto:iacrpt65%40gmail.com\?/);
    expect(useInvoiceStore.getState().drafts.acme?.recipient?.name).toBe('Ian Carpenter');
  });
  it('keeps saved invoices isolated by tenant', () => {
    const invoice = newInvoice();
    invoice.items[0].name = 'Saved Acme work';
    useInvoiceStore.getState().saveDraft('acme', invoice);
    render(<InvoiceCreatePage />);
    expect(screen.getByLabelText('Item name 1')).toHaveValue('Saved Acme work');
    act(() => useTenantStore.getState().selectTenant('globex'));
    expect(screen.getByLabelText('Item name 1')).toHaveValue('');
    expect(useInvoiceStore.getState().drafts.globex).toBeUndefined();
    act(() => useTenantStore.getState().selectTenant('acme'));
    expect(screen.getByLabelText('Item name 1')).toHaveValue('Saved Acme work');
  });
});
