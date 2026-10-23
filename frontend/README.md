# Mantis Enterprise Dashboard

A route-complete React implementation based on the supplied Mantis dashboard references. It includes dashboard analytics, tables, forms, customer/invoice/e-commerce flows, profiles, chat, calendar, kanban, authentication, maintenance pages, charts, pricing, and a component catalog.

## Stack

- React 19 + TypeScript + Vite
- React Router for all application routes
- TanStack Query and Axios for server data
- Zustand for persisted UI state
- React Hook Form + Zod for validated forms
- shadcn-style local components with Tailwind CSS
- TanStack Table for filtering, sorting, and pagination
- Recharts and date-fns
- i18next with English and Bengali resources
- Vitest, React Testing Library, and Playwright
- ESLint, Prettier, Husky, and lint-staged
- OpenAPI contract for the mock API

## Requirements

- Node.js 20 or newer
- pnpm 9 or newer

## Run locally

```bash
pnpm install
pnpm dev
```

This starts both services:

- Frontend: `http://localhost:5173`
- Mock JSON API: `http://localhost:4000`

Open `http://localhost:5173/dashboard/analytics`. The demo login is available at `http://localhost:5173/auth/login`; any submitted credentials continue to the dashboard.

To run only one service:

```bash
pnpm dev:web
pnpm dev:api
```

## Production build

```bash
pnpm build
pnpm preview
```

## Tests and quality checks

```bash
pnpm test
pnpm lint
pnpm test:e2e
pnpm storybook
```

The first Playwright run may require `pnpm exec playwright install chromium`.

## Replace the dummy API

Copy `.env.example` to `.env` and update:

```dotenv
VITE_API_URL=https://your-api.example.com
```

All HTTP calls are centralized in `src/api/client.ts`. Keep or adapt the exported response types there, then replace the query functions with your real endpoints. The current contract is documented in `openapi.yaml`; `db.json` contains the editable local data used by `json-server`.

For production authentication, replace the demo submit handler in `src/pages/PublicPages.tsx` with your OAuth2/OIDC provider, store tokens in secure HTTP-only cookies, and attach the session through an Axios interceptor. A custom role/action permission starter is provided in `src/auth/permissions.ts`.

## Monitoring and analytics

The environment contract includes `VITE_SENTRY_DSN` and `VITE_POSTHOG_KEY`. `src/lib/monitoring.ts` initializes Sentry and PostHog only when their respective production keys are present. No monitoring or analytics data is sent by the starter application without those variables.

## Project structure

```text
src/
  api/             API client and response contracts
  auth/            Role and permission rules
  components/      Layout and shadcn-style UI primitives
  data/            Navigation and route catalog
  lib/             Utilities and monitoring hook
  pages/           Feature and route-family screens
  store/           Zustand application state
db.json            Dummy REST API data
openapi.yaml       API contract
e2e/               Playwright smoke tests
```
