-- 000014_store_operations_and_invoicing.up.sql
-- Domain D: Store operations, customers and invoicing

-- 1. Schema store: Products
CREATE TABLE IF NOT EXISTS store.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    sku VARCHAR(64) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    price NUMERIC(15, 2) NOT NULL CHECK (price >= 0),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_product_sku UNIQUE (store_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_store ON store.products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_status ON store.products(status);

-- 2. Schema store: Inventory Locations
CREATE TABLE IF NOT EXISTS store.inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_location_name UNIQUE (store_id, name)
);

CREATE INDEX IF NOT EXISTS idx_inventory_locations_store ON store.inventory_locations(store_id);

-- Backfill default location for existing stores
INSERT INTO store.inventory_locations (store_id, name, is_default)
SELECT id, 'Default', true FROM store.stores
ON CONFLICT (store_id, name) DO NOTHING;

-- Auto-provision default location on store creation
CREATE OR REPLACE FUNCTION store.trg_init_store_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO store.inventory_locations (store_id, name, is_default)
    VALUES (NEW.id, 'Default', true)
    ON CONFLICT (store_id, name) DO NOTHING;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_init_store_location_trigger ON store.stores;
CREATE TRIGGER trg_init_store_location_trigger
    AFTER INSERT ON store.stores
    FOR EACH ROW EXECUTE FUNCTION store.trg_init_store_location();

