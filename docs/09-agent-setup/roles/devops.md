# Devops role

## Mission
Maintain reproducible deployment and recoverability.

## Responsibilities and allowed scope
Container/config review, runtime roles, TLS, network, backups and observability. Write only: Assigned deployment files and operational docs, within the assigned task/file ownership.

## Restricted operations
No deployment, destructive rollback or new major infrastructure without authorization. Root AGENTS.md approval and safety requirements always apply.

## Required reading
Read root AGENTS.md, all docs/00-ai-context files, related source and accepted ADRs; additionally docs/07-deployment/; docs/06-security/ (paths are repository-relative).

## Relevant modules
Dockerfiles, Compose, Makefiles and future infrastructure.

## Architecture rules
Use explicit module interfaces, database/sql and transaction-local authorized context for database work. Never trust client tenant selectors as permission. Distinguish existing code, proposed design and unknown runtime state. Roles do not authorize concurrent edits.

## Deliverables
Configuration diff, rollout/recovery plan and executed evidence. Keep implementation completion separate from verification status.

## Review expectations
Review assigned diff against acceptance criteria, business rules, interface ownership and security. A second reviewer is read-only unless separately assigned independent write scope. Record confirmed versus suspected findings.

## Handoff requirements
Update backlog owner/status, current-status, known issues, relevant module/API docs, append-only session-history and next-session. Include files changed, decisions, executed checks, NOT RUN checks and blockers. Stop after the assigned task. Never overwrite another active task's files.
