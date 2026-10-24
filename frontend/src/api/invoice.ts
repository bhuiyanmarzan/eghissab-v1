import { api } from './client';

export interface InvoiceItem {
  id: string;
  store_id: string;
  invoice_id: string;
  product_id?: string;
  description_snapshot: string;
  sku_snapshot?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_rate: number;
  tax_amount: number;
  line_total: number;
  created_at: string;
}

export interface InvoiceItemInput {
  product_id?: string;
  description_snapshot: string;
  sku_snapshot?: string;
  quantity: number;
  unit_price: number;
  discount_amount?: number;
  tax_rate?: number;
  tax_amount?: number;
  line_total?: number;
}

export interface Invoice {
  id: string;
  store_id: string;
  store_customer_id?: string;
  customer_name?: string;
  invoice_number: string;
  lifecycle_status: 'draft' | 'issued' | 'paid' | 'partially_paid' | 'voided' | 'cancelled';
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  paid_amount: number;
  currency: string;
  notes?: string;
  invoice_date: string;
  due_date?: string;
  issued_at?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
  items?: InvoiceItem[];
}

export interface CreateInvoicePayload {
  store_customer_id?: string;
  currency?: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  items: InvoiceItemInput[];
}

export interface UpdateInvoicePayload {
  store_customer_id?: string;
  invoice_date?: string;
  due_date?: string;
  notes?: string;
  items?: InvoiceItemInput[];
}

export interface Payment {
  id: string;
  invoice_id: string;
  amount: number;
  currency: string;
  method: 'cash' | 'card' | 'mobile_banking' | 'bank_transfer' | 'credit_balance' | 'other';
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  external_reference?: string;
  received_by?: string;
  paid_at: string;
  created_at: string;
}

export interface RecordPaymentPayload {
  amount: number;
  currency?: string;
  method: string;
  external_reference?: string;
}

export interface Adjustment {
  id: string;
  invoice_id: string;
  adjustment_number: string;
  type: 'credit_note' | 'debit_note' | 'tax_correction' | 'discount_reversal' | 'write_off';
  amount: number;
  tax_impact: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface CreateAdjustmentPayload {
  type: string;
  amount: number;
  tax_impact?: number;
  reason: string;
}

export interface Decision {
  id: string;
  invoice_id: string;
  consumer_id: string;
  decision: 'pending' | 'approved' | 'disputed' | 'rejected';
  notes?: string;
  decided_at?: string;
  created_at: string;
}

export interface InvoiceDecisionPayload {
  decision: string;
  notes?: string;
}

export interface InvoiceEvent {
  id: string;
  invoice_id: string;
  actor_user_id?: string;
  event_type: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// Invoice Operations
export async function listInvoices(
  storeId: string,
  params?: { customer_id?: string; status?: string }
): Promise<Invoice[]> {
  const { data } = await api.get<Invoice[]>(`/stores/${storeId}/invoices`, { params });
  return data;
}

export async function getInvoice(storeId: string, invoiceId: string): Promise<Invoice> {
  const { data } = await api.get<Invoice>(`/stores/${storeId}/invoices/${invoiceId}`);
  return data;
}

export async function createInvoiceDraft(storeId: string, payload: CreateInvoicePayload): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/stores/${storeId}/invoices`, payload);
  return data;
}

export async function updateInvoiceDraft(
  storeId: string,
  invoiceId: string,
  payload: UpdateInvoicePayload
): Promise<Invoice> {
  const { data } = await api.patch<Invoice>(`/stores/${storeId}/invoices/${invoiceId}`, payload);
  return data;
}

export async function issueInvoice(storeId: string, invoiceId: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/stores/${storeId}/invoices/${invoiceId}/issue`);
  return data;
}

export async function voidInvoice(storeId: string, invoiceId: string, reason?: string): Promise<Invoice> {
  const { data } = await api.post<Invoice>(`/stores/${storeId}/invoices/${invoiceId}/void`, { reason });
  return data;
}

// Payment Operations
export async function recordInvoicePayment(
  storeId: string,
  invoiceId: string,
  payload: RecordPaymentPayload
): Promise<Payment> {
  const { data } = await api.post<Payment>(`/stores/${storeId}/invoices/${invoiceId}/payments`, payload);
  return data;
}

export async function listInvoicePayments(storeId: string, invoiceId: string): Promise<Payment[]> {
  const { data } = await api.get<Payment[]>(`/stores/${storeId}/invoices/${invoiceId}/payments`);
  return data;
}

// Adjustment Operations
export async function createInvoiceAdjustment(
  storeId: string,
  invoiceId: string,
  payload: CreateAdjustmentPayload
): Promise<Adjustment> {
  const { data } = await api.post<Adjustment>(`/stores/${storeId}/invoices/${invoiceId}/adjustments`, payload);
  return data;
}

export async function listInvoiceAdjustments(storeId: string, invoiceId: string): Promise<Adjustment[]> {
  const { data } = await api.get<Adjustment[]>(`/stores/${storeId}/invoices/${invoiceId}/adjustments`);
  return data;
}

// Consumer Decision Operations
export async function recordInvoiceDecision(
  storeId: string,
  invoiceId: string,
  payload: InvoiceDecisionPayload
): Promise<Decision> {
  const { data } = await api.post<Decision>(`/stores/${storeId}/invoices/${invoiceId}/decision`, payload);
  return data;
}

// Audit Trail Events
export async function listInvoiceEvents(storeId: string, invoiceId: string): Promise<InvoiceEvent[]> {
  const { data } = await api.get<InvoiceEvent[]>(`/stores/${storeId}/invoices/${invoiceId}/events`);
  return data;
}
