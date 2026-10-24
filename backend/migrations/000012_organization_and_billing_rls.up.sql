-- 000012_organization_and_billing_rls.up.sql

-- 1. Grant table permissions to runtime application role eghissab_app
GRANT USAGE ON SCHEMA organization TO eghissab_app;
GRANT USAGE ON SCHEMA store TO eghissab_app;
GRANT USAGE ON SCHEMA billing TO eghissab_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA organization TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA store TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA billing TO eghissab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA organization GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA store GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA billing GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;

-- 2. Row Level Security: Organization Tables
ALTER TABLE organization.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organizations FORCE ROW LEVEL SECURITY;

CREATE POLICY org_select_policy ON organization.organizations
    FOR SELECT TO eghissab_app
    USING (
        id = app.current_org_id()
        OR
        id IN (
            SELECT organization_id FROM organization.organization_memberships
            WHERE user_id = app.current_user_id() AND status = 'active'
        )
    );

CREATE POLICY org_insert_policy ON organization.organizations
    FOR INSERT TO eghissab_app
    WITH CHECK (
        created_by = app.current_user_id()
    );

CREATE POLICY org_update_policy ON organization.organizations
    FOR UPDATE TO eghissab_app
    USING (
        id IN (
            SELECT organization_id FROM organization.organization_memberships
            WHERE user_id = app.current_user_id() AND is_owner = true AND status = 'active'
        )
    )
    WITH CHECK (
        id IN (
            SELECT organization_id FROM organization.organization_memberships
            WHERE user_id = app.current_user_id() AND is_owner = true AND status = 'active'
        )
    );

ALTER TABLE organization.organization_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_memberships FORCE ROW LEVEL SECURITY;

CREATE POLICY org_membership_select_policy ON organization.organization_memberships
    FOR SELECT TO eghissab_app
    USING (
        organization_id = app.current_org_id()
        OR user_id = app.current_user_id()
    );

CREATE POLICY org_membership_manage_policy ON organization.organization_memberships
    FOR ALL TO eghissab_app
    USING (
        organization_id IN (
            SELECT organization_id FROM organization.organization_memberships
            WHERE user_id = app.current_user_id() AND is_owner = true AND status = 'active'
        )
    )
    WITH CHECK (
        organization_id IN (
            SELECT organization_id FROM organization.organization_memberships
            WHERE user_id = app.current_user_id() AND is_owner = true AND status = 'active'
        )
    );

ALTER TABLE organization.organization_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY org_roles_policy ON organization.organization_roles
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id())
    WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE organization.organization_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY org_permissions_select_policy ON organization.organization_permissions
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE organization.organization_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY org_role_permissions_policy ON organization.organization_role_permissions
    FOR ALL TO eghissab_app
    USING (role_id IN (SELECT id FROM organization.organization_roles WHERE organization_id = app.current_org_id()));

ALTER TABLE organization.organization_role_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_role_assignments FORCE ROW LEVEL SECURITY;
CREATE POLICY org_role_assignments_policy ON organization.organization_role_assignments
    FOR ALL TO eghissab_app
    USING (membership_id IN (SELECT id FROM organization.organization_memberships WHERE organization_id = app.current_org_id()));

ALTER TABLE organization.organization_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization.organization_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY org_invitations_policy ON organization.organization_invitations
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id() OR email IN (SELECT normalized_value FROM identity.user_contacts WHERE user_id = app.current_user_id()));

-- 3. Row Level Security: Store Tables
ALTER TABLE store.stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.stores FORCE ROW LEVEL SECURITY;
CREATE POLICY store_policy ON store.stores
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id())
    WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE store.store_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_roles FORCE ROW LEVEL SECURITY;
CREATE POLICY store_roles_policy ON store.store_roles
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id())
    WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE store.store_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_memberships FORCE ROW LEVEL SECURITY;
CREATE POLICY store_memberships_policy ON store.store_memberships
    FOR ALL TO eghissab_app
    USING (
        user_id = app.current_user_id()
        OR store_id IN (SELECT id FROM store.stores WHERE organization_id = app.current_org_id())
    );

-- 4. Row Level Security: Billing Tables
ALTER TABLE billing.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.plans FORCE ROW LEVEL SECURITY;
CREATE POLICY plans_select_policy ON billing.plans
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE billing.plan_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.plan_versions FORCE ROW LEVEL SECURITY;
CREATE POLICY plan_versions_select_policy ON billing.plan_versions
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE billing.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.subscriptions FORCE ROW LEVEL SECURITY;
CREATE POLICY subscriptions_policy ON billing.subscriptions
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id())
    WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE billing.billing_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.billing_invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_invoices_policy ON billing.billing_invoices
    FOR ALL TO eghissab_app
    USING (subscription_id IN (SELECT id FROM billing.subscriptions WHERE organization_id = app.current_org_id()));

