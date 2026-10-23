BEGIN;

REVOKE EXECUTE ON FUNCTION identity.auth_prune_attempts(interval) FROM eghissab_app;
DROP FUNCTION IF EXISTS identity.auth_prune_attempts(interval);
REVOKE DELETE ON identity.auth_attempts FROM eghissab_identity_executor;

COMMIT;
