-- 000007_consumer_profiles.down.sql
BEGIN;

DROP TABLE IF EXISTS consumer.consumer_profiles;

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'identity' AND table_name = 'mfa_factors' AND column_name = 'encrypted_secret'
    ) THEN
        ALTER TABLE identity.mfa_factors RENAME COLUMN encrypted_secret TO secret_ciphertext;
    END IF;
END $$;

COMMIT;
