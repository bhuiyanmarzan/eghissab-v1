-- 000003_create_app_role.up.sql

DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'eghissab_app') THEN
        CREATE ROLE eghissab_app WITH LOGIN PASSWORD 'change-me-app-password';
    END IF;

    -- Grant connection to current database
    EXECUTE format('GRANT CONNECT ON DATABASE %I TO eghissab_app', current_database());
END
$$;

-- Enforce that this role cannot bypass Row-Level Security policies under any circumstances
ALTER ROLE eghissab_app NOBYPASSRLS;

-- Grant schema usage
GRANT USAGE ON SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public TO eghissab_app;

-- Grant DML privileges on existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public TO eghissab_app;

-- Grant usage on sequences (for auto-increment/serial IDs if any)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public TO eghissab_app;

-- Grant execute on functions (e.g. app.current_user_id(), app.current_org_id())
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public TO eghissab_app;

-- Ensure future tables created by migrations automatically grant DML to the application role
ALTER DEFAULT PRIVILEGES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public
    GRANT USAGE, SELECT ON SEQUENCES TO eghissab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA app, identity, platform, organization, billing, store, invoice, consumer, system, public
    GRANT EXECUTE ON FUNCTIONS TO eghissab_app;
