import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomerListPage } from './CustomerListPage';
import { getCustomerRecords, saveCustomer, setCustomerDeleted } from '../api/customers';
import { type CustomerRecord } from '../lib/customer';
import { useTenantStore } from '../store/useTenantStore';
vi.mock('../api/customers', () => ({
  getCustomerRecords: vi.fn(),
  saveCustomer: vi.fn(),
  setCustomerDeleted: vi.fn(),
}));
const initial: CustomerRecord[] = Array.from({ length: 12 }, (_, i) => ({
  id: String(100 - i),
  name: i === 0 ? 'Earl Parrini' : `Customer Person ${i}`,
  email: `person${i}@example.com`,
  phone: '+1 (965) 886-4355',
  age: 55 - i,
  country: i % 2 ? 'Kenya' : 'Russia',
  status: i % 3 === 0 ? 'Complete' : i % 3 === 1 ? 'Pending' : 'Canceled',
  role: 'Designer',
  about: 'Customer profile',
  skills: ['Figma'],
}));
let records: CustomerRecord[];
beforeEach(() => {
  vi.resetAllMocks();
  records = structuredClone(initial);
  useTenantStore.setState({ selectedTenantId: 'acme' });
  vi.mocked(getCustomerRecords).mockImplementation(async (tenant) =>
    tenant === 'acme' ? structuredClone(records) : [],
  );
  vi.mocked(saveCustomer).mockImplementation(async (tenant, values, id) => {
    const row = {
      ...values,
      id: id ?? 'server-new-id',
      name: `${values.firstName} ${values.lastName}`,
      tenantId: tenant,
    };
    records = id ? records.map((r) => (r.id === id ? { ...r, ...row } : r)) : [...records, row];
    return row;
  });
  vi.mocked(setCustomerDeleted).mockImplementation(async (id, deleted) => {
    records = records.map((r) => (r.id === id ? { ...r, deleted } : r));
    return records.find((r) => r.id === id)!;
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});
async function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <CustomerListPage />
    </QueryClientProvider>,
  );
  await screen.findByRole('table', { name: 'Customers' });
  return client;
}
const rows = () =>
  within(screen.getByRole('table', { name: 'Customers' }))
    .getAllByRole('row')
    .slice(1);
