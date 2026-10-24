-- 000017_audit_outbox_and_jobs.down.sql
BEGIN;

DROP TABLE IF EXISTS system.webhook_receipts CASCADE;
DROP TABLE IF EXISTS system.notification_deliveries CASCADE;
DROP TABLE IF EXISTS system.file_assets CASCADE;
DROP TABLE IF EXISTS system.job_attempts CASCADE;
DROP TABLE IF EXISTS system.jobs CASCADE;
DROP TABLE IF EXISTS system.event_deliveries CASCADE;
DROP TABLE IF EXISTS system.outbox_events CASCADE;
DROP TABLE IF EXISTS system.audit_events CASCADE;

COMMIT;
