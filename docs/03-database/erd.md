# Actual migration ERD

FACT: twenty-six tables in database catalog across identity, consumer, platform, organization, store, and billing. Columns, constraints and indexes are in [dictionary](schema-dictionary.md).

```mermaid
erDiagram
  identity_users ||--o{ identity_user_contacts : has
  identity_users ||--o{ identity_user_identities : has
  identity_users ||--o{ identity_user_sessions : has
  identity_users ||--o{ identity_mfa_factors : has
  identity_users ||--o| consumer_consumer_profiles : profile
  identity_users ||--o{ organization_organizations : creates
  identity_users ||--o{ organization_organization_memberships : belongs_to
  organization_organizations ||--o{ organization_organization_memberships : has
  organization_organizations ||--o{ store_stores : owns
  organization_organizations ||--o{ organization_organization_roles : defines
  organization_organizations ||--o{ store_store_roles : defines
  organization_organizations ||--o{ billing_subscriptions : consumes
  billing_plans ||--o{ billing_plan_versions : versions
  billing_plan_versions ||--o{ billing_subscriptions : selected_by
  billing_subscriptions ||--o{ billing_billing_invoices : generates
  billing_billing_invoices ||--o{ billing_billing_payments : pays
  organization_organizations ||--o{ billing_usage_records : tracks
  store_stores ||--o{ store_store_memberships : has
  identity_users ||--o{ store_store_memberships : assigned
  store_store_roles ||--o{ store_store_memberships : grants
  identity_users ||--o{ platform_role_assignments : assigned
  platform_roles ||--o{ platform_role_assignments : role
  identity_users {
    uuid id PK
  }
  identity_user_contacts {
    uuid id PK
    uuid user_id FK
  }
  identity_user_identities {
    uuid id PK
    uuid user_id FK
  }
  identity_user_sessions {
    uuid id PK
    uuid user_id FK
  }
  identity_mfa_factors {
    uuid id PK
    uuid user_id FK
  }
  consumer_consumer_profiles {
    uuid id PK
    uuid user_id FK "unique"
  }
  identity_verification_challenges {
    uuid id PK
    uuid user_id FK "nullable"
    uuid contact_id FK "nullable"
  }
  store_store_roles ||--o{ store_store_role_permissions : defines
  app_permissions ||--o{ store_store_role_permissions : assigned
  app_menus ||--o{ app_menu_permissions : requires
  app_permissions ||--o{ app_menu_permissions : permits
  store_stores ||--|| store_store_settings : configures
  store_stores ||--o{ store_store_invitations : invites
  store_store_roles ||--o{ store_store_invitations : grants
  consumer_consumer_profiles ||--o{ consumer_customer_links : links
  store_store_customers ||--o{ consumer_customer_links : establishes
  consumer_consumer_profiles ||--o{ consumer_membership_requests : submits
  store_stores ||--o{ consumer_membership_requests : receives
  consumer_consumer_profiles ||--o{ consumer_expense_categories : categorizes
  consumer_consumer_profiles ||--o{ consumer_expense_entries : records
  consumer_expense_entries ||--o{ consumer_expense_adjustments : adjusts
  invoice_invoices ||--o| consumer_expense_entries : claims
  platform_role_assignments {
    uuid id PK
    uuid user_id FK
    uuid role_id FK
    uuid granted_by FK "nullable"
  }
  app_permissions {
    uuid id PK
  }
  store_store_role_permissions {
    uuid role_id PK_FK
    uuid permission_id PK_FK
  }
  app_menus {
    uuid id PK
  }
  app_menu_permissions {
    uuid menu_id PK_FK
    uuid permission_id PK_FK
  }
  store_store_settings {
    uuid store_id PK_FK
  }
  store_store_invitations {
    uuid id PK
    uuid store_id FK
    uuid role_id FK
  }
  consumer_customer_links {
    uuid id PK
    uuid consumer_id FK
    uuid store_customer_id FK
  }
  consumer_membership_requests {
    uuid id PK
    uuid consumer_id FK
    uuid store_id FK
    uuid store_customer_id FK "nullable"
  }
  consumer_expense_categories {
    uuid id PK
    uuid consumer_id FK
    uuid parent_id FK "nullable"
  }
  consumer_expense_entries {
    uuid id PK
    uuid consumer_id FK
    uuid invoice_id FK "nullable"
    uuid store_id FK "nullable"
    uuid category_id FK "nullable"
  }
  consumer_expense_adjustments {
    uuid id PK
    uuid expense_entry_id FK
    uuid created_by FK "nullable"
  }
  system_audit_events {
    uuid id PK
    uuid actor_user_id FK "nullable"
    uuid organization_id FK "nullable"
    uuid store_id FK "nullable"
  }
  system_outbox_events {
    uuid id PK
    string aggregate_type
    uuid aggregate_id
    string event_type
  }
  system_event_deliveries {
    uuid id PK
    uuid event_id FK
    string consumer_name
  }
  system_jobs {
    uuid id PK
    uuid event_id FK "nullable"
    string type
    string status
  }
  system_job_attempts {
    uuid id PK
    uuid job_id FK
    int attempt_number
    string outcome
  }
  system_file_assets {
    uuid id PK
    uuid invoice_id FK "nullable"
    uuid organization_id FK "nullable"
    uuid store_id FK "nullable"
    string storage_key UK
  }
  system_notification_deliveries {
    uuid id PK
    uuid job_id FK "nullable"
    string recipient
    string channel
  }
  system_webhook_receipts {
    uuid id PK
    string provider
    string provider_event_id
    string status
  }
```

Entity names replace schema dots with underscores for display. No target domain relationships are represented as existing tables.

Related: [Documentation index](../README.md).
