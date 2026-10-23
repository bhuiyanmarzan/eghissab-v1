# Module registry

## 2026-10-22 authentication update

Identity is now IMPLEMENTED_UNVERIFIED with eight auth routes, RLS/bootstrap functions and SMTP delivery; infrastructure guards are hardened. The table below preserves the earlier baseline; see ../08-modules/identity.md for current identity interfaces.


Status describes source completeness, never test success. Ownership is a responsibility, not a write lock. Owners for unassigned work are unassigned.

| Module | Purpose | Owner | Dependencies | Public interfaces | Database tables | Status | Evidence / issues |
|---|---|---|---|---|---|---|---|
| [infrastructure](../08-modules/infrastructure.md) | SQL pool, config, transaction and HTTP foundations | backend role; task owner unassigned | none (shared infrastructure) | ConnectWithPool, TxManager, DBTX, tenant.Context | none | PARTIALLY_IMPLEMENTED | `backend/internal/database/; backend/internal/config/; backend/internal/tenant/`; SEC-001, DB-001, OPS-001 |
| [health](../08-modules/health.md) | Liveness endpoint | backend role; task owner unassigned | net/http | GET /healthz | none | IMPLEMENTED | `backend/internal/modules/health/`; No readiness check; runtime unverified |
| [listing](../08-modules/listing.md) | Existing marketplace prototype | backend role; task owner unassigned | database, httpx, middleware | Service/Repository; GET/POST /listings; DELETE /listings/{id} | listings referenced but definition absent | PARTIALLY_IMPLEMENTED | `backend/internal/modules/listing/`; LEGACY-001 |
| [identity](../08-modules/identity.md) | Shared identities, contacts, credentials and sessions | backend role; task owner unassigned | infrastructure | none registered | identity.users, user_contacts, user_identities, user_sessions, mfa_factors, verification_challenges | PARTIALLY_IMPLEMENTED | `backend/migrations/000002_create_identity.up.sql`; SEC-002, DB-001, AUTH-001 |
| [platform](../08-modules/platform.md) | Platform roles, administration and audits | backend role; task owner unassigned | identity; target organization, billing | none registered | platform.roles, role_assignments | PARTIALLY_IMPLEMENTED | `backend/migrations/000002_create_identity.up.sql`; PLAT-001 |
| [organization](../08-modules/organization.md) | Organization ownership and membership | backend role; task owner unassigned | identity | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; ORG-001 |
| [billing](../08-modules/billing.md) | Plans, subscription, entitlement and quotas | backend role; task owner unassigned | organization | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; BILL-001 |
| [store](../08-modules/store.md) | Isolated stores, employees and roles | backend role; task owner unassigned | organization, billing, identity | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; STORE-001 |
| [inventory](../08-modules/inventory.md) | Products and inventory | backend role; task owner unassigned | store | none | none; no inventory namespace | PLANNED | `docs/01-product/scope.md`; INV-001 |
| [consumer](../08-modules/consumer.md) | Offline customers, verified links and personal expenses | backend role; task owner unassigned | identity, store | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; CON-001 |
| [invoice](../08-modules/invoice.md) | Store invoices and customer decisions | backend role; task owner unassigned | store, inventory, consumer | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; INVOICE-001 |
| [system](../08-modules/system.md) | Durable events, workers and audit infrastructure | backend role; task owner unassigned | explicit domain event contracts | none | none; namespace only | PLANNED | `backend/migrations/000001_create_foundation.up.sql`; EVENT-001 |
| [frontend](../08-modules/frontend.md) | Web portals | frontend role; task owner unassigned | target authenticated API | starter React component only | none | PARTIALLY_IMPLEMENTED | `frontend/src/App.tsx`; WEB-001 |
| [mobile](../08-modules/mobile.md) | Expo client | mobile role; task owner unassigned | target authenticated API | none | none | PLANNED | `docs/01-product/scope.md`; MOB-001 |


Related: [Documentation index](../README.md).
