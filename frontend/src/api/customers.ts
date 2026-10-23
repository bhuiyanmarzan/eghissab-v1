import { api } from './client';
import type { CustomerRecord, CustomerValues } from '../lib/customer';
export async function getCustomerRecords(tenantId: string) {
  const { data } = await api.get<CustomerRecord[]>('/customers');
  return data.filter((row) => (row.tenantId ?? 'acme') === tenantId);
}
export async function saveCustomer(tenantId: string, values: CustomerValues, id?: string) {
  const record = { ...values, name: `${values.firstName} ${values.lastName}`.trim(), tenantId };
  return id
    ? (await api.patch<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, record)).data
    : (await api.post<CustomerRecord>('/customers', record)).data;
}
export async function setCustomerDeleted(id: string, deleted: boolean) {
  return (await api.patch<CustomerRecord>(`/customers/${encodeURIComponent(id)}`, { deleted }))
    .data;
}
