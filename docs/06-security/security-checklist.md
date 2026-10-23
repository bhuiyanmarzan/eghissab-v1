# Security checklist

Use per task; unchecked means not evidenced, not necessarily a reproduced exploit.

- [ ] Authentication and session revocation implemented under reviewed protocol.
- [ ] Organization/store membership derived and verified server-side.
- [ ] RBAC and consumer invoice eligibility enforced.
- [ ] Generic transactions cannot satisfy authorized tenant guards.
- [ ] Restricted runtime role is nonsuperuser, nonowner and NOBYPASSRLS.
- [ ] Appropriate RLS USING/WITH CHECK policies and grants exist and deny cross-scope operations.
- [ ] Pool reuse, rollback/cancel and missing-context checks executed.
- [ ] Sensitive actions audited; credentials/tokens/personal data redacted.
- [ ] Secrets provisioned independently; example passwords never used in production.
- [ ] TLS/network exposure reviewed.
- [ ] Encrypted off-host backups and isolated restore verified.

DOC-001 source review identified gaps; none of these is marked passed without corresponding evidence. See [issues](../00-ai-context/known-issues.md).

Related: [Documentation index](../README.md).
