-- 000016_store_active_select_policy.up.sql
BEGIN;

DROP POLICY IF EXISTS store_policy ON store.stores;
CREATE POLICY store_policy ON store.stores
    FOR ALL TO eghissab_app
    USING (
        status = 'active'
        OR organization_id = app.current_org_id()
        OR organization.is_org_member(organization_id, app.current_user_id())
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    )
    WITH CHECK (
        organization_id = app.current_org_id()
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    );

COMMIT;
