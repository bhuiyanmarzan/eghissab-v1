-- 000011_billing_schema.down.sql

DROP TABLE IF EXISTS billing.billing_webhook_events CASCADE;
DROP TABLE IF EXISTS billing.usage_records CASCADE;
DROP TABLE IF EXISTS billing.billing_payments CASCADE;
DROP TABLE IF EXISTS billing.billing_invoices CASCADE;
DROP TABLE IF EXISTS billing.subscriptions CASCADE;
DROP TABLE IF EXISTS billing.plan_versions CASCADE;
DROP TABLE IF EXISTS billing.plans CASCADE;
