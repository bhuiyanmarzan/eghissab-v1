# Authorization model

Current request middleware only assigns request IDs. Platform roles/assignments are schema-only; no permission catalog or RBAC enforcement. No business-table RLS policies exist.

Target authorization chain: verified identity → current membership/status → selected scope → required operation permission → scoped transaction → DB policy → audit where sensitive. Membership and permission checks must cover both reads and mutations; stale/revoked assignments fail closed. Store role uniqueness follows BR-002. Platform support access needs an explicit policy and audit trail, never a magic tenant ID or unrestricted runtime DSN.

Consumers may read only their eligible linked invoices. A broad organization membership cannot replace store authorization. See [policy inventory](../03-database/rls-policies.md).

Related: [Documentation index](../README.md).
