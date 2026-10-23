# EGHissab documentation

Start with [AGENTS.md](../AGENTS.md), [current status](00-ai-context/current-status.md), [backlog](00-ai-context/task-backlog.md), and [handoff](00-ai-context/next-session.md).

## Reading conventions
FACT = source evidence (not runtime success); USER-REPORTED = supplied context without repository/runtime proof; PROPOSED = future design, not approval; UNKNOWN = missing evidence. Feature labels: IMPLEMENTED, PARTIALLY_IMPLEMENTED, PLANNED, BLOCKED, UNKNOWN. Task statuses and module labels are different; source presence never establishes VERIFIED.

Snapshot: 2026-10-22, base commit 94b9196. User-supplied instructions limit this work to docs and agent infrastructure. Existing backend/frontend README tutorial content was preserved. Scope and source conflicts are recorded, not silently corrected.

## Contents

### 00-ai-context

- [architecture-summary.md](00-ai-context/architecture-summary.md)
- [current-status.md](00-ai-context/current-status.md)
- [decision-log.md](00-ai-context/decision-log.md)
- [dependency-map.md](00-ai-context/dependency-map.md)
- [known-issues.md](00-ai-context/known-issues.md)
- [module-registry.md](00-ai-context/module-registry.md)
- [next-session.md](00-ai-context/next-session.md)
- [project-context.md](00-ai-context/project-context.md)
- [session-history.md](00-ai-context/session-history.md)
- [task-backlog.md](00-ai-context/task-backlog.md)

### 01-product

- [business-rules.md](01-product/business-rules.md)
- [personas-and-journeys.md](01-product/personas-and-journeys.md)
- [product-vision.md](01-product/product-vision.md)
- [scope.md](01-product/scope.md)

### 02-architecture

- [authentication-flow.md](02-architecture/authentication-flow.md)
- [authorization-model.md](02-architecture/authorization-model.md)
- [event-architecture.md](02-architecture/event-architecture.md)
- [modular-monolith.md](02-architecture/modular-monolith.md)
- [module-boundaries.md](02-architecture/module-boundaries.md)
- [system-architecture.md](02-architecture/system-architecture.md)
- [tenant-isolation.md](02-architecture/tenant-isolation.md)

### 02-architecture/adr

- [adr-001.md](02-architecture/adr/adr-001.md)
- [adr-002.md](02-architecture/adr/adr-002.md)
- [adr-003.md](02-architecture/adr/adr-003.md)
- [adr-004.md](02-architecture/adr/adr-004.md)
- [adr-005.md](02-architecture/adr/adr-005.md)

### 03-database

- [constraints-indexes.md](03-database/constraints-indexes.md)
- [database-overview.md](03-database/database-overview.md)
- [erd.md](03-database/erd.md)
- [migrations.md](03-database/migrations.md)
- [rls-policies.md](03-database/rls-policies.md)
- [schema-dictionary.md](03-database/schema-dictionary.md)

### 04-api

- [api-conventions.md](04-api/api-conventions.md)
- [authentication-api.md](04-api/authentication-api.md)
- [openapi.yaml](04-api/openapi.yaml)

### 05-development

- [coding-standards.md](05-development/coding-standards.md)
- [definition-of-done.md](05-development/definition-of-done.md)
- [go-standards.md](05-development/go-standards.md)
- [testing-strategy.md](05-development/testing-strategy.md)

### 06-security

- [security-checklist.md](06-security/security-checklist.md)
- [security-model.md](06-security/security-model.md)
- [threat-model.md](06-security/threat-model.md)

### 07-deployment

- [backup-recovery.md](07-deployment/backup-recovery.md)
- [deployment-architecture.md](07-deployment/deployment-architecture.md)
- [environment-configuration.md](07-deployment/environment-configuration.md)

### 08-modules

- [billing.md](08-modules/billing.md)
- [consumer.md](08-modules/consumer.md)
- [frontend.md](08-modules/frontend.md)
- [health.md](08-modules/health.md)
- [identity.md](08-modules/identity.md)
- [infrastructure.md](08-modules/infrastructure.md)
- [inventory.md](08-modules/inventory.md)
- [invoice.md](08-modules/invoice.md)
- [listing.md](08-modules/listing.md)
- [mobile.md](08-modules/mobile.md)
- [organization.md](08-modules/organization.md)
- [platform.md](08-modules/platform.md)
- [store.md](08-modules/store.md)
- [system.md](08-modules/system.md)

### Agent setup

[Prepared roles, workflows and prompts](09-agent-setup/README.md): .agents installation is blocked by environment policy.

[Documentation verification report](00-ai-context/verification-report.md).


Related: [Documentation index](README.md).

Authentication implementation: [API](04-api/authentication-api.md), [setup and verification](07-deployment/authentication-setup.md), [ADR-006](02-architecture/adr/adr-006.md).
