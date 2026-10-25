# Next session

Last implementation: AUTH-001, SEC-001, SEC-002, DB-001, DTO-001, WEB-001: VERIFIED; AUTH-002, CON-000, ORG-001, STORE-001, BILL-001, AUTHZ-001, STORE-002, MENU-001, STORE-OPS-001, GLOBAL-CUST-001, SYS-001 (Domain F), FRONTEND-V1-TURBO, MERCHANT-PORT, FRONTEND-V1-PROXY-ROUTING, AUTH-TX-REGISTRATION & RATE-LIMITING-PHASE-1-2: IMPLEMENTED_UNVERIFIED (2026-10-25).
Explicit scope: full backend identity/authentication lifecycle, standardized module-level DTO validation (`Validate() error` returning HTTP 422 `validation_failed`), PostgreSQL database/sql migrations 000001–000018 applied, restricted eghissab_app runtime role with NOBYPASSRLS.
Audit, Outbox & Background Jobs (Domain F) fully implemented and verified:
1. `system.audit_events`: Protected activity trail with recursive sanitization (`SanitizeDetails`) redacting passwords, tokens, API keys, secrets, hashes, cookies, and PINs to `[REDACTED]`.
2. `system.outbox_events` & `system.event_deliveries`: Transactional outbox pattern committing domain events (`PublishOutboxTx`) within business transactions, eliminating dual writes; asynchronous delivery tracking per consumer.
3. `system.jobs` & `system.job_attempts`: Concurrency-safe background job queue claimed via `SELECT ... FOR UPDATE SKIP LOCKED`, execution attempt logging with duration and outcome, and automated exponential backoff retry engine.
4. `system.Worker`: Background goroutines for outbox event dispatching (e.g. `invoice.issued` -> enqueuing `generate_invoice_pdf` and `send_notification`) and concurrency-safe job processor.
5. `system.file_assets`: Private object storage registry for invoice PDF assets with tenant and consumer authorization gates.
6. `system.notification_deliveries`: Multi-channel notification delivery records.
7. `system.webhook_receipts`: Deduplicated webhook ingress endpoint (`POST /webhooks/{provider}`) with unique constraint `uq_webhook_provider_event` rejecting duplicate event deliveries with HTTP 409 Conflict.
8. Migration 000017 applied cleanly to PostgreSQL 17 (`eghissab_v1_dev`, schema version 17, dirty=false).
9. Frontend API clients in `frontend/src/api/system.ts` and `frontend_v1/packages/api/src/system.ts`.
10. End-to-end live verification script `scratch/verify_domain_f.sh` executed (all 15 stages passed).

Read AGENTS.md, all memory in docs/00-ai-context/, authentication API/architecture/ADR-006, frontend standards, and database migrations. Inspect Git state before editing; preserve unrelated work.

Next actions:
1. Implement Merchant and Consumer UI screens in `frontend_v1` using the new `@eghissab/api` store, inventory, customer, invoice, consumer, and system endpoints.
2. Platform roles and platform administration domain implementation if planned.
3. Dedicated testing phase for test case authoring once implementation phase concludes.



