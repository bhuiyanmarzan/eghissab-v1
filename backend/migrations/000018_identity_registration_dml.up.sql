-- 000018_identity_registration_dml.up.sql
-- Grant table permissions to runtime application role eghissab_app for direct transactional registration
GRANT SELECT, INSERT ON identity.users TO eghissab_app;
GRANT SELECT, INSERT ON identity.user_contacts TO eghissab_app;
GRANT INSERT ON identity.user_identities TO eghissab_app;

-- Row Level Security: Policies for direct INSERT by eghissab_app
CREATE POLICY users_insert_policy ON identity.users
    FOR INSERT TO eghissab_app
    WITH CHECK (true);

CREATE POLICY user_contacts_insert_policy ON identity.user_contacts
    FOR INSERT TO eghissab_app
    WITH CHECK (true);

CREATE POLICY user_contacts_lookup_policy ON identity.user_contacts
    FOR SELECT TO eghissab_app
    USING (true);

CREATE POLICY user_identities_insert_policy ON identity.user_identities
    FOR INSERT TO eghissab_app
    WITH CHECK (true);
