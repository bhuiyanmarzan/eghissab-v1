# Schema dictionary

FACT: derived only from `backend/migrations/000002_create_identity.up.sql`; live catalog UNKNOWN. Exact definitions below specify every column/type/default/nullability, PK/FK and CHECK. No explicit ON DELETE/ON UPDATE clauses exist; no triggers maintain updated_at. See [constraints/indexes](constraints-indexes.md) for explicit indexes.

All eight tables: RLS enabled = NO as defined; forced = NO; policies = NONE; grants = SELECT/INSERT/UPDATE/DELETE to eghissab_app via migration 000003. Role attributes/live overrides unverified. Known security gap: broad access without table policies.

## identity.users

Owning module: identity.

```sql
CREATE TABLE identity.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','active','suspended','disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.user_contacts

Owning module: identity.

```sql
CREATE TABLE identity.user_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    type VARCHAR(12) NOT NULL
        CHECK (type IN ('email','phone')),
    normalized_value VARCHAR(320) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.user_identities

Owning module: identity.

```sql
CREATE TABLE identity.user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('credentials','google','facebook','github')),
    provider_subject VARCHAR(255),
    password_hash TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (provider = 'credentials'
         AND password_hash IS NOT NULL
         AND provider_subject IS NULL)
        OR
        (provider <> 'credentials'
         AND provider_subject IS NOT NULL
         AND password_hash IS NULL)
    )
);
```

## identity.user_sessions

Owning module: identity.

```sql
CREATE TABLE identity.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    token_family_id UUID NOT NULL,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.mfa_factors

Owning module: identity.

```sql
CREATE TABLE identity.mfa_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    factor_type VARCHAR(30) NOT NULL,
    secret_ciphertext TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.verification_challenges

Owning module: identity.

```sql
CREATE TABLE identity.verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES identity.users(id),
    contact_id UUID REFERENCES identity.user_contacts(id),
    purpose VARCHAR(30) NOT NULL,
    challenge_hash TEXT NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0
        CHECK (attempt_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## platform.roles

Owning module: platform.

```sql
CREATE TABLE platform.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL
);
```

## platform.role_assignments

Owning module: platform.

```sql
CREATE TABLE platform.role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    role_id UUID NOT NULL REFERENCES platform.roles(id),
    granted_by UUID REFERENCES identity.users(id),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```


Related: [Documentation index](../README.md).
