# Next session

Last implementation: AUTH-001, IMPLEMENTED_UNVERIFIED, 2026-10-22. Explicit scope: full backend identity/authentication, limited transaction/RLS/role prerequisites, additive migration and documentation. DOC-001 still awaits protected .agents installation; do not bypass that restriction.

Read AGENTS.md, all memory, authentication API/architecture/ADR-006, migration 000004 and authentication setup. Inspect Git before editing; AGENTS.md/docs were already untracked at this session's start and must be preserved. No agent delegation or parallel writes were used.

Next actions: review and apply migration 000004 with privileged migration credentials when authorized; provision runtime password/auth signing key/SMTP/HTTPS frontend landing page/proxy CIDRs. The API intentionally refuses startup without these. Then, only when explicitly authorized to run automated tests, exercise the complete lifecycle, error cases, RLS roles, refresh races/reuse, logout revocation, verification expiry/retries and SMTP delivery listed in setup. Do not mark this work VERIFIED/DONE from compilation alone. Existing transaction tests may need updated expectations for the stricter guard/nesting contract; tests were neither run nor changed by this no-test request.

Do not automatically begin organization/store or frontend work. Existing listing isolation/schema, future default grants, email/session retention maintenance, key rollover and mail outbox are documented follow-ups. See [known issues](known-issues.md) and [setup](../07-deployment/authentication-setup.md).
