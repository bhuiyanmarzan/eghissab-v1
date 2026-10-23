# Known issues

## Confirmed source defects and gaps
- ISSUE-001 (P0, DB-001): no ENABLE/FORCE RLS or CREATE POLICY in migrations 000001–000003. NOBYPASSRLS alone supplies no row filtering. Identity/platform tables receive broad application DML grants.
- ISSUE-002 (P0, SEC-001): `backend/internal/database/tx.go` uses one executor key for WithTx and WithTenantTx. TenantTxFromContext/GetExecutor accept any injected DBTX; no proof RLS settings were applied. `WithTenantTx` accepts non-nil context with zero identities. Source-confirmed; exploit/runtime reproduction NOT RUN.
- ISSUE-003 (P1, LEGACY-001): listing repository and seed reference unqualified `listings`; no migration defines it. Clean migration set cannot create the required relation. Live database UNKNOWN.
- ISSUE-004 (P0, DB-001): development Compose supplies POSTGRES_USER credentials to runtime; config falls back to them and root sample uses them. Production Compose separates app credentials but migration fixes a default password and only sets NOBYPASSRLS on existing roles; it does not enforce NOSUPERUSER. Actual role state UNKNOWN.
- ISSUE-005 (P2, later pool maintenance): `backend/internal/database/db.go` returns on PingContext error without closing opened pool.
- ISSUE-006 (P1, DB-001): role down migration does not reverse ALTER DEFAULT PRIVILEGES, which can leave role dependencies; rollback execution NOT RUN.

## Architectural conflicts
- Listing routes are unauthenticated and use non-tenant repository (`listing/module.go`, `cmd/api/main.go`), conflicting with target store isolation if used for store data. Product role is unresolved; do not silently assign it to inventory.
- User-reported migration completion is not evidence of organization/store/invoice schemas: only empty namespaces exist for them.

## Suspected risks requiring reproduction
- Root deploy starts services before migrations; a fresh database may fail app-role connection until provisioning (OPS-001).
- POSTGRES_PORT maps host/container to the same configurable port, but server runs default 5432; non-default setting may break connectivity (OPS-001).
- Build/toolchain/image availability and lockfile compatibility unverified; do not call them confirmed failures.

## Technical debt / missing design
Legacy compatibility wrappers; tutorial backend README; starter frontend; no auth/RBAC middleware, audit pipeline, Redis, workers or backup automation. Default credential examples must never be treated as production secrets. Link verification, amendment authority, billing lifecycle and support privileges remain unresolved.


Related: [Documentation index](../README.md).

## 2026-10-22 authentication implementation follow-up

ISSUE-001: identity RLS and scoped grants added in migration 000004, not yet applied/verified. Platform runtime grants revoked; future domain policies remain pending. ISSUE-002: generic/scoped executor provenance, required IDs and nesting hardened; unverified. ISSUE-004: runtime fallback removed, development uses app role and startup rejects privileged role; historical fixed migration password still needs administrative rotation. ISSUE-005: pool closed on failed ping. ISSUE-003/listing and ISSUE-006/historical rollback defaults remain open.

AUTH-001 remains IMPLEMENTED_UNVERIFIED. Required checks: SQL migration execution/role ownership/RLS denial, complete lifecycle, refresh concurrency/reuse and logout races, verification attempts/expiry, SMTP delivery and trusted proxy spoofing. Existing transaction tests were not run or updated; expectations may need reconciliation with the tightened contract when testing is authorized. No production-readiness claim.

Operational follow-ups: frontend verification landing page; configure HTTPS, signing key, SMTP and runtime credentials; maintenance retention for spent sessions/challenges/rate counters; historical broad default privileges need review in every future migration; no durable SMTP outbox/multi-key rollout. Synchronous mail errors can disclose eligibility during outages. See ../07-deployment/authentication-setup.md.
