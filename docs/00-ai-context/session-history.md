# Session history

Append-only: add entries; do not rewrite old results.

## 2026-10-22 — DOC-001 — Codex
- Inspected clean initial Git state at 94b9196 and five recent commits; read backend/frontend source, migrations, tests, Compose/Docker/config examples and existing README files.
- Created AGENTS.md and docs/00–09; requested `.agents` content staged in docs/09-agent-setup after protected-path write rejection. Existing README/application/migration files preserved.
- Recorded five approved business rules as ADR-001–005; no new business approvals invented.
- Result: persistent project memory, actual eight-table dictionary/ERD, API inventory, standards, security gaps, staged agent workflows and deterministic backlog.
- Verification: documentation checks only, recorded in verification-report.md. Application tests/builds/migrations NOT RUN by instruction.
- Blocker: `.agents/` installation denied by environment approval policy. Handoff: install staged files when authorized; next implementation candidate SEC-001; no feature development started.

Related: [Documentation index](../README.md).

## 2026-10-22 — AUTH-001 and scoped security prerequisites — Codex
- User selected /home/maezan/Desktop/coding/eghissab-v1 and explicitly requested the complete backend identity lifecycle with existing database/sql/schema/RLS conventions and no automated tests.
- Inspected all project memory, role/Go/API docs, schema/grants, transaction infrastructure, configuration/composition and Git state. AGENTS.md and docs/ were already untracked; preserved unrelated work and secrets. No subagents used.
- Added identity handler/service/repository/token/password/SMTP implementation; composed eight routes and live-session middleware. Added forward-only migration 000004 with restricted bootstrap functions, dedicated NOLOGIN role, identity FORCE RLS, least-privilege grants, session rotation state, normalized email/family indexes and persistent rate budgets.
- Hardened tenant executor provenance/required context/nesting, runtime role checks and configuration; closed pool on failed ping; updated Compose/example configuration, architecture/API/OpenAPI/module/memory/setup documentation.
- Source review covered purpose/expiry/attempt limits, hash-only tokens, service-owned transactions, family reuse revocation committed on failure, serialized refresh/logout and fixed search_path/role grants. Required live security checks remain unverified.
- Verification: gofmt; go build -buildvcs=false ./... completed successfully in a staged source copy and the target repository (no test execution). Initial compilation found and corrected a missing nil error return in the tenant guard. No dependencies added. Automated tests, migration execution, database queries, services, SMTP delivery, race tests and deployment NOT RUN.
- State: IMPLEMENTED_UNVERIFIED, not VERIFIED/DONE. Setup requires migration application, independently provisioned secrets/runtime password/SMTP/trusted proxy CIDRs and HTTPS frontend verification page. DOC-001 installation blocker and unrelated public listing prototype remain unchanged.
