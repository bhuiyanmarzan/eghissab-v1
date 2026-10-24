-- 000012_organization_and_billing_rls.down.sql

DROP FUNCTION IF EXISTS organization.create_organization_with_owner(VARCHAR, VARCHAR, UUID);

DROP POLICY IF EXISTS webhook_events_policy ON billing.billing_webhook_events;
DROP POLICY IF EXISTS usage_records_policy ON billing.usage_records;
DROP POLICY IF EXISTS billing_payments_policy ON billing.billing_payments;
DROP POLICY IF EXISTS billing_invoices_policy ON billing.billing_invoices;
DROP POLICY IF EXISTS subscriptions_policy ON billing.subscriptions;
DROP POLICY IF EXISTS plan_versions_select_policy ON billing.plan_versions;
DROP POLICY IF EXISTS plans_select_policy ON billing.plans;

DROP POLICY IF EXISTS store_memberships_policy ON store.store_memberships;
DROP POLICY IF EXISTS store_roles_policy ON store.store_roles;
DROP POLICY IF EXISTS store_policy ON store.stores;

DROP POLICY IF EXISTS org_invitations_policy ON organization.organization_invitations;
DROP POLICY IF EXISTS org_role_assignments_policy ON organization.organization_role_assignments;
DROP POLICY IF EXISTS org_role_permissions_policy ON organization.organization_role_permissions;
DROP POLICY IF EXISTS org_permissions_select_policy ON organization.organization_permissions;
DROP POLICY IF EXISTS org_roles_policy ON organization.organization_roles;
DROP POLICY IF EXISTS org_membership_manage_policy ON organization.organization_memberships;
DROP POLICY IF EXISTS org_membership_select_policy ON organization.organization_memberships;
DROP POLICY IF EXISTS org_update_policy ON organization.organizations;
DROP POLICY IF EXISTS org_insert_policy ON organization.organizations;
DROP POLICY IF EXISTS org_select_policy ON organization.organizations;

REVOKE ALL ON ALL TABLES IN SCHEMA billing FROM eghissab_app;
REVOKE ALL ON ALL TABLES IN SCHEMA store FROM eghissab_app;
REVOKE ALL ON ALL TABLES IN SCHEMA organization FROM eghissab_app;
