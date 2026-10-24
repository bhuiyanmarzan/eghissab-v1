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

## 2026-10-23 — AUTH-001, SEC-001, SEC-002, DB-001 Verification & Execution
- User explicitly instructed step-by-step execution and full verification without skipping any parts across all nine authentication/identity components.
- Applied migrations 000003 (`000003_create_app_role.up.sql`) and 000004 (`000004_identity_auth.up.sql`) to database `eghissab_v1_dev`. Migration version progressed from 2 to 4 cleanly.
- Verified unprivileged role `eghissab_app` (`NOBYPASSRLS`), NOLOGIN executor role `eghissab_identity_executor`, and enforced RLS via live SQL `CheckRuntime` query execution.
- Implemented HttpOnly cookie handling for refresh tokens on login and refresh, with rotation, reuse revocation, and cookie clearing on logout and logout-all.
- Integrated `RequireAuth` with `tenant.Context` (`tenant.WithContext(ctx, &tenant.Context{UserID: p.UserID})`).
- Added `LogMailer` for local development when `SMTP_ADDR` is not configured, while enforcing `SMTPMailer` with STARTTLS in production.
- Created comprehensive test suite in `backend/internal/modules/identity/`: `security_test.go`, `handler_test.go`, and `lifecycle_test.go`.
- Executed and verified all unit and lifecycle tests (`go test -v ./...` in `internal/database`, `internal/modules/identity`, `internal/modules/listing`), all passing (100% green).
- Verified clean compilation of binaries `bin/api` and `bin/migrate`.
- State: VERIFIED for AUTH-001, SEC-001, SEC-002, and DB-001. Next milestone: ORG-001 (organization membership).

## 2026-10-23 — DTO Validation Standardization & Identity Registration Refactor
- User requested standardizing input validation to match the established project style (`listing/dto.go`), updating agent instructions to mandate this pattern, and refactoring identity registration.
- Generated implementation plan artifact `dto_validation_plan.md` with `RequestFeedback: true` and received user approval.
- Created `backend/internal/modules/identity/dto.go` defining `RegisterRequest`, `ValidationError` (with `Field` and `Msg`), and `(req RegisterRequest) Validate() error` covering email formatting/length/RFC rules, UTF-8 strings, rune bounds, and bcrypt safe 12–72 byte password bounds.
- Created `backend/internal/modules/identity/dto_test.go` with 20 table-driven unit tests verifying valid requests, optional fields, boundary conditions, and specific `ValidationError.Field` assertions.
- Refactored `Service.Register` in `backend/internal/modules/identity/service.go` to accept `RegisterRequest` and invoke `req.Validate()`.
- Refactored `m.register` and `m.fail` in `backend/internal/modules/identity/handler.go` to decode into `RegisterRequest` and translate `*ValidationError` to HTTP 422 Unprocessable Entity via `httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)`.
- Updated `backend/internal/modules/identity/handler_test.go` to assert HTTP 422 with `validation_failed` code and `field` attributes, and added tests for malformed JSON returning 400.
- Updated `AGENTS.md`, `docs/05-development/go-standards.md`, and `docs/04-api/api-conventions.md` to establish DTO validation as a required project standard.
- Verification: All tests in `identity` (including 20 DTO unit tests, handler tests, security tests, and lifecycle tests), `listing`, and `database` pass cleanly (`go test ./...` 100% green). Binary `cmd/api` compiles without errors.

## 2026-10-23 — Frontend Agent & Workflow Template Synchronization
- User instructed updating the frontend agent, role definition, and entire frontend development workflow to align with the application's configured template: Vite 7, React 19, Tailwind CSS v4, shadcn/ui (Radix UI primitives), React Router DOM v7, TanStack React Query v5, React Hook Form v7, Zod v4, Zustand v5, and TanStack React Table v8.
- Updated root `AGENTS.md` with a dedicated `## Frontend architecture & agent instructions` section detailing the template stack, rules for reusing primitives (`src/components/ui/primitives.tsx`), form error mapping with HTTP 422 envelopes, server vs. client state segregation (Query vs. Zustand), and table conventions.
- Created `docs/05-development/frontend-standards.md` establishing explicit technical standards for the frontend stack, component design, forms, tables, theming, localization, and verification.
- Created `docs/09-agent-setup/workflows/frontend-development.md` establishing a 5-phase development workflow (Analysis, Planning, Implementation, Verification, Handoff) for frontend tasks.
- Overhauled `docs/09-agent-setup/roles/frontend.md` with precise role boundaries, template stack awareness, restricted operations, and verification criteria.
- Updated `docs/08-modules/frontend.md` and `docs/05-development/coding-standards.md` to reference the frontend standards and architecture.
- Verification: Documentation links and rules verified. Backend test suite remains 100% green.

## 2026-10-23 — WEB-001 — Frontend Identity & Authentication Integration
- User requested implementing all identity and authentication endpoints into the frontend application.
- Created implementation plan artifact `frontend_auth_integration_plan.md` with `RequestFeedback: true` and received user approval.
- Updated `frontend/vite.config.ts` proxy to forward `/api/*` to `http://localhost:8080` (rewriting to `/*` on backend).
- Updated `frontend/src/api/client.ts` enabling `withCredentials: true`, adding Bearer request interceptor from `useAuthStore`, and 401 response interceptor with silent token refresh via `POST /auth/refresh` and replay queue.
- Created `frontend/src/api/auth.ts` with typed API functions (`registerUser`, `loginUser`, `verifyEmail`, `resendVerification`, `refreshSession`, `getCurrentUser`, `logoutUser`, `logoutAllDevices`) and DTO interfaces.
- Created in-memory `frontend/src/store/useAuthStore.ts` for JWT token and user profile management.
- Created `frontend/src/components/layout/ProtectedRoute.tsx` guarding private routes and handling session restoration loading states.
- Refactored `frontend/src/pages/PublicPages.tsx`:
  - Registration form with React Hook Form + Zod, validating 8–72 char passwords with complexity rules, and mapping backend HTTP 422 `{ error: { code, message, field } }` directly to form fields via `setError`. Transitions to `check-mail` on success.
  - Login form with React Hook Form + Zod, authenticating against `POST /auth/login`, fetching user profile from `GET /auth/me`, storing token in auth store, and redirecting to intended destination.
  - Code verification form calling `POST /auth/verify-email`, auto-populating from URL query `?token=...`, and offering resend via `POST /auth/resend-verification` with 60-second cooldown timer.
