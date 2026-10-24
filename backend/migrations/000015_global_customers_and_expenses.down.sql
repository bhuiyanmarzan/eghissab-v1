-- 000015_global_customers_and_expenses.down.sql

DROP TABLE IF EXISTS consumer.expense_adjustments CASCADE;
DROP TABLE IF EXISTS consumer.expense_entries CASCADE;
DROP TABLE IF EXISTS consumer.expense_categories CASCADE;
DROP TABLE IF EXISTS consumer.membership_requests CASCADE;
DROP TABLE IF EXISTS consumer.customer_links CASCADE;
