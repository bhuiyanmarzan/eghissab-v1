-- 000008_google_oauth_and_identity_linking.up.sql
BEGIN;

CREATE FUNCTION identity.auth_google_login(
    p_subject text,
    p_session uuid,
    p_family uuid,
    p_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    u uuid;
BEGIN
    SELECT u2.id INTO u 
    FROM identity.users u2 
    JOIN identity.user_identities i ON i.user_id = u2.id
    WHERE i.provider = 'google' AND i.provider_subject = p_subject 
      AND i.status = 'active' AND u2.status = 'active';

    IF u IS NULL THEN
        RETURN NULL;
    END IF;

    PERFORM 1 FROM identity.users WHERE id = u AND status = 'active' FOR UPDATE;

    INSERT INTO identity.user_sessions(id, user_id, token_family_id, refresh_token_hash, expires_at)
    VALUES (p_session, u, p_family, p_hash, clock_timestamp() + interval '30 days');

    RETURN u;
END $$;

CREATE FUNCTION identity.auth_google_register(
    p_email text,
    p_first text,
    p_last text,
    p_subject text,
    p_session uuid,
    p_family uuid,
    p_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    u uuid;
    c uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_email, 0));

    IF EXISTS (
        SELECT 1 FROM identity.user_contacts 
        WHERE type = 'email' AND lower(normalized_value) = lower(p_email)
    ) THEN
        RETURN NULL;
    END IF;

    IF EXISTS (
        SELECT 1 FROM identity.user_identities 
        WHERE provider = 'google' AND provider_subject = p_subject
    ) THEN
        RETURN NULL;
    END IF;

    INSERT INTO identity.users(first_name, last_name, status)
    VALUES (p_first, NULLIF(p_last, ''), 'active')
    RETURNING id INTO u;

    INSERT INTO identity.user_contacts(user_id, type, normalized_value, is_primary, verified_at)
    VALUES (u, 'email', lower(p_email), true, clock_timestamp())
    RETURNING id INTO c;

    INSERT INTO identity.user_identities(user_id, provider, provider_subject, status)
    VALUES (u, 'google', p_subject, 'active');

    INSERT INTO identity.user_sessions(id, user_id, token_family_id, refresh_token_hash, expires_at)
    VALUES (p_session, u, p_family, p_hash, clock_timestamp() + interval '30 days');

    RETURN u;
END $$;

CREATE FUNCTION identity.auth_google_link_challenge(
    p_email text,
    p_challenge uuid,
    p_hash text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    u uuid;
    c uuid;
BEGIN
    PERFORM pg_advisory_xact_lock(hashtextextended(p_email, 0));

    SELECT x.user_id, x.id INTO u, c
    FROM identity.user_contacts x
    JOIN identity.users y ON y.id = x.user_id
    WHERE x.type = 'email' AND lower(x.normalized_value) = lower(p_email)
      AND y.status = 'active';

    IF u IS NULL THEN
        RETURN NULL;
    END IF;

    INSERT INTO identity.verification_challenges(id, user_id, contact_id, purpose, challenge_hash, expires_at)
    VALUES (p_challenge, u, c, 'identity_linking', p_hash, clock_timestamp() + interval '15 minutes');

    RETURN u;
END $$;

CREATE FUNCTION identity.auth_google_link_confirm(
    p_challenge uuid,
    p_hash text,
    p_user uuid,
    p_subject text,
    p_session uuid,
    p_family uuid,
    p_session_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE
    v identity.verification_challenges;
BEGIN
    SELECT * INTO v FROM identity.verification_challenges 
    WHERE id = p_challenge AND purpose = 'identity_linking' FOR UPDATE;

    IF v.id IS NULL OR v.consumed_at IS NOT NULL OR v.expires_at <= clock_timestamp() OR v.attempt_count >= 5 THEN
        RETURN false;
    END IF;

    UPDATE identity.verification_challenges SET attempt_count = attempt_count + 1 WHERE id = p_challenge;

    IF v.challenge_hash <> p_hash OR v.user_id <> p_user THEN
        RETURN false;
    END IF;

    UPDATE identity.verification_challenges SET consumed_at = clock_timestamp() WHERE id = p_challenge;

    PERFORM 1 FROM identity.users WHERE id = p_user AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    IF EXISTS (
        SELECT 1 FROM identity.user_identities 
        WHERE provider = 'google' AND provider_subject = p_subject
    ) THEN
        RETURN false;
    END IF;

    INSERT INTO identity.user_identities(user_id, provider, provider_subject, status)
    VALUES (p_user, 'google', p_subject, 'active');

    INSERT INTO identity.user_sessions(id, user_id, token_family_id, refresh_token_hash, expires_at)
    VALUES (p_session, p_user, p_family, p_session_hash, clock_timestamp() + interval '30 days');

    RETURN true;
END $$;

CREATE FUNCTION identity.auth_google_link_with_password(
    p_user uuid,
    p_subject text,
    p_session uuid,
    p_family uuid,
    p_session_hash text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
BEGIN
    PERFORM 1 FROM identity.users WHERE id = p_user AND status = 'active' FOR UPDATE;
    IF NOT FOUND THEN RETURN false; END IF;

    IF EXISTS (
        SELECT 1 FROM identity.user_identities 
        WHERE provider = 'google' AND provider_subject = p_subject
    ) THEN
        RETURN false;
    END IF;

    INSERT INTO identity.user_identities(user_id, provider, provider_subject, status)
    VALUES (p_user, 'google', p_subject, 'active');

    INSERT INTO identity.user_sessions(id, user_id, token_family_id, refresh_token_hash, expires_at)
    VALUES (p_session, p_user, p_family, p_session_hash, clock_timestamp() + interval '30 days');

    RETURN true;
END $$;

DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='identity' AND (p.proname LIKE 'auth\_google\_%' ESCAPE '\') LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,eghissab_app', f.signature);
  EXECUTE format('ALTER FUNCTION %s OWNER TO eghissab_identity_executor', f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO eghissab_app', f.signature);
 END LOOP;
END $$;

COMMIT;