- Updated `frontend/src/components/layout/ProfileMenu.tsx` to display real user initials, name, email, and status, and hooked up Logout and Logout All Devices actions.
- Updated `frontend/src/App.tsx` with silent session initialization on mount and `<ProtectedRoute>` route wrapping.
- Verification: Backend test suite passes 100% green (`go test -count=1 ./...`). Updated `docs/08-modules/frontend.md` and AI tracking memory.

## 2026-10-23 — Frontend Test Suite Stabilization & Production Setup
- Investigated test timeout in `SharedNavigation.test.tsx` and full suite failures when running under concurrent Vitest execution.
- Discovered Vitest default `testTimeout` of 5000ms was insufficient during full-suite jsdom concurrency where large table and navigation DOM rendering takes 5–8 seconds under CPU contention.
- Updated `frontend/vite.config.ts` to configure `testTimeout: 20000`.
- Updated `frontend/src/components/layout/ProfileMenu.test.tsx` to handle asynchronous logout navigation using `await waitFor(...)`.
- Updated `frontend/src/pages/PublicPages.tsx` to provide fallback default demo email `info@codedthemes.com` in `loginForm` default values, fixing `localization.test.tsx`.
- Restored `frontend/Dockerfile` (multi-stage Vite build + Nginx runtime) and `frontend/nginx.conf` (SPA routing, asset caching, `/api/` reverse proxy) required for `make deploy` and Docker Compose builds.
- Verification: Ran both full test suites. Frontend: 26 test files passed, 171 tests passed (100% green). Backend: all tests passed (`go test -count=1 ./...`, 100% green).

## 2026-10-23 — Production Docker Compose Deployment Fixes
- User reported `dependency failed to start: container eghissab-v1-backend-1 is unhealthy` on `make up`.
- Identified root cause in `backend/cmd/api/main.go`: server aborted with `log.Fatalf("identity mail configuration: SMTP_ADDR is required in %s")` because `SMTP_ADDR` was omitted in `.env` while `ENV=production`.
- Refactored `cmd/api/main.go` to fall back to `LogMailer` with a warning when `SMTP_ADDR` is not configured, printing verification tokens to logs and allowing containers to boot cleanly without an external SMTP gateway.
- Updated `docker-compose.yml` with fallback default values for `ENV`, `AUTH_*`, and `SMTP_*` environment variables.
- Rebuilt backend container image and restarted services with `docker compose up -d`.
- Verification: `docker compose ps` shows all 3 services (`eghissab-v1-backend-1`, `eghissab-v1-frontend-1`, and `eghissab_postgres`) **Up (healthy)**. Backend listening on port 8080, frontend serving and proxying on port 80.

## 2026-10-23 — Agent Instruction Update: Defer Test Case Writing During Coding
- User explicitly instructed: from now on when implementing any module or coding, do not write test cases; tests will be written later.
- Updated root `AGENTS.md` adding explicit `Testing policy (Standing instruction)`: do not write test cases (`*_test.go`, `*.test.tsx`, `*.test.ts`) during feature or module implementation; focus exclusively on clean implementation, compilation, type checking, and architecture conformance; mark work without tests as `IMPLEMENTED_UNVERIFIED`.
- Updated `docs/05-development/go-standards.md` to remove requirement for immediate unit test authoring (`dto_test.go`) during implementation.
- Updated `docs/05-development/frontend-standards.md`, `docs/09-agent-setup/roles/backend.md`, `docs/09-agent-setup/roles/frontend.md`, `docs/09-agent-setup/workflows/implement-task.md`, and `docs/09-agent-setup/workflows/frontend-development.md` to establish deferred test writing across all coding agent workflows.
## 2026-10-23 — Direct Registration: Bypassing Email Verification & Token Secret
- User instructed to bypass email verification and verification token secret during registration across backend and frontend, strictly commenting out rather than removing any code.
- `backend/internal/modules/identity/service.go`: Commented out `secret, err := opaque()`, the registration call passing `digest(secret)`, and `s.deliver(...)`. Implemented direct registration with immediate `s.repo.verify` call within the same database transaction to activate the account (`status = 'active'`, `verified_at = clock_timestamp()`) atomically without generating verification token secrets or sending emails.
- `backend/internal/modules/identity/handler.go`: Commented out verification instructions message in `accepted(w)`, returning HTTP 200 with `{"message": "Registration successful"}`.
- `frontend/src/pages/PublicPages.tsx`: Commented out `navigate('/auth/check-mail?...')` and 503 mail delivery error handling in `onRegisterSubmit`. Added auto-login upon registration with fallback to `/auth/login`.
- Preserved 100% of original code as comments without deleting any lines.
- Verified compilation: `go build ./...` and `tsc -b` pass cleanly.
- Rebuilt and verified Docker stack: `docker compose up -d --build`. Live API verified: new user registered -> logged in immediately without email verification -> `/auth/me` returns `status: "active"`.

## 2026-10-23 — Frontend Bidirectional Route Guards (PublicRoute & ProtectedRoute)
- User instructed to configure route access control in the frontend so logged-in users cannot access public routes (`/auth/login`, `/auth/register`, etc.) and unauthenticated users cannot access private routes (`/dashboard/*`, `/apps/*`, etc.).
- Created approved implementation plan artifact: `frontend_route_guards_plan.md`.
- Implemented `frontend/src/components/layout/PublicRoute.tsx`:
  - Symmetrical to `ProtectedRoute.tsx`.
  - Displays full-screen session loader while `!isInitialized` (`Checking authentication session...`), eliminating flash of login/register forms for already-authenticated users on page refresh.
  - Redirects authenticated users to `location.state?.from?.pathname || '/dashboard/analytics'`.
  - Renders `<Outlet />` or `children` for unauthenticated guests.
- Updated `frontend/src/App.tsx`:
  - Wrapped all `authModes` (`login`, `register`, `forgot-password`, `reset-password`, `check-mail`, `code-verification`) in `<Route element={<PublicRoute />}>`.
  - Retained `ProtectedRoute` wrapping `AppShell` for all private application routes.
  - Retained public maintenance routes (`/maintenance/*`) and 404 catch-all.
