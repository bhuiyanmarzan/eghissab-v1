-- Migration 000006: Add routine pruning for expired rate limit counters
BEGIN;

-- Ensure the identity executor has permission to delete expired attempts
GRANT DELETE ON identity.auth_attempts TO eghissab_identity_executor;

CREATE OR REPLACE FUNCTION identity.auth_prune_attempts(p_older_than interval DEFAULT interval '24 hours')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
  v_deleted integer;
BEGIN
  DELETE FROM identity.auth_attempts
  WHERE window_start < clock_timestamp() - p_older_than;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END $$;

REVOKE ALL ON FUNCTION identity.auth_prune_attempts(interval) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION identity.auth_prune_attempts(interval) TO eghissab_app;

COMMIT;
