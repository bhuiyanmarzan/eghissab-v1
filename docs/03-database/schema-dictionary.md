# Schema dictionary

FACT: derived only from `backend/migrations/000002_create_identity.up.sql`; live catalog UNKNOWN. Exact definitions below specify every column/type/default/nullability, PK/FK and CHECK. No explicit ON DELETE/ON UPDATE clauses exist; no triggers maintain updated_at. See [constraints/indexes](constraints-indexes.md) for explicit indexes.

All eight tables: RLS enabled = NO as defined; forced = NO; policies = NONE; grants = SELECT/INSERT/UPDATE/DELETE to eghissab_app via migration 000003. Role attributes/live overrides unverified. Known security gap: broad access without table policies.

## identity.users

Owning module: identity.

```sql
CREATE TABLE identity.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name VARCHAR(120) NOT NULL,
    last_name VARCHAR(120),
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending','active','suspended','disabled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.user_contacts

Owning module: identity.

```sql
CREATE TABLE identity.user_contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    type VARCHAR(12) NOT NULL
        CHECK (type IN ('email','phone')),
    normalized_value VARCHAR(320) NOT NULL,
    is_primary BOOLEAN NOT NULL DEFAULT false,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.user_identities

Owning module: identity.

```sql
CREATE TABLE identity.user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    provider VARCHAR(30) NOT NULL
        CHECK (provider IN ('credentials','google','facebook','github')),
    provider_subject VARCHAR(255),
    password_hash TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (
        (provider = 'credentials'
         AND password_hash IS NOT NULL
         AND provider_subject IS NULL)
        OR
        (provider <> 'credentials'
         AND provider_subject IS NOT NULL
         AND password_hash IS NULL)
    )
);
```

## identity.user_sessions

Owning module: identity.

```sql
CREATE TABLE identity.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    token_family_id UUID NOT NULL,
    refresh_token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.mfa_factors

Owning module: identity.

```sql
CREATE TABLE identity.mfa_factors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    factor_type VARCHAR(30) NOT NULL,
    encrypted_secret TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## identity.verification_challenges

Owning module: identity.

```sql
CREATE TABLE identity.verification_challenges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES identity.users(id),
    contact_id UUID REFERENCES identity.user_contacts(id),
    purpose VARCHAR(30) NOT NULL,
    challenge_hash TEXT NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0
        CHECK (attempt_count >= 0),
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## platform.roles

Owning module: platform.

```sql
CREATE TABLE platform.roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    name VARCHAR(120) NOT NULL
);
```

## platform.role_assignments

Owning module: platform.

```sql
CREATE TABLE platform.role_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES identity.users(id),
    role_id UUID NOT NULL REFERENCES platform.roles(id),
    granted_by UUID REFERENCES identity.users(id),
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

## consumer.consumer_profiles

Owning module: consumer. Added in migration `000007_consumer_profiles.up.sql`. RLS forced (`user_id = app.current_user_id()`).

```sql
CREATE TABLE consumer.consumer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES identity.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'disabled')),
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
## organization.organizations

Owning module: organization. Added in migration `000010_organization_and_store.up.sql`. RLS forced.

```sql
CREATE TABLE organization.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'disabled')),
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

## organization.organization_memberships

Owning module: organization. Added in migration `000010_organization_and_store.up.sql`. RLS forced. BR-001 last-owner protection trigger attached.

```sql
CREATE TABLE organization.organization_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'invited', 'suspended')),
    is_owner BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_membership_user UNIQUE (organization_id, user_id)
);
```

## store.stores

Owning module: store. Added in migration `000010_organization_and_store.up.sql`. RLS forced.

```sql
CREATE TABLE store.stores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    name VARCHAR(120) NOT NULL,
    slug VARCHAR(120) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended', 'disabled', 'archived')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_org_store_slug UNIQUE (organization_id, slug)
);
```

## store.store_memberships

Owning module: store. Added in migration `000010_organization_and_store.up.sql`. RLS forced. Enforces BR-002: one active role per user per store.

```sql
CREATE TABLE store.store_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES identity.users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_membership_user UNIQUE (store_id, user_id)
);
```

## billing.subscriptions

Owning module: billing. Added in migration `000011_billing_schema.up.sql`. RLS forced. Enforces maximum of one currently effective subscription per organization via partial unique index.

