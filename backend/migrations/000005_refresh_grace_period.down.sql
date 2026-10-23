CREATE OR REPLACE FUNCTION identity.auth_refresh(p_hash text,p_new_id uuid,p_new_hash text)
RETURNS TABLE(result text,user_id uuid,session_id uuid) LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,identity,pg_temp AS $$
DECLARE s identity.user_sessions; u uuid;
BEGIN
 SELECT x.user_id INTO u FROM identity.user_sessions x WHERE x.refresh_token_hash=p_hash;
 IF u IS NULL THEN RETURN QUERY SELECT 'invalid'::text,NULL::uuid,NULL::uuid; RETURN; END IF;
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

REVOKE ALL ON FUNCTION identity.auth_refresh(text,uuid,text) FROM PUBLIC,eghissab_app;
ALTER FUNCTION identity.auth_refresh(text,uuid,text) OWNER TO eghissab_identity_executor;
GRANT EXECUTE ON FUNCTION identity.auth_refresh(text,uuid,text) TO eghissab_app;
