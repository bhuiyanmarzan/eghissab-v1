import { api } from './client';

export interface ConsumerProfile {
  id: string;
  user_id: string;
  status: string;
  preferences: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface CreateConsumerProfilePayload {
  preferences?: Record<string, unknown>;
}

export interface UpdateConsumerPreferencesPayload {
  preferences: Record<string, unknown>;
}

export interface MembershipRequest {
  id: string;
  consumer_id: string;
  store_id: string;
  store_name: string;
  store_customer_id?: string;
  customer_number?: string;
  customer_phone?: string;
  status: 'pending' | 'approved' | 'rejected' | 'cancelled';
  notes?: string;
  reviewed_by?: string;
  reviewed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateMembershipRequestPayload {
  store_id: string;
  customer_phone?: string;
  notes?: string;
}

export interface ReviewMembershipRequestPayload {
  status: 'approved' | 'rejected';
  access_from?: string;
}

export interface CustomerLink {
  id: string;
  consumer_id: string;
  store_id: string;
  store_name: string;
  store_customer_id: string;
  customer_number: string;
  customer_display_name: string;
  status: 'active' | 'revoked' | 'suspended';
  verified_at: string;
  access_from: string;
  created_at: string;
  updated_at: string;
}

export interface ConsumerInvoiceItem {
  id: string;
  description_snapshot: string;
  sku_snapshot?: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

export interface ConsumerInvoice {
  id: string;
  store_id: string;
  store_name: string;
  store_customer_id: string;
  invoice_number: string;
  lifecycle_status: string;
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
  decision?: string;
  decision_notes?: string;
  is_claimed_as_expense: boolean;
  created_at: string;
  items?: ConsumerInvoiceItem[];
}

export interface ConsumerInvoiceDecisionPayload {
  decision: 'approved' | 'disputed' | 'rejected';
  notes?: string;
}

export interface ClaimInvoiceExpensePayload {
  category_id?: string;
  notes?: string;
}

export interface ExpenseCategory {
  id: string;
  consumer_id: string;
  name: string;
  parent_id?: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateExpenseCategoryPayload {
  name: string;
  parent_id?: string;
  color?: string;
  icon?: string;
}

export interface UpdateExpenseCategoryPayload {
  name?: string;
  parent_id?: string;
  color?: string;
  icon?: string;
}

export interface ExpenseEntry {
  id: string;
  consumer_id: string;
  invoice_id?: string;
  store_id?: string;
  category_id?: string;
  amount: number;
  currency: string;
  source_type: 'invoice' | 'manual' | 'recurring';
  entry_date: string;
  description: string;
  created_at: string;
  updated_at: string;
  store_name?: string;
  invoice_number?: string;
  category_name?: string;
  category_color?: string;
  category_icon?: string;
}

export interface CreateExpenseEntryPayload {
  invoice_id?: string;
  store_id?: string;
  category_id?: string;
  amount: number;
  currency: string;
  source_type: 'invoice' | 'manual' | 'recurring';
  entry_date: string;
  description?: string;
}

export interface UpdateExpenseEntryPayload {
  category_id?: string;
  amount?: number;
  entry_date?: string;
  description?: string;
}

export interface ExpenseAdjustment {
  id: string;
  expense_entry_id: string;
  amount_delta: number;
  reason: string;
  created_by: string;
  created_at: string;
}

export interface CreateExpenseAdjustmentPayload {
  amount_delta: number;
  reason: string;
}

// Consumer Profile API
export async function getConsumerProfile(): Promise<ConsumerProfile> {
  const { data } = await api.get<ConsumerProfile>('/consumer/profile');
  return data;
}

export async function createConsumerProfile(payload: CreateConsumerProfilePayload): Promise<ConsumerProfile> {
  const { data } = await api.post<ConsumerProfile>('/consumer/profile', payload);
  return data;
}

export async function updateConsumerPreferences(payload: UpdateConsumerPreferencesPayload): Promise<ConsumerProfile> {
  const { data } = await api.patch<ConsumerProfile>('/consumer/profile', payload);
  return data;
}

// Membership Requests API
export async function submitMembershipRequest(payload: CreateMembershipRequestPayload): Promise<MembershipRequest> {
  const { data } = await api.post<MembershipRequest>('/consumer/membership-requests', payload);
  return data;
}

export async function listConsumerMembershipRequests(): Promise<MembershipRequest[]> {
  const { data } = await api.get<MembershipRequest[]>('/consumer/membership-requests');
  return data;
}

export async function listStoreMembershipRequests(storeId: string, status?: string): Promise<MembershipRequest[]> {
  const { data } = await api.get<MembershipRequest[]>(`/stores/${storeId}/membership-requests`, {
    params: status ? { status } : undefined,
  });
  return data;
}

export async function reviewMembershipRequest(
  storeId: string,
  requestId: string,
  payload: ReviewMembershipRequestPayload
): Promise<MembershipRequest> {
  const { data } = await api.post<MembershipRequest>(
    `/stores/${storeId}/membership-requests/${requestId}/review`,
    payload
  );
  return data;
}

// Customer Links API
export async function listConsumerCustomerLinks(): Promise<CustomerLink[]> {
  const { data } = await api.get<CustomerLink[]>('/consumer/customer-links');
  return data;
}

export async function revokeCustomerLink(linkId: string): Promise<{ revoked: boolean }> {
  const { data } = await api.delete<{ revoked: boolean }>(`/consumer/customer-links/${linkId}`);
  return data;
}

export async function listStoreCustomerLinks(storeId: string): Promise<CustomerLink[]> {
  const { data } = await api.get<CustomerLink[]>(`/stores/${storeId}/customer-links`);
  return data;
}

// Cross-Store Invoices API
export async function listConsumerInvoices(): Promise<ConsumerInvoice[]> {
  const { data } = await api.get<ConsumerInvoice[]>('/consumer/invoices');
  return data;
}

export async function getConsumerInvoice(invoiceId: string): Promise<ConsumerInvoice> {
  const { data } = await api.get<ConsumerInvoice>(`/consumer/invoices/${invoiceId}`);
  return data;
}

export async function recordConsumerInvoiceDecision(
  invoiceId: string,
  payload: ConsumerInvoiceDecisionPayload
): Promise<ConsumerInvoice> {
  const { data } = await api.post<ConsumerInvoice>(`/consumer/invoices/${invoiceId}/decision`, payload);
  return data;
}

export async function claimInvoiceExpense(
  invoiceId: string,
  payload?: ClaimInvoiceExpensePayload
): Promise<ExpenseEntry> {
  const { data } = await api.post<ExpenseEntry>(`/consumer/invoices/${invoiceId}/claim-expense`, payload ?? {});
  return data;
}

// Expense Categories API
export async function listExpenseCategories(): Promise<ExpenseCategory[]> {
  const { data } = await api.get<ExpenseCategory[]>('/consumer/expense-categories');
  return data;
}

export async function createExpenseCategory(payload: CreateExpenseCategoryPayload): Promise<ExpenseCategory> {
  const { data } = await api.post<ExpenseCategory>('/consumer/expense-categories', payload);
  return data;
}

export async function updateExpenseCategory(
  categoryId: string,
  payload: UpdateExpenseCategoryPayload
): Promise<ExpenseCategory> {
  const { data } = await api.patch<ExpenseCategory>(`/consumer/expense-categories/${categoryId}`, payload);
  return data;
}

export async function deleteExpenseCategory(categoryId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>(`/consumer/expense-categories/${categoryId}`);
  return data;
}

// Expense Entries API
export async function listExpenseEntries(params?: {
  category_id?: string;
  start_date?: string;
  end_date?: string;
}): Promise<ExpenseEntry[]> {
  const { data } = await api.get<ExpenseEntry[]>('/consumer/expenses', { params });
  return data;
}

export async function getExpenseEntry(expenseId: string): Promise<ExpenseEntry> {
  const { data } = await api.get<ExpenseEntry>(`/consumer/expenses/${expenseId}`);
  return data;
}

export async function createExpenseEntry(payload: CreateExpenseEntryPayload): Promise<ExpenseEntry> {
  const { data } = await api.post<ExpenseEntry>('/consumer/expenses', payload);
  return data;
}

export async function updateExpenseEntry(
  expenseId: string,
  payload: UpdateExpenseEntryPayload
): Promise<ExpenseEntry> {
  const { data } = await api.patch<ExpenseEntry>(`/consumer/expenses/${expenseId}`, payload);
  return data;
}

export async function deleteExpenseEntry(expenseId: string): Promise<{ deleted: boolean }> {
  const { data } = await api.delete<{ deleted: boolean }>(`/consumer/expenses/${expenseId}`);
  return data;
}

// Expense Adjustments API
export async function listExpenseAdjustments(expenseId: string): Promise<ExpenseAdjustment[]> {
  const { data } = await api.get<ExpenseAdjustment[]>(`/consumer/expenses/${expenseId}/adjustments`);
  return data;
}

export async function createExpenseAdjustment(
  expenseId: string,
  payload: CreateExpenseAdjustmentPayload
): Promise<ExpenseAdjustment> {
  const { data } = await api.post<ExpenseAdjustment>(`/consumer/expenses/${expenseId}/adjustments`, payload);
  return data;
}
