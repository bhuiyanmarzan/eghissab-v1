# Definition of Done

Track each dimension independently:

| Dimension | Completion evidence |
|---|---|
| Implementation complete | Assigned scope/acceptance behavior delivered; diff reviewed; blockers disclosed |
| Tests executed | Actual commands, outcomes and environment recorded; skipped = NOT RUN |
| Security review complete | Applicable permissions, scope, data handling and failure paths reviewed; risks recorded; runtime claims require runtime evidence |
| Documentation updated | Current status, backlog, issues, relevant design/API/module docs and append-only history/handoff reconciled |
| Business approval received | Explicit decision origin recorded for material choices; N/A only when none required |

A task becomes VERIFIED only after required checks are executed and pass. DONE additionally requires all applicable dimensions and deliverables, with no unresolved acceptance blockers. A documented waiver is not a passing test. IMPLEMENTED_UNVERIFIED preserves missing verification. BLOCKED identifies an unmet prerequisite or denied required deliverable.

DOC-001 requires intended files, accurate source evidence, resolvable links, unique IDs, consistent handoff, and no application/migration changes. Runtime testing is N/A by scope; protected `.agents/` delivery is still blocked, so DOC-001 is not DONE. Staging complete contents does not silently satisfy the intended-path requirement.

Related: [Documentation index](../README.md).