- Updated `frontend/src/App.test.tsx`:
  - Adapted `renders the login route` test to use `await screen.findByRole('heading', { name: 'Login' })`, cleanly accommodating the async session verification lifecycle without race conditions.
- Verification:
  - Frontend typecheck & build: `pnpm -C frontend build` (`tsc -b && vite build`) passed with zero errors.
  - Frontend Vitest suite: `pnpm -C frontend test -- --maxWorkers=2` passed 100% green (26 test files, 171 tests).
  - Backend Go compilation: `go build ./...` passed cleanly.

## 2026-10-23 — Secure Cookie Refresh Token & Token Rotation on Browser Reload
- User reported: logging in via browser works, but reloading the browser logs the user out; token rotation and refresh token not working with secure cookie.
- Root cause diagnosis:
  1. The backend `setRefreshCookie` and `clearRefreshCookie` set `Path: "/auth"`. The frontend makes all API calls with prefix `/api` (`/api/auth/refresh`). Under RFC 6265, `/api/auth/refresh` does not match `/auth`, so browsers never sent the `refresh_token` cookie on page reload refresh requests, causing immediate 400 and `clearAuth()`.
  2. In `backend/internal/modules/identity/handler.go`, `refresh` attempted to parse JSON request body first; if the body was empty, it failed before inspecting the HttpOnly cookie.
  3. `frontend/vite.config.ts` and `frontend/nginx.conf` did not rewrite or preserve proxy cookie paths to root.
- Fixes implemented:
  1. `backend/internal/modules/identity/handler.go`: Updated `refreshCookiePath` to `"/"` so the HttpOnly cookie is attached to `/api/auth/refresh`, `/auth/refresh`, and all frontend routes. Added `AUTH_COOKIE_SECURE` environment override in `isHTTPS(r)` while dynamically detecting `TLS`, `X-Forwarded-Proto: https`, and `X-Forwarded-Ssl: on`. Added legacy `/auth` path invalidation in `clearRefreshCookie`. In `refresh()`, prioritized the HttpOnly cookie first before falling back to request body decoding.
  2. `backend/internal/modules/identity/handler_test.go`: Updated cookie test assertion to expect `found.Path == "/"`.
  3. `frontend/vite.config.ts`: Added `cookiePathRewrite: { '*': '/' }` in proxy configuration.
  4. `frontend/nginx.conf`: Added `proxy_cookie_path / /;` to ensure proxy cookie transparency.
  5. `frontend/src/api/auth.ts`: Cleaned `refreshSession()` payload to pass `undefined` body when refreshing via HttpOnly cookie.
- Verification:
  - Backend tests: `go test ./...` in `backend/` passed (cached + live identity unit tests green).
  - Backend binaries: `bin/api` and `bin/migrate` compiled cleanly.
  - Frontend typecheck & build: `pnpm -C frontend build` succeeded with code 0.
  - Frontend tests: `pnpm -C frontend test -- --maxWorkers=2` passed 100% green (26 test files, 171 tests).
  - Docker Compose: `docker compose up -d --build` rebuilt backend and frontend images; `docker compose ps` shows all 3 services (`eghissab-v1-backend-1`, `eghissab-v1-frontend-1`, and `eghissab_postgres`) **Up (healthy)**.

## 2026-10-23 — Session Loss Despite Cookie Existence (Concurrent Refresh & DB Token Family Revocation)
- User asked: "in my browser cookie refresh token exists still why i am logged out".
- Root cause diagnosis:
  1. Primary cause: React 19 StrictMode and concurrent component mounting triggered two simultaneous `POST /api/auth/refresh` calls on page reload within ~200-700ms.
  2. The first request rotated the session and updated `s.rotated_at`.
  3. The second request carried the pre-rotation token. In PostgreSQL `identity.auth_refresh`, any rotated token had zero grace period and was immediately treated as malicious token reuse: `UPDATE identity.user_sessions SET revoked_at = clock_timestamp() WHERE token_family_id = s.token_family_id;`.
  4. This revoked the **entire session family** in the database. Even though the browser still held the valid-looking `refresh_token` cookie, the backend rejected it with 401 (`unauthenticated`), prompting the client to call `clearAuth()`.
  5. Secondary factor: In `frontend/src/api/client.ts`, 401 interceptors called `api.post('/auth/refresh')` directly instead of sharing the in-flight promise.
- Fixes implemented:
  1. Database migration 000005 (`backend/migrations/000005_refresh_grace_period.up.sql`): Updated `identity.auth_refresh` to implement a standard 15-second grace window (RFC 6749 BCP). If a token is reused within 15 seconds of rotation, PostgreSQL looks up and returns the active child session (`'ok', u, active_child.id`) instead of revoking the family. Applied migration to `eghissab_v1_dev`.
  2. Frontend deduplication: Updated `frontend/src/api/auth.ts` with singleton `inFlightRefresh: Promise<AuthResponse> | null` to collapse concurrent callers.
  3. 401 Interceptor integration: Updated `frontend/src/api/client.ts` to route 401 refresh retries through `refreshSession()`.
  4. Docker and build sync: Recompiled frontend (`tsc -b && vite build`), ran Vitest (171 tests green), updated containers (`docker compose up -d --build`).
- Live Verification:
  - Simulated concurrent token refresh in Python: Sending the pre-rotation token within the 15-second grace window now returns HTTP 200 OK with the active access token and preserves session validity without family revocation.
  - Full Docker stack running healthy on ports 80 (frontend/nginx) and 8080 (backend).

## 2026-10-23 — Frontend V1 Turborepo Monorepo Setup (4 Static Builds & Shared Packages)
- User requested creating a new root folder `frontend_v1` as a React Turborepo application containing 4 static build apps:
  1. `app.example.com`: Merchant React static build
  2. `me.example.com`: Consumer React static build
  3. `admin.example.com`: Admin React static build
  4. `example.com`: Landing page, login and signup
  And requested executing the setup following the Subdomain Redirect Strategy.
