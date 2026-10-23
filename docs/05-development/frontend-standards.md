# Frontend standards & template conventions

## Current baseline & tech stack
The application frontend is located in `frontend/` and built upon a modern, production-grade template:
- **Build tool & runtime**: Vite 7 with TypeScript 5.9 (`@vitejs/plugin-react`). Package manager is `pnpm`.
- **UI library**: React 19 (`react`, `react-dom`).
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`, `@import "tailwindcss";`, `@theme` token variables in `frontend/src/index.css`).
- **Component system**: shadcn / Radix UI primitives (`frontend/src/components/ui/primitives.tsx`, `components.json`), Lucide icons (`lucide-react`), Class Variance Authority (`cva`), and `cn` utility (`clsx` + `tailwind-merge`).
- **Routing**: React Router DOM v7 (`react-router-dom`), structured under `frontend/src/App.tsx` and wrapped in `frontend/src/components/layout/AppShell.tsx`.
- **Server state & data fetching**: TanStack React Query v5 (`@tanstack/react-query`) with an Axios client (`frontend/src/api/client.ts`).
- **Form management & validation**: React Hook Form v7 (`react-hook-form`), Zod v4 (`zod`), and `@hookform/resolvers/zod`.
- **Client state management**: Zustand v5 (`zustand`, `zustand/middleware` `persist`) located in `frontend/src/store/`.
- **Data grids & tables**: TanStack React Table v8 (`@tanstack/react-table`) with rich table controls (`frontend/src/components/react-table/`, `frontend/src/lib/reactTable.ts`).
- **Internationalization (i18n)**: `i18next`, `react-i18next`, `i18next-browser-languagedetector`, with locales in `frontend/src/locales/`.
- **Testing & quality**: Vitest (`vitest`), Testing Library (`@testing-library/react`), Playwright (`@playwright/test`), ESLint (`eslint.config.js`), Prettier, Storybook.

---

## Directory structure conventions

```
frontend/src/
├── api/          # Axios client (client.ts), React Query fetchers/mutations, endpoint functions, DTOs
├── auth/         # Permission guards and client-side role helpers
├── components/
│   ├── ui/       # shadcn/Radix primitive components (primitives.tsx: Button, Card, Input, Select, Badge, Avatar)
│   ├── layout/   # Shell, Header, Sidebar, Logo, ThemeProvider, LanguageSelector
│   ├── react-table/ # TanStack Table reusable widgets (DemoTable, TableControls, EditableTableCell)
│   └── [domain]/ # Domain-specific components (customer, invoice, dashboard, chat, etc.)
├── data/         # Navigation manifests (navigation.ts, sidebarNavigation.ts) and mock datasets
├── lib/          # Utilities (utils.ts: cn, titleFromPath), theme tokens, localization helpers, schemas
├── locales/      # Translation files (bn.json, en defaults)
├── pages/        # Route-level page components (DashboardPage, InvoiceListPage, CustomerListPage, PublicPages)
├── store/        # Zustand state stores (useAppStore, useTenantStore, useInvoiceStore, etc.)
├── test/         # Vitest setup and testing mocks
├── App.tsx       # Route definitions and RouteResolver
├── index.css     # Tailwind v4 import, @theme design tokens, CSS variables, utility styles
└── main.tsx      # App entry point, QueryClientProvider, BrowserRouter, Monitoring
```

---

## Mandatory rules for frontend development

### 1. Component & UI primitive standard
- **Never reinvent basic UI primitives**: Always import and reuse base components from `frontend/src/components/ui/primitives.tsx` (`Button`, `Card`, `CardHeader`, `CardContent`, `Input`, `Select`, `Badge`, `Avatar`).
- **Styling with Tailwind CSS v4**:
  - Always use theme tokens defined in `src/index.css` (`var(--color-primary)`, `var(--color-surface)`, `var(--color-border)`, `var(--color-ink)`, `var(--color-muted)`).
  - Use `cn(...)` from `src/lib/utils` for conditional or merged Tailwind classes.
  - Do not write ad-hoc raw hex values in class names when theme tokens exist.
- **Theming & RTL support**:
  - Components must seamlessly support dark mode (via `.dark` CSS variables) and light mode.
  - Respect text direction (`direction: 'ltr' | 'rtl'`) managed by `useAppStore`.

### 2. Form management & validation standard
- **React Hook Form + Zod**: All forms must be built using `useForm` with `zodResolver(schema)`:
  ```tsx
  import { useForm } from 'react-hook-form';
  import { zodResolver } from '@hookform/resolvers/zod';
  import { z } from 'zod';

  const formSchema = z.object({
    email: z.string().email('Enter a valid email'),
    firstName: z.string().min(1, 'First name is required'),
  });
  type FormValues = z.infer<typeof formSchema>;

  const { register, handleSubmit, formState: { errors }, setError } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
  });
  ```
- **Backend validation error mapping**:
  - The backend returns standard HTTP 422 envelopes: `{ "error": { "code": "validation_failed", "message": "...", "field": "..." } }`.
  - On mutation failure, map `field` directly to the form state using `setError(field as keyof FormValues, { message: error.response.data.error.message })`.

### 3. Server state vs. client state standard
- **Server state (TanStack Query)**:
  - All HTTP requests to the backend must be orchestrated via `@tanstack/react-query` (`useQuery`, `useMutation`).
  - Do **not** mirror server-fetched data into Zustand stores. Let React Query manage caching, stale times, re-fetching, and query invalidation.
  - Query keys must follow structured array naming: `['customers', tenantId]`, `['invoices', invoiceId]`.
  - Invalidate affected query keys on successful mutations via `queryClient.invalidateQueries({ queryKey: [...] })`.
- **Client state (Zustand)**:
  - Use Zustand (`frontend/src/store/`) exclusively for true client-side state: UI layout preferences, active tenant selector (`useTenantStore`), theme mode (`useAppStore`), table filter states, and temporary draft states.
  - Persist client state using Zustand's `persist` middleware when state should survive page reloads (e.g. tenant selection, theme).

### 4. TanStack React Table standard
- **Table grids**: For data tables with sorting, filtering, pagination, or search, use `@tanstack/react-table`.
- **Conventions**:
  - Declare column definitions using `ColumnDef<TData, TValue>[]`.
  - Separate table controls (search input, density toggle, column visibility, CSV/JSON export) into modular subcomponents as demonstrated in `frontend/src/components/react-table/TableControls.tsx`.
  - Keep row actions (view, edit, delete) in dedicated action columns.

### 5. Routing & navigation standard
- **React Router DOM**:
  - All new private pages must be declared in `frontend/src/data/navigation.ts` and rendered inside the `AppShell` layout in `frontend/src/App.tsx`.
  - Public routes (`/auth/*`, `/maintenance/*`) bypass `AppShell` and render inside `PublicLayout`.
  - Navigation must use `<Link to="...">` or `useNavigate()` to preserve client-side routing without full page refreshes.

### 6. Internationalization standard
- Use `useTranslation()` from `react-i18next`.
- Wrap display text in `translateString("...")` or `translateNode(...)` from `frontend/src/lib/localization`.
- Keep translation keys registered in `frontend/src/locales/`.

---

## Verification checklist for frontend tasks
1. `tsc -b`: TypeScript typecheck passes without errors.
2. `vitest run`: Unit tests pass.
3. No hardcoded server URLs; all API calls go through `api` in `src/api/client.ts`.
4. Dark/light mode theme variables verified.
5. Form errors show inline validation feedback to the user.
