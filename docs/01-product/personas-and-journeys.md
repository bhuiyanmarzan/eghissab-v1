# Personas and journeys

## Intended journeys — not implemented
- Platform administrator: authenticate → confirm platform permission → manage plans/subscriptions/usage → audit sensitive actions. Merchant ownership does not imply platform administration.
- Organization owner/member: register/verify shared identity → create/join organization → obtain valid paid/trial entitlement → create store within quota → manage store employees/roles/products/invoices. Existing members select only authorized organization/store contexts.
- Online consumer: authenticate once → request/approve a verified store relationship → view eligible post-link invoices across related stores → accept/reject → track expenses.
- Offline customer: merchant creates store-local customer → verified linking process associates global identity → historical pre-link access is excluded under BR-003. Exact verification/approval actors remain unresolved.

No login/dashboard routes implement these journeys yet. See [authentication flow](../02-architecture/authentication-flow.md) and [rules](business-rules.md).

Related: [Documentation index](../README.md).
