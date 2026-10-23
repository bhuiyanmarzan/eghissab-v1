# Database overview

FACT: three migration pairs. Foundation creates pgcrypto and schemas app, identity, platform, organization, billing, store, invoice, consumer, system. Only identity (six tables) and platform (two tables) have table definitions. `app` has four context helpers; remaining namespaces are empty in these migrations. `public.listings` is not defined; unqualified listing queries depend on unknown external state.

`database/sql` uses pgx stdlib; default pool 25 open/25 idle and five-minute lifetime/idle timeout. Compose sets PostgreSQL max_connections=50. Capacity not load-tested. Migration runner uses a privileged URL, API should use a restricted URL; current config/development exceptions are recorded in [issues](../00-ai-context/known-issues.md).

No organization, store, billing, inventory, invoice, consumer, outbox or audit entity is invented in the dictionary. Their schemas/services are future backlog work. User reports completed migrations, but no live DB was inspected. See [dictionary](schema-dictionary.md), [ERD](erd.md), [RLS](rls-policies.md).

Related: [Documentation index](../README.md).