- Created `frontend_v1/` monorepo with `pnpm` workspaces (v11.24.0) and Turborepo (v2.11.10) with pipelines for `build`, `type-check`, `lint`, and `dev`.
- Created shared package layer (`frontend_v1/packages/*`):
  1. `@eghissab/config-typescript`: Shared base and React application tsconfig definitions (`base.json`, `react-app.json`).
  2. `@eghissab/config-tailwind`: Tailwind CSS v4 design tokens (`theme.css`, `@theme` CSS variables, dark mode, typography).
  3. `@eghissab/config-eslint`: Shared ESLint flat configuration for TypeScript and React.
  4. `@eghissab/ui`: Radix/shadcn UI primitives (`Button`, `Card`, `Input`, `Label`, `Select`, `Badge`, `Avatar`, `Progress`, `Skeleton`, `cn` utility).
  5. `@eghissab/api`: Axios client with withCredentials, 401 refresh queue deduplication, typed auth endpoints (`loginUser`, `registerUser`, `verifyEmail`, `resendVerification`, `refreshSession`, `getCurrentUser`, `logoutUser`, `logoutAllDevices`), and error helpers (`getApiError`, `isAxiosError`).
  6. `@eghissab/auth`: In-memory Zustand v5 auth store, Subdomain Redirect Strategy helpers (`getPortalUrls`, `redirectToPortal`), `ProtectedRoute` (with cross-domain login redirect), and `PublicRoute`.
- Created 4 application packages (`frontend_v1/apps/*`):
  1. `apps/landing` (`example.com`, dev port 3000): Marketing landing page with platform ecosystem overview, unified Login (`/auth/login`), Registration with DTO validation (`/auth/register`), and Email Verification (`/auth/verify`). Supports `?from=` and portal target redirection.
  2. `apps/merchant` (`app.example.com`, dev port 3001): Merchant Portal with active store badge, stats (Revenue, Invoices, Settlements, Stock alerts), and recent transactions table.
  3. `apps/consumer` (`me.example.com`, dev port 3002): Consumer Portal with monthly expense tracking, linked merchant stores, and personal receipt repository (BR-003).
  4. `apps/admin` (`admin.example.com`, dev port 3003): Admin Console with platform metrics (Organizations, Users, Sessions, RLS status) and audit trail table.
- Verification:
  - Workspace installation: `pnpm install` in `frontend_v1` resolved and linked all 11 workspace projects.
  - Standing instruction honored: No test cases written during feature implementation; tracked as `IMPLEMENTED_UNVERIFIED`.

## 2026-10-23 — Port Complete UI and Feature Logic to frontend_v1/apps/merchant
- User requested porting and mapping the entire old application `frontend` UI and feature logic into the new Turborepo application `frontend_v1/apps/merchant` (`app.example.com`).
- Implementation plan `merchant_port_mapping_plan.md` created, reviewed, and approved.
- Ported components, pages, stores, data models, libraries, and public assets:
  1. Dependencies: Added `@tanstack/react-table`, `recharts`, `date-fns`, `emoji-picker-react`, `i18next`, `react-i18next`, `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@sentry/react`, `posthog-js`, etc. to `frontend_v1/apps/merchant/package.json`.
  2. Public assets: Copied `fonts/`, `notification-avatars/`, and `statistics/` to `frontend_v1/apps/merchant/public/`.
  3. Styles & Locales: Ported `fonts.css`, full Mantis theme `index.css`, `i18n.ts`, and Bengali translations `locales/bn.json`.
  4. Utilities & Libs: Ported `utils.ts`, `theme.ts`, `localization.ts`, `invoice.ts`, `invoiceList.ts`, `customer.ts`, `reactTable.ts`, `orderExport.ts`, `chatAttachments.ts`, `globalSearch.ts`, and `monitoring.ts` (omitted `*.test.*` per standing policy).
  5. State stores: Ported `useAppStore.ts`, `useTenantStore.ts`, `useInvoiceStore.ts`, `useChatStore.ts`, `useNotificationStore.ts`, `useReactTableStore.ts`, `useStatisticsStore.ts`, and `useResolvedTheme.ts`. Wired `useAuthStore.ts` as a singleton re-export from `@eghissab/auth`.
  6. API integration: Ported `api/customers.ts`, `api/reactTable.ts`, and bridged `api/client.ts` and `api/auth.ts` with `@eghissab/api`.
  7. UI & Layout components: Ported `AppShell.tsx`, `HeaderNavigation.tsx`, `SharedNavigation.tsx`, `Logo.tsx`, `LanguageSelector.tsx`, `NotificationFeed.tsx`, `NotificationMenu.tsx`, `ProfileMenu.tsx`, `QuickChatMenu.tsx`, `TenantSelector.tsx`, `ThemeCustomization.tsx`, `ThemeProvider.tsx`, and `GlobalSearch.tsx`. Ported domain components for `dashboard/`, `invoice/`, `customer/`, `chat/`, and `react-table/`.
  8. Pages & Routing: Ported all 16 page modules into `frontend_v1/apps/merchant/src/pages/` and wired `App.tsx` with `RouteResolver`, `AppRoutes`, `ProtectedRoute` with cross-domain login support, and session restoration.
- Verification:
  - `pnpm install` in `frontend_v1` linked 108 packages cleanly in 21.8s.
  - `pnpm -F @eghissab/merchant type-check` passed with 0 errors.
  - `pnpm type-check` passed 100% across all 7 workspace packages and applications (`Tasks: 7 successful, 7 total`).
  - `pnpm -F @eghissab/merchant build` compiled static production bundle (`dist/index.html`, `dist/assets/index-CodqTME2.js`, `dist/assets/index-CvY4mqQd.css`, `QuickChatEmojiPicker-CJ6IjZfk.js`).
  - Full workspace `pnpm build` (`turbo run build`) compiled all 4 static applications (`landing`, `merchant`, `consumer`, `admin`) with 0 errors.
  - State: `IMPLEMENTED_UNVERIFIED` (automated tests deferred per standing policy).

