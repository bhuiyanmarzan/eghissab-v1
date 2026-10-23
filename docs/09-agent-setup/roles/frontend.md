# Frontend role

## Mission
Build and maintain approved web portal applications and features using the project's established frontend template and architectural standards.

## Established template & technology stack
All frontend code in `frontend/src/` must adhere strictly to the configured template:
- **Build tool**: Vite 7 + TypeScript 5.9 (`pnpm`).
- **Core UI**: React 19 (`react`, `react-dom`).
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`, `@theme` tokens in `src/index.css`).
- **Design system & primitives**: shadcn / Radix UI primitives (`src/components/ui/primitives.tsx`, `components.json`), Lucide icons (`lucide-react`), CVA (`class-variance-authority`), and `cn` helper (`src/lib/utils.ts`).
- **Routing**: React Router DOM v7 (`react-router-dom`, `src/App.tsx`, `src/components/layout/AppShell.tsx`).
- **Server state**: TanStack React Query v5 (`@tanstack/react-query`) with Axios HTTP client (`src/api/client.ts`).
- **Forms & validation**: React Hook Form v7 (`react-hook-form`), Zod v4 (`zod`), and `@hookform/resolvers/zod`.
- **Client state**: Zustand v5 (`zustand`, `persist` middleware) in `src/store/` (e.g., `useAppStore`, `useTenantStore`).
- **Data tables**: TanStack React Table v8 (`@tanstack/react-table`) with rich table controls (`src/components/react-table/`, `src/lib/reactTable.ts`).
- **Localization**: `react-i18next` with locales in `src/locales/`.

## Responsibilities and allowed scope
- Build responsive, accessible UI components and pages using the template's design system and primitives.
- Integrate backend API endpoints using `@tanstack/react-query` and the centralized Axios client.
- Map backend validation errors (HTTP 422 `{ error: { code, message, field } }`) directly to React Hook Form field errors.
- Manage client-side application state (theme, tenant selector, navigation, table filters) using Zustand.
- Testing policy: Do NOT write test cases (`*.test.tsx`) during feature implementation; test authoring is deferred to a later dedicated testing phase.
- Write scope: Assigned files in `frontend/src/`, `frontend/package.json` (for approved dependencies), and frontend documentation.

## Restricted operations
- **Never reinvent basic UI primitives**: Always reuse existing primitives in `src/components/ui/primitives.tsx` (`Button`, `Card`, `Input`, `Select`, `Badge`, `Avatar`).
- **Never mirror server state in Zustand**: Keep server-fetched entities in TanStack Query cache. Use Zustand only for client UI/tenant/session state.
- **Never bypass server-side validation**: Frontend validation is for immediate UX feedback; the backend DTO validation remains the source of truth.
- **Never invent endpoints or unauthorized contract modifications**: All API calls must align with backend specifications in `docs/04-api/`.
- **No unauthorized major framework or library replacements**: Adhere strictly to the established Vite/React/Tailwind/shadcn/Zustand stack.

## Required reading
1. Root [AGENTS.md](../../AGENTS.md)
2. [Frontend standards](../../docs/05-development/frontend-standards.md)
3. [Frontend development workflow](../workflows/frontend-development.md)
4. [API documentation](../../docs/04-api/) (API conventions, authentication API, OpenAPI)
5. [Frontend module documentation](../../docs/08-modules/frontend.md)

## Architecture rules
- Use `cn(...)` from `src/lib/utils` for conditional classes; never use raw string concatenation for Tailwind classes.
- Respect design tokens (`var(--color-primary)`, `var(--color-surface)`, `bg-surface`, `text-ink`, `border-border`).
- Ensure all pages and components work seamlessly in both Light and Dark modes.
- Support internationalization: wrap display text in `translateNode` or `translateString`.
- Use tenant context from `useTenantStore` for multi-tenant queries; client tenant IDs are selectors, never authority.

## Deliverables & verification
- Clean, type-safe TypeScript code passing `tsc -b`.
- Verification via `tsc -b` typecheck and `pnpm build` (test cases deferred per standing policy).
- Record implementation separate from verification status (`IMPLEMENTED_UNVERIFIED` while tests are deferred).
- Update relevant docs in `docs/08-modules/frontend.md` and AI memory tracking.

## Handoff requirements
Follow [finish-session](../workflows/finish-session.md). Update backlog owner/status, `current-status.md`, `session-history.md`, and `next-session.md`. Never overwrite concurrent changes.
