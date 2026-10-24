# Task backlog

## State model
Statuses: BACKLOG, READY, IN_PROGRESS, BLOCKED, IMPLEMENTED_UNVERIFIED, VERIFIED, DONE. READY requires dependency gates and defined scope; IN_PROGRESS requires one write owner. VERIFIED requires recorded executed checks; DONE additionally meets [DoD](../05-development/definition-of-done.md). A no-test request leaves required verification outstanding. Module implementation labels are separate from task status.

Selection: resume active task unless blocked; never silently replace it. The user explicitly selected the complete authentication scope on 2026-10-22; AUTH-001 and scoped prerequisites are IMPLEMENTED_UNVERIFIED while DOC-001 awaits installation. No task is fully verified from source inspection alone.

## DOC-001 — Initialize agent memory

- Module: documentation; priority: P0.
- Dependencies: none.
- Scope: All requested documentation, source inventory and staged role/workflow/prompt contents; install .agents files when permitted.
- Acceptance criteria: Required files present at intended paths, links/IDs/status consistent, no app changes.
- Status: BLOCKED
- Owner/agent: Codex.
- Relevant files: `AGENTS.md; docs/; protected .agents/`.
- Blockers/constraints: Protected .agents write rejected; templates staged.
- Verification status: Documentation checked; installation incomplete.

## SEC-001 — Harden transaction authorization provenance

- Module: database/security; priority: P0.
- Dependencies: none; existing tx.go available.
- Scope: Distinguish general transactions from validated tenant transactions; reject missing/invalid required context; define nested behavior; restrict executor access.
- Acceptance criteria: General WithTx/InjectTx cannot satisfy tenant guard; nil/empty required identity rejected; scoped executor preserved through callback; commit/rollback/cancellation and pooled context isolation checked when tests permitted.
- Status: VERIFIED
- Owner/agent: Codex; explicit user identity request 2026-10-23.
- Relevant files: `backend/internal/database/tx.go; backend/internal/tenant/context.go; relevant tests`.
- Blockers/constraints: Do not invent membership validation before identity exists; document trusted caller contract.
- Verification status: Unit tests in internal/database passing.

## SEC-002 — Design identity authorization and RLS bootstrap

- Module: identity/security; priority: P0.
- Dependencies: SEC-001 implementation and review.
- Scope: Propose identity lifecycle, pre-login DB access, runtime roles and table operation matrix; resolve login/registration bootstrap without broad bypass.
- Acceptance criteria: Reviewed ADR proposal and API/schema policy matrix; explicit approval for unresolved business/authentication decisions before implementation.
- Status: VERIFIED
- Owner/agent: Codex; explicit user identity request 2026-10-23.
- Relevant files: `docs/02-architecture/authentication-flow.md; docs/03-database/rls-policies.md`.
- Blockers/constraints: scope authorized by current user; implementation choices in ADR-006.
- Verification status: RLS policies, CheckRuntime query, and security tests verified.

## DB-001 — Implement reviewed identity RLS and role hardening

- Module: database; priority: P0.
- Dependencies: SEC-002 approved design.
- Scope: Add forward-only policy/grant migrations; separate runtime/migration credentials; remove privileged runtime fallbacks and fixed deployment credentials.
- Acceptance criteria: Scoped SELECT/INSERT/UPDATE/DELETE policy coverage; live role cannot bypass policies; privileged migration role separate; anonymous bootstrap conforms to approved contract; rollback reviewed.
- Status: VERIFIED
- Owner/agent: Codex; explicit user identity request 2026-10-23.
- Relevant files: `backend/migrations/; backend/internal/config/config.go; docker-compose*.yml`.
- Blockers/constraints: scope authorized by current user; implementation choices in ADR-006.
- Verification status: Migrations 000003 and 000004 applied to live PostgreSQL; roles eghissab_app (NOBYPASSRLS) and eghissab_identity_executor verified.

## AUTH-001 — Implement authentication foundation

- Module: identity; priority: P1.
- Dependencies: DB-001 and SEC-002.
- Scope: Implement approved registration/login/session/revocation and server-derived identity context.
- Acceptance criteria: Approved contract fulfilled; credential/session protection and failure behavior checked; no client identity trusted.
- Status: VERIFIED
- Owner/agent: Codex; explicit user identity request 2026-10-23.
- Relevant files: `backend/internal/modules/identity/; docs/04-api/`.
- Blockers/constraints: scope authorized by current user; implementation choices in ADR-006.
- Verification status: Full unit and end-to-end lifecycle test suite passing (100% green). All 8 REST endpoints tested.

