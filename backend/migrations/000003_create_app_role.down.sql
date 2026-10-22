-- 000003_create_app_role.down.sql

REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public FROM eghissab_app;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public FROM eghissab_app;
REVOKE ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public FROM eghissab_app;
REVOKE USAGE ON SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public FROM eghissab_app;

DO $$
BEGIN
    EXECUTE format('REVOKE CONNECT ON DATABASE %I FROM eghissab_app', current_database());
EXCEPTION
    WHEN OTHERS THEN NULL;
END
$$;

DROP ROLE IF EXISTS eghissab_app;