ALTER TABLE billing.billing_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.billing_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY billing_payments_policy ON billing.billing_payments
    FOR ALL TO eghissab_app
    USING (billing_invoice_id IN (
        SELECT id FROM billing.billing_invoices WHERE subscription_id IN (
            SELECT id FROM billing.subscriptions WHERE organization_id = app.current_org_id()
        )
    ));

ALTER TABLE billing.usage_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.usage_records FORCE ROW LEVEL SECURITY;
CREATE POLICY usage_records_policy ON billing.usage_records
    FOR ALL TO eghissab_app
    USING (organization_id = app.current_org_id())
    WITH CHECK (organization_id = app.current_org_id());

ALTER TABLE billing.billing_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing.billing_webhook_events FORCE ROW LEVEL SECURITY;
CREATE POLICY webhook_events_policy ON billing.billing_webhook_events
    FOR ALL TO eghissab_app USING (true);

-- 5. Atomic Organization Creation SECURITY DEFINER Function
-- Executes as eghissab to atomically provision organization, owner role & membership, and default free subscription
CREATE OR REPLACE FUNCTION organization.create_organization_with_owner(
    p_name VARCHAR(120),
    p_slug VARCHAR(120),
    p_user_id UUID
)
RETURNS TABLE(
    organization_id UUID,
    membership_id UUID,
    role_id UUID,
    subscription_id UUID
)
SECURITY DEFINER
SET search_path = organization, billing, store, identity, public
LANGUAGE plpgsql
AS $$
DECLARE
    v_org_id UUID;
    v_mem_id UUID;
    v_owner_role_id UUID;
    v_admin_role_id UUID;
    v_member_role_id UUID;
    v_free_plan_version_id UUID;
    v_sub_id UUID;
BEGIN
    -- 1. Create organization
    INSERT INTO organization.organizations (name, slug, created_by)
    VALUES (p_name, p_slug, p_user_id)
    RETURNING id INTO v_org_id;

    -- 2. Create organization membership with is_owner = true
    INSERT INTO organization.organization_memberships (organization_id, user_id, status, is_owner)
    VALUES (v_org_id, p_user_id, 'active', true)
    RETURNING id INTO v_mem_id;

    -- 3. Create default roles for organization
    INSERT INTO organization.organization_roles (organization_id, code, name)
    VALUES (v_org_id, 'owner', 'Owner')
    RETURNING id INTO v_owner_role_id;

    INSERT INTO organization.organization_roles (organization_id, code, name)
    VALUES (v_org_id, 'admin', 'Administrator')
    RETURNING id INTO v_admin_role_id;

    INSERT INTO organization.organization_roles (organization_id, code, name)
    VALUES (v_org_id, 'member', 'Member')
    RETURNING id INTO v_member_role_id;

    -- 4. Assign Owner role to creator membership
    INSERT INTO organization.organization_role_assignments (membership_id, role_id)
    VALUES (v_mem_id, v_owner_role_id);

    -- 5. Create default store roles for organization
    INSERT INTO store.store_roles (organization_id, code, name)
    VALUES 
        (v_org_id, 'store_manager', 'Store Manager'),
        (v_org_id, 'cashier', 'Cashier'),
        (v_org_id, 'staff', 'Staff');

    -- 6. Attach default free plan subscription
    SELECT pv.id INTO v_free_plan_version_id
    FROM billing.plans p
    JOIN billing.plan_versions pv ON pv.plan_id = p.id
    WHERE p.code = 'free'
    ORDER BY pv.version DESC
    LIMIT 1;

    IF v_free_plan_version_id IS NOT NULL THEN
        INSERT INTO billing.subscriptions (
            organization_id,
            plan_version_id,
            status,
            period_start,
            period_end
        )
        VALUES (
            v_org_id,
            v_free_plan_version_id,
            'active',
            clock_timestamp(),
            clock_timestamp() + interval '100 years'
        )
        RETURNING id INTO v_sub_id;
    END IF;

    RETURN QUERY SELECT v_org_id, v_mem_id, v_owner_role_id, v_sub_id;
END;
$$;

GRANT EXECUTE ON FUNCTION organization.create_organization_with_owner(VARCHAR, VARCHAR, UUID) TO eghissab_app;
