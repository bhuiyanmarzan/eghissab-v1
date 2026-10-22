-- 000001_foundation.down.sql

-- Drop functions
DROP FUNCTION IF EXISTS app.current_consumer_id();
DROP FUNCTION IF EXISTS app.current_store_id();
DROP FUNCTION IF EXISTS app.current_org_id();
DROP FUNCTION IF EXISTS app.current_user_id();

-- Drop schemas (reverse order of creation)
DROP SCHEMA IF EXISTS system;
DROP SCHEMA IF EXISTS consumer;
DROP SCHEMA IF EXISTS invoice;
DROP SCHEMA IF EXISTS store;
DROP SCHEMA IF EXISTS billing;
DROP SCHEMA IF EXISTS organization;
DROP SCHEMA IF EXISTS platform;
DROP SCHEMA IF EXISTS identity;
DROP SCHEMA IF EXISTS app;

-- Drop extension
DROP EXTENSION IF EXISTS pgcrypto;
