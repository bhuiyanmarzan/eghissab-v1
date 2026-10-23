# Business rules

## Approved rules

- BR-001: Multiple organization owners are permitted; at least one active owner must remain. ([ADR-001](../02-architecture/adr/adr-001.md)).
- BR-002: One active role per user per store. ([ADR-002](../02-architecture/adr/adr-002.md)).
- BR-003: Eligible consumer invoice visibility begins after approved customer linking. ([ADR-003](../02-architecture/adr/adr-003.md)).
- BR-004: Valid paid or trial entitlement permits store creation. ([ADR-004](../02-architecture/adr/adr-004.md)).
- BR-005: One effective final customer invoice decision; amendments require a defined process. ([ADR-005](../02-architecture/adr/adr-005.md)).

Origin: explicit approved-rule statements in the user-supplied initialization file; recorded 2026-10-22. Original approval date unknown. These rules are intended behavior, not current implementation.

## Unresolved decisions
Account activation/verification and session protocol; linking proof and duplicate/merge handling; exact eligible invoice definition and timestamp boundary; amendment actor/process; invoice rejection versus voiding; subscription grace/expiry and trial limits; quotas; platform support access/audit retention. Obtain decisions before affected feature implementations. Do not infer answers from old unrelated repositories.

Related: [Documentation index](../README.md).
