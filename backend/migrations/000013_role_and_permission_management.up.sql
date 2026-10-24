-- 000013_role_and_permission_management.up.sql
-- Domain C: Role and Permission Management

-- 1. Schema Alterations
ALTER TABLE store.stores 
    ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES identity.users(id);

CREATE INDEX IF NOT EXISTS idx_stores_created_by ON store.stores(created_by);

ALTER TABLE store.store_roles 
    ADD COLUMN IF NOT EXISTS system_role BOOLEAN NOT NULL DEFAULT false;

-- 2. Permissions Catalog (app.permissions)
CREATE TABLE IF NOT EXISTS app.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    scope VARCHAR(30) NOT NULL CHECK (scope IN ('organization', 'store', 'platform')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_permissions_scope ON app.permissions(scope);

-- Seed recommended baseline permissions
INSERT INTO app.permissions (code, scope, description) VALUES
    ('organization.manage', 'organization', 'Full management access to organization settings and operations'),
    ('store.create', 'organization', 'Permission to create new stores under organization'),
    ('store.read', 'store', 'View store details and configuration'),
    ('store.manage', 'store', 'Modify store settings and operational configuration'),
    ('staff.manage', 'store', 'Invite, assign roles to, or remove store staff members'),
    ('product.read', 'store', 'View catalog products and inventory levels'),
    ('product.write', 'store', 'Create, update, or archive catalog products and pricing'),
    ('invoice.issue', 'store', 'Generate and issue customer sales invoices'),
    ('invoice.void', 'store', 'Void or cancel issued customer invoices'),
    ('customer.manage', 'store', 'Create, update, and manage customer records')
ON CONFLICT (code) DO NOTHING;

-- 3. Store Role Permissions (Composite PK)
CREATE TABLE IF NOT EXISTS store.store_role_permissions (
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_store_role_perms_perm ON store.store_role_permissions(permission_id);

-- 4. Presentation Menus & Menu Permissions
CREATE TABLE IF NOT EXISTS app.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(80) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    route VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES app.menus(id) ON DELETE CASCADE,
    portal VARCHAR(30) NOT NULL DEFAULT 'merchant' CHECK (portal IN ('merchant', 'consumer', 'admin')),
    display_order INT NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_menus_portal ON app.menus(portal);

CREATE TABLE IF NOT EXISTS app.menu_permissions (
    menu_id UUID NOT NULL REFERENCES app.menus(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_perms_perm ON app.menu_permissions(permission_id);

-- Seed baseline merchant navigation menus
INSERT INTO app.menus (key, label, route, portal, display_order, icon) VALUES
    ('merchant.dashboard', 'Dashboard', '/dashboard', 'merchant', 1, 'LayoutDashboard'),
    ('merchant.invoices', 'Invoices', '/invoices', 'merchant', 2, 'Receipt'),
    ('merchant.products', 'Products', '/products', 'merchant', 3, 'Package'),
    ('merchant.customers', 'Customers', '/customers', 'merchant', 4, 'Users'),
    ('merchant.staff', 'Staff & Roles', '/staff', 'merchant', 5, 'ShieldCheck'),
    ('merchant.settings', 'Store Settings', '/settings', 'merchant', 6, 'Settings')
ON CONFLICT (key) DO NOTHING;

-- Map menus to permission requirements
INSERT INTO app.menu_permissions (menu_id, permission_id)
SELECT m.id, p.id FROM app.menus m, app.permissions p
WHERE (m.key = 'merchant.dashboard' AND p.code = 'store.read')
   OR (m.key = 'merchant.invoices' AND p.code = 'invoice.issue')
   OR (m.key = 'merchant.products' AND p.code = 'product.read')
   OR (m.key = 'merchant.customers' AND p.code = 'customer.manage')
   OR (m.key = 'merchant.staff' AND p.code = 'staff.manage')
   OR (m.key = 'merchant.settings' AND p.code = 'store.manage')
ON CONFLICT DO NOTHING;

-- 5. Store Settings
CREATE TABLE IF NOT EXISTS store.store_settings (
    store_id UUID PRIMARY KEY REFERENCES store.stores(id) ON DELETE CASCADE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    invoice_preferences JSONB NOT NULL DEFAULT '{"prefix": "INV", "next_number": 1, "paper_size": "A4", "show_tax": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Backfill default settings for any existing stores
INSERT INTO store.store_settings (store_id)
SELECT id FROM store.stores
ON CONFLICT (store_id) DO NOTHING;

-- Auto-provision store_settings on store creation trigger
CREATE OR REPLACE FUNCTION store.trg_init_store_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO store.store_settings (store_id)
    VALUES (NEW.id)
    ON CONFLICT (store_id) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_store_settings_trigger ON store.stores;
CREATE TRIGGER trg_init_store_settings_trigger
    AFTER INSERT ON store.stores
    FOR EACH ROW
    EXECUTE FUNCTION store.trg_init_store_settings();

-- 6. Store Invitations
CREATE TABLE IF NOT EXISTS store.store_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    intended_contact VARCHAR(320) NOT NULL,
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_invitations_store ON store.store_invitations(store_id);
CREATE INDEX IF NOT EXISTS idx_store_invitations_contact ON store.store_invitations(intended_contact);
CREATE INDEX IF NOT EXISTS idx_store_invitations_status ON store.store_invitations(status);

-- 7. Permissions and Row Level Security
GRANT USAGE ON SCHEMA app TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA store TO eghissab_app;

ALTER TABLE app.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY permissions_read_policy ON app.permissions
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE store.store_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_role_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY store_role_permissions_policy ON store.store_role_permissions
    FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE app.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.menus FORCE ROW LEVEL SECURITY;
CREATE POLICY menus_read_policy ON app.menus
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE app.menu_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE app.menu_permissions FORCE ROW LEVEL SECURITY;
CREATE POLICY menu_permissions_read_policy ON app.menu_permissions
    FOR SELECT TO eghissab_app USING (true);

ALTER TABLE store.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_settings FORCE ROW LEVEL SECURITY;
CREATE POLICY store_settings_policy ON store.store_settings
    FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE store.store_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_invitations FORCE ROW LEVEL SECURITY;
CREATE POLICY store_invitations_policy ON store.store_invitations
    FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

-- 8. Fix recursive RLS policies on organization_memberships via SECURITY DEFINER helper
CREATE OR REPLACE FUNCTION organization.is_org_owner(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, organization
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization.organization_memberships
        WHERE organization_id = p_org_id AND user_id = p_user_id AND is_owner = true AND status = 'active'
    );
$$;

DROP POLICY IF EXISTS org_membership_manage_policy ON organization.organization_memberships;
CREATE POLICY org_membership_manage_policy ON organization.organization_memberships
    FOR ALL TO eghissab_app
    USING (
        organization.is_org_owner(organization_id, app.current_user_id())
    )
    WITH CHECK (
        organization.is_org_owner(organization_id, app.current_user_id())
    );

DROP POLICY IF EXISTS org_update_policy ON organization.organizations;
CREATE POLICY org_update_policy ON organization.organizations
    FOR UPDATE TO eghissab_app
    USING (
        organization.is_org_owner(id, app.current_user_id())
    )
    WITH CHECK (
        organization.is_org_owner(id, app.current_user_id())
    );

-- 9. Centralized Authorization SQL Functions (SECURITY DEFINER)
CREATE OR REPLACE FUNCTION app.has_org_permission(p_org_id uuid, p_user_id uuid, p_perm_code text)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, organization, app
STABLE
AS $$
    SELECT organization.is_org_owner(p_org_id, p_user_id)
    OR EXISTS (
        SELECT 1
        FROM organization.organization_memberships om
        JOIN organization.organization_role_assignments ora ON ora.membership_id = om.id
        JOIN organization.organization_role_permissions orp ON orp.role_id = ora.role_id
        LEFT JOIN organization.organization_permissions op ON op.id = orp.permission_id
        LEFT JOIN app.permissions ap ON ap.id = orp.permission_id
        WHERE om.organization_id = p_org_id
          AND om.user_id = p_user_id
          AND om.status = 'active'
          AND (op.code = p_perm_code OR ap.code = p_perm_code)
    );
$$;

CREATE OR REPLACE FUNCTION app.has_store_permission(p_store_id uuid, p_user_id uuid, p_perm_code text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, store, organization, app
STABLE
AS $$
DECLARE
    v_org_id uuid;
BEGIN
    SELECT organization_id INTO v_org_id FROM store.stores WHERE id = p_store_id;
    IF v_org_id IS NULL THEN
        RETURN false;
    END IF;

    -- Org owner override
    IF organization.is_org_owner(v_org_id, p_user_id) THEN
        RETURN true;
    END IF;

    -- Store role permission check
    RETURN EXISTS (
        SELECT 1
        FROM store.store_memberships sm
        JOIN store.store_role_permissions srp ON srp.role_id = sm.role_id
        JOIN app.permissions p ON p.id = srp.permission_id
        WHERE sm.store_id = p_store_id
          AND sm.user_id = p_user_id
          AND sm.status = 'active'
          AND p.code = p_perm_code
    );
END;
$$;

CREATE OR REPLACE FUNCTION app.get_store_permissions(p_store_id uuid, p_user_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, store, organization, app
STABLE
AS $$
DECLARE
    v_org_id uuid;
    v_perms text[];
BEGIN
    SELECT organization_id INTO v_org_id FROM store.stores WHERE id = p_store_id;
    IF v_org_id IS NULL THEN
        RETURN ARRAY[]::text[];
    END IF;

    IF organization.is_org_owner(v_org_id, p_user_id) THEN
        SELECT COALESCE(array_agg(code ORDER BY code), ARRAY[]::text[])
        INTO v_perms
        FROM app.permissions
        WHERE scope = 'store';
        RETURN v_perms;
    END IF;

    SELECT COALESCE(array_agg(DISTINCT p.code ORDER BY p.code), ARRAY[]::text[])
    INTO v_perms
    FROM store.store_memberships sm
    JOIN store.store_role_permissions srp ON srp.role_id = sm.role_id
    JOIN app.permissions p ON p.id = srp.permission_id
    WHERE sm.store_id = p_store_id
      AND sm.user_id = p_user_id
      AND sm.status = 'active';

    RETURN COALESCE(v_perms, ARRAY[]::text[]);
END;
$$;

GRANT EXECUTE ON FUNCTION app.has_org_permission(uuid, uuid, text) TO eghissab_app;
GRANT EXECUTE ON FUNCTION app.has_store_permission(uuid, uuid, text) TO eghissab_app;
GRANT EXECUTE ON FUNCTION app.get_store_permissions(uuid, uuid) TO eghissab_app;

-- 10. Store and Store Roles Non-Recursive RLS Policies
CREATE OR REPLACE FUNCTION organization.is_org_member(p_org_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, organization
STABLE
AS $$
    SELECT EXISTS (
        SELECT 1 FROM organization.organization_memberships
        WHERE organization_id = p_org_id AND user_id = p_user_id AND status = 'active'
    );
$$;

DROP POLICY IF EXISTS store_policy ON store.stores;
CREATE POLICY store_policy ON store.stores
    FOR ALL TO eghissab_app
    USING (
        organization_id = app.current_org_id()
        OR organization.is_org_member(organization_id, app.current_user_id())
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    )
    WITH CHECK (
        organization_id = app.current_org_id()
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    );

DROP POLICY IF EXISTS store_roles_policy ON store.store_roles;
CREATE POLICY store_roles_policy ON store.store_roles
    FOR ALL TO eghissab_app
    USING (
        organization_id = app.current_org_id()
        OR organization.is_org_member(organization_id, app.current_user_id())
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    )
    WITH CHECK (
        organization_id = app.current_org_id()
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    );

DROP POLICY IF EXISTS store_memberships_policy ON store.store_memberships;
CREATE POLICY store_memberships_policy ON store.store_memberships
    FOR ALL TO eghissab_app
    USING (true)
    WITH CHECK (true);

-- 11. Billing Non-Recursive RLS Policies
DROP POLICY IF EXISTS subscriptions_policy ON billing.subscriptions;
CREATE POLICY subscriptions_policy ON billing.subscriptions
    FOR ALL TO eghissab_app
    USING (
        organization_id = app.current_org_id()
        OR organization.is_org_member(organization_id, app.current_user_id())
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    )
    WITH CHECK (
        organization_id = app.current_org_id()
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    );

DROP POLICY IF EXISTS billing_invoices_policy ON billing.billing_invoices;
CREATE POLICY billing_invoices_policy ON billing.billing_invoices
    FOR ALL TO eghissab_app
    USING (
        subscription_id IN (
            SELECT id FROM billing.subscriptions
            WHERE organization_id = app.current_org_id()
               OR organization.is_org_member(organization_id, app.current_user_id())
               OR organization.is_org_owner(organization_id, app.current_user_id())
               OR app.current_user_id() IS NULL
        )
    );

DROP POLICY IF EXISTS billing_payments_policy ON billing.billing_payments;
CREATE POLICY billing_payments_policy ON billing.billing_payments
    FOR ALL TO eghissab_app
    USING (
        billing_invoice_id IN (
            SELECT id FROM billing.billing_invoices
            WHERE subscription_id IN (
                SELECT id FROM billing.subscriptions
                WHERE organization_id = app.current_org_id()
                   OR organization.is_org_member(organization_id, app.current_user_id())
                   OR organization.is_org_owner(organization_id, app.current_user_id())
                   OR app.current_user_id() IS NULL
            )
        )
    );

DROP POLICY IF EXISTS usage_records_policy ON billing.usage_records;
CREATE POLICY usage_records_policy ON billing.usage_records
    FOR ALL TO eghissab_app
    USING (
        organization_id = app.current_org_id()
        OR organization.is_org_member(organization_id, app.current_user_id())
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    )
    WITH CHECK (
        organization_id = app.current_org_id()
        OR organization.is_org_owner(organization_id, app.current_user_id())
        OR app.current_user_id() IS NULL
    );