```sql
CREATE TABLE billing.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organization.organizations(id) ON DELETE CASCADE,
    plan_version_id UUID NOT NULL REFERENCES billing.plan_versions(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'trialing', 'past_due', 'canceled', 'expired')),
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    canceled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Partial Unique Index:
CREATE UNIQUE INDEX uq_effective_subscription_per_org
ON billing.subscriptions (organization_id)
WHERE status IN ('active', 'trialing', 'past_due');
```

## billing.billing_webhook_events

Owning module: billing. Added in migration `000011_billing_schema.up.sql`. RLS forced. Enforces durable webhook receipt deduplication.

```sql
CREATE TABLE billing.billing_webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider VARCHAR(50) NOT NULL,
    event_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'processed', 'failed', 'ignored')),
    error_message TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_webhook_provider_event UNIQUE (provider, event_id)
);
```

## app.permissions

Owning module: authorization / store. Added in migration `000013_role_and_permission_management.up.sql`. RLS forced. Baseline catalog defines permissions across scopes.

```sql
CREATE TABLE app.permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(80) NOT NULL UNIQUE,
    scope VARCHAR(30) NOT NULL CHECK (scope IN ('organization', 'store', 'platform')),
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

## store.store_role_permissions

Owning module: store. Composite PK mapping organization-reusable store roles to catalog permissions.

```sql
CREATE TABLE store.store_role_permissions (
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);
```

## app.menus & app.menu_permissions

Owning module: presentation / store. Presentation metadata for hierarchical navigation trees. Separated from authorization authority.

```sql
CREATE TABLE app.menus (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(80) NOT NULL UNIQUE,
    label VARCHAR(120) NOT NULL,
    route VARCHAR(255) NOT NULL,
    parent_id UUID REFERENCES app.menus(id) ON DELETE CASCADE,
    portal VARCHAR(30) NOT NULL DEFAULT 'merchant' CHECK (portal IN ('merchant', 'consumer', 'admin')),
    display_order INT NOT NULL DEFAULT 0,
    icon VARCHAR(50),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE app.menu_permissions (
    menu_id UUID NOT NULL REFERENCES app.menus(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES app.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (menu_id, permission_id)
);
```

## store.store_settings

Owning module: store. Store operational settings with default timezone Asia/Dhaka and currency BDT. Auto-initialized by trigger `store.trg_init_store_settings`.

```sql
CREATE TABLE store.store_settings (
    store_id UUID PRIMARY KEY REFERENCES store.stores(id) ON DELETE CASCADE,
    timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Dhaka',
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    invoice_preferences JSONB NOT NULL DEFAULT '{"prefix": "INV", "next_number": 1, "paper_size": "A4", "show_tax": true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

## store.store_invitations

Owning module: store. Staff invitations lifecycle with single-use 32-byte tokens.

```sql
CREATE TABLE store.store_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    intended_contact VARCHAR(320) NOT NULL,
    role_id UUID NOT NULL REFERENCES store.store_roles(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'accepted', 'revoked', 'expired')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_by UUID NOT NULL REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    accepted_at TIMESTAMPTZ
);
```

## store.products

Owning module: store. Added in migration `000014_store_operations_and_invoicing.up.sql`. RLS forced. Product catalog isolated per store.

```sql
CREATE TABLE store.products (
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
```

## store.inventory_locations

Owning module: store. Storage locations per store. Default location auto-initialized on store creation via `store.trg_init_store_location`.

```sql
CREATE TABLE store.inventory_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_store_location_name UNIQUE (store_id, name)
);
```

## store.inventory_balances

Owning module: store. Composite PK tracking stock quantity per product per location. Updated exclusively by trigger `store.trg_apply_stock_movement`.

```sql
CREATE TABLE store.inventory_balances (
    store_id UUID NOT NULL REFERENCES store.stores(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES store.products(id) ON DELETE CASCADE,
    location_id UUID NOT NULL REFERENCES store.inventory_locations(id) ON DELETE CASCADE,
    quantity NUMERIC(15, 3) NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (store_id, product_id, location_id)
);
```

## store.stock_movements

Owning module: store. Transactional stock audit ledger. Controlled movements automatically sync `inventory_balances`.

```sql
CREATE TABLE store.stock_movements (
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
```

## store.store_customers

Owning module: store. Customers isolated per store with sequential customer numbers and optional consumer profile linkage.

```sql
CREATE TABLE store.store_customers (
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
```

## invoice.invoices

Owning module: invoice. Invoices isolated per store with lifecycle states (`draft`, `issued`, `paid`, `partially_paid`, `voided`, `cancelled`). Protected by immutability trigger `invoice.trg_protect_issued_invoice`.

```sql
CREATE TABLE invoice.invoices (
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
```

## invoice.invoice_items

Owning module: invoice. Line items with immutable snapshots of description, price, discounts, and taxes. Protected by trigger `invoice.trg_protect_issued_invoice_items`.

```sql
CREATE TABLE invoice.invoice_items (
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
```

## invoice.invoice_decisions

Owning module: invoice. Consumer decision records (`pending`, `approved`, `disputed`, `rejected`).

```sql
CREATE TABLE invoice.invoice_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id),
    decision VARCHAR(20) NOT NULL CHECK (decision IN ('pending', 'approved', 'disputed', 'rejected')),
    notes TEXT,
    decided_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT uq_invoice_consumer_decision UNIQUE (invoice_id, consumer_id)
);
```

## invoice.invoice_events

Owning module: invoice. Append-only audit trail logging all invoice lifecycle events.

```sql
CREATE TABLE invoice.invoice_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES invoice.invoices(id) ON DELETE CASCADE,
    actor_user_id UUID REFERENCES identity.users(id),
    event_type VARCHAR(50) NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

## invoice.invoice_payments

Owning module: invoice. Payment records for issued invoices with overpayment protection.

```sql
CREATE TABLE invoice.invoice_payments (
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
```

## invoice.invoice_adjustments

Owning module: invoice. Credit and debit notes aligning with accounting requirements without altering immutable issued invoice history.

```sql
CREATE TABLE invoice.invoice_adjustments (
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
```

## consumer.customer_links

Owning module: consumer. Added in migration `000015_global_customers_and_expenses.up.sql`. RLS forced. Verified correspondence linking a global consumer profile to a store-isolated customer with temporal access gating (`access_from`).

```sql
CREATE TABLE consumer.customer_links (
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
```

## consumer.membership_requests

Owning module: consumer. Added in migration `000015_global_customers_and_expenses.up.sql`. RLS forced. Isolated applications for store linking. Pending requests grant zero invoice access until approved by store staff (`customer.manage` or org owner).

```sql
CREATE TABLE consumer.membership_requests (
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
```

## consumer.expense_categories

Owning module: consumer. Added in migration `000015_global_customers_and_expenses.up.sql`. RLS forced. Hierarchical categories for personal budgeting.

```sql
CREATE TABLE consumer.expense_categories (
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
```

## consumer.expense_entries

Owning module: consumer. Added in migration `000015_global_customers_and_expenses.up.sql`. RLS forced. Consumer personal expense ledger supporting both claimed invoices and manual personal expenses (`source_type = 'manual'`). Enforces invoice claim deduplication via partial unique index.

```sql
CREATE TABLE consumer.expense_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    consumer_id UUID NOT NULL REFERENCES consumer.consumer_profiles(id) ON DELETE CASCADE,
    invoice_id UUID REFERENCES invoice.invoices(id) ON DELETE SET NULL,
    store_id UUID REFERENCES store.stores(id) ON DELETE SET NULL,
    category_id UUID REFERENCES consumer.expense_categories(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(3) NOT NULL DEFAULT 'BDT',
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('invoice', 'manual', 'recurring')),
    entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
    description TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

-- Partial Unique Index (Deduplication):
CREATE UNIQUE INDEX uq_consumer_invoice_expense
ON consumer.expense_entries (consumer_id, invoice_id)
WHERE invoice_id IS NOT NULL;
```

## consumer.expense_adjustments

Owning module: consumer. Added in migration `000015_global_customers_and_expenses.up.sql`. RLS forced. Auditable post-entry corrections without modifying base expense records.

```sql
CREATE TABLE consumer.expense_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_entry_id UUID NOT NULL REFERENCES consumer.expense_entries(id) ON DELETE CASCADE,
    amount_delta NUMERIC(15, 2) NOT NULL CHECK (amount_delta <> 0),
    reason TEXT NOT NULL,
    created_by UUID REFERENCES identity.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
```

Related: [Documentation index](../README.md).



