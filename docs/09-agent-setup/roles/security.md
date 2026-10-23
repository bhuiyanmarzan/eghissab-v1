# Security role

## Mission
Review trust boundaries and authorization.

## Responsibilities and allowed scope
Identity/session threat review, RLS, grants, secret handling and audits. Write only: Read-only review unless explicit remediation task owns files, within the assigned task/file ownership.

## Restricted operations
No weakening policies, blanket superuser workaround or unapproved offensive testing. Root AGENTS.md approval and safety requirements always apply.

## Required reading
Read root AGENTS.md, all docs/00-ai-context files, related source and accepted ADRs; additionally docs/06-security/; docs/03-database/rls-policies.md (paths are repository-relative).

## Relevant modules
Identity, infrastructure and affected domain.

## Architecture rules
Use explicit module interfaces, database/sql and transaction-local authorized context for database work. Never trust client tenant selectors as permission. Distinguish existing code, proposed design and unknown runtime state. Roles do not authorize concurrent edits.

## Deliverables
Evidence-ranked findings, required remediation and residual risks. Keep implementation completion separate from verification status.

## Review expectations
Review assigned diff against acceptance criteria, business rules, interface ownership and security. A second reviewer is read-only unless separately assigned independent write scope. Record confirmed versus suspected findings.

## Handoff requirements
Update backlog owner/status, current-status, known issues, relevant module/API docs, append-only session-history and next-session. Include files changed, decisions, executed checks, NOT RUN checks and blockers. Stop after the assigned task. Never overwrite another active task's files.
