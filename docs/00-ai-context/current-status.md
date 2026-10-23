# Current status

As of 2026-10-23 (Asia/Dhaka). AUTH-001 and its scoped SEC-001/SEC-002/DB-001 prerequisites are VERIFIED. Automated tests, migration application to PostgreSQL, live role/RLS verification, and full lifecycle tests were executed successfully. Existing DOC-001 protected .agents installation blocker remains unchanged.

FACT: complete backend identity lifecycle is composed and operational in cmd/api:
1. User registration: module-level `RegisterRequest` DTO validation returning `ValidationError` (field-level 422 `validation_failed`), bcrypt cost 12 password hashing, advisory locks, duplicate account handling, and atomic DB transactions.
2. Email verification: 30-minute expiry, single-use SHA-256 tokens, 5-attempt brute-force protection, SMTP delivery with LogMailer dev fallback, and 60-second cooldown resend.
3. Login: credential validation, constant-time dummy hash comparison for non-existent accounts, active status verification, and session creation.
4. JWT authentication: 10-minute short-lived HMAC-SHA256 access tokens with strict header, claims (iss, aud, sub, sid, jti, iat, exp), and signature verification.
5. Refresh-token lifecycle: HttpOnly cookies with SameSite=Lax and Path=/auth, atomic rotation, reuse detection immediately revoking entire family, and 30-day fixed expiry.
6. Authenticated user context: RequireAuth middleware verifying live database session, GET /auth/me current-user profile endpoint, and tenant.Context integration with UserID.
7. Logout: revoke current session family, clear refresh cookie (Max-Age: -1), and POST /auth/logout-all to revoke all sessions across all devices.
8. PostgreSQL integration: database/sql connection pool, migrations 000001–000004 applied, unprivileged eghissab_app role with NOBYPASSRLS, and transaction-scoped RLS via set_config.
9. API integration: REST routes, handlers, services, repositories, module DTO validation (`Validate() error`), and consistent httpx error envelope.

Verification: All Go tests in internal/database, internal/modules/identity (including 20 DTO unit tests and 422 handler tests), and internal/modules/listing pass. Migrations 000003 and 000004 applied to database eghissab_v1_dev (version 4, dirty=false). Live role and RLS verification confirmed via CheckRuntime. Binaries bin/api and bin/migrate compile cleanly. AGENTS.md, go-standards.md, frontend-standards.md, frontend role, and frontend workflow updated with full project awareness.

Frontend template: Configured in `frontend/` using Vite 7 + React 19 + Tailwind CSS v4 + shadcn/ui + React Router DOM v7 + TanStack React Query v5 + React Hook Form v7 + Zod v4 + Zustand v5 + TanStack React Table v8. Agent role, workflow, and coding standards are documented and active.

Next priority: ORG-001 (organization membership and multi-store schema/services) / WEB-001 (frontend auth page integration).
