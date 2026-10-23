import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InvoiceListPage } from './InvoiceListPage';
import { initialInvoiceRecords } from '../data/invoices';
import { useInvoiceStore } from '../store/useInvoiceStore';
import { useTenantStore } from '../store/useTenantStore';

beforeEach(() => {
  useInvoiceStore.setState({ drafts: {}, addresses: {}, records: {}, deleted: {} });
  useTenantStore.setState({ selectedTenantId: 'acme' });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
const renderList = () =>
  render(
    <MemoryRouter>
      <InvoiceListPage />
    </MemoryRouter>,
  );
const rows = () =>
  within(screen.getByRole('table', { name: 'Invoices' }))
    .getAllByRole('row')
    .slice(1);
const seedMore = (count: number) => {
  for (let index = 0; index < count; index++)
    useInvoiceStore.getState().saveDraft('acme', {
      ...structuredClone(initialInvoiceRecords[0]),
      id: String(100 + index),
      recipient: { ...initialInvoiceRecords[0].recipient!, name: `Client ${index}` },
    });
};
describe('Invoice List', () => {
  it('renders invoice columns, filters status and searches email', () => {
    renderList();
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('tab', { name: /^Paid/ }));
    expect(rows()).toHaveLength(2);
    expect(screen.queryByText('Abey Boseley')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /^All/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Search invoices' }), {
      target: { value: 'aabsl32@gmail.com' },
    });
    expect(rows()).toHaveLength(1);
    expect(screen.getByText('Abey Boseley')).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Search invoices' }), {
      target: { value: '7/15/2022' },
    });
    expect(rows()).toHaveLength(1);

    fireEvent.change(screen.getByRole('textbox', { name: 'Search invoices' }), {
      target: { value: 'missing' },
    });
    expect(screen.getByText('No invoices found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'CSV Export' })).toBeDisabled();
  });
  it('sorts invoice identifiers numerically in both directions', () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Invoice Id' }));
    expect(within(rows()[0]).getAllByRole('cell')[1]).toHaveTextContent('1');
    fireEvent.click(screen.getByRole('button', { name: 'Invoice Id' }));
    expect(within(rows()[0]).getAllByRole('cell')[1]).toHaveTextContent('5');
  });
  it('selects the page, clears selection and exports selected invoices', async () => {
    Object.defineProperty(URL, 'createObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: vi.fn(),
      writable: true,
      configurable: true,
    });
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:invoices');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    let filename = '';
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download;
    });
    renderList();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all invoices on this page' }));
    expect(screen.getByText('5 invoices selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select invoice 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV Export' }));
    expect(create).toHaveBeenCalledOnce();
    expect(filename).toBe('selected-invoices.csv');
    expect(create.mock.calls[0][0]).toBeInstanceOf(Blob);
    const exported = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.readAsText(create.mock.calls[0][0] as Blob);
    });
    expect(exported.split('\r\n')).toHaveLength(2);
    expect(exported).toContain('Abey Boseley');
    expect(exported).not.toContain('Mickie Melmoth');
  });
  it('paginates, jumps to a page and resets when filtering', () => {
    seedMore(10);
    renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Row per page' }), {
      target: { value: '5' },
    });
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
    expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toHaveValue(3);
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Go to page' }), {
      target: { value: '2' },
    });
    expect(screen.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search invoices' }), {
      target: { value: 'Abey' },
    });
    expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toHaveValue(1);
    expect(rows()).toHaveLength(1);
  });
  it('cancels deletion, deletes only the selected invoice and restores it', async () => {
    renderList();
    fireEvent.click(screen.getByRole('button', { name: 'Delete invoice 2' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Delete invoice 2' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(screen.queryByText('Abey Boseley')).not.toBeInTheDocument();
    expect(useInvoiceStore.getState().deleted.acme?.[0].id).toBe('2');
    fireEvent.click(screen.getByRole('button', { name: /^Deleted invoices/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore invoice 2' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    expect(rows()).toHaveLength(5);
    expect(screen.getByText('Abey Boseley')).toBeInTheDocument();
  });
  it('connects Add, View and Edit to the correct invoice routes', () => {
    renderList();
    expect(screen.getByRole('link', { name: 'Add Invoice' })).toHaveAttribute(
      'href',
      '/apps/invoice/create?new=1',
    );
    expect(screen.getByRole('link', { name: 'View invoice 2' })).toHaveAttribute(
      'href',
      '/apps/invoice/details/2',
    );
    expect(screen.getByRole('link', { name: 'Edit invoice 5' })).toHaveAttribute(
      'href',
      '/apps/invoice/edit/5',
    );
  });
  it('shows saved invoices and keeps each tenant isolated', () => {
    seedMore(1);
    renderList();
    expect(rows()).toHaveLength(6);
    act(() => useTenantStore.getState().selectTenant('globex'));
    expect(rows()).toHaveLength(5);
    expect(screen.queryByText('Client 0')).not.toBeInTheDocument();
    act(() => useTenantStore.getState().selectTenant('acme'));
    expect(rows()).toHaveLength(6);
  });
  it('handles an entirely empty list and clamps the last page after deletion', async () => {
    seedMore(1);
    renderList();
    fireEvent.change(screen.getByRole('combobox', { name: 'Row per page' }), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Go to next page' }));
    const lastRow = rows()[0];
    fireEvent.click(within(lastRow).getByRole('button', { name: /Delete invoice/ }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() =>
      expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toHaveValue(1),
    );
    act(() => useInvoiceStore.setState({ records: { acme: [] } }));
    expect(screen.getByText('No invoices found')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Go to next page' })).toBeDisabled();
  });
});
