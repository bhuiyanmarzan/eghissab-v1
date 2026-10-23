import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from './client';
import { createReactTableRow, getReactTableRows, updateReactTableRow } from './reactTable';
import { makeReactTableRows } from '../data/reactTableRows';
vi.mock('./client', () => ({ api: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
beforeEach(() => vi.resetAllMocks());
describe('React table API', () => {
  it('scopes fetched records to the active tenant', async () => {
    const rows = makeReactTableRows('globex');
    vi.mocked(api.get).mockResolvedValue({ data: rows });
    expect(await getReactTableRows('globex')).toEqual(rows);
    expect(api.get).toHaveBeenCalledWith('/reactTableRows', { params: { tenantId: 'globex' } });
  });
  it('uses the server-assigned identifier when creating records', async () => {
    const row = makeReactTableRows()[0];
    vi.mocked(api.post).mockResolvedValue({ data: { ...row, id: 'server-id' } });
    expect((await createReactTableRow(row)).id).toBe('server-id');
  });
  it('propagates failed updates and supports recoverable deletion', async () => {
    vi.mocked(api.patch).mockRejectedValueOnce(new Error('offline'));
    await expect(updateReactTableRow('a/b', { name: 'Changed' })).rejects.toThrow('offline');
    expect(api.patch).toHaveBeenCalledWith('/reactTableRows/a%2Fb', { name: 'Changed' });
    vi.mocked(api.patch).mockResolvedValue({ data: { id: 'a', deleted: false } });
    await updateReactTableRow('a', { deleted: false });
    expect(api.patch).toHaveBeenLastCalledWith('/reactTableRows/a', { deleted: false });
  });
});
