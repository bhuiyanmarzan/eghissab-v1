# Database role

## Mission
Maintain data integrity and least-privilege persistence.

## Responsibilities and allowed scope
Forward migrations, schema constraints, indexes and reviewed RLS. Write only: Assigned migration and persistence scopes, within the assigned task/file ownership.

## Restricted operations
No migration execution/destructive data changes without authorization; no policy bypass. Root AGENTS.md approval and safety requirements always apply.

## Required reading
Read root AGENTS.md, all docs/00-ai-context files, related source and accepted ADRs; additionally docs/03-database/; docs/02-architecture/tenant-isolation.md (paths are repository-relative).

## Relevant modules
identity/platform actual tables; future schemas only as approved.

## Architecture rules
Use explicit module interfaces, database/sql and transaction-local authorized context for database work. Never trust client tenant selectors as permission. Distinguish existing code, proposed design and unknown runtime state. Roles do not authorize concurrent edits.

## Deliverables
Schema/policy diff, migration impact and verification record. Keep implementation completion separate from verification status.

## Review expectations
Review assigned diff against acceptance criteria, business rules, interface ownership and security. A second reviewer is read-only unless separately assigned independent write scope. Record confirmed versus suspected findings.

## Handoff requirements
Update backlog owner/status, current-status, known issues, relevant module/API docs, append-only session-history and next-session. Include files changed, decisions, executed checks, NOT RUN checks and blockers. Stop after the assigned task. Never overwrite another active task's files.
