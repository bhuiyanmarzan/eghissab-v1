-- 000015_global_customers_and_expenses.up.sql
-- Domain E: Global customers, store membership and expenses

-- 1. Schema consumer: Customer Links (Identity Correspondence & Temporal Access Gate)
CREATE TABLE IF NOT EXISTS consumer.customer_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
    store_customer_id UUID NOT NULL REFERENCES store.store_customers(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'revoked', 'suspended')),
    verified_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    access_from TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_consumer_store_customer UNIQUE (consumer_id, store_customer_id)
);

CREATE INDEX IF NOT EXISTS idx_customer_links_consumer ON consumer.customer_links(consumer_id);
CREATE INDEX IF NOT EXISTS idx_customer_links_store_customer ON consumer.customer_links(store_customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_links_status ON consumer.customer_links(status);

-- 2. Schema consumer: Store Membership Requests (Pending Requests Do Not Grant Access)
CREATE TABLE IF NOT EXISTS consumer.membership_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    store_customer_id UUID REFERENCES store.store_customers(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    notes TEXT,
    reviewed_by UUID REFERENCES identity.users(id),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_membership_requests_store ON consumer.membership_requests(store_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_requests_consumer ON consumer.membership_requests(consumer_id, status);

-- 3. Schema consumer: Expense Categories (Hierarchical Personal Budgeting)
CREATE TABLE IF NOT EXISTS consumer.expense_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES consumer.expense_categories(id) ON DELETE CASCADE,
    color VARCHAR(20),
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_consumer_category_name UNIQUE (consumer_id, name)
);

CREATE INDEX IF NOT EXISTS idx_expense_categories_consumer ON consumer.expense_categories(consumer_id);
CREATE INDEX IF NOT EXISTS idx_expense_categories_parent ON consumer.expense_categories(parent_id);

-- 4. Schema consumer: Expense Entries (Personal & Invoice-Sourced Expenses)
CREATE TABLE IF NOT EXISTS consumer.expense_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoice.invoices(id) ON DELETE SET NULL,
    store_id UUID REFERENCES store.stores(id) ON DELETE SET NULL,
    category_id UUID REFERENCES consumer.expense_categories(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('invoice', 'manual', 'bank_feed', 'import')),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Partial Unique Index: Prevent claiming or counting the same invoice twice in expenses
CREATE UNIQUE INDEX IF NOT EXISTS uq_consumer_invoice_expense 
ON consumer.expense_entries (consumer_id, invoice_id) 
WHERE invoice_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expense_entries_consumer ON consumer.expense_entries(consumer_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_date ON consumer.expense_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_expense_entries_category ON consumer.expense_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_expense_entries_store ON consumer.expense_entries(store_id);

-- 5. Schema consumer: Expense Adjustments (Auditable Corrections without rewriting records)
CREATE TABLE IF NOT EXISTS consumer.expense_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_entry_id UUID NOT NULL REFERENCES consumer.expense_entries(id) ON DELETE CASCADE,
    amount_delta NUMERIC(15, 2) NOT NULL CHECK (amount_delta <> 0),
    reason TEXT NOT NULL,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_expense_adjustments_entry ON consumer.expense_adjustments(expense_entry_id);

-- 6. Permissions, Grants and Row-Level Security
GRANT USAGE ON SCHEMA consumer TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA consumer TO eghissab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA consumer GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;

-- Force RLS on all tables
ALTER TABLE consumer.customer_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.customer_links FORCE ROW LEVEL SECURITY;
CREATE POLICY customer_links_policy ON consumer.customer_links FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE consumer.membership_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.membership_requests FORCE ROW LEVEL SECURITY;
CREATE POLICY membership_requests_policy ON consumer.membership_requests FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE consumer.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.expense_categories FORCE ROW LEVEL SECURITY;
CREATE POLICY expense_categories_policy ON consumer.expense_categories FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE consumer.expense_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.expense_entries FORCE ROW LEVEL SECURITY;
CREATE POLICY expense_entries_policy ON consumer.expense_entries FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE consumer.expense_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE consumer.expense_adjustments FORCE ROW LEVEL SECURITY;
CREATE POLICY expense_adjustments_policy ON consumer.expense_adjustments FOR ALL TO eghissab_app USING (true) WITH CHECK (true);
