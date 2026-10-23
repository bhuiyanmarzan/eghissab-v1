# EGHissab agent instructions

## Start here
Read [project memory](docs/00-ai-context/project-context.md), all files in `docs/00-ai-context/`, [backlog](docs/00-ai-context/task-backlog.md), [handoff](docs/00-ai-context/next-session.md), and related source before editing. [Documentation index](docs/README.md) locates architecture, database, security, and module details.

## Source of truth
1. Explicit current user instructions.
2. Implementation and migrations for current behavior.
3. Accepted ADRs for intended design.
4. Approved product/business rules.
5. Current task requirements and acceptance criteria.
6. Architecture and module documentation.
7. AI memory and handoff documents.
8. Assumptions and suggestions.

Record code/ADR conflicts; implementation evidence does not revoke approved intent. Label FACT, USER-REPORTED, PROPOSED, and UNKNOWN. Never invent approvals, endpoints, tables, or completion claims.

## Execution rules
Select one authorized task; verify dependencies, owner, and write scope. Inspect actual code and preserve unrelated work. Never start another task automatically. Use `database/sql`, parameterized queries, request context, service-owned transactions, and transaction-local RLS variables. Verify identity/membership server-side; client tenant IDs are selectors, never authority. Preserve RLS, existing migrations, data, and module boundaries. Never bypass authorization for convenience or commit secrets.

Obtain explicit approval before destructive DB work, dropping/renaming production columns/tables, breaking API contracts, changing approved business rules, replacing authentication architecture, weakening security, major infrastructure dependencies, or established module boundary changes. Existing explicit authorization counts; do not ask twice. Record architectural choices in ADRs without inventing ACCEPTED status.

## Verification and completion
Follow [Definition of Done](docs/05-development/definition-of-done.md). Record implementation completion, tests executed, security review, documentation, and approval independently. Run checks required by the task/user when permitted. If the user requests no tests, report NOT RUN and keep required unverified work IMPLEMENTED_UNVERIFIED. Never call skipped checks passed. This initialization permits documentation checks only; no application tests or migrations.

Update current-status, backlog, decision log when relevant, known issues, append-only session history, and next-session before stopping. Report changes, verification, blockers, and next action.

## Coordination and role instructions
One active write owner per task and file scope. Roles do not authorize concurrent edits. Parallel work requires independent/coordinated scopes and branches/worktrees; inspect Git state and coordinate ownership because a status document is not a lock. Reviewers are read-only unless separately assigned. Shared migrations, interfaces, API contracts, and cross-module edits need coordination. Never overwrite another writer's changes.

The environment rejected `.agents/` writes. Requested role/workflow/prompt documents are staged in [agent setup](docs/09-agent-setup/README.md); read them from there until an authorized operator installs them at the specified paths. Do not circumvent the restriction.
