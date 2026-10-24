-- 000007_consumer_profiles.up.sql
BEGIN;

CREATE TABLE consumer.consumer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'suspended')),
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_consumer_profiles_user ON consumer.consumer_profiles(user_id);

GRANT USAGE ON SCHEMA consumer TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON consumer.consumer_profiles TO eghissab_app;

ALTER TABLE consumer.consumer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.consumer_profiles FORCE ROW LEVEL SECURITY;

CREATE POLICY consumer_profile_owner ON consumer.consumer_profiles
    FOR ALL TO eghissab_app
    USING (user_id = app.current_user_id())
    WITH CHECK (user_id = app.current_user_id());

-- Align identity.mfa_factors column naming to encrypted_secret
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'identity' AND table_name = 'mfa_factors' AND column_name = 'secret_ciphertext'
    ) THEN
        ALTER TABLE identity.mfa_factors RENAME COLUMN secret_ciphertext TO encrypted_secret;
    END IF;
END $$;

COMMIT;