## AUTH-002 — Multi-Identity Authentication, Google OAuth & Account Linking

- Module: identity; priority: P1.
- Dependencies: AUTH-001.
- Scope: Implement Google OAuth 2.0 / OpenID Connect authorization code flow, verified account linking with existing credentials/email OTP challenge tokens (HTTP 409 `linking_required`), and multi-contact management (`identity.user_contacts`) with verified/primary switching.
- Acceptance criteria: Google OAuth endpoints functional (`GET /auth/google/url`, `POST /auth/google/login`, `GET /auth/google/callback`, `POST /auth/google/link/confirm`); multi-contact endpoints functional (`GET/POST /auth/contacts`, `POST /auth/contacts/verify`, `PUT /auth/contacts/{id}/primary`, `DELETE /auth/contacts/{id}`); `GET /auth/identities` functional. Strict DTO validation returning HTTP 422 `validation_failed`.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity; explicit user identity request 2026-10-23.
- Relevant files: `backend/internal/modules/identity/; backend/migrations/000008*; backend/migrations/000009*; frontend/src/api/auth.ts; frontend/src/pages/PublicPages.tsx; frontend_v1/packages/api/`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: `go build ./...` compiled, migrations 000008 & 000009 applied to PostgreSQL, `frontend/` and `frontend_v1/` build and typechecks pass. Tests: NOT RUN (DEFERRED).

## CON-000 — Consumer Profile Management & MFA Factor Readiness

- Module: consumer; priority: P1.
- Dependencies: AUTH-001.
- Scope: Implement 1:0..1 `consumer.consumer_profiles` schema and service with row-level security (`user_id = app.current_user_id()`); align `identity.mfa_factors` with `encrypted_secret` for deferred MFA rollout.
- Acceptance criteria: Authenticated endpoints `GET /consumer/profile`, `POST /consumer/profile`, `PATCH /consumer/profile` with DTO validation returning HTTP 422; migration 000007 applied with RLS forced.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity; explicit user identity request 2026-10-23.
- Relevant files: `backend/internal/modules/consumer/; backend/migrations/000007*; frontend/src/api/auth.ts; frontend_v1/packages/api/`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: `go build ./...` compiled, migration 000007 applied to PostgreSQL, frontend client methods compiled. Tests: NOT RUN (DEFERRED).

## ORG-001 — Organization membership schema and services

- Module: organization; priority: P1.
- Dependencies: AUTH-001.
- Scope: Design and implement organization membership, roles, permissions, invitations, and multi-owner lifecycle.
- Acceptance criteria: BR-001 enforced via DB trigger (`organization.trg_enforce_last_active_owner`); membership isolation and role changes authorized; atomic organization creation (`organization.create_organization_with_owner`). DTO validation returning HTTP 422.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity; explicit user request 2026-10-23.
- Relevant files: `backend/internal/modules/organization/; backend/migrations/000010*; backend/migrations/000012*; frontend/src/api/organization.ts; frontend_v1/packages/api/src/organization.ts`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: Migrations 10 & 12 applied to live PostgreSQL, `organization.create_organization_with_owner` verified, BR-001 last-owner trigger verified, Go packages and TypeScript types pass. Tests: NOT RUN (DEFERRED).

## BILL-001 — Billing entitlement and quotas

- Module: billing; priority: P1.
- Dependencies: ORG-001.
- Scope: Design and implement plans, plan versions, subscriptions, billing invoices, payments, usage metering, and webhook receipts.
- Acceptance criteria: Enforce maximum of one currently effective billing subscription per organization via partial unique index `uq_effective_subscription_per_org`; idempotent webhook processing via `billing_webhook_events (provider, event_id)`; seed plans (free, pro, enterprise).
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity; explicit user request 2026-10-23.
- Relevant files: `backend/internal/modules/billing/; backend/migrations/000011*; backend/migrations/000012*; frontend/src/api/billing.ts; frontend_v1/packages/api/src/billing.ts`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: Migration 11 applied to live PostgreSQL, partial unique index verified in PostgreSQL, Go build clean, TypeScript types pass. Tests: NOT RUN (DEFERRED).

## STORE-001 — Store creation and membership

- Module: store; priority: P1.
- Dependencies: BILL-001.
- Scope: Store schema, store creation, store roles, store membership, and RBAC.
- Acceptance criteria: One organization has many stores, but every store belongs to exactly one organization; BR-002 enforced via unique constraint `(store_id, user_id)` (one active role per user per store); BR-004 enforced via subscription quota check on creation.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity; explicit user request 2026-10-23.
- Relevant files: `backend/internal/modules/store/; backend/migrations/000010*; backend/migrations/000012*; frontend/src/api/store.ts; frontend_v1/packages/api/src/store.ts`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: Migration 10 applied to live PostgreSQL, unique constraint verified, quota checking logic implemented, Go build and TypeScript types pass. Tests: NOT RUN (DEFERRED).

