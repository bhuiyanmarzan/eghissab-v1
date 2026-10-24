-- 000017_audit_outbox_and_jobs.up.sql
BEGIN;

-- 1. Audit Activity Trail
CREATE TABLE IF NOT EXISTS system.audit_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_user_id UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organization.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES store.stores(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    details JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_org ON system.audit_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_store ON system.audit_events(store_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_actor ON system.audit_events(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_action ON system.audit_events(action);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON system.audit_events(created_at DESC);

-- 2. Transactionally Committed Outbox Events
CREATE TABLE IF NOT EXISTS system.outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type VARCHAR(50) NOT NULL,
    aggregate_id UUID NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_outbox_events_aggregate ON system.outbox_events(aggregate_type, aggregate_id);
CREATE INDEX IF NOT EXISTS idx_outbox_events_created ON system.outbox_events(created_at ASC);

-- 3. Consumer Event Deliveries
CREATE TABLE IF NOT EXISTS system.event_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL REFERENCES system.outbox_events(id) ON DELETE CASCADE,
    consumer_name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'delivered', 'failed', 'dead_letter')),
    delivered_at TIMESTAMPTZ,
    last_error TEXT,
    attempt_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_event_consumer UNIQUE (event_id, consumer_name)
);

CREATE INDEX IF NOT EXISTS idx_event_deliveries_pending ON system.event_deliveries(status) WHERE status = 'pending';

-- 4. Background Job Queue
CREATE TABLE IF NOT EXISTS system.jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID REFERENCES system.outbox_events(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    run_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    max_attempts INT NOT NULL DEFAULT 3,
    attempt_count INT NOT NULL DEFAULT 0,
    locked_at TIMESTAMPTZ,
    locked_by VARCHAR(100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_jobs_claim ON system.jobs(status, run_at ASC) WHERE status = 'queued';

-- 5. Persistent Job Attempt History
CREATE TABLE IF NOT EXISTS system.job_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID NOT NULL REFERENCES system.jobs(id) ON DELETE CASCADE,
    attempt_number INT NOT NULL,
    outcome VARCHAR(20) NOT NULL
        CHECK (outcome IN ('success', 'failed', 'retryable_error')),
    error_message TEXT,
    duration_ms INT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    finished_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_job_attempts_job ON system.job_attempts(job_id);

-- 6. File Assets & Private Storage Metadata
CREATE TABLE IF NOT EXISTS system.file_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID REFERENCES invoice.invoices(id) ON DELETE SET NULL,
    organization_id UUID REFERENCES organization.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES store.stores(id) ON DELETE CASCADE,
    storage_key VARCHAR(500) NOT NULL UNIQUE,
    visibility VARCHAR(20) NOT NULL DEFAULT 'private'
        CHECK (visibility IN ('private', 'public', 'tenant')),
    file_name VARCHAR(255) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size BIGINT NOT NULL CHECK (file_size >= 0),
    checksum_sha256 VARCHAR(64),
    uploaded_by UUID REFERENCES identity.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_file_assets_invoice ON system.file_assets(invoice_id);
CREATE INDEX IF NOT EXISTS idx_file_assets_store ON system.file_assets(store_id);

-- 7. Message Notification Deliveries
CREATE TABLE IF NOT EXISTS system.notification_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES system.jobs(id) ON DELETE SET NULL,
    recipient VARCHAR(255) NOT NULL,
    channel VARCHAR(20) NOT NULL
        CHECK (channel IN ('email', 'sms', 'push', 'webhook')),
    template VARCHAR(100) NOT NULL,
    provider VARCHAR(50) NOT NULL,
    provider_message_id VARCHAR(255),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'sent', 'delivered', 'failed')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    delivered_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_notification_deliveries_status ON system.notification_deliveries(status);

-- 8. Webhook Receipts & Deduplication
CREATE TABLE IF NOT EXISTS system.webhook_receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    provider_event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'received'
        CHECK (status IN ('received', 'processing', 'processed', 'ignored', 'failed')),
    processed_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, provider_event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_receipts_provider ON system.webhook_receipts(provider, status);

-- 9. Row-Level Security and Privileges
GRANT USAGE ON SCHEMA system TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA system TO eghissab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA system GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;

ALTER TABLE system.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_policy ON system.audit_events FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.outbox_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.outbox_events FORCE ROW LEVEL SECURITY;
CREATE POLICY outbox_events_policy ON system.outbox_events FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.event_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.event_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY event_deliveries_policy ON system.event_deliveries FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.jobs FORCE ROW LEVEL SECURITY;
CREATE POLICY jobs_policy ON system.jobs FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.job_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.job_attempts FORCE ROW LEVEL SECURITY;
CREATE POLICY job_attempts_policy ON system.job_attempts FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.file_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.file_assets FORCE ROW LEVEL SECURITY;
CREATE POLICY file_assets_policy ON system.file_assets FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.notification_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.notification_deliveries FORCE ROW LEVEL SECURITY;
CREATE POLICY notification_deliveries_policy ON system.notification_deliveries FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE system.webhook_receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system.webhook_receipts FORCE ROW LEVEL SECURITY;
CREATE POLICY webhook_receipts_policy ON system.webhook_receipts FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

COMMIT;
