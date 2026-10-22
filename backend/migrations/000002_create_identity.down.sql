-- 000002_identity.down.sql

-- Drop platform tables & indexes (depend on identity.users)
DROP INDEX IF EXISTS platform.uq_active_platform_role;
DROP TABLE IF EXISTS platform.role_assignments;
DROP TABLE IF EXISTS platform.roles;

-- Drop identity tables & indexes (reverse creation order)
DROP INDEX IF EXISTS identity.idx_verification_expiry;
DROP TABLE IF EXISTS identity.verification_challenges;

DROP TABLE IF EXISTS identity.mfa_factors;

DROP INDEX IF EXISTS identity.idx_user_sessions;
DROP TABLE IF EXISTS identity.user_sessions;

DROP INDEX IF EXISTS identity.uq_user_credentials;
DROP INDEX IF EXISTS identity.uq_provider_subject;
DROP TABLE IF EXISTS identity.user_identities;

DROP INDEX IF EXISTS identity.idx_contacts_user;
DROP INDEX IF EXISTS identity.uq_primary_user_contact;
DROP INDEX IF EXISTS identity.uq_verified_contacts;
DROP TABLE IF EXISTS identity.user_contacts;

DROP TABLE IF EXISTS identity.users;
