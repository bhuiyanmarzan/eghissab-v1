import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { getCustomerRecords, saveCustomer, setCustomerDeleted } from './customers';
import { customerDefaults, type CustomerRecord } from '../lib/customer';
vi.mock('./client', () => ({ api: { get: vi.fn(), patch: vi.fn(), post: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
const row: CustomerRecord = {
  id: '100',
  name: 'Earl Parrini',
  email: 'sah@gmail.com',
  phone: '+1 965 8864355',
  age: 55,
  country: 'Russia',
  status: 'Complete',
};
describe('Customer API', () => {
  it('keeps legacy customers in Acme and isolates tenant records', async () => {
    vi.mocked(api.get).mockResolvedValue({
      data: [row, { ...row, id: 'new', tenantId: 'globex' }],
    });
    expect(await getCustomerRecords('acme')).toEqual([row]);
    expect((await getCustomerRecords('globex')).map((r) => r.id)).toEqual(['new']);
  });
  it('saves joined names and returns server identifiers', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ...row, id: 'server-id' } });
    expect((await saveCustomer('acme', customerDefaults(row))).id).toBe('server-id');
    expect(api.post).toHaveBeenCalledWith(
      '/customers',
      expect.objectContaining({ name: 'Earl Parrini', tenantId: 'acme' }),
    );
  });
  it('patches the existing record, propagates failures and restores deletion flags', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('offline'));
    await expect(saveCustomer('acme', customerDefaults(row), 'a/b')).rejects.toThrow('offline');
    expect(api.patch).toHaveBeenCalledWith('/customers/a%2Fb', expect.any(Object));
    vi.mocked(api.patch).mockResolvedValue({ data: row });
    await setCustomerDeleted('100', false);
    expect(api.patch).toHaveBeenLastCalledWith('/customers/100', { deleted: false });
  });
});
