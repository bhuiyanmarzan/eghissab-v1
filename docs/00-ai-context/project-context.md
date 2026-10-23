# Project context

## 2026-10-22 authentication update

Identity authentication is now implemented but runtime-unverified; see current-status.md and ../04-api/authentication-api.md. Earlier initial-inventory statements below are historical.


## Purpose and identity
FACT: repository `github.com/bhuiyanmarzan/eghissab-v1`, local directory `eghissab-v1`, inspected at commit `94b9196` on 2026-10-22 (Asia/Dhaka). Root contains `backend/`, `frontend/`, Compose files and Makefile. No pre-existing AGENTS.md or docs tree was found here. Other projects' instructions/ADRs do not apply automatically.

USER-REPORTED target: EGHissab is a multi-organization, multi-store SaaS with platform administration, organization/store operations, and global consumer expense tracking. An organization is the billing boundary; stores isolate operational data. A user can own/join several organizations and participate as a consumer. Platform access must be explicitly authorized, not inferred from a merchant role.

## Stack and evidence
FACT: Go `database/sql` with pgx stdlib and golang-migrate (`backend/go.mod`); configured Go version 1.27.0, not validated here. React/TypeScript/Vite starter (`frontend/package.json`, `frontend/src/App.tsx`). PostgreSQL 17 image in `docker-compose.yml`. Modular health/listing code under `backend/internal/modules/`.
PROPOSED: Redis, Expo mobile, domain modules and worker/outbox. No implementation found for these.

## Principles
Shared identity; organization billing; store isolation; consumer visibility only via eligible approved relationships. Modular monolith with explicit interfaces, parameterized SQL, transaction-local RLS, least privilege, auditable sensitive actions. See [business rules](../01-product/business-rules.md), [architecture](architecture-summary.md), and [current status](current-status.md).

Related: [Documentation index](../README.md).
