import { api } from './client';

export interface Plan {
  id: string;
  code: string;
  name: string;
  status: string;
  version: number;
  price_minor: number;
  currency: string;
  billing_interval: string;
  limits: {
    max_stores?: number;
    max_staff_per_store?: number;
    max_invoices_per_month?: number;
    [key: string]: unknown;
  };
}

export interface Subscription {
  id: string;
  organization_id: string;
  plan_code: string;
  plan_name: string;
  status: string;
  period_start: string;
  period_end: string;
  canceled_at?: string;
  limits: {
    max_stores?: number;
    max_staff_per_store?: number;
    max_invoices_per_month?: number;
    [key: string]: unknown;
  };
}

export interface BillingInvoice {
  id: string;
  subscription_id: string;
  amount_minor: number;
  currency: string;
  status: string;
  provider_reference?: string;
  period_start: string;
  period_end: string;
  due_at: string;
  paid_at?: string;
  created_at: string;
}

export interface SubscribePayload {
  organization_id: string;
  plan_code: string;
  billing_interval?: string;
}

export interface RecordUsagePayload {
  organization_id: string;
  store_id?: string;
  metric: string;
  quantity: number;
  source_key: string;
}

export async function listPlans(): Promise<Plan[]> {
  const { data } = await api.get<Plan[]>('/billing/plans');
  return data;
}

export async function getSubscription(organizationId: string): Promise<Subscription> {
  const { data } = await api.get<Subscription>('/billing/subscription', {
    params: { organization_id: organizationId },
  });
  return data;
}

export async function subscribeToPlan(payload: SubscribePayload): Promise<Subscription> {
  const { data } = await api.post<Subscription>('/billing/subscribe', payload);
  return data;
}

export async function cancelSubscription(organizationId: string, reason?: string): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/billing/cancel', {
    organization_id: organizationId,
    reason,
  });
  return data;
}

export async function listBillingInvoices(organizationId: string): Promise<BillingInvoice[]> {
  const { data } = await api.get<BillingInvoice[]>('/billing/invoices', {
    params: { organization_id: organizationId },
  });
  return data;
}

export async function recordUsage(payload: RecordUsagePayload): Promise<{ message: string }> {
  const { data } = await api.post<{ message: string }>('/billing/usage', payload);
  return data;
}
