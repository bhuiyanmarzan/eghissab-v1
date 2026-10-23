# Threat model

| Threat / trust boundary | Current evidence | Target mitigation / task |
|---|---|---|
| Client spoofs user/store context | No auth/membership middleware; carrier trusts callers | Server-derived verified actor; SEC-002/AUTH-001 |
| Generic executor used as tenant transaction | One shared context key | Authorization provenance guard; SEC-001 |
| Cross-user credential/session data access | Broad grants, no RLS policies | Narrow operation policies and bootstrap path; DB-001 |
| DB owner/superuser runtime bypass | Development credentials and fallback | Enforced restricted runtime role; DB-001 |
| Pool carries scope between requests | local settings exist, no live verification | Same-transaction queries and reuse tests; SEC-001 |
| SQL injection | Listing value placeholders exist | Parameterize all future queries; whitelist dynamic identifiers |
| Consumer sees earlier/unrelated invoices | Domain not implemented | Approved linking and eligibility predicates; CON-001/INVOICE-001 |
| Concurrent owner removal or final decisions | Domain not implemented | Atomic invariant enforcement; ORG-001/INVOICE-001 |
| Secret/account takeover | No auth service; example role password in migration | Provision secrets, approved hash/session/MFA policy; AUTH-001/OPS-001 |
| Worker replays or gains excess authority | No worker yet | Idempotency and revalidated scope; EVENT-001 |
| Data loss / exposed database | Published DB port; no backup automation | Network controls and restore practice; OPS-001 |

Assess exploitability in authorized isolated environments; this is a source-based threat inventory, not a penetration-test report. See [security checklist](security-checklist.md).

Related: [Documentation index](../README.md).
