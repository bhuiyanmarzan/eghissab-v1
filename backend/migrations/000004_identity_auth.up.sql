-- Additive authentication boundary. Run with the privileged migration connection.
BEGIN;
DO $$ BEGIN
 IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='eghissab_identity_executor') THEN
  CREATE ROLE eghissab_identity_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
 END IF;
END $$;
ALTER ROLE eghissab_identity_executor NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS;
ALTER ROLE eghissab_app NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
-- Do not grant membership of the executor role to the runtime role.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_auth_members WHERE member IN ('eghissab_app'::regrole,'eghissab_identity_executor'::regrole)) THEN
  RAISE EXCEPTION 'identity runtime and executor roles must have no role memberships';
 END IF;
END $$;
ALTER TABLE identity.user_sessions ADD COLUMN rotated_at timestamptz;
CREATE INDEX idx_session_family ON identity.user_sessions(token_family_id);
CREATE UNIQUE INDEX uq_verified_email_normalized ON identity.user_contacts(lower(normalized_value)) WHERE type='email' AND verified_at IS NOT NULL;
CREATE INDEX idx_contact_email_lookup ON identity.user_contacts(lower(normalized_value)) WHERE type='email';
CREATE TABLE identity.auth_attempts (
 key_hash text PRIMARY KEY,
 window_start timestamptz NOT NULL,
 attempts integer NOT NULL CHECK(attempts > 0)
);
GRANT USAGE ON SCHEMA identity, app TO eghissab_identity_executor;
GRANT CREATE ON SCHEMA identity TO eghissab_identity_executor;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA identity TO eghissab_identity_executor;
REVOKE ALL ON ALL TABLES IN SCHEMA identity FROM PUBLIC, eghissab_app;
DO $$ DECLARE t text; BEGIN
 FOREACH t IN ARRAY ARRAY['users','user_contacts','user_identities','user_sessions','verification_challenges','mfa_factors','auth_attempts'] LOOP
  EXECUTE format('ALTER TABLE identity.%I ENABLE ROW LEVEL SECURITY',t);
  EXECUTE format('ALTER TABLE identity.%I FORCE ROW LEVEL SECURITY',t);
  EXECUTE format('CREATE POLICY identity_executor ON identity.%I TO eghissab_identity_executor USING (true) WITH CHECK (true)',t);
 END LOOP;
END $$;
GRANT SELECT ON identity.users, identity.user_contacts TO eghissab_app;
CREATE POLICY own_profile ON identity.users FOR SELECT TO eghissab_app USING (id=app.current_user_id());
CREATE POLICY own_contacts ON identity.user_contacts FOR SELECT TO eghissab_app USING (user_id=app.current_user_id());