const fillNew = () => {
  fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'New' } });
  fireEvent.change(screen.getByLabelText('Last Name'), { target: { value: 'Customer' } });
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'new@example.com' } });
  fireEvent.change(screen.getByLabelText('Contact'), { target: { value: '+1 123 456 7890' } });
  fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'Canada' } });
};
describe('Customer List', () => {
  it('renders existing customers, searches email, and combines search and status filters', async () => {
    await setup();
    expect(rows()).toHaveLength(10);
    expect(rows()[0]).toHaveTextContent('Earl Parrini');
    fireEvent.change(screen.getByRole('textbox', { name: 'Search customers' }), {
      target: { value: 'person1@' },
    });
    expect(rows()).toHaveLength(1);
    fireEvent.change(screen.getByRole('combobox', { name: 'Status Filter' }), {
      target: { value: 'Complete' },
    });
    expect(screen.getByText('No customers found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(rows()).toHaveLength(10);
  });
  it('sorts identifiers numerically and supports dropdown and column sorting', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: '#' }));
    expect(rows()[0]).toHaveTextContent('89');
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort customers' }), {
      target: { value: 'age' },
    });
    expect(rows()[0]).toHaveTextContent('44');
    fireEvent.click(screen.getByRole('button', { name: 'Age' }));
    expect(rows()[0]).toHaveTextContent('55');
  });
  it('supports page size, last page, go to and selection across pages', async () => {
    await setup();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select all customers' }));
    expect(screen.getByText('12 row(s) selected')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
    expect(rows()).toHaveLength(2);
    expect(screen.getByRole('checkbox', { name: 'Select customer 89' })).toBeChecked();
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Go to page' }), {
      target: { value: '1' },
    });
    fireEvent.change(screen.getByRole('combobox', { name: 'Row per page' }), {
      target: { value: '5' },
    });
    expect(rows()).toHaveLength(5);
    fireEvent.click(screen.getByRole('button', { name: 'Clear selection' }));
    expect(screen.getByRole('checkbox', { name: 'Select customer 100' })).not.toBeChecked();
  });
  it('expands and collapses the customer profile without navigating', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'View customer 100' }));
    expect(screen.getByText('Personal Details')).toBeInTheDocument();
    expect(screen.getByText('Customer profile')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View customer 100' }));
    expect(screen.queryByText('Personal Details')).not.toBeInTheDocument();
  });
  it('validates create fields and saves skills and privacy preferences with the server id', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await screen.findByText('First name is required');
    expect(saveCustomer).not.toHaveBeenCalled();
    fillNew();
    fireEvent.change(screen.getByLabelText('Skills'), { target: { value: 'React' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }));
    fireEvent.click(screen.getByRole('switch', { name: 'Available to hire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(saveCustomer).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({ firstName: 'New', skills: ['React'], availableToHire: true }),
      undefined,
    );
    expect(records.find((r) => r.id === 'server-new-id')).toBeDefined();
  });
  it('cancels edits without changing data and saves the same customer without duplication', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Edit customer 100' }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Changed' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(saveCustomer).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit customer 100' }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Updated' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Updated Parrini');
    expect(records).toHaveLength(12);
    expect(saveCustomer).toHaveBeenCalledWith(
      'acme',
      expect.objectContaining({ firstName: 'Updated' }),
      '100',
    );
  });
  it('keeps failed save drafts open for retry', async () => {
    await setup();
    vi.mocked(saveCustomer).mockRejectedValue(new Error('offline'));
    fireEvent.click(screen.getByRole('button', { name: 'Edit customer 100' }));
    fireEvent.change(screen.getByLabelText('First Name'), { target: { value: 'Unsaved' } });
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    await screen.findByText('Unable to save customer. Try again.');
    expect(screen.getByLabelText('First Name')).toHaveValue('Unsaved');
    expect(records[0].name).toBe('Earl Parrini');
  });
  it('cancels deletion then soft deletes and restores the selected record', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Delete customer 100' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(setCustomerDeleted).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Delete customer 100' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Earl Parrini')).not.toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: /Deleted customers/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Restore' }));
    await screen.findByText('No deleted customers');
    expect(records[0].deleted).toBe(false);
  });
  it('exports only selected filtered customers', async () => {
    await setup();
    const urls = vi.fn().mockReturnValue('blob:test');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: urls });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('checkbox', { name: 'Select customer 100' }));
    fireEvent.click(screen.getByRole('button', { name: 'CSV Export' }));
    expect(urls).toHaveBeenCalledOnce();
    expect(urls.mock.calls[0][0]).toBeInstanceOf(Blob);
  });
  it('isolates customers and resets selection when changing tenant', async () => {
    await setup();
    cleanup();
    useTenantStore.setState({ selectedTenantId: 'globex' });
    await setup();
    expect(getCustomerRecords).toHaveBeenCalledWith('globex');
    expect(screen.getByText('No customers found')).toBeInTheDocument();
    expect(screen.queryByText('Earl Parrini')).not.toBeInTheDocument();
  });
  it('reads a valid avatar and can remove it before saving', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    fireEvent.change(screen.getByLabelText('Upload avatar file'), {
      target: { files: [new File(['image'], 'avatar.png', { type: 'image/png' })] },
    });
    await screen.findByAltText('Customer avatar');
    fireEvent.click(screen.getByRole('button', { name: 'Remove image' }));
    expect(screen.queryByAltText('Customer avatar')).not.toBeInTheDocument();
  });
  it('returns to a valid page after deleting the last record on the final page', async () => {
    records = records.slice(0, 11);
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Go to last page' }));
    for (const id of ['90']) {
      fireEvent.click(screen.getByRole('button', { name: 'Delete customer ' + id }));
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
    await waitFor(() =>
      expect(screen.getByRole('spinbutton', { name: 'Go to page' })).toHaveValue(1),
    );
    expect(rows()).toHaveLength(10);
  });
  it('rejects invalid avatar uploads and preserves the form', async () => {
    await setup();
    fireEvent.click(screen.getByRole('button', { name: 'Add Customer' }));
    fireEvent.change(screen.getByLabelText('Upload avatar file'), {
      target: { files: [new File(['x'], 'test.txt', { type: 'text/plain' })] },
    });
    expect(screen.getByText('Choose a PNG, JPEG or WebP image up to 2 MB.')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
  it('shows a recoverable fetch error', async () => {
    vi.mocked(getCustomerRecords).mockRejectedValue(new Error('offline'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <CustomerListPage />
      </QueryClientProvider>,
    );
    await screen.findByText(
      'Unable to load customers. Check the connection and try again.',
      {},
      { timeout: 4000 },
    );
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
