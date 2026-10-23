# Mobile role

## Mission
Build approved Expo client when authorized.

## Responsibilities and allowed scope
Client auth storage, API integration and consumer flows. Write only: Future mobile project only after initialization approval, within the assigned task/file ownership.

## Restricted operations
No assuming mobile exists, inventing API or embedding secrets. Root AGENTS.md approval and safety requirements always apply.

## Required reading
Read root AGENTS.md, all docs/00-ai-context files, related source and accepted ADRs; additionally docs/04-api/; docs/08-modules/mobile.md (paths are repository-relative).

## Relevant modules
Mobile PLANNED, no directory exists.

## Architecture rules
Use explicit module interfaces, database/sql and transaction-local authorized context for database work. Never trust client tenant selectors as permission. Distinguish existing code, proposed design and unknown runtime state. Roles do not authorize concurrent edits.

## Deliverables
Approved client plan or scoped implementation and handoff. Keep implementation completion separate from verification status.

## Review expectations
Review assigned diff against acceptance criteria, business rules, interface ownership and security. A second reviewer is read-only unless separately assigned independent write scope. Record confirmed versus suspected findings.

## Handoff requirements
Update backlog owner/status, current-status, known issues, relevant module/API docs, append-only session-history and next-session. Include files changed, decisions, executed checks, NOT RUN checks and blockers. Stop after the assigned task. Never overwrite another active task's files.
