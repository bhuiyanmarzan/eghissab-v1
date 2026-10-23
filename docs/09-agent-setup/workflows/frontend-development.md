# Frontend development workflow

This workflow guides the Frontend Agent step-by-step when implementing or updating features in `frontend/`.

---

## Phase 1: Context & requirement analysis
1. **Identify task scope**: Read the backlog item, acceptance criteria, and related backend API contracts in `docs/04-api/`.
2. **Inspect existing template components**:
   - Check `frontend/src/components/ui/primitives.tsx` for existing UI primitives (`Button`, `Card`, `Input`, `Select`, `Badge`, `Avatar`).
   - Check `frontend/src/store/` for relevant Zustand stores (`useAppStore`, `useTenantStore`).
   - Check `frontend/src/data/navigation.ts` for route definitions.
3. **Verify backend contracts**: Review the endpoint's request payload, response schema, and error codes (especially HTTP 422 `{ error: { code, message, field } }`).

---

## Phase 2: Architecture & state planning
1. **Determine state distribution**:
   - **Server data**: Plan TanStack Query hooks (`useQuery`, `useMutation`) in `frontend/src/api/`. Do not duplicate in Zustand.
   - **Client UI state**: If global or persisted across routes (e.g. active tenant, sidebar state), use a Zustand store in `frontend/src/store/`.
   - **Form state**: Use React Hook Form + Zod schema for input forms.
   - **Table state**: Use TanStack Table (`useReactTable`) for data grids.
2. **Define TypeScript interfaces**: Declare exact types for entity models, request payloads, and API responses.

---

## Phase 3: Implementation
1. **API Integration (`frontend/src/api/`)**:
   - Create or update the endpoint helper using the `api` axios instance in `src/api/client.ts`.
   - Write React Query query/mutation hooks.
2. **Form Construction (`react-hook-form` + `zod`)**:
   - Define validation schema with `z.object({...})`.
   - Connect fields using `register(...)`.
   - Bind submit handlers to `handleSubmit(onSubmit)`.
   - Handle backend HTTP 422 errors by calling `setError(field, { message })`.
3. **Table & List Construction (`@tanstack/react-table`)**:
   - Create column definitions with `ColumnDef<T>[]`.
   - Integrate sorting, filtering, and pagination controls using `src/components/react-table/TableControls.tsx`.
4. **Component Composition & Styling**:
   - Compose with shadcn primitives and Tailwind CSS v4 design tokens (`bg-surface`, `text-ink`, `border-border`, `text-primary`).
   - Ensure dark mode and responsive layout compatibility.
   - Use `translateNode` / `translateString` for all user-facing labels.
5. **Route Mounting (`frontend/src/App.tsx`)**:
   - Mount new page components in `AppRoutes` and register paths in `src/data/navigation.ts`.

---

## Phase 4: Verification & quality checks
1. **Typecheck & Build**: Verify TypeScript compiles without type errors (`tsc -b`, `pnpm build`).
2. **Testing Policy**: Do NOT write test cases (`*.test.tsx`) during feature coding; test writing is deferred to a later dedicated testing phase.
3. **Lint & Format**: Ensure ESLint and Prettier pass.
4. **Manual sanity check**:
   - Does the component render properly in both Light and Dark themes?
   - Do form errors highlight the exact invalid fields?
   - Does navigation update the URL without triggering full page reloads?

---

## Phase 5: Handoff & memory updates
1. Update `docs/00-ai-context/current-status.md` and `docs/00-ai-context/session-history.md`.
2. Update `docs/08-modules/frontend.md` if new pages, stores, or API modules were added.
3. Record unverified items as `IMPLEMENTED_UNVERIFIED` if tests were not run.
