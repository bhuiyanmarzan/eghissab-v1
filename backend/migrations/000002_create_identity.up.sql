
-- 000002_identity.up.sql

CREATE TABLE identity.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','active','suspended','disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

-- Unconditional uniqueness: no two rows may share the same type + value,
-- regardless of verification status. Case-insensitive for email safety.
CREATE UNIQUE INDEX uq_contact_type_value
ON identity.user_contacts(type, lower(normalized_value));

CREATE UNIQUE INDEX uq_primary_user_contact
ON identity.user_contacts(user_id, type)
WHERE is_primary = true;

CREATE INDEX idx_contacts_user
ON identity.user_contacts(user_id);

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

CREATE UNIQUE INDEX uq_provider_subject
ON identity.user_identities(provider, provider_subject)
WHERE provider_subject IS NOT NULL;

CREATE UNIQUE INDEX uq_user_credentials
ON identity.user_identities(user_id)
WHERE provider = 'credentials';

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

CREATE INDEX idx_user_sessions
ON identity.user_sessions(user_id, expires_at DESC);

CREATE TABLE identity.mfa_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    factor_type VARCHAR(30) NOT NULL,
    secret_ciphertext TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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

CREATE INDEX idx_verification_expiry
ON identity.verification_challenges(expires_at);

CREATE TABLE platform.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL
);

CREATE TABLE platform.role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    role_id UUID NOT NULL REFERENCES platform.roles(id),
    granted_by UUID REFERENCES identity.users(id),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_active_platform_role
ON platform.role_assignments(user_id, role_id)
WHERE revoked_at IS NULL;
