# Security model

## Implemented safeguards (source only)
Parameterized listing queries; transaction-local RLS setting helper; request IDs and JSON logs; HTTP timeouts; production backend image runs nonroot; separate production Compose app/migration URLs. No runtime verification.

## Missing safeguards
No auth/session handling, RBAC, membership checks, table policies, consumer invoice rules, audit storage or rate limiting. Identity tables store password/token hashes and MFA ciphertext fields, but no code establishes hashing/encryption policy. App role has broad DML; development runtime can use privileged DB credentials. See [RLS inventory](../03-database/rls-policies.md).

## Target model
Authenticate identity, enforce role/operation permissions and membership, use scoped DB transactions plus least-privilege RLS, audit sensitive operations, protect keys separately from ciphertext, redact personal data/secrets, restrict DB network exposure and use secure transport. Consumer queries use approved links and eligibility boundary; organization membership never substitutes for store authorization. Backups must be encrypted/access-controlled with tested recovery. No production readiness claim.

Related: [Documentation index](../README.md).
