import { api } from './client';

export interface AuditEvent {
  id: string;
  actor_user_id?: string;
  actor_name?: string;
  organization_id?: string;
  store_id?: string;
  action: string;
  details: Record<string, any>;
  created_at: string;
}

export interface ListAuditEventsParams {
  action?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface RecordAuditEventPayload {
  action: string;
  details?: Record<string, any>;
  store_id?: string;
}

export interface Job {
  id: string;
  event_id?: string;
  type: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  payload: Record<string, any>;
  run_at: string;
  max_attempts: number;
  attempt_count: number;
  locked_at?: string;
  locked_by?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateJobPayload {
  type: string;
  payload?: Record<string, any>;
  run_at?: string;
  max_attempts?: number;
}

export interface JobAttempt {
  id: string;
  job_id: string;
  attempt_number: number;
  outcome: 'success' | 'failed' | 'retryable_error';
  error_message?: string;
  duration_ms: number;
  started_at: string;
  finished_at: string;
}

export interface OutboxEvent {
  id: string;
  aggregate_type: string;
  aggregate_id: string;
  event_type: string;
  payload: Record<string, any>;
  created_at: string;
}

export interface FileAsset {
  id: string;
  invoice_id?: string;
  organization_id?: string;
  store_id?: string;
  storage_key: string;
  visibility: 'private' | 'public' | 'tenant';
  file_name: string;
  mime_type: string;
  file_size: number;
  checksum_sha256?: string;
  uploaded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface WebhookReceipt {
  id: string;
  provider: string;
  provider_event_id: string;
  event_type: string;
  payload?: Record<string, any>;
  status: string;
  processed_at?: string;
  last_error?: string;
  created_at: string;
}

export interface IngestWebhookPayload {
  provider_event_id: string;
  event_type: string;
  payload?: Record<string, any>;
}

// 1. Audit Trail API
export async function listOrgAuditEvents(orgId: string, params?: ListAuditEventsParams): Promise<AuditEvent[]> {
  const { data } = await api.get<AuditEvent[]>(`/api/organizations/${orgId}/audit-events`, { params });
  return data;
}

export async function listStoreAuditEvents(storeId: string, params?: ListAuditEventsParams): Promise<AuditEvent[]> {
  const { data } = await api.get<AuditEvent[]>(`/api/stores/${storeId}/audit-events`, { params });
  return data;
}

export async function recordStoreAuditEvent(storeId: string, payload: RecordAuditEventPayload): Promise<AuditEvent> {
  const { data } = await api.post<AuditEvent>(`/api/stores/${storeId}/audit-events`, payload);
  return data;
}

// 2. Background Jobs API
export async function listJobs(params?: { status?: string; type?: string; limit?: number }): Promise<Job[]> {
  const { data } = await api.get<Job[]>('/api/system/jobs', { params });
  return data;
}

export async function createJob(payload: CreateJobPayload): Promise<Job> {
  const { data } = await api.post<Job>('/api/system/jobs', payload);
  return data;
}

export async function getJob(jobId: string): Promise<Job> {
  const { data } = await api.get<Job>(`/api/system/jobs/${jobId}`);
  return data;
}

export async function listJobAttempts(jobId: string): Promise<JobAttempt[]> {
  const { data } = await api.get<JobAttempt[]>(`/api/system/jobs/${jobId}/attempts`);
  return data;
}

export async function retryJob(jobId: string): Promise<Job> {
  const { data } = await api.post<Job>(`/api/system/jobs/${jobId}/retry`, {});
  return data;
}

// 3. Outbox Inspection API
export async function listOutboxEvents(params?: { limit?: number }): Promise<OutboxEvent[]> {
  const { data } = await api.get<OutboxEvent[]>('/api/system/outbox', { params });
  return data;
}

// 4. File Assets API
export async function getFileAsset(fileId: string): Promise<FileAsset> {
  const { data } = await api.get<FileAsset>(`/api/files/${fileId}`);
  return data;
}

export async function getInvoicePDF(invoiceId: string): Promise<FileAsset> {
  const { data } = await api.get<FileAsset>(`/api/invoices/${invoiceId}/pdf`);
  return data;
}

// 5. Webhook Ingress API
export async function ingestWebhook(provider: string, payload: IngestWebhookPayload): Promise<WebhookReceipt> {
  const { data } = await api.post<WebhookReceipt>(`/api/webhooks/${provider}`, payload);
  return data;
}
