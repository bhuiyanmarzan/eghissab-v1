-- 000010_organization_and_store.up.sql

-- 1. Organizations
CREATE TABLE IF NOT EXISTS organization.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'disabled')),
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_organizations_created_by ON organization.organizations(created_by);
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organization.organizations(status);

-- 2. Organization Memberships
CREATE TABLE IF NOT EXISTS organization.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'invited', 'suspended')),
    is_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_membership_user UNIQUE (organization_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_memberships_user ON organization.organization_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_org_memberships_org ON organization.organization_memberships(organization_id);

-- 3. Last-Owner Protection Trigger (BR-001 & ADR-001)
CREATE OR REPLACE FUNCTION organization.trg_enforce_last_active_owner()
RETURNS TRIGGER AS $$
DECLARE
    remaining_owners INT;
    org_exists BOOLEAN;
BEGIN
    -- If the parent organization is already deleted or being deleted, allow CASCADE
    SELECT EXISTS(SELECT 1 FROM organization.organizations WHERE id = OLD.organization_id) INTO org_exists;
    IF NOT org_exists THEN
        RETURN COALESCE(NEW, OLD);
    END IF;

    -- Only evaluate when an active owner is being deleted or updated to not be an active owner
    IF (TG_OP = 'DELETE' AND OLD.is_owner = true AND OLD.status = 'active') OR
       (TG_OP = 'UPDATE' AND OLD.is_owner = true AND OLD.status = 'active' AND (NEW.is_owner = false OR NEW.status != 'active')) THEN
        SELECT COUNT(*) INTO remaining_owners
        FROM organization.organization_memberships
        WHERE organization_id = OLD.organization_id
          AND id != OLD.id
          AND is_owner = true
          AND status = 'active';

        IF remaining_owners = 0 THEN
            RAISE EXCEPTION 'BR-001: Cannot remove or demote the last active owner of an organization';
        END IF;
    END IF;
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_last_active_owner ON organization.organization_memberships;
CREATE TRIGGER enforce_last_active_owner
BEFORE UPDATE OR DELETE ON organization.organization_memberships
FOR EACH ROW EXECUTE FUNCTION organization.trg_enforce_last_active_owner();

-- 4. Organization Roles
CREATE TABLE IF NOT EXISTS organization.organization_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_role_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_org_roles_org ON organization.organization_roles(organization_id);

-- 5. Organization Permissions
CREATE TABLE IF NOT EXISTS organization.organization_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL,
    description TEXT
);

-- Seed baseline organization permissions
INSERT INTO organization.organization_permissions (code, name, description) VALUES
    ('org:update', 'Update Organization', 'Modify organization metadata and settings'),
    ('org:delete', 'Delete Organization', 'Deactivate or delete organization'),
    ('org:member:invite', 'Invite Members', 'Invite new members into the organization'),
    ('org:member:manage', 'Manage Members', 'Change member roles or remove members'),
    ('org:role:manage', 'Manage Roles', 'Create, update, and assign custom roles'),
    ('org:billing:manage', 'Manage Billing', 'Manage subscriptions, payment methods, and invoices'),
    ('store:create', 'Create Store', 'Create a new store under the organization'),
    ('store:manage', 'Manage Stores', 'Update, archive, or configure stores')
ON CONFLICT (code) DO NOTHING;

-- 6. Organization Role Permissions (Composite PK)
CREATE TABLE IF NOT EXISTS organization.organization_role_permissions (
    role_id UUID NOT NULL REFERENCES organization.organization_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES organization.organization_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 7. Organization Role Assignments
CREATE TABLE IF NOT EXISTS organization.organization_role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    membership_id UUID NOT NULL REFERENCES organization.organization_memberships(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES organization.organization_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_membership_role UNIQUE (membership_id, role_id)
);

CREATE INDEX IF NOT EXISTS idx_org_role_assignments_membership ON organization.organization_role_assignments(membership_id);

-- 8. Organization Invitations
CREATE TABLE IF NOT EXISTS organization.organization_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    email VARCHAR(320) NOT NULL,
    invitation_token_hash TEXT NOT NULL UNIQUE,
    role_id UUID REFERENCES organization.organization_roles(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    accepted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_org_invitations_org ON organization.organization_invitations(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_invitations_email ON organization.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invitations_status ON organization.organization_invitations(status);

-- 9. Stores
CREATE TABLE IF NOT EXISTS store.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'disabled', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_store_slug UNIQUE (organization_id, slug)
);

CREATE INDEX IF NOT EXISTS idx_stores_org ON store.stores(organization_id);
CREATE INDEX IF NOT EXISTS idx_stores_status ON store.stores(status);

-- 10. Store Roles
CREATE TABLE IF NOT EXISTS store.store_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    code VARCHAR(50) NOT NULL,
    name VARCHAR(100) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_role_code UNIQUE (organization_id, code)
);

CREATE INDEX IF NOT EXISTS idx_store_roles_org ON store.store_roles(organization_id);

-- 11. Store Memberships (BR-002: Exactly one active role per user per store)
CREATE TABLE IF NOT EXISTS store.store_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_membership_user UNIQUE (store_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_store_memberships_store ON store.store_memberships(store_id);
CREATE INDEX IF NOT EXISTS idx_store_memberships_user ON store.store_memberships(user_id);
