# Identity & Authentication API

Status: IMPLEMENTED_UNVERIFIED, 2026-10-22. Direct Go paths below; Nginx exposes them under `/api`. Bodies require `application/json`, one JSON object, no unknown fields, at most 16 KiB. Errors use the existing `{ "error": { "code", "message" } }` envelope. Auth responses use `Cache-Control: no-store`.

| Method/path | Body / authorization | Result |
|---|---|---|
| POST /auth/register | email, first_name, optional last_name, password | 202 generic accepted; pending account and verification email if new |
| POST /auth/resend-verification | email | 202 generic accepted; replacement challenge when eligible and cooldown elapsed |
| POST /auth/verify-email | token | 200 email verified; invalid/expired/used/locked token returns 401 |
| POST /auth/login | email, password | 200 access_token, refresh_token, token_type=Bearer, expires_in=600 |
| POST /auth/refresh | refresh_token | 200 rotated token pair; old refresh token is permanently spent |
| GET /auth/me | Authorization: Bearer access_token | 200 id, first_name, last_name, email, status |
| POST /auth/logout | Authorization: Bearer access_token; no body | 204; revokes the current refresh family |
| POST /auth/logout-all | Authorization: Bearer access_token; no body | 204; revokes every session belonging to this user |

Email normalization trims and lowercases the complete address. Names allow at most 120 Unicode characters; first_name is required. Passwords use bcrypt cost 12, accept 12–72 UTF-8 bytes, and are never trimmed or truncated. Invalid credentials, pending/unverified/suspended/disabled accounts and invalid tokens share 401 unauthenticated. Invalid input returns 400 validation_failed. Rate limits return 429 rate_limited with Retry-After: 900. Database failures return 500 internal_error without details. Mail delivery failures return 503 delivery_unavailable: registration remains committed; retry `/auth/resend-verification` after one minute. Delivery errors can reveal eligibility during an SMTP outage; generic success responses do not guarantee timing-indistinguishability.

Access JWTs use HS256, a configured issuer/audience and a signing key of at least 32 random bytes (standard base64). Validate exact algorithm/header, signature, subject/session/JTI UUIDs, issuer, audience, iat/nbf/exp and maximum 10-minute lifetime. Every protected request additionally verifies an active, unrotated, unrevoked, unexpired session and active user in PostgreSQL. Logout and refresh invalidate earlier access tokens on subsequent requests; already in-flight operations may finish.

Refresh tokens contain 256 random bits; only SHA-256 hashes are stored. Sessions rotate atomically under a user-row lock, retain spent hashes, and share the original 30-day absolute expiry (no sliding renewal). Reuse commits revocation of the entire family before returning 401. Clients must serialize refresh requests: simultaneous uses intentionally trigger reuse protection. A lost rotation response requires login again; blindly retrying the old refresh token revokes the family.

Verification tokens contain a challenge UUID and 256-bit secret. Only the secret hash is stored; challenges expire after 30 minutes, allow five failed attempts, are single-use and purpose-bound. Resend consumes prior challenges and has a 60-second cooldown. Contact verification and pending→active transition are atomic. Login requires active user, active credentials and a verified email.

Registration/login/resend have per-email limits of ten requests per 15 minutes; registration/login/resend/verification also have per-client-IP limits of ten requests per 15 minutes. Counters are hashed and persisted across processes. Set AUTH_TRUSTED_PROXY_CIDRS to only the actual proxy networks; forwarded addresses are walked from right to left through trusted hops. With no trusted proxies configured, peer IP is used (a shared proxy shares its budget). Never trust arbitrary forwarded headers or broad public network CIDRs.

Tokens are returned in JSON, never cookies. Browser clients should keep tokens in memory; mobile clients should use platform secure storage. This API does not set cookies or introduce ambient cookie authentication. Use HTTPS, appropriate CSP/CORS and an HTTPS verification landing page. The landing page must POST its token to the API, remove the token from browser history and use Referrer-Policy: no-referrer; do not log URLs containing tokens. The frontend landing page is not implemented by this backend task. No organization/store/platform permissions are inferred from identity. Existing listing routes retain their existing behavior and remain outside authenticated domain functionality.

See [setup and verification](../07-deployment/authentication-setup.md), [OpenAPI](openapi.yaml), [RLS](../03-database/rls-policies.md).
