-- 000009_multi_contact_and_identities.up.sql
BEGIN;

CREATE FUNCTION identity.auth_add_contact(
    p_user uuid,
    p_type text,
    p_val text,
    p_challenge uuid,
    p_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    c uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_val, 0));

    IF EXISTS (
        SELECT 1 FROM identity.user_contacts 
        WHERE type = p_type AND lower(normalized_value) = lower(p_val)
    ) THEN
        RETURN NULL;
    END IF;

    INSERT INTO identity.user_contacts(user_id, type, normalized_value, is_primary, verified_at)
    VALUES (p_user, p_type, lower(p_val), false, NULL)
    RETURNING id INTO c;

    INSERT INTO identity.verification_challenges(id, user_id, contact_id, purpose, challenge_hash, expires_at)
    VALUES (p_challenge, p_user, c, 'contact_verification', p_hash, clock_timestamp() + interval '30 minutes');

    RETURN c;
END $$;

CREATE FUNCTION identity.auth_verify_contact(
    p_challenge uuid,
    p_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    v identity.verification_challenges;
BEGIN
    SELECT * INTO v FROM identity.verification_challenges 
    WHERE id = p_challenge AND purpose = 'contact_verification' FOR UPDATE;

    IF v.id IS NULL OR v.consumed_at IS NOT NULL OR v.expires_at <= clock_timestamp() OR v.attempt_count >= 5 THEN
        RETURN false;
    END IF;

    UPDATE identity.verification_challenges SET attempt_count = attempt_count + 1 WHERE id = p_challenge;

    IF v.challenge_hash <> p_hash THEN
        RETURN false;
    END IF;

    UPDATE identity.verification_challenges SET consumed_at = clock_timestamp() WHERE id = p_challenge;

    UPDATE identity.user_contacts SET verified_at = clock_timestamp() 
    WHERE id = v.contact_id;

    RETURN true;
END $$;

CREATE FUNCTION identity.auth_set_primary_contact(
    p_user uuid,
    p_contact uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    c_type text;
BEGIN
    PERFORM 1 FROM identity.users WHERE id = p_user AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    SELECT type INTO c_type FROM identity.user_contacts 
    WHERE id = p_contact AND user_id = p_user AND verified_at IS NOT NULL;

    IF c_type IS NULL THEN
        RETURN false;
    END IF;

    UPDATE identity.user_contacts SET is_primary = false 
    WHERE user_id = p_user AND type = c_type;

    UPDATE identity.user_contacts SET is_primary = true 
    WHERE id = p_contact AND user_id = p_user;

    RETURN true;
END $$;

CREATE FUNCTION identity.auth_delete_contact(
    p_user uuid,
    p_contact uuid
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    is_prim boolean;
BEGIN
    PERFORM 1 FROM identity.users WHERE id = p_user AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    SELECT is_primary INTO is_prim FROM identity.user_contacts 
    WHERE id = p_contact AND user_id = p_user;

    IF is_prim IS NULL OR is_prim = true THEN
        RETURN false;
    END IF;

    DELETE FROM identity.verification_challenges WHERE contact_id = p_contact;
    DELETE FROM identity.user_contacts WHERE id = p_contact AND user_id = p_user;

    RETURN true;
END $$;

CREATE FUNCTION identity.auth_user_identities(
    p_user uuid
) RETURNS TABLE(
    id uuid,
    provider text,
    status text,
    created_at timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
    SELECT i.id, i.provider::text, i.status::text, i.created_at
    FROM identity.user_identities i
    WHERE i.user_id = p_user
    ORDER BY i.created_at ASC;
$$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='identity' AND (
     p.proname IN ('auth_add_contact', 'auth_verify_contact', 'auth_set_primary_contact', 'auth_delete_contact', 'auth_user_identities')
 ) LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,eghissab_app', f.signature);
  EXECUTE format('ALTER FUNCTION %s OWNER TO eghissab_identity_executor', f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO eghissab_app', f.signature);
 END LOOP;
END $$;

COMMIT;
