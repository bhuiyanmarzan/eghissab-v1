# Authentication flow

Implemented for the explicit 2026-10-22 user request: registration, email verification, password login, JWT access tokens, rotating refresh sessions, authenticated identity and logout. Status: IMPLEMENTED_UNVERIFIED.

The module lives in backend/internal/modules/identity. cmd/api composes a service, database/sql repository, injectable VerificationMailer and verified-STARTTLS SMTP adapter. HTTP handlers validate input and map domain errors into existing httpx envelopes. Services own transaction boundaries through the existing TxManager. Repository methods require a transaction from context; no second SQL pool or ORM is introduced.

Pre-auth operations use narrowly named SECURITY DEFINER functions owned by the dedicated NOLOGIN/NOBYPASSRLS identity executor. Runtime cannot directly read credentials or modify identity/session/challenge tables. All seven identity tables ENABLE/FORCE RLS; own profile/contact SELECT uses transaction-local app.user_id. The executor has explicit policies and table privileges limited to identity. The database trusts the API to validate passwords/JWTs before invoking authenticated operations; these functions are an application boundary, not independent cryptographic attestation of an untrusted runtime process.

Authenticated middleware derives Principal only from a validated JWT plus live session state. No request-supplied user/organization/store IDs become authority. GET /auth/me sets only the authenticated user transaction-locally; global identities need no organization. Tenant transactions now have a distinct authorization marker tied to the captured scope, reject empty required IDs and reject nesting. Membership resolution remains the responsibility of future organization/store services.

See [API/security behavior](../04-api/authentication-api.md), [RLS matrix](../03-database/rls-policies.md), [implementation decision](adr/adr-006.md) and [setup](../07-deployment/authentication-setup.md).
