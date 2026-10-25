-- 000018_identity_registration_dml.down.sql
DROP POLICY IF EXISTS user_identities_insert_policy ON identity.user_identities;
DROP POLICY IF EXISTS user_contacts_lookup_policy ON identity.user_contacts;
DROP POLICY IF EXISTS user_contacts_insert_policy ON identity.user_contacts;
DROP POLICY IF EXISTS users_insert_policy ON identity.users;

REVOKE INSERT ON identity.user_identities FROM eghissab_app;
REVOKE INSERT ON identity.user_contacts FROM eghissab_app;
REVOKE INSERT ON identity.users FROM eghissab_app;
