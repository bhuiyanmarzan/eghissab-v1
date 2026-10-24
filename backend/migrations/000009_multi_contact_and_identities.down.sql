-- 000009_multi_contact_and_identities.down.sql
BEGIN;

DROP FUNCTION IF EXISTS identity.auth_add_contact(uuid, text, text, uuid, text);
DROP FUNCTION IF EXISTS identity.auth_verify_contact(uuid, text);
DROP FUNCTION IF EXISTS identity.auth_set_primary_contact(uuid, uuid);
DROP FUNCTION IF EXISTS identity.auth_delete_contact(uuid, uuid);
DROP FUNCTION IF EXISTS identity.auth_user_identities(uuid);

COMMIT;
