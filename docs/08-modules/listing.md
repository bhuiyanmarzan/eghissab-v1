# Listing module

## Purpose and business responsibilities
Existing marketplace prototype. Follow [business rules](../01-product/business-rules.md); do not infer unapproved domain rules.

## Implementation and evidence
Status: PARTIALLY_IMPLEMENTED. Evidence: `backend/internal/modules/listing/`. IMPLEMENTED means present code, not executed verification. Runtime verification: NOT RUN. Existing implementation is a starter/prototype, not a completed business portal.

## Ownership and interfaces
- Database ownership: listings referenced but definition absent.
- Dependencies: database, httpx, middleware.
- Main services / API endpoints: Service/Repository; GET/POST /listings; DELETE /listings/{id}.
- Events: none implemented; any future event contract requires design review.
- Permissions: no business authorization implemented here; health is public liveness. Other exposed prototype routes are not a model for protected business access.
- RLS requirements: server-derived validated context, appropriate scope and least privilege for any database operation; see [policy inventory](../03-database/rls-policies.md). No defined table policies currently.

## Remaining work and acceptance
LEGACY-001. Acceptance criteria come from the corresponding [backlog](../00-ai-context/task-backlog.md) entry. For planned modules, first review schema/API/business rules, then implement within assigned ownership; require positive and cross-scope negative authorization evidence before declaring verified. For health, verify its documented response when runtime checks are permitted. Shared table access must use owning-module interfaces, not direct cross-module writes.

## Handoff
No write ownership is assigned by this document. Claim a task before changes; update status, interfaces, evidence and remaining work at task completion.

Related: [Documentation index](../README.md).
