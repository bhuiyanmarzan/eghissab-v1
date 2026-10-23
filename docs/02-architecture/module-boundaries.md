# Module boundaries

[Module registry](../00-ai-context/module-registry.md) is the canonical implementation inventory. Identity owns credentials/session data; organization owns membership/owners; billing owns entitlements; store owns store membership and roles; inventory owns stock; invoice owns invoice state/decisions; consumer owns store relationships and personal views; platform owns administrative policy. Only identity/platform tables exist today.

Target: callers use owner-provided interfaces; dependencies flow as [mapped](../00-ai-context/dependency-map.md), without cycles. A cross-module workflow has one explicit service transaction boundary; all participating repositories use the same scoped transaction. Do not make independent commits inside a shared workflow. Define event schema/version and integration responsibility before asynchronous coupling. No direct consumer-wide bypass for invoice queries.

Related: [Documentation index](../README.md).
