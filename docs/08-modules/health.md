# Health module

## Purpose and business responsibilities
Liveness endpoint. Follow [business rules](../01-product/business-rules.md); do not infer unapproved domain rules.

## Implementation and evidence
Status: IMPLEMENTED. Evidence: `backend/internal/modules/health/`. IMPLEMENTED means present code, not executed verification. Runtime verification: NOT RUN. 

## Ownership and interfaces
- Database ownership: none.
- Dependencies: net/http.
- Main services / API endpoints: GET /healthz.
- Events: none implemented; any future event contract requires design review.
- Permissions: no business authorization implemented here; health is public liveness. Other exposed prototype routes are not a model for protected business access.
- RLS requirements: server-derived validated context, appropriate scope and least privilege for any database operation; see [policy inventory](../03-database/rls-policies.md). No defined table policies currently.

## Remaining work and acceptance
No readiness check; runtime unverified. Acceptance criteria come from the corresponding [backlog](../00-ai-context/task-backlog.md) entry. For planned modules, first review schema/API/business rules, then implement within assigned ownership; require positive and cross-scope negative authorization evidence before declaring verified. For health, verify its documented response when runtime checks are permitted. Shared table access must use owning-module interfaces, not direct cross-module writes.

## Handoff
No write ownership is assigned by this document. Claim a task before changes; update status, interfaces, evidence and remaining work at task completion.

Related: [Documentation index](../README.md).
