# Environment configuration

Sources: root/backend `.env.sample`, `backend/internal/config/config.go`, Makefiles and Compose. Actual `.env` secret contents were not read.

| Variable | Current behavior |
|---|---|
| PORT | Config default 8080; Compose fixes container port 8080 |
| ENV | Config default development; Compose selects environment; does not gate destructive migration commands |
| DATABASE_URL | Runtime DSN; config falls back to POSTGRES_USER/PASSWORD/DB and localhost |
| MIGRATION_DATABASE_URL | Migration DSN; config falls back to runtime URL |
| POSTGRES_USER/PASSWORD/DB/PORT | PostgreSQL provisioning/URL construction; port default 5432 in config |
| POSTGRES_APP_USER/PASSWORD | Production Compose app URL; migration role/password are fixed and not driven by these variables |
| DB_MAX_OPEN_CONNS / DB_MAX_IDLE_CONNS | Config defaults 25/25 |
| DB_CONN_MAX_LIFETIME / DB_CONN_MAX_IDLE_TIME | Config defaults 5m/5m |
| LOG_LEVEL | Supplied by Compose but main fixes slog level Info |
| VITE_API_URL | Frontend Docker build arg default /api; starter does not consume it |

Config attempts `.env` and `../.env`. Invalid int/duration values fall back to defaults; strict production validation is absent. Never print live DSNs or passwords into docs. Provision distinct app/migration secrets and verify role identity. Changing an environment app password does not rotate the fixed migration-created role password. See [security issues](../00-ai-context/known-issues.md).

Related: [Documentation index](../README.md).
