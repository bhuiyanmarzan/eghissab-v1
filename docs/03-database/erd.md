# Actual migration ERD

FACT: eight tables only. Optional FK relationships are shown separately. Columns, constraints and indexes are in [dictionary](schema-dictionary.md). The absent listing relation is intentionally excluded.

```mermaid
erDiagram
  identity_users ||--o{ identity_user_contacts : has
  identity_users ||--o{ identity_user_identities : has
  identity_users ||--o{ identity_user_sessions : has
  identity_users ||--o{ identity_mfa_factors : has
  identity_users |o--o{ identity_verification_challenges : subject
  identity_user_contacts |o--o{ identity_verification_challenges : contact
  identity_users ||--o{ platform_role_assignments : assigned
  identity_users |o--o{ platform_role_assignments : grants
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
  identity_verification_challenges {
    uuid id PK
    uuid user_id FK "nullable"
    uuid contact_id FK "nullable"
  }
  platform_roles {
    uuid id PK
  }
  platform_role_assignments {
    uuid id PK
    uuid user_id FK
    uuid role_id FK
    uuid granted_by FK "nullable"
  }
```

Entity names replace schema dots with underscores for display. No target domain relationships are represented as existing tables.

Related: [Documentation index](../README.md).