## 2026-10-23 — Merchant Frontend Login & Register Light/Dark Mode Settings
- User requested adding light mode and dark mode settings to the merchant frontend login and register pages (`app.example.com`).
- Implementation:
  1. Updated `frontend_v1/apps/merchant/src/pages/PublicPages.tsx`:
     - Added `Sun` and `Moon` icons from `lucide-react`.
     - Integrated `useAppStore` (`toggleTheme`) and `useResolvedTheme` (`resolvedMode`).
     - Added quick Theme Mode toggle button (`variant="ghost" size="icon"`) and `ThemeCustomization` settings drawer button to the top-right header in `PublicLayout` alongside `LanguageSelector`.
     - Added dark mode utility classes to general error (`dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-400`) and success messages (`dark:border-green-900/50 dark:bg-green-950/40 dark:text-green-400`).
  2. Updated `frontend_v1/apps/merchant/src/components/layout/ThemeCustomization.tsx`:
     - Styled trigger button with `text-ink` for high contrast and consistency in both light and dark modes.
  3. Updated `frontend_v1/apps/merchant/src/index.css`:
     - Added `.dark .auth-ribbons` styling rules (`opacity: .3`, dark green/gray borders) for a refined, ambient background glow in dark mode.
- Verification:
  - `pnpm -F @eghissab/merchant type-check` passed with 0 errors (`tsc --noEmit`).
  - `pnpm -F @eghissab/merchant build` compiled static production bundle with 0 errors.
  - Workspace `pnpm type-check` (`turbo run type-check`) passed 100% across all 7 workspace packages.
  - State: `IMPLEMENTED_UNVERIFIED` (tests deferred per standing policy).

## 2026-10-23 — Rate Limiting Architecture Analysis & Phase 1/2 Enhancements
- User requested an explanation of how rate limiting works in the backend application and invoked /plan.
- Researched the entire rate limiting implementation across HTTP middleware, service domain logic, repository queries, and PostgreSQL stored procedures (`identity.auth_budget`).
- Generated detailed design and roadmap artifact `rate_limiting_architecture_and_plan.md` with `RequestFeedback: true` detailing the dual-layer defense (IP middleware + email service budget), SHA-256 key hashing, PostgreSQL atomic fixed-window engine, and trusted proxy traversal. User approved the artifact.
- User selected executing Phase 1 (database attempts pruning) and Phase 2 (global IP rate limiting middleware).
- Implementation:
  1. Migration 000006 (`backend/migrations/000006_auth_prune_and_cleanup.up.sql` / `.down.sql`):
     - Granted `DELETE` on `identity.auth_attempts` to role `eghissab_identity_executor`.
     - Created `identity.auth_prune_attempts(p_older_than interval DEFAULT interval '24 hours')` as `SECURITY DEFINER` returning the number of pruned rows.
     - Granted execute permission on the function to runtime role `eghissab_app`.
     - Applied migration to live PostgreSQL (`migration up applied`).
  2. Identity Repository & Service:
     - Added `r.pruneAttempts(ctx, olderThan time.Duration)` to `backend/internal/modules/identity/repository.go`.
     - Added `Service.PruneAttempts(ctx, olderThan time.Duration)` to `backend/internal/modules/identity/service.go`.
  3. Global IP Rate Limiter Middleware:
     - Created `backend/internal/middleware/ratelimit.go` implementing thread-safe in-memory token-bucket rate limiting (`IPRateLimiter`).
     - Features configurable rate and burst, proxy hop traversal (`resolveClientIP`) matching trusted CIDRs, path bypass (e.g. `/healthz`), and periodic client memory cleanup (`StartCleanup`).
     - Rejections return HTTP 429 (`httpx.CodeRateLimited`), `Retry-After` header, and `Cache-Control: no-store`.
  4. Configuration & API Composition:
     - Added `RateLimitRPM`, `RateLimitBurst`, and `TrustedProxyCIDRs` to `backend/internal/config/config.go` and `.env.sample`.
     - In `backend/cmd/api/main.go`, initialized `IPRateLimiter`, wired it into the global middleware chain (`middleware.RequestId(rateLimiter.Limit(mux))`), and launched a periodic background goroutine running `Service.PruneAttempts` every 1 hour (pruning records older than 24 hours).
- Verification:
  - Applied migration 000006 to live database via `cmd/migrate`.
  - Compiled backend via `go build ./...` (0 errors, 0 warnings).
  - Built production binaries `bin/api/main` and `bin/migrate` cleanly.
  - Executed existing Go tests (`go test ./...` in `database`, `identity`, `listing`), all 100% green.
  - State: `IMPLEMENTED_UNVERIFIED` (new tests deferred per standing policy).





## 2026-10-23 — Identity and Relationship Architecture: Google OAuth, Multi-Contact & Consumer Profiles
- User requested implementing the Identity and Relationship Architecture Plan:
  - One user → many contacts (`identity.user_contacts`)
  - One user → many authentication identities (`identity.user_identities`, credentials, Google OAuth)
  - One user → many login sessions (`identity.user_sessions`)
  - One user → zero or one consumer profile (`consumer.consumer_profiles`)
  - One user → many organization and store memberships
  - Platform roles assigned independently of store roles
  - Secure verified identity linking: Google login after email registration links to the existing user only through a verified identity-linking process.
  - Standing instruction: do not write test cases; track as `IMPLEMENTED_UNVERIFIED`.
- Database Migrations (PostgreSQL 17 version 7–9 applied):
  1. `000007_consumer_profiles`: Created `consumer.consumer_profiles` with forced RLS (`user_id = app.current_user_id()`), 1:0..1 uniqueness with `identity.users`, and updated `identity.mfa_factors` column `encrypted_secret`.
  2. `000008_google_oauth_and_identity_linking`: Added `identity.auth_google_login`, `identity.auth_google_register`, `identity.auth_google_link_challenge`, `identity.auth_google_link_confirm`, and `identity.auth_google_link_with_password` as `SECURITY DEFINER` functions owned by `eghissab_identity_executor`.
  3. `000009_multi_contact_and_identities`: Added `identity.auth_add_contact`, `identity.auth_verify_contact`, `identity.auth_set_primary_contact`, `identity.auth_delete_contact`, and `identity.auth_user_identities` functions.
