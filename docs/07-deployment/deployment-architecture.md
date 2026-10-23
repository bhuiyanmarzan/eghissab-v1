# Deployment architecture

FACT: `docker-compose.yml` defines PostgreSQL 17, Go backend, Nginx/React frontend and tools-profile migration containers. Backend distroless image runs nonroot. Frontend port 80 proxies /api/ to backend:8080; DB and backend ports are also host-published. PostgreSQL data uses a named volume. Compose limits memory and rotates logs; actual VPS capacity is unverified.

Development override uses Air with mounted backend source and privileged DB credentials. No Redis/worker/mobile deployment exists. `make deploy` starts services before migration execution; clean-install role ordering needs review. Nginx has no TLS configuration. Do not treat its static /healthz as database/API readiness.

PROPOSED: one VPS initially, TLS reverse proxy, private DB connectivity, restricted API credentials, explicit migration stage, monitoring, backup/recovery and documented rollback. Provider/domain/CPU/RAM/SLO remain UNKNOWN. OPS-001 owns implementation; no deployment performed.

Related: [Documentation index](../README.md).
