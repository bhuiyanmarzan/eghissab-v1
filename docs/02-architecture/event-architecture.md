# Events and workers

FACT: no event publisher, outbox table, Redis client, worker executable or queue exists. `system` is only a namespace.

PROPOSED: persist domain change and outbox record in one SQL transaction; publish asynchronously with bounded retries, deduplication, explicit versioned contracts and dead-letter handling. Consumers must be idempotent. Worker authorization must derive a current valid actor/scope, set local RLS per job, and avoid privileged pool bypass. Revoked permissions and failed jobs must be observable without logging secrets.

Redis may support ephemeral caching/rate limits/coordination after a concrete use case is approved. PostgreSQL remains durable truth. EVENT-001 owns design; no infrastructure has been approved solely by this proposal.

Related: [Documentation index](../README.md).