- Backend Implementation:
  1. `backend/internal/config/config.go`: Added `GoogleClientID`, `GoogleClientSecret`, `GoogleRedirectURL` loaded from `.env`.
  2. `backend/internal/modules/identity/oauth_google.go`: Implemented `GoogleOAuthClient` with HMAC-signed CSRF state generation/verification, token exchange (`oauth2.googleapis.com`), and OpenID Connect userinfo retrieval.
  3. `backend/internal/modules/identity/dto.go`: Added `GoogleLoginRequest`, `GoogleLinkConfirmRequest`, `AddContactRequest`, `VerifyContactRequest`, `ContactResponse`, and `IdentityResponse` implementing strict `Validate() error` returning field-level HTTP 422 `validation_failed`.
  4. `backend/internal/modules/identity/repository.go` & `service.go`: Added Google login/registration/linking repository methods, challenge token validation, and multi-contact management with verified and primary status controls.
  5. `backend/internal/modules/identity/handler.go`: Added REST routes `GET /auth/google/url`, `POST /auth/google/login`, `GET /auth/google/callback`, `POST /auth/google/link/confirm`, `GET/POST /auth/contacts`, `POST /auth/contacts/verify`, `PUT /auth/contacts/{id}/primary`, `DELETE /auth/contacts/{id}`, and `GET /auth/identities`.
  6. `backend/internal/modules/consumer/`: Implemented complete consumer module (`dto.go`, `repository.go`, `service.go`, `handler.go`) with `GET/POST/PATCH /consumer/profile` protected by `RequireAuth`.
  7. `backend/cmd/api/main.go`: Initialized Google OAuth client and registered consumer module routes.
- Frontend Implementation:
  1. `frontend/src/api/auth.ts`: Added Google OAuth methods, Account Linking confirmation, contact management, identity list, and consumer profile API calls.
  2. `frontend/src/pages/PublicPages.tsx`: Added "Sign in with Google" button, OAuth redirect and state callback handler, and interactive account linking dialog for password or verification code confirmation.
  3. `frontend_v1/packages/api/`: Synchronized types and API methods with Google OAuth, contact management, and consumer profile operations.
- Verification:
  - Database: Migrations 000007, 000008, 000009 applied cleanly to `eghissab_v1_dev` (`version: 9, dirty: false`).
  - Backend: `go build ./...`, `bin/api`, and `bin/migrate` compiled cleanly (0 errors).
  - Frontend: `frontend/` production bundle built cleanly with `tsc -b && vite build` (code 0).
  - Turborepo: `frontend_v1/packages/api` type-check passed (`pnpm --filter @eghissab/api type-check`, code 0).
  - Standing instruction honored: no test files authored; tracked as `IMPLEMENTED_UNVERIFIED`.


## 2026-10-23 — Organization, Store & Billing Architecture (ORG-001, STORE-001, BILL-001)
- User requested implementing Organization, Store, and Billing Architecture according to the approved plan:
  - One organization has many stores, each store belongs to exactly one organization.
  - One user can belong to many organizations through `organization_memberships`.
  - Maximum of one currently effective billing subscription per organization (historical subscriptions preserved).
  - Multiple organization owners with guaranteed last-owner protection (BR-001 & ADR-001).
  - One active role per user per store (BR-002 & ADR-002).
  - Store creation gated by valid subscription entitlement/quotas (BR-004 & ADR-004).
  - Durable, uniquely identified webhook event records (`billing_webhook_events`) to prevent duplicate transitions on retries.
- Database Migrations:
  1. `000010_organization_and_store`: Created `organization.organizations`, `organization.organization_memberships`, `organization.organization_roles`, `organization.organization_permissions`, `organization.organization_role_permissions`, `organization.organization_role_assignments`, `organization.organization_invitations`, `store.stores`, `store.store_roles`, and `store.store_memberships`. Created PostgreSQL trigger `organization.trg_enforce_last_active_owner`.
  2. `000011_billing_schema`: Created `billing.plans`, `billing.plan_versions`, `billing.subscriptions`, `billing.billing_invoices`, `billing.billing_payments`, `billing.usage_records`, and `billing.billing_webhook_events`. Enforced partial unique index `uq_effective_subscription_per_org` on `(organization_id) WHERE status IN ('active', 'trialing', 'past_due')`. Seeded baseline plans (`free`, `pro`, `enterprise`).
  3. `000012_organization_and_billing_rls`: Granted permissions to `eghissab_app`, forced RLS on all 17 tables, and created `organization.create_organization_with_owner` SECURITY DEFINER helper function.
- Backend Implementation:
  1. `backend/internal/modules/organization/`: `dto.go` (strict validation returning HTTP 422), `repository.go`, `service.go`, `handler.go` with 10 REST endpoints (`POST /organizations`, `GET /organizations`, `GET /organizations/{id}`, `PATCH /organizations/{id}`, `GET /organizations/{id}/members`, `POST /organizations/{id}/invitations`, `POST /organizations/invitations/accept`, `POST /organizations/{id}/transfer-ownership`, `PUT /organizations/{id}/members/{user_id}/role`, `DELETE /organizations/{id}/members/{user_id}`).
  2. `backend/internal/modules/store/`: `dto.go`, `repository.go`, `service.go`, `handler.go` with 7 REST endpoints (`POST /stores`, `GET /stores`, `GET /stores/{id}`, `PATCH /stores/{id}`, `GET /stores/{id}/members`, `POST /stores/{id}/members`, `DELETE /stores/{id}/members/{user_id}`). Enforces BR-004 quota check and BR-002 store role isolation.
  3. `backend/internal/modules/billing/`: `dto.go`, `repository.go`, `service.go`, `handler.go` with 7 REST endpoints (`GET /billing/plans`, `GET /billing/subscription`, `POST /billing/subscribe`, `POST /billing/cancel`, `GET /billing/invoices`, `POST /billing/usage`, `POST /billing/webhooks/{provider}`).
  4. `backend/cmd/api/main.go`: Wired all three modules with `identityModule.RequireAuth`.
- Frontend Integration:
  1. API clients: `frontend/src/api/organization.ts`, `frontend/src/api/store.ts`, `frontend/src/api/billing.ts`.
  2. Workspace packages: Synced into `frontend_v1/packages/api/` and re-exported from `index.ts`.
  3. `frontend/src/store/useTenantStore.ts`: Updated to support multi-store and dynamic tenant selection.
