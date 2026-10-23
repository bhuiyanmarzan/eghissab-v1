import { api } from './client';
import type { ReactTableRow, TableRowValues } from '../lib/reactTable';
export async function getReactTableRows(tenantId: string) {
  return (await api.get<ReactTableRow[]>('/reactTableRows', { params: { tenantId } })).data;
}
export async function updateReactTableRow(
  id: string,
  values: Partial<TableRowValues> & { deleted?: boolean },
) {
  return (await api.patch<ReactTableRow>(`/reactTableRows/${encodeURIComponent(id)}`, values)).data;
}
export async function createReactTableRow(row: ReactTableRow) {
  return (await api.post<ReactTableRow>('/reactTableRows', row)).data;
}
