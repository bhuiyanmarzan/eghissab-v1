-- 000013_role_and_permission_management.down.sql

DROP TRIGGER IF EXISTS trg_init_store_settings_trigger ON store.stores;
DROP FUNCTION IF EXISTS store.trg_init_store_settings();

DROP TABLE IF EXISTS store.store_invitations CASCADE;
DROP TABLE IF EXISTS store.store_settings CASCADE;
DROP TABLE IF EXISTS app.menu_permissions CASCADE;
DROP TABLE IF EXISTS app.menus CASCADE;
DROP TABLE IF EXISTS store.store_role_permissions CASCADE;
DROP TABLE IF EXISTS app.permissions CASCADE;

ALTER TABLE store.store_roles DROP COLUMN IF EXISTS system_role;
ALTER TABLE store.stores DROP COLUMN IF EXISTS created_by;
