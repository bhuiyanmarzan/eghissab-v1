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

## ORG-001 — Organization membership schema and services

- Module: organization; priority: P1.
- Dependencies: AUTH-001.
- Scope: Design then add organization membership and multi-owner lifecycle.
- Acceptance criteria: BR-001 enforced atomically; membership isolation and role changes authorized; schema/API review completed.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `backend/migrations/; future organization module`.
- Blockers/constraints: Schema absent.
- Verification status: NOT RUN

## BILL-001 — Billing entitlement and quotas

- Module: billing; priority: P1.
- Dependencies: ORG-001.
- Scope: Design plans/subscriptions/trials and quota checks.
- Acceptance criteria: Approved lifecycle, concurrency and entitlement behavior documented and implemented.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future billing module; migrations`.
- Blockers/constraints: Billing lifecycle/provider decisions unresolved.
- Verification status: NOT RUN

## STORE-001 — Store creation and membership

- Module: store; priority: P1.
- Dependencies: BILL-001.
- Scope: Store schema, creation, membership and RBAC.
- Acceptance criteria: BR-002/BR-004 enforced; quotas atomic; cross-store isolation verified.
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `future store module; migrations`.
- Blockers/constraints: Dependent domain schemas absent.
- Verification status: NOT RUN

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
- Status: BACKLOG
- Owner/agent: unassigned.
- Relevant files: `frontend/src/`.
- Blockers/constraints: No auth or portal API yet.
- Verification status: NOT RUN

## MOB-001 — Expo client foundation

- Module: mobile; priority: P3.
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
