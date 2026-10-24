-- 000008_google_oauth_and_identity_linking.down.sql
BEGIN;

DROP FUNCTION IF EXISTS identity.auth_google_login(text, uuid, uuid, text);
DROP FUNCTION IF EXISTS identity.auth_google_register(text, text, text, text, uuid, uuid, text);
DROP FUNCTION IF EXISTS identity.auth_google_link_challenge(text, uuid, text);
DROP FUNCTION IF EXISTS identity.auth_google_link_confirm(uuid, text, uuid, text, uuid, uuid, text);
DROP FUNCTION IF EXISTS identity.auth_google_link_with_password(uuid, text, uuid, uuid, text);

COMMIT;
