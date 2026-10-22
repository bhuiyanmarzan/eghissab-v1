
-- 000001_foundation.up.sql

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS app;
CREATE SCHEMA IF NOT EXISTS identity;
CREATE SCHEMA IF NOT EXISTS platform;
CREATE SCHEMA IF NOT EXISTS organization;
CREATE SCHEMA IF NOT EXISTS billing;
CREATE SCHEMA IF NOT EXISTS store;
CREATE SCHEMA IF NOT EXISTS invoice;
CREATE SCHEMA IF NOT EXISTS consumer;
CREATE SCHEMA IF NOT EXISTS system;

-- Returns NULL when no authenticated identity is set.
CREATE OR REPLACE FUNCTION app.current_user_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.user_id', true), ''
    )::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_org_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.organization_id', true), ''
    )::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_store_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.store_id', true), ''
    )::uuid
$$;

CREATE OR REPLACE FUNCTION app.current_consumer_id()
RETURNS uuid
LANGUAGE sql STABLE
AS $$
    SELECT NULLIF(
        current_setting('app.consumer_id', true), ''
    )::uuid
$$;