-- 3. Schema store: Inventory Balances
CREATE TABLE IF NOT EXISTS store.inventory_balances (
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES store.inventory_locations(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (store_id, product_id, location_id)
);

CREATE INDEX IF NOT EXISTS idx_inventory_balances_product ON store.inventory_balances(product_id);

-- 4. Schema store: Stock Movements (Transactional Inventory Control)
CREATE TABLE IF NOT EXISTS store.stock_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES store.inventory_locations(id) ON DELETE CASCADE,
    quantity_delta NUMERIC(15, 3) NOT NULL,
    reason VARCHAR(50) NOT NULL CHECK (reason IN ('initial_stock', 'purchase_received', 'sale_issued', 'sale_returned', 'inventory_adjustment', 'damaged', 'transfer')),
    reference_id UUID,
    actor_user_id UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_store_product ON store.stock_movements(store_id, product_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_ref ON store.stock_movements(reference_id);

-- Trigger: Automatically synchronize inventory_balances on stock_movements
CREATE OR REPLACE FUNCTION store.trg_apply_stock_movement()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    INSERT INTO store.inventory_balances (store_id, product_id, location_id, quantity, updated_at)
    VALUES (NEW.store_id, NEW.product_id, NEW.location_id, NEW.quantity_delta, clock_timestamp())
    ON CONFLICT (store_id, product_id, location_id)
    DO UPDATE SET 
        quantity = store.inventory_balances.quantity + EXCLUDED.quantity,
        updated_at = clock_timestamp();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_stock_movement_trigger ON store.stock_movements;
CREATE TRIGGER trg_apply_stock_movement_trigger
    AFTER INSERT ON store.stock_movements
    FOR EACH ROW EXECUTE FUNCTION store.trg_apply_stock_movement();

-- 5. Schema store: Store Customers
CREATE TABLE IF NOT EXISTS store.store_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    customer_number VARCHAR(50) NOT NULL,
    display_name VARCHAR(150) NOT NULL,
    phone VARCHAR(50),
    email VARCHAR(320),
    address TEXT,
    consumer_id UUID REFERENCES consumer.consumer_profiles(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_customer_number UNIQUE (store_id, customer_number)
);

CREATE INDEX IF NOT EXISTS idx_store_customers_store ON store.store_customers(store_id);
CREATE INDEX IF NOT EXISTS idx_store_customers_phone ON store.store_customers(phone);
CREATE INDEX IF NOT EXISTS idx_store_customers_consumer ON store.store_customers(consumer_id);

-- 6. Schema invoice: Invoices
CREATE TABLE IF NOT EXISTS invoice.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    store_customer_id UUID REFERENCES store.store_customers(id) ON DELETE SET NULL,
    invoice_number VARCHAR(64) NOT NULL,
    lifecycle_status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (lifecycle_status IN ('draft', 'issued', 'paid', 'partially_paid', 'voided', 'cancelled')),
    subtotal NUMERIC(15, 2) NOT NULL DEFAULT 0,
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    notes TEXT,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    issued_at TIMESTAMPTZ,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_invoice_number UNIQUE (store_id, invoice_number)
);

CREATE INDEX IF NOT EXISTS idx_invoices_store ON invoice.invoices(store_id);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON invoice.invoices(store_customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoice.invoices(lifecycle_status);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoice.invoices(invoice_date);

-- 7. Schema invoice: Invoice Items (Snapshots & Immutability)
CREATE TABLE IF NOT EXISTS invoice.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES store.products(id) ON DELETE SET NULL,
    description_snapshot VARCHAR(255) NOT NULL,
    sku_snapshot VARCHAR(64),
    quantity NUMERIC(15, 3) NOT NULL CHECK (quantity > 0),
    unit_price NUMERIC(15, 2) NOT NULL CHECK (unit_price >= 0),
    discount_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    tax_rate NUMERIC(5, 2) NOT NULL DEFAULT 0,
    tax_amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    line_total NUMERIC(15, 2) NOT NULL CHECK (line_total >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON invoice.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product ON invoice.invoice_items(product_id);

-- Trigger: Protect issued invoice line items from modification
CREATE OR REPLACE FUNCTION invoice.trg_protect_issued_invoice_items()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
    v_status VARCHAR(20);
BEGIN
    SELECT lifecycle_status INTO v_status FROM invoice.invoices WHERE id = COALESCE(OLD.invoice_id, NEW.invoice_id);
    IF v_status IN ('issued', 'paid', 'partially_paid', 'voided', 'cancelled') THEN
        RAISE EXCEPTION 'Cannot modify line items of an issued invoice';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_issued_invoice_items_trigger ON invoice.invoice_items;
CREATE TRIGGER trg_protect_issued_invoice_items_trigger
    BEFORE INSERT OR UPDATE OR DELETE ON invoice.invoice_items
    FOR EACH ROW EXECUTE FUNCTION invoice.trg_protect_issued_invoice_items();

-- Trigger: Protect financial totals of issued invoices
CREATE OR REPLACE FUNCTION invoice.trg_protect_issued_invoice()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.lifecycle_status IN ('issued', 'paid', 'partially_paid', 'voided', 'cancelled') THEN
        IF NEW.total_amount <> OLD.total_amount OR NEW.subtotal <> OLD.subtotal 
           OR NEW.tax_amount <> OLD.tax_amount OR NEW.discount_amount <> OLD.discount_amount THEN
            RAISE EXCEPTION 'Cannot modify financial totals of issued invoice %', OLD.invoice_number;
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_issued_invoice_trigger ON invoice.invoices;
CREATE TRIGGER trg_protect_issued_invoice_trigger
    BEFORE UPDATE ON invoice.invoices
    FOR EACH ROW EXECUTE FUNCTION invoice.trg_protect_issued_invoice();

-- 8. Schema invoice: Consumer Decisions
CREATE TABLE IF NOT EXISTS invoice.invoice_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('pending', 'approved', 'disputed', 'rejected')),
    notes TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_invoice_consumer_decision UNIQUE (invoice_id, consumer_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_decisions_invoice ON invoice.invoice_decisions(invoice_id);

-- 9. Schema invoice: Invoice Events Audit Trail
CREATE TABLE IF NOT EXISTS invoice.invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES identity.users(id),
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_invoice ON invoice.invoice_events(invoice_id);

-- 10. Schema invoice: Invoice Payments
CREATE TABLE IF NOT EXISTS invoice.invoice_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    method VARCHAR(30) NOT NULL CHECK (method IN ('cash', 'card', 'mobile_banking', 'bank_transfer', 'credit_balance', 'other')),
    status VARCHAR(20) NOT NULL DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),
    external_reference VARCHAR(255),
    received_by UUID REFERENCES identity.users(id),
    paid_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_invoice ON invoice.invoice_payments(invoice_id);

-- 11. Schema invoice: Invoice Adjustments (Credit/Debit Notes)
CREATE TABLE IF NOT EXISTS invoice.invoice_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    adjustment_number VARCHAR(64) NOT NULL,
    type VARCHAR(30) NOT NULL CHECK (type IN ('credit_note', 'debit_note', 'tax_correction', 'discount_reversal', 'write_off')),
    amount NUMERIC(15, 2) NOT NULL CHECK (amount > 0),
    tax_impact NUMERIC(15, 2) NOT NULL DEFAULT 0,
    reason TEXT NOT NULL,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_invoice_adjustments_invoice ON invoice.invoice_adjustments(invoice_id);

-- 12. Permissions, Grants and Row-Level Security
GRANT USAGE ON SCHEMA store TO eghissab_app;
GRANT USAGE ON SCHEMA invoice TO eghissab_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA store TO eghissab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA invoice TO eghissab_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA store GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA invoice GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO eghissab_app;

-- Force RLS on all tables
ALTER TABLE store.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.products FORCE ROW LEVEL SECURITY;
CREATE POLICY products_policy ON store.products FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE store.inventory_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.inventory_locations FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_locations_policy ON store.inventory_locations FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE store.inventory_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.inventory_balances FORCE ROW LEVEL SECURITY;
CREATE POLICY inventory_balances_policy ON store.inventory_balances FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE store.stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.stock_movements FORCE ROW LEVEL SECURITY;
CREATE POLICY stock_movements_policy ON store.stock_movements FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE store.store_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE store.store_customers FORCE ROW LEVEL SECURITY;
CREATE POLICY store_customers_policy ON store.store_customers FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoices FORCE ROW LEVEL SECURITY;
CREATE POLICY invoices_policy ON invoice.invoices FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoice_items FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_items_policy ON invoice.invoice_items FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoice_decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoice_decisions FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_decisions_policy ON invoice.invoice_decisions FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoice_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoice_events FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_events_policy ON invoice.invoice_events FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoice_payments FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_payments_policy ON invoice.invoice_payments FOR ALL TO eghissab_app USING (true) WITH CHECK (true);

ALTER TABLE invoice.invoice_adjustments ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice.invoice_adjustments FORCE ROW LEVEL SECURITY;
CREATE POLICY invoice_adjustments_policy ON invoice.invoice_adjustments FOR ALL TO eghissab_app USING (true) WITH CHECK (true);
