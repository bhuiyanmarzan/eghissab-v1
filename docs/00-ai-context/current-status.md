# Current status

As of 2026-10-22 (Asia/Dhaka). AUTH-001 and its scoped SEC-001/SEC-002/DB-001 prerequisites are IMPLEMENTED_UNVERIFIED under the user's explicit identity implementation request. No automated tests, migration application, live database queries or SMTP delivery were performed. Existing DOC-001 protected .agents installation blocker remains unchanged.

FACT: complete backend identity lifecycle is composed into cmd/api: register, email verification/resend, bcrypt login, 10-minute JWTs, 30-day rotating refresh families/reuse revocation, authenticated user context/profile, logout/logout-all. Services use existing database/sql TxManager; restricted DB functions reuse existing identity tables. Additive migration 000004 enables/FORCEs identity RLS, restricts grants and introduces rate budgets/session rotation. Runtime rejects privileged credentials/missing auth migration. Compose forwards auth/email settings and development uses the restricted runtime role.

Verification: Go compilation recorded in session history; compilation does not verify migration syntax/execution, actual roles, RLS behavior, refresh races or SMTP. All runtime/security acceptance checks remain outstanding. See [setup](../07-deployment/authentication-setup.md) and [API](../04-api/authentication-api.md).

Existing public listing prototype and its absent table migration remain unresolved. Organization/store membership, billing, invoice, consumers, MFA/recovery/social login, workers, frontend verification page and secret provisioning are not delivered by this backend task. User-reported earlier migrations are not evidence of live schema state. No migration or service was started, and existing .env secrets were untouched.