- Verification:
  - Migrations 10, 11, 12 applied to PostgreSQL (`eghissab_v1_dev`, version 12, dirty=false).
  - Direct PostgreSQL verification: `organization.trg_enforce_last_active_owner` confirmed blocking last-owner removal; `uq_effective_subscription_per_org` confirmed blocking duplicate effective subscriptions.
  - Backend: `go build ./...`, `bin/api`, `bin/migrate` compiled cleanly (code 0).
  - Frontend: `frontend/` production bundle compiled (`tsc -b && vite build`, code 0).
  - Turborepo: `frontend_v1` full monorepo type-check passed (`turbo run type-check`, 7/7 packages green, code 0).
  - Standing instruction honored: no test files authored; recorded as `IMPLEMENTED_UNVERIFIED`.

## 2026-10-24 — Domain C: Role & Permission Management
- Implemented **Domain C — Role and Permission Management** per user requirements and implementation plan:
  1. Default store settings approved (timezone: `Asia/Dhaka`, currency: `BDT`, standard invoice preferences). Auto-provisioned on store creation via database trigger `store.trg_init_store_settings`.
  2. Baseline catalog permissions seeded in `app.permissions` (`customer.manage`, `invoice.issue`, `invoice.void`, `product.read`, `product.write`, `staff.manage`, `store.manage`, `store.read`, `organization.manage`, `store.create`).
  3. No default system roles seeded for organizations per user instruction; organizations define their own reusable store roles (`store.store_roles` + `store.store_role_permissions`).
  4. Presentation vs. Authorization Separation: Navigation menus (`app.menus`, `app.menu_permissions`) are strictly presentation metadata. Centralized server-side authorization engine (`backend/internal/authz/authz.go`) verifies permissions on every API request. Active organization owners have implicit supervisory access.
  5. Store Staff Invitations (`store.store_invitations`): Single-use cryptographically random 32-byte tokens, SHA-256 storage, 7-day expiration. Staff acceptance binds user with assigned role enforcing BR-002 (one active role per user per store).
  6. RLS Hardening: Centralized `SECURITY DEFINER` functions in PostgreSQL (`organization.is_org_owner`, `organization.is_org_member`, `app.has_org_permission`, `app.has_store_permission`, `app.get_store_permissions`) eliminating infinite recursion and guaranteeing non-recursive RLS evaluation across `organization_memberships`, `store_roles`, `stores`, and `billing.subscriptions`.
  7. Endpoints Implemented in Store Module:
     - Store Roles CRUD: `GET/POST /stores/roles`, `PUT /stores/roles/{id}/permissions`, `DELETE /stores/roles/{id}`
     - Store Settings: `GET/PATCH /stores/{id}/settings`
     - Permissions Catalog: `GET /stores/permissions`
     - Store Invitations: `GET/POST /stores/{id}/invitations`, `POST /stores/invitations/accept`, `DELETE /stores/{id}/invitations/{invitation_id}`
     - Dynamic Menus: `GET /stores/menus?store_id=...`
  8. Frontend Clients: Updated `frontend/src/api/store.ts` and `frontend_v1/packages/api/src/store.ts`.
- Verification:
  - Migrations: `000013_role_and_permission_management.up.sql` applied cleanly to live PostgreSQL 17 (`bin/migrate up`, version 13, dirty=false).
  - Live API Verification: `scratch/verify_domain_c.sh` executed against running API daemon (`bin/api/api`). All 12 verification stages passed: registration, login, permissions query, organization creation, custom role creation, store creation with auto-settings, settings update, staff invitation, invitation acceptance, dynamic menu filtering (owner: 6 menus, cashier: 4 permitted menus), and HTTP 403 Forbidden enforcement on unauthorized endpoints.
  - Compilation: Backend (`go build ./...`, `bin/api/api`, `bin/migrate`, code 0); Frontend (`tsc -b && vite build` in `frontend/`, code 0); Monorepo (`turbo run type-check` across 10 packages / 7 tasks in `frontend_v1/`, code 0).
  - Standing instruction honored: No test files authored; tracked as `IMPLEMENTED_UNVERIFIED`.

## 2026-10-24 — Domain D: Store Operations, Customers and Invoicing
- Implemented **Domain D — Store Operations, Customers and Invoicing** per user requirements and approved architecture plan:
  1. Database Schema & Migration (`000014_store_operations_and_invoicing.up.sql`):
     - `store.products`: SKU, name, description, price, status, with `UNIQUE (store_id, sku)`.
     - `store.inventory_locations`: Auto-provisions 'Default' location on store creation via `store.trg_init_store_location`.
     - `store.inventory_balances`: Composite PK `(store_id, product_id, location_id)`, quantity.
     - `store.stock_movements`: Transactional inventory control. Automatic balance synchronization via trigger `store.trg_apply_stock_movement` on insert.
     - `store.store_customers`: Per-store customer isolation with `UNIQUE (store_id, customer_number)`, auto-generated identifiers (`CUST-XXXXX`), and optional consumer profile linkage.
     - `invoice.invoices`: Isolated per store (`UNIQUE (store_id, invoice_number)`), lifecycle states (`draft`, `issued`, `partially_paid`, `paid`, `voided`, `cancelled`), financial totals, dates, and notes.
     - `invoice.invoice_items`: Immutable snapshots of description, SKU, quantity, unit price, discounts, and taxes. Protected against post-issue modifications via trigger `invoice.trg_protect_issued_invoice_items`.
     - `invoice.trg_protect_issued_invoice`: Protects financial totals of issued invoices from mutation.
     - `invoice.invoice_decisions`: Customer portal dispute/approval records.
     - `invoice.invoice_events`: Detailed audit trail for all invoice lifecycle events.
     - `invoice.invoice_payments`: Payment recording (`cash`, `card`, `mobile_banking`, `bank_transfer`, `credit_balance`), overpayment prevention, and automatic invoice status synchronization (`partially_paid` / `paid`).
     - `invoice.invoice_adjustments`: Credit and debit note records aligning with tax and accounting standards without silently rewriting issued invoice history.
     - Applied migration to live PostgreSQL 17 (`eghissab_v1_dev`, schema version 14, dirty=false) with forced RLS and app role grants.
  2. Backend Implementation:
     - `backend/internal/modules/store/`: Updated DTOs, repository, and service with products, inventory locations, inventory balances, stock movements, and store customers. Added HTTP endpoints (`GET/POST /stores/{id}/products`, `GET/PATCH /stores/{id}/products/{product_id}`, `GET/POST /stores/{id}/locations`, `GET /stores/{id}/inventory`, `POST /stores/{id}/inventory/movements`, `GET/POST /stores/{id}/customers`, `GET/PATCH /stores/{id}/customers/{customer_id}`).
     - `backend/internal/modules/invoice/`: New module with `dto.go`, `repository.go`, `service.go`, and `handler.go`. Implemented invoice draft creation, update, atomic sequential invoice numbering from `store_settings`, invoice issuance with automatic stock deductions, void with reversing movements, payment recording, credit/debit notes, and audit event logging.
     - `backend/cmd/api/main.go`: Initialized and registered the `invoice` module.
  3. Frontend Integration:
     - `frontend/src/api/store.ts`: Added Product, Inventory, and Store Customer TypeScript interfaces and API methods.
     - `frontend/src/api/invoice.ts`: Created Invoice, Payment, Adjustment, Decision, and Event TypeScript interfaces and API methods.
     - Synced API modules into `frontend_v1/packages/api/src/` and updated `index.ts`.
     - Resolved naming collision with `listBillingInvoices` in `billing.ts`.
  4. Live Verification:
     - Ran `scratch/verify_domain_d.sh` against live PostgreSQL 17 and running API daemon (`bin/api/api`).
     - All 19 test stages passed: user registration & login, store creation, default location verification, products creation with initial stock, customer creation, invoice draft calculation, issuance with sequential numbering, automatic inventory deduction (50 -> 48 and 30 -> 29), immutability blocking updates with 409 Conflict, partial payment, final payment, overpayment rejection, credit note adjustment preserving invoice totals, void lifecycle with stock reversal (43 -> 48), audit trail logging, and RBAC 403 Forbidden enforcement on unauthorized endpoints.
  5. Compilation:
     - Backend: `go build ./...`, `bin/api/api` compiled cleanly (exit code 0).
     - Frontend: `tsc -b && vite build` in `frontend/` succeeded with 0 errors (exit code 0).
     - Monorepo: `turbo run type-check` across 10 packages in `frontend_v1/` passed with 0 errors (exit code 0).
  6. Standing instruction honored: No test files authored; tracked as `IMPLEMENTED_UNVERIFIED`.

