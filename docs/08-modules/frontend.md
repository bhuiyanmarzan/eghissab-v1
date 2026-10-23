# Frontend module

## Purpose and business responsibilities
Provides the multi-tenant web application portal for business operations, analytics dashboards, invoicing, customer management, inventory/products, authentication, and user profile management.

## Implementation and template architecture
Status: TEMPLATE_CONFIGURED. Evidence: `frontend/` directory with Vite, React 19, Tailwind CSS v4, shadcn/ui, React Router DOM, TanStack React Query, React Hook Form, Zustand, and TanStack React Table.

### Key architectural layers:
- **Application Shell & Navigation**: `src/components/layout/AppShell.tsx` hosts sidebar navigation, header, theme toggles, and tenant switcher. Route declarations live in `src/App.tsx` and navigation manifests in `src/data/navigation.ts`.
- **UI Primitives**: Located in `src/components/ui/primitives.tsx` using Radix UI + Tailwind v4 + CVA (`Button`, `Card`, `Input`, `Select`, `Badge`, `Avatar`).
- **Data Table Engine**: Located in `src/components/react-table/` and `src/lib/reactTable.ts` utilizing `@tanstack/react-table` for sorting, filtering, row selection, column toggles, and export.
- **Form System**: Built with `react-hook-form` + `zod` schema resolvers. Intercepts backend HTTP 422 `{ error: { code, message, field } }` envelopes to surface field-level validation errors directly under inputs.
- **State Management**:
  - **Server State**: Managed via `@tanstack/react-query` (`QueryClient` configured in `src/main.tsx`).
  - **Client State**: Managed via Zustand stores in `src/store/` (`useAppStore` for theme/layout/RTL, `useTenantStore` for multi-tenant context, `useNotificationStore`, etc.).
- **HTTP Client**: Centralized Axios client in `src/api/client.ts` configured with `/api` proxy and 8s default timeout.
- **Styling & Theming**: Tailwind CSS v4 configured via `@tailwindcss/vite` and `@theme` design tokens in `src/index.css`. Fully supports dark mode (`.dark`) and RTL/LTR text direction.
- **Internationalization**: `react-i18next` configured in `src/i18n.ts` with locale dictionaries in `src/locales/`.

## Ownership and interfaces
- **Database ownership**: None directly. All mutations and queries occur through the authenticated Go backend API.
- **Dependencies**: Backend HTTP API (`/api/*` via Nginx reverse proxy).
- **Authentication integration**:
  - Public auth flows: Login, Register, Email Verification, Password Reset in `src/pages/PublicPages.tsx`.
  - Credentials & sessions: Relies on HttpOnly refresh token cookies and Bearer access tokens returned by `/auth/login` and `/auth/refresh`.
  - Context injection: Selected tenant from `useTenantStore` sent via headers/query parameters for tenant-scoped operations.

## Standards and workflows
- **Coding standards**: [Frontend standards](../05-development/frontend-standards.md)
- **Agent role specification**: [Frontend role](../09-agent-setup/roles/frontend.md)
- **Agent workflow**: [Frontend development workflow](../09-agent-setup/workflows/frontend-development.md)

## Remaining work and acceptance
1. **WEB-001**: Connect `PublicPages.tsx` registration, login, verification, and session lifecycle to the live backend identity endpoints (`POST /auth/register`, `POST /auth/login`, `POST /auth/verify-email`, `POST /auth/resend-verification`, `POST /auth/refresh`, `GET /auth/me`, `POST /auth/logout`, `POST /auth/logout-all`). Status: IMPLEMENTED (with in-memory `useAuthStore`, `ProtectedRoute`, silent refresh interceptors, and HTTP 422 error mapping).
2. **WEB-002**: Connect tenant selection in `useTenantStore` to real organization membership queries once ORG-001 is completed.
3. **WEB-003**: Connect invoice and customer pages to real backend service endpoints.

Related: [Documentation index](../README.md).
