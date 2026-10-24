-- 000010_organization_and_store.down.sql

DROP TABLE IF EXISTS store.store_memberships CASCADE;
DROP TABLE IF EXISTS store.store_roles CASCADE;
DROP TABLE IF EXISTS store.stores CASCADE;

DROP TABLE IF EXISTS organization.organization_invitations CASCADE;
DROP TABLE IF EXISTS organization.organization_role_assignments CASCADE;
DROP TABLE IF EXISTS organization.organization_role_permissions CASCADE;
DROP TABLE IF EXISTS organization.organization_permissions CASCADE;
DROP TABLE IF EXISTS organization.organization_roles CASCADE;

DROP TRIGGER IF EXISTS enforce_last_active_owner ON organization.organization_memberships;
DROP FUNCTION IF EXISTS organization.trg_enforce_last_active_owner();

DROP TABLE IF EXISTS organization.organization_memberships CASCADE;
DROP TABLE IF EXISTS organization.organizations CASCADE;
