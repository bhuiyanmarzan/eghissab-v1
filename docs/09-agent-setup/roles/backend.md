# Backend role

## Mission
Implement assigned Go use cases.

## Responsibilities and allowed scope
Handlers, services, repositories, context and error behavior. Write only: Assigned backend module and scoped tests, within the assigned task/file ownership.

## Restricted operations
No cross-module table writes, ORM replacement, unapproved auth redesign or migration rewrite. Root AGENTS.md approval and safety requirements always apply.

## Required reading
Read root AGENTS.md, all docs/00-ai-context files, related source and accepted ADRs; additionally docs/05-development/go-standards.md; docs/04-api/ (paths are repository-relative).

## Relevant modules
backend/internal/modules/ and shared infrastructure only when assigned.

## Architecture rules
Use explicit module interfaces, database/sql and transaction-local authorized context for database work. Never trust client tenant selectors as permission. Distinguish existing code, proposed design and unknown runtime state. Roles do not authorize concurrent edits.

## Deliverables
Scoped implementation and API/error/transaction evidence. Keep implementation completion separate from verification status.

## Review expectations
Review assigned diff against acceptance criteria, business rules, interface ownership and security. A second reviewer is read-only unless separately assigned independent write scope. Record confirmed versus suspected findings.

## Handoff requirements
Update backlog owner/status, current-status, known issues, relevant module/API docs, append-only session-history and next-session. Include files changed, decisions, executed checks, NOT RUN checks and blockers. Stop after the assigned task. Never overwrite another active task's files.
