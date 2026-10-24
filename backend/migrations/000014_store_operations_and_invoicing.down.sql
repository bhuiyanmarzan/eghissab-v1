-- 000014_store_operations_and_invoicing.down.sql

DROP TRIGGER IF EXISTS trg_protect_issued_invoice_trigger ON invoice.invoices;
DROP FUNCTION IF EXISTS invoice.trg_protect_issued_invoice();

DROP TRIGGER IF EXISTS trg_protect_issued_invoice_items_trigger ON invoice.invoice_items;
DROP FUNCTION IF EXISTS invoice.trg_protect_issued_invoice_items();

DROP TRIGGER IF EXISTS trg_apply_stock_movement_trigger ON store.stock_movements;
DROP FUNCTION IF EXISTS store.trg_apply_stock_movement();

DROP TRIGGER IF EXISTS trg_init_store_location_trigger ON store.stores;
DROP FUNCTION IF EXISTS store.trg_init_store_location();

DROP TABLE IF EXISTS invoice.invoice_adjustments CASCADE;
DROP TABLE IF EXISTS invoice.invoice_payments CASCADE;
DROP TABLE IF EXISTS invoice.invoice_events CASCADE;
DROP TABLE IF EXISTS invoice.invoice_decisions CASCADE;
DROP TABLE IF EXISTS invoice.invoice_items CASCADE;
DROP TABLE IF EXISTS invoice.invoices CASCADE;

DROP TABLE IF EXISTS store.store_customers CASCADE;
DROP TABLE IF EXISTS store.stock_movements CASCADE;
DROP TABLE IF EXISTS store.inventory_balances CASCADE;
DROP TABLE IF EXISTS store.inventory_locations CASCADE;
DROP TABLE IF EXISTS store.products CASCADE;