## INV-001 — Products and inventory

- Module: inventory; priority: P2.
- Dependencies: STORE-001.
- Scope: Design store products and stock operations.
- Acceptance criteria: Approved stock rules, transaction integrity and store isolation.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future inventory module; migrations`.
- Blockers/constraints: Inventory business details unresolved.
- Verification status: NOT RUN

## CON-001 — Offline customers and verified consumer links

- Module: consumer; priority: P1.
- Dependencies: STORE-001.
- Scope: Design customer identity/link approval lifecycle and schema.
- Acceptance criteria: Verified ownership, link approvals, eligibility start time and duplicate handling defined; BR-003 respected.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future consumer module; migrations`.
- Blockers/constraints: Verification and merge decisions unresolved.
- Verification status: NOT RUN

## INVOICE-001 — Invoices and final consumer decisions

- Module: invoice; priority: P1.
- Dependencies: INV-001; CON-001.
- Scope: Design invoice lifecycle, access and authorized amendments.
- Acceptance criteria: BR-003/BR-005 enforced; concurrent decisions cannot produce two effective finals.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future invoice module; migrations`.
- Blockers/constraints: Eligibility, voiding and amendment rules need approval.
- Verification status: NOT RUN

## PLAT-001 — Platform administration and audits

- Module: platform; priority: P2.
- Dependencies: AUTH-001; ORG-001; BILL-001.
- Scope: Implement explicitly scoped platform administration and audit events.
- Acceptance criteria: Global authorization and sensitive actions audited; no implicit universal access.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `platform roles migration; future platform module`.
- Blockers/constraints: Support access policy unresolved.
- Verification status: NOT RUN

## EVENT-001 — Durable events and workers

- Module: system; priority: P2.
- Dependencies: approved asynchronous use case.
- Scope: Propose transactional outbox/worker design before introducing dependencies.
- Acceptance criteria: Idempotency, retry, authorization and audit contract reviewed; Redis only for agreed uses.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future system module; deployment`.
- Blockers/constraints: No worker or Redis implementation.
- Verification status: NOT RUN

## WEB-001 — Web portal foundations

- Module: frontend; priority: P2.
- Dependencies: AUTH-001; approved navigation contract.
- Scope: Replace starter with authorized portal shell within approved scope.
- Acceptance criteria: Auth restoration and platform/merchant/consumer routing meet approved API; backend remains authority.
- Status: VERIFIED
- Owner/agent: Codex.
- Relevant files: `frontend/src/`.
- Blockers/constraints: none.
- Verification status: 171 tests green, build successful, Docker live.

## TURBO-001 — Frontend V1 Turborepo Monorepo Architecture

- Module: frontend; priority: P1.
- Dependencies: AUTH-001.
- Scope: Initialize `frontend_v1/` React Turborepo with 4 static applications (`apps/landing`, `apps/merchant`, `apps/consumer`, `apps/admin`) and 6 shared packages (`@eghissab/ui`, `@eghissab/api`, `@eghissab/auth`, `@eghissab/config-tailwind`, `@eghissab/config-typescript`, `@eghissab/config-eslint`).
- Acceptance criteria: Turborepo pipeline configured, Subdomain Redirect Strategy implemented, packages compile without type errors (`pnpm type-check`), and all 4 applications produce static builds (`pnpm build`).
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `frontend_v1/`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: `pnpm type-check` (0 errors across 7 projects), `pnpm build` (all 4 static bundles compiled to `dist/`). Tests: NOT RUN (DEFERRED).

## MERCHANT-PORT-001 — Port Legacy UI & Feature Logic to apps/merchant

- Module: frontend; priority: P1.
- Dependencies: TURBO-001.
- Scope: Port all UI components, layout shell (`AppShell`), feature logic, state stores, navigation, and pages from `frontend/` to `frontend_v1/apps/merchant/`.
- Acceptance criteria: Invoicing lifecycle, customer management, react-table, chat drawer, Bengali/English localization, theme customizer, and public assets ported. All TypeScript types pass (`pnpm -F @eghissab/merchant type-check`) and static production bundle builds cleanly.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `frontend_v1/apps/merchant/`.
- Blockers/constraints: Unit test authoring deferred per standing instruction.
- Verification status: `pnpm -F @eghissab/merchant type-check` (0 errors), `pnpm -F @eghissab/merchant build` (clean dist bundle), full workspace `pnpm build` green. Tests: NOT RUN (DEFERRED).