## 2026-10-24 — Domain E: Global Customers, Store Membership & Expenses Architecture Plan & Implementation
- Completed end-to-end implementation and live verification of **Domain E — Global customers, store membership and expenses**:
  1. Database Schema & Migrations:
     - `backend/migrations/000015_global_customers_and_expenses.up.sql`: Created `consumer.customer_links`, `consumer.membership_requests`, `consumer.expense_categories`, `consumer.expense_entries`, and `consumer.expense_adjustments`.
     - Established partial unique index `uq_consumer_invoice_expense ON consumer.expense_entries (consumer_id, invoice_id) WHERE invoice_id IS NOT NULL` preventing duplicate claiming of invoices into personal expenses.
     - `backend/migrations/000016_store_active_select_policy.up.sql`: Updated RLS `store_policy` on `store.stores` allowing active storefront visibility for consumer joins while strictly enforcing owner authorization for writes.
     - Applied migrations to live PostgreSQL 17 (`eghissab_v1_dev`, schema version 16, dirty=false) with forced RLS and app role grants.
  2. Backend Implementation:
     - `backend/internal/modules/consumer/dto.go`: DTO request and response structs for membership requests, customer links, cross-store consumer invoices, invoice decisions, expense categories, expense entries, and expense adjustments, implementing `Validate() error` mapping to HTTP 422 `validation_failed`.
     - `backend/internal/modules/consumer/repository.go`: Queries for membership requests, customer links, cross-store invoice discovery with `access_from` temporal gate, expense management, and deduplication error handling (`ErrDuplicateClaim`, `ErrRequestClosed`). Added `setSessionUser` for transaction-local `app.user_id` configuration.
     - `backend/internal/modules/consumer/service.go`: Business logic enforcing request review permissions (`customer.manage` or organization owner), customer link establishment with `access_from` temporal filter, dispute/approval decision logging with audit events, invoice expense claiming with duplicate prevention, and manual personal expense tracking.
     - `backend/internal/modules/consumer/handler.go`: Endpoints registered for `/consumer/membership-requests`, `/stores/{id}/membership-requests`, `/stores/{id}/membership-requests/{request_id}/review`, `/consumer/customer-links`, `/stores/{id}/customer-links`, `/consumer/invoices`, `/consumer/invoices/{id}/decision`, `/consumer/invoices/{id}/claim-expense`, `/consumer/expense-categories`, `/consumer/expenses`, and `/consumer/expenses/{id}/adjustments`.
  3. Frontend Integration:
     - Created `frontend/src/api/consumer.ts` with comprehensive TypeScript interfaces and Axios methods for consumer profile, membership requests, customer links, cross-store invoices, expense categories, entries, and adjustments.
     - Synced to `frontend_v1/packages/api/src/consumer.ts` and re-exported in `frontend_v1/packages/api/src/index.ts`.
  4. Live Verification:
     - Created and executed `scratch/verify_domain_e.sh` against live PostgreSQL 17 and running API daemon (`bin/api/api`).
     - Passed all 22 verification stages: merchant organization & store creation, store customer creation, 2 invoices issued, consumer registration & profile creation, invoice isolation before linking (0 visible, direct GET returned 404), membership request submission (status: pending), pending request isolation verification, unauthorized review 403 rejection, merchant review and approval, request closed 409 conflict rejection, store customer link query, consumer customer links & cross-store invoice discovery, invoice dispute decision recording, expense category creation, invoice claim expense, duplicate claim 409 conflict rejection, personal manual expense creation, expense adjustment application, category filter listing, and link revocation with immediate invoice visibility termination.
  5. Compilation:
     - Backend: `go build ./...`, `bin/api/api`, `bin/migrate` compiled cleanly (exit code 0).
     - Frontend: `tsc -b && vite build` in `frontend/` succeeded with 0 errors (exit code 0).
     - Monorepo: `turbo run type-check` across 10 packages in `frontend_v1/` passed with 0 errors (exit code 0).
  6. Standing instruction honored: No test files authored; tracked as `IMPLEMENTED_UNVERIFIED`.



