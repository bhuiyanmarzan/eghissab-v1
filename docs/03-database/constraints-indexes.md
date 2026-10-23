# Constraints and indexes

## Actual definitions
Every table has UUID primary key/default gen_random_uuid(). Inline UNIQUE constraints: user_sessions.refresh_token_hash and platform.roles.code. Foreign keys, nullability and exact CHECK expressions are retained in [schema dictionary](schema-dictionary.md); no explicit cascading actions, ownership invariants or store-role constraints exist.

Explicit indexes (verbatim migration definitions):

```sql
CREATE UNIQUE INDEX uq_verified_contacts
ON identity.user_contacts(type, normalized_value)
WHERE verified_at IS NOT NULL;

CREATE UNIQUE INDEX uq_primary_user_contact
ON identity.user_contacts(user_id, type)
WHERE is_primary = true;

CREATE INDEX idx_contacts_user
ON identity.user_contacts(user_id);

CREATE UNIQUE INDEX uq_provider_subject
ON identity.user_identities(provider, provider_subject)
WHERE provider_subject IS NOT NULL;

CREATE UNIQUE INDEX uq_user_credentials
ON identity.user_identities(user_id)
WHERE provider = 'credentials';

CREATE INDEX idx_user_sessions
ON identity.user_sessions(user_id, expires_at DESC);

CREATE INDEX idx_verification_expiry
ON identity.verification_challenges(expires_at);

CREATE UNIQUE INDEX uq_active_platform_role
ON platform.role_assignments(user_id, role_id)
WHERE revoked_at IS NULL;
```

User status is limited to pending/active/suspended/disabled; contacts to email/phone; provider to credentials/google/facebook/github. Credential check requires password hash for credentials and provider subject for OAuth, mutually exclusive. Challenge attempts must be nonnegative. Other status fields are unconstrained strings. Verified contact uniqueness is partial; unverified duplicates are allowed. No check ties a challenge's contact_id to its user_id, no expiry-order checks, and no automatically maintained updated_at. Whether to add these requires scoped design; no migration changed.

Related: [Documentation index](../README.md).