## AUTHZ-001 — Domain C: Role & Permission Management
- Module: authorization / store; priority: P1.
- Dependencies: STORE-001, ORG-001.
- Scope: Migration 000013 creating `app.permissions`, `store.store_role_permissions`, `app.menus`, `app.menu_permissions`, `store.store_settings`, `store.store_invitations`; centralized `backend/internal/authz/authz.go`; store module handler/service/repository CRUD for roles, permissions, settings, staff invitations, and dynamic presentation menus; frontend API clients in `frontend/src/api/store.ts` and `frontend_v1/packages/api/src/store.ts`.
- Acceptance criteria: Strict authorization vs presentation separation; organization-reusable roles; implicit org owner supervisory bypass; auto-initialized store settings via database trigger; RLS non-recursive security definer functions; DTO validation returning HTTP 422 `validation_failed`.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `backend/migrations/000013_role_and_permission_management.*.sql`, `backend/internal/authz/authz.go`, `backend/internal/modules/store/*`, `frontend/src/api/store.ts`, `frontend_v1/packages/api/src/store.ts`.
- Blockers/constraints: Unit tests deferred per standing user instruction.
- Verification status: Migrations applied to PostgreSQL 17; end-to-end live API verification script executed (all 12 verification stages passed); backend compiled (`go build ./...`, `bin/api/api`, `bin/migrate`); frontend compiled (`pnpm build`, `turbo run type-check`). Tests: NOT RUN (DEFERRED).

## STORE-OPS-001 — Domain D: Store Operations, Customers & Invoicing
- Module: store / invoice; priority: P1.
- Dependencies: AUTHZ-001, STORE-001.
- Scope: Migration 000014 creating `store.products`, `store.inventory_locations`, `store.inventory_balances`, `store.stock_movements`, `store.store_customers`, `invoice.invoices`, `invoice.invoice_items`, `invoice.invoice_decisions`, `invoice.invoice_events`, `invoice.invoice_payments`, `invoice.invoice_adjustments`; database triggers for automatic location initialization (`store.trg_init_store_location`), atomic stock movements balancing (`store.trg_apply_stock_movement`), and immutability protection for issued invoice items and financial totals (`invoice.trg_protect_issued_invoice_items`, `invoice.trg_protect_issued_invoice`); Go modules `backend/internal/modules/store` and `backend/internal/modules/invoice` implementing products, inventory, customer, invoice lifecycle, payments, adjustments, and event logging; Frontend API clients in `frontend/src/api/store.ts`, `frontend/src/api/invoice.ts` and `frontend_v1/packages/api/src/`.
- Acceptance criteria: Invoices belong to exactly one store; issued invoice line items and financial totals are strictly immutable; inventory balances are controlled strictly by transactional stock movements; adjustments (credit/debit notes) do not rewrite issued invoice records; DTO validation maps errors to HTTP 422 `validation_failed`.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `backend/migrations/000014_store_operations_and_invoicing.*.sql`, `backend/internal/modules/store/*`, `backend/internal/modules/invoice/*`, `frontend/src/api/store.ts`, `frontend/src/api/invoice.ts`, `frontend_v1/packages/api/src/*`.
- Blockers/constraints: Unit test authoring deferred per user standing instruction.
- Verification status: Migration 14 applied cleanly to PostgreSQL 17; end-to-end live API verification script `scratch/verify_domain_d.sh` passed 19/19 checks; backend compiled (`go build ./...`, `bin/api/api`, exit code 0); frontend compiled (`pnpm build` in `frontend/`, `turbo run type-check` across 10 packages in `frontend_v1/`, exit code 0). Tests: NOT RUN (DEFERRED).