CREATE FUNCTION identity.auth_budget(p_key text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE n integer;
BEGIN
 INSERT INTO identity.auth_attempts(key_hash,window_start,attempts) VALUES(p_key,clock_timestamp(),1)
 ON CONFLICT(key_hash) DO UPDATE SET
 attempts=CASE WHEN auth_attempts.window_start < clock_timestamp()-interval '15 minutes' THEN 1 ELSE LEAST(auth_attempts.attempts+1,11) END,
 window_start=CASE WHEN auth_attempts.window_start < clock_timestamp()-interval '15 minutes' THEN clock_timestamp() ELSE auth_attempts.window_start END
 RETURNING attempts INTO n;
 RETURN n<=10;
END $$;

CREATE FUNCTION identity.auth_register(p_email text,p_first text,p_last text,p_password text,p_challenge uuid,p_hash text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE u uuid; c uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
 IF EXISTS(SELECT 1 FROM identity.user_contacts WHERE type='email' AND lower(normalized_value)=p_email) THEN RETURN NULL; END IF;
 INSERT INTO identity.users(first_name,last_name) VALUES(p_first,NULLIF(p_last,'')) RETURNING id INTO u;
 INSERT INTO identity.user_contacts(user_id,type,normalized_value,is_primary) VALUES(u,'email',p_email,true) RETURNING id INTO c;
 INSERT INTO identity.user_identities(user_id,provider,password_hash) VALUES(u,'credentials',p_password);
 INSERT INTO identity.verification_challenges(id,user_id,contact_id,purpose,challenge_hash,expires_at)
 VALUES(p_challenge,u,c,'email_verification',p_hash,clock_timestamp()+interval '30 minutes');
 RETURN u;
END $$;

CREATE FUNCTION identity.auth_resend(p_email text,p_challenge uuid,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE u uuid; c uuid;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended(p_email,0));
 IF EXISTS(SELECT 1 FROM identity.user_contacts WHERE type='email' AND lower(normalized_value)=p_email AND verified_at IS NOT NULL) THEN RETURN false; END IF;
 SELECT x.user_id,x.id INTO u,c FROM identity.user_contacts x JOIN identity.users y ON y.id=x.user_id
 WHERE x.type='email' AND lower(x.normalized_value)=p_email AND x.is_primary AND x.verified_at IS NULL AND y.status='pending'
 ORDER BY x.created_at LIMIT 1;
 IF u IS NULL THEN RETURN false; END IF;
 PERFORM 1 FROM identity.users WHERE id=u FOR UPDATE;
 IF EXISTS(SELECT 1 FROM identity.verification_challenges WHERE contact_id=c AND purpose='email_verification' AND created_at>clock_timestamp()-interval '60 seconds') THEN RETURN false; END IF;
 UPDATE identity.verification_challenges SET consumed_at=clock_timestamp() WHERE contact_id=c AND purpose='email_verification' AND consumed_at IS NULL;
 INSERT INTO identity.verification_challenges(id,user_id,contact_id,purpose,challenge_hash,expires_at)
 VALUES(p_challenge,u,c,'email_verification',p_hash,clock_timestamp()+interval '30 minutes');
 RETURN true;
END $$;

CREATE FUNCTION identity.auth_verify(p_id uuid,p_hash text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE v identity.verification_challenges; u uuid; email text;
BEGIN
 SELECT user_id INTO u FROM identity.verification_challenges WHERE id=p_id AND purpose='email_verification';
 IF u IS NULL THEN RETURN false; END IF;
 SELECT lower(c.normalized_value) INTO email FROM identity.user_contacts c JOIN identity.verification_challenges x ON x.contact_id=c.id WHERE x.id=p_id;
 PERFORM pg_advisory_xact_lock(hashtextextended(email,0));
 PERFORM 1 FROM identity.users WHERE id=u FOR UPDATE;
 SELECT * INTO v FROM identity.verification_challenges WHERE id=p_id FOR UPDATE;
 IF v.consumed_at IS NOT NULL OR v.expires_at<=clock_timestamp() OR v.attempt_count>=5 THEN RETURN false; END IF;
 UPDATE identity.verification_challenges SET attempt_count=attempt_count+1 WHERE id=p_id;
 IF v.challenge_hash<>p_hash THEN RETURN false; END IF;
 IF NOT EXISTS(SELECT 1 FROM identity.users WHERE id=u AND status='pending') THEN RETURN false; END IF;
 -- Do not steal an email verified by a different identity.
 IF EXISTS(SELECT 1 FROM identity.user_contacts a JOIN identity.user_contacts b ON a.type=b.type AND lower(a.normalized_value)=lower(b.normalized_value)
 WHERE a.id=v.contact_id AND b.verified_at IS NOT NULL AND b.user_id<>u) THEN RETURN false; END IF;
 UPDATE identity.user_contacts SET verified_at=clock_timestamp() WHERE id=v.contact_id AND user_id=u AND type='email';
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE identity.users SET status='active',updated_at=clock_timestamp() WHERE id=u;
 UPDATE identity.verification_challenges SET consumed_at=clock_timestamp() WHERE user_id=u AND purpose='email_verification' AND consumed_at IS NULL;
 RETURN true;
END $$;

CREATE FUNCTION identity.auth_credentials(p_email text) RETURNS TABLE(user_id uuid,password_hash text)
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
 SELECT u.id,i.password_hash FROM identity.users u JOIN identity.user_contacts c ON c.user_id=u.id
 JOIN identity.user_identities i ON i.user_id=u.id
 WHERE c.type='email' AND lower(c.normalized_value)=p_email AND c.verified_at IS NOT NULL
 AND u.status='active' AND i.provider='credentials' AND i.status='active'
$$;
CREATE FUNCTION identity.auth_login(p_user uuid,p_password text,p_session uuid,p_family uuid,p_hash text)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
BEGIN
 PERFORM 1 FROM identity.users WHERE id=p_user AND status='active' FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM identity.user_identities WHERE user_id=p_user AND provider='credentials' AND status='active' AND password_hash=p_password) THEN RETURN false; END IF;
 INSERT INTO identity.user_sessions(id,user_id,token_family_id,refresh_token_hash,expires_at)
 VALUES(p_session,p_user,p_family,p_hash,clock_timestamp()+interval '30 days');
 RETURN true;
END $$;

CREATE FUNCTION identity.auth_refresh(p_hash text,p_new_id uuid,p_new_hash text)
RETURNS TABLE(result text,user_id uuid,session_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE s identity.user_sessions; u uuid;
BEGIN
 SELECT x.user_id INTO u FROM identity.user_sessions x WHERE x.refresh_token_hash=p_hash;
 IF u IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid; RETURN; END IF;
 -- Serialize rotation, logout and reuse revocation across the user's sessions.
 PERFORM 1 FROM identity.users WHERE id=u FOR UPDATE;
 SELECT * INTO s FROM identity.user_sessions x WHERE x.refresh_token_hash=p_hash FOR UPDATE;
 IF s.rotated_at IS NOT NULL THEN
  UPDATE identity.user_sessions x SET revoked_at=COALESCE(x.revoked_at,clock_timestamp()) WHERE x.token_family_id=s.token_family_id;
  RETURN QUERY SELECT 'reuse'::text,NULL::uuid,NULL::uuid; RETURN;
 END IF;
 IF s.revoked_at IS NOT NULL OR s.expires_at<=clock_timestamp() OR NOT EXISTS(SELECT 1 FROM identity.users WHERE id=u AND status='active') THEN
  RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid; RETURN;
 END IF;
 UPDATE identity.user_sessions SET rotated_at=clock_timestamp(),last_used_at=clock_timestamp() WHERE id=s.id;
 INSERT INTO identity.user_sessions(id,user_id,token_family_id,refresh_token_hash,expires_at)
 VALUES(p_new_id,u,s.token_family_id,p_new_hash,s.expires_at);
 RETURN QUERY SELECT 'ok'::text,u,p_new_id;
END $$;

CREATE FUNCTION identity.auth_authorize(p_user uuid,p_session uuid) RETURNS boolean
LANGUAGE sql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
 SELECT EXISTS(SELECT 1 FROM identity.user_sessions s JOIN identity.users u ON u.id=s.user_id
 WHERE s.id=p_session AND s.user_id=p_user AND u.status='active' AND s.revoked_at IS NULL AND s.rotated_at IS NULL AND s.expires_at>clock_timestamp())
$$;
CREATE FUNCTION identity.auth_logout(p_user uuid,p_session uuid,p_all boolean) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE f uuid;
BEGIN
 PERFORM 1 FROM identity.users WHERE id=p_user FOR UPDATE;
 SELECT token_family_id INTO f FROM identity.user_sessions WHERE id=p_session AND user_id=p_user;
 IF f IS NULL THEN RETURN false; END IF;
 UPDATE identity.user_sessions SET revoked_at=COALESCE(revoked_at,clock_timestamp()) WHERE user_id=p_user AND (p_all OR token_family_id=f);
 RETURN true;
END $$;
-- Function owners have only scoped identity-table privileges. No dynamic SQL or caller search_path.
DO $$ DECLARE f record; BEGIN
 FOR f IN SELECT p.oid::regprocedure AS signature FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
 WHERE n.nspname='identity' AND p.proname LIKE 'auth\_%' ESCAPE '\' LOOP
  EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC,eghissab_app',f.signature);
  EXECUTE format('ALTER FUNCTION %s OWNER TO eghissab_identity_executor',f.signature);
  EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO eghissab_app',f.signature);
 END LOOP;
END $$;
REVOKE CREATE ON SCHEMA identity FROM eghissab_identity_executor;
-- Membership tables have no runtime API yet. Remove unscoped DML pending that module.
REVOKE ALL ON platform.roles,platform.role_assignments FROM PUBLIC,eghissab_app;
COMMIT;
