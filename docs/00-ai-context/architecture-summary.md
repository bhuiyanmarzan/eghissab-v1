# Architecture summary

## 2026-10-22 authentication update

Current implementation update: identity module and restricted bootstrap functions are now wired into cmd/api; tenant authorization guards are hardened. The earlier inventory below describes the pre-authentication baseline. See ../02-architecture/authentication-flow.md.


## Implemented code, not runtime verification
`backend/cmd/api/main.go` composes config, SQL pool, health/listing modules, request IDs, JSON logging, HTTP timeouts and graceful shutdown. Handler → service → repository layers exist for listing. `internal/db` and `internal/handlers` are compatibility wrappers. The API constructs a transaction manager but does not inject it into listing services.

`backend/internal/database/tx.go` implements transactions and local RLS configuration; it does not prove membership or distinguish a generic transaction from an authorized tenant transaction. See [issues](known-issues.md).

## Target architecture
Clients → Go API → domain modules → PostgreSQL. Identity is shared; organization owns membership, billing owns entitlement, store owns store membership/roles, inventory and invoices operate inside stores, consumer owns approved links and cross-store personal views. Redis is proposed for ephemeral coordination/caching, never the authoritative entitlement or permission source. Durable event/outbox processing and workers are planned, not wired. See [module boundaries](../02-architecture/module-boundaries.md) and [dependency map](dependency-map.md).

Related: [Documentation index](../README.md).