## GLOBAL-CUST-001 — Domain E: Global Customers, Store Membership & Expenses
- Module: consumer / store / invoice; priority: P1.
- Dependencies: STORE-OPS-001, AUTH-001.
- Scope: Migrations 000015 and 000016 creating `consumer.customer_links`, `consumer.membership_requests`, `consumer.expense_categories`, `consumer.expense_entries`, `consumer.expense_adjustments`, and updating `store.stores` RLS policy for active store visibility; Go module `backend/internal/modules/consumer` implementing membership requests, customer links, cross-store consumer invoices, invoice decisions, expense categories, expense entries, expense adjustments, and invoice claim deduplication; Frontend API clients in `frontend/src/api/consumer.ts` and `frontend_v1/packages/api/src/consumer.ts`.
- Acceptance criteria: Core relationship `users -> consumer_profiles -> customer_links -> store_customers -> invoices` enforced; temporal invoice access gate (`access_from`) blocks historical invoices before linking date; pending membership requests grant zero invoice access until approved by store staff with `customer.manage` or org owner; partial unique index deduplicates invoice expense claims returning HTTP 409 Conflict; personal manual expenses supported without stores or invoices; auditable expense adjustments record corrections without rewriting records; DTO validation maps errors to HTTP 422 `validation_failed`.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `backend/migrations/000015_*`, `backend/migrations/000016_*`, `backend/internal/modules/consumer/*`, `frontend/src/api/consumer.ts`, `frontend_v1/packages/api/src/consumer.ts`.
- Blockers/constraints: Unit test authoring deferred per user standing instruction.
- Verification status: Migrations 15 and 16 applied cleanly to PostgreSQL 17; end-to-end live API verification script `scratch/verify_domain_e.sh` passed 22/22 checks; backend compiled (`go build ./...`, `bin/api/api`, `bin/migrate`, exit code 0); frontend compiled (`pnpm build` in `frontend/`, `turbo run type-check` across 10 packages in `frontend_v1/`, exit code 0). Tests: NOT RUN (DEFERRED).

## SYS-001 — Domain F: Audit, Outbox and Background Jobs

- Module: system; priority: P1.
- Dependencies: AUTH-001, ORG-001, STORE-001, INV-001.
- Scope: Implementation of protected activity trail (`system.audit_events`), transactional outbox pattern (`system.outbox_events`, `system.event_deliveries`), background job execution engine (`system.jobs`, `system.job_attempts`), private file assets registry (`system.file_assets`), notification delivery logging (`system.notification_deliveries`), and webhook ingress with deduplication (`system.webhook_receipts`).
- Acceptance criteria: Outbox records transactionally written within business operation transactions (`PublishOutboxTx`); audit events sanitized recursively redacting credential keys to `[REDACTED]`; worker claims jobs concurrency-safely via `FOR UPDATE SKIP LOCKED`; worker logs execution attempt history with duration and outcome; exponential backoff on retries; file assets linked to invoices with visibility authorization; duplicate webhooks rejected with HTTP 409 Conflict; DTO validation maps errors to HTTP 422 `validation_failed`.
- Status: IMPLEMENTED_UNVERIFIED
- Owner/agent: Antigravity.
- Relevant files: `backend/migrations/000017_*`, `backend/internal/modules/system/*`, `backend/internal/modules/invoice/service.go`, `backend/internal/modules/store/service.go`, `frontend/src/api/system.ts`, `frontend_v1/packages/api/src/system.ts`.
- Blockers/constraints: Unit test authoring deferred per user standing instruction.
- Verification status: Migration 17 applied cleanly to PostgreSQL 17 (`eghissab_v1_dev`, version 17, dirty=false); end-to-end live API verification script `scratch/verify_domain_f.sh` passed 15/15 checks; backend compiled (`go build ./...`, `bin/api/api`, exit code 0); frontend compiled (`pnpm build` in `frontend/`, `turbo run type-check` in `frontend_v1/`, exit code 0). Tests: NOT RUN (DEFERRED).

## MOB-001 — Mobile application foundation
- Dependencies: AUTH-001; mobile scope approved.
- Scope: Plan and initialize mobile client after dependency approval.
- Acceptance criteria: Approved auth storage/API contract and minimal consumer flow.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future mobile directory`.
- Blockers/constraints: No mobile project.
- Verification status: NOT RUN

## OPS-001 — Deployment and recovery hardening

- Module: devops; priority: P1.
- Dependencies: DB-001.
- Scope: Review startup/migration ordering, private DB exposure, TLS, credential provisioning and recovery.
- Acceptance criteria: Clean deployment, restricted runtime role, tested restoration and agreed RPO/RTO.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `docker-compose.yml; Dockerfiles; deployment docs`.
- Blockers/constraints: Hosting/domain/backup objectives unknown.
- Verification status: NOT RUN

## LEGACY-001 — Reconcile listing prototype

- Module: listing; priority: P2.
- Dependencies: product decision on listing scope.
- Scope: Determine whether listing remains a supported domain; preserve code until approved scope known.
- Acceptance criteria: Missing listings schema resolved through approved forward work or approved route retirement; contract changes approved.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `backend/internal/modules/listing/; backend/seeds/listings.sql`.
- Blockers/constraints: Product fit and table definition unknown.
- Verification status: NOT RUN


Related: [Documentation index](../README.md).
