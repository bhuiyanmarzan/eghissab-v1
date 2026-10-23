# Migration inventory and procedure

| Version | Up definitions | Down behavior |
|---|---|---|
| 000001_create_foundation | pgcrypto; nine schemas; four app context functions | drops functions, schemas and pgcrypto |
| 000002_create_identity | six identity and two platform tables plus indexes | drops tables/indexes in dependency order |
| 000003_create_app_role | create role if absent; NOBYPASSRLS; connection/schema/DML/function/default grants | revokes current grants and drops role; default privileges not reversed |

Source: `backend/migrations/`. Runtime migration history UNKNOWN. Do not infer applied version from binaries or files. `backend/cmd/migrate/main.go` uses file://migrations relative to working directory; up applies pending versions, down takes one step. No production rollback guard exists in code despite tutorial discussion in README.

Future procedure: inspect deployed version/dirty state with authorized access; review forward migration, backup and rollback impact; apply in an approved maintenance/deployment process using migration credentials; verify restricted-role behavior. Preserve published migrations; add corrective forward migrations. Destructive rollback requires explicit authorization. No migration was modified or executed during DOC-001.

Related: [Documentation index](../README.md).
