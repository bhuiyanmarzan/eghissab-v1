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

Mandatory DTO validation: All HTTP user input validation must use module-level DTOs defined in `dto.go` (e.g. `RegisterRequest`, `CreateListingRequest`). Request structs must implement `Validate() error` returning a `*ValidationError{Field: "...", Msg: "..."}` with trimmed field checks, bounds, and formatting rules. Handlers must translate `*ValidationError` to HTTP 422 Unprocessable Entity via `httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)`. Every DTO must have corresponding unit tests in `dto_test.go`. Never use ad-hoc validation scattered across handlers or generic 400 errors for semantic field validation failures.

Obtain explicit approval before destructive DB work, dropping/renaming production columns/tables, breaking API contracts, changing approved business rules, replacing authentication architecture, weakening security, major infrastructure dependencies, or established module boundary changes. Existing explicit authorization counts; do not ask twice. Record architectural choices in ADRs without inventing ACCEPTED status.

## Frontend architecture & agent instructions
All frontend development occurs in `frontend/` and must adhere strictly to the established template:
- **Core stack**: Vite 7 + TypeScript 5.9, React 19, Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`, `@theme` tokens in `src/index.css`), shadcn / Radix UI primitives (`src/components/ui/primitives.tsx`), React Router DOM v7 (`src/App.tsx`, `AppShell.tsx`), TanStack React Query v5 (`@tanstack/react-query`), React Hook Form v7 (`react-hook-form` + `zod`), Zustand v5 (`src/store/`), TanStack React Table v8 (`src/components/react-table/`, `src/lib/reactTable.ts`), and `react-i18next`.
- **UI primitives**: Never reinvent base buttons, cards, inputs, selects, or badges. Always import and reuse components from `src/components/ui/primitives.tsx`. Use `cn(...)` from `src/lib/utils.ts` with Tailwind v4 design tokens (`bg-surface`, `text-ink`, `border-border`, `text-primary`). Ensure full support for dark mode (`.dark`) and RTL/LTR direction.
- **Form validation**: Always use React Hook Form with `zodResolver(schema)`. Intercept backend HTTP 422 `{ "error": { "code": "validation_failed", "message": "...", "field": "..." } }` responses and map them directly to form fields via `setError(field, { message })`.
- **State segregation**: Server state belongs exclusively in TanStack Query (`useQuery`, `useMutation`). Do not mirror query results into Zustand. Use Zustand solely for client-side UI, persistent settings (`useAppStore`), and active tenant selection (`useTenantStore`).
- **Data tables**: Always use TanStack React Table with pagination, column toggles, and sorting as structured in `src/components/react-table/`.
- **API calls**: Use the configured Axios client in `src/api/client.ts`. Never hardcode base URLs or ports.
- **Standards & workflow**: Follow [Frontend standards](docs/05-development/frontend-standards.md), [Frontend role](docs/09-agent-setup/roles/frontend.md), and [Frontend workflow](docs/09-agent-setup/workflows/frontend-development.md).

## Verification and completion
Follow [Definition of Done](docs/05-development/definition-of-done.md). Record implementation completion, tests executed, security review, documentation, and approval independently. Run checks required by the task/user when permitted. If the user requests no tests, report NOT RUN and keep required unverified work IMPLEMENTED_UNVERIFIED. Never call skipped checks passed. This initialization permits documentation checks only; no application tests or migrations.

Update current-status, backlog, decision log when relevant, known issues, append-only session history, and next-session before stopping. Report changes, verification, blockers, and next action.

## Coordination and role instructions
One active write owner per task and file scope. Roles do not authorize concurrent edits. Parallel work requires independent/coordinated scopes and branches/worktrees; inspect Git state and coordinate ownership because a status document is not a lock. Reviewers are read-only unless separately assigned. Shared migrations, interfaces, API contracts, and cross-module edits need coordination. Never overwrite another writer's changes.

The environment rejected `.agents/` writes. Requested role/workflow/prompt documents are staged in [agent setup](docs/09-agent-setup/README.md); read them from there until an authorized operator installs them at the specified paths. Do not circumvent the restriction.
