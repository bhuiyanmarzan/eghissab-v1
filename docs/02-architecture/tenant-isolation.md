# Tenant isolation

## Actual mechanism
`app.current_user_id/current_org_id/current_store_id/current_consumer_id` read optional UUID settings; empty/missing becomes NULL. Malformed nonempty UUID values cause casts to fail. `WithTenantTx` sets all four with parameterized `set_config(..., true)` and commits/rolls back; missing optional values are empty strings. No table policies consume these helpers yet.

## Target lifecycle
Server validates identity and requested membership → begin SQL transaction → set local trusted scope → execute all authorized queries on that same transaction → commit or rollback → return connection to pool. Do not use session-wide SET or query on a separate pool connection. No client header is authority. Worker jobs resolve scoped actor/permissions afresh.

SEC-001 must prevent a general or manually injected executor being accepted as tenant-authorized and reject invalid required identities. Authenticated global consumer/platform access needs a deliberate scope model, not fabricated organization IDs. Live connection reuse, cancellation, rollback and cross-scope denial need verification before claiming isolation. See [issues](../00-ai-context/known-issues.md).

Related: [Documentation index](../README.md).
