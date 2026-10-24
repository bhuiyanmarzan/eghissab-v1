-- 000011_billing_schema.up.sql

-- 1. Plans
CREATE TABLE IF NOT EXISTS billing.plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- 2. Plan Versions
CREATE TABLE IF NOT EXISTS billing.plan_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID NOT NULL REFERENCES billing.plans(id) ON DELETE CASCADE,
    version INT NOT NULL,
    price_minor BIGINT NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    billing_interval VARCHAR(20) NOT NULL DEFAULT 'month'
        CHECK (billing_interval IN ('month', 'year', 'lifetime', 'free')),
    limits JSONB NOT NULL DEFAULT '{"max_stores": 1, "max_staff_per_store": 3, "max_invoices_per_month": 500}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_plan_version UNIQUE (plan_id, version)
);

CREATE INDEX IF NOT EXISTS idx_plan_versions_plan ON billing.plan_versions(plan_id);

-- 3. Subscriptions (with partial unique index for at most one effective subscription per org)
CREATE TABLE IF NOT EXISTS billing.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    plan_version_id UUID NOT NULL REFERENCES billing.plan_versions(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_org ON billing.subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON billing.subscriptions(status);

-- CRITICAL: Maximum of one currently effective billing subscription per organization
CREATE UNIQUE INDEX IF NOT EXISTS uq_effective_subscription_per_org
ON billing.subscriptions (organization_id)
WHERE status IN ('active', 'trialing', 'past_due');

-- 4. Billing Invoices
CREATE TABLE IF NOT EXISTS billing.billing_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscription_id UUID NOT NULL REFERENCES billing.subscriptions(id) ON DELETE CASCADE,
    amount_minor BIGINT NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
    provider_reference VARCHAR(255),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    due_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_billing_invoices_sub ON billing.billing_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_status ON billing.billing_invoices(status);

-- 5. Billing Payments
CREATE TABLE IF NOT EXISTS billing.billing_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    billing_invoice_id UUID NOT NULL REFERENCES billing.billing_invoices(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    provider_transaction_id VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
    amount_minor BIGINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_billing_payments_invoice ON billing.billing_payments(billing_invoice_id);

-- 6. Usage Records (Idempotent by source_key)
CREATE TABLE IF NOT EXISTS billing.usage_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    store_id UUID REFERENCES store.stores(id) ON DELETE CASCADE,
    metric VARCHAR(64) NOT NULL,
    quantity BIGINT NOT NULL DEFAULT 1,
    source_key VARCHAR(128) NOT NULL UNIQUE,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_usage_records_org ON billing.usage_records(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_store ON billing.usage_records(store_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_metric ON billing.usage_records(metric);

-- 7. Billing Webhook Events (Durable idempotent receipts)
CREATE TABLE IF NOT EXISTS billing.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_webhook_events_provider ON billing.billing_webhook_events(provider);
CREATE INDEX IF NOT EXISTS idx_webhook_events_status ON billing.billing_webhook_events(status);

-- 8. Seed Default Plans & Versions
DO $$
DECLARE
    v_free_id UUID;
    v_pro_id UUID;
    v_ent_id UUID;
BEGIN
    -- Free plan
    INSERT INTO billing.plans (code, name, status)
    VALUES ('free', 'Free Starter', 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_free_id;

    INSERT INTO billing.plan_versions (plan_id, version, price_minor, currency, billing_interval, limits)
    VALUES (v_free_id, 1, 0, 'BDT', 'free', '{"max_stores": 1, "max_staff_per_store": 3, "max_invoices_per_month": 500}'::jsonb)
    ON CONFLICT (plan_id, version) DO NOTHING;

    -- Pro plan
    INSERT INTO billing.plans (code, name, status)
    VALUES ('pro', 'Professional Merchant', 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_pro_id;

    INSERT INTO billing.plan_versions (plan_id, version, price_minor, currency, billing_interval, limits)
    VALUES (v_pro_id, 1, 99900, 'BDT', 'month', '{"max_stores": 5, "max_staff_per_store": 20, "max_invoices_per_month": 10000}'::jsonb)
    ON CONFLICT (plan_id, version) DO NOTHING;

    -- Enterprise plan
    INSERT INTO billing.plans (code, name, status)
    VALUES ('enterprise', 'Enterprise Fleet', 'active')
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO v_ent_id;

    INSERT INTO billing.plan_versions (plan_id, version, price_minor, currency, billing_interval, limits)
    VALUES (v_ent_id, 1, 499900, 'BDT', 'month', '{"max_stores": 999, "max_staff_per_store": 999, "max_invoices_per_month": 999999}'::jsonb)
    ON CONFLICT (plan_id, version) DO NOTHING;
END $$;
