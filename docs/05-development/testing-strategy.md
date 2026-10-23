# Testing strategy

## This session
Application tests, builds, migrations, database connections and containers: NOT RUN, explicitly excluded by initialization instructions. Documentation checks only: required/staged files, local links, unique task/ADR IDs, consistent status/handoff and unchanged tracked source.

## Existing tests (inspected, not executed)
`backend/internal/database/tx_test.go`: context/executor retrieval and missing context, no live database isolation coverage. Listing `dto_test.go`, `service_test.go`, `repository_test.go`: validation, service mocks and missing executor guards. Existing injected-executor test currently accepts generic injection as tenant-authorized; it must change with SEC-001 rather than perpetuating the defect.

## Future task-driven verification
Run targeted unit tests when allowed; integration tests for transaction/RLS changes need real PostgreSQL and a restricted nonowner, nonsuperuser role. Cover own/cross-store read/write, absent/malformed context, wrong membership, general executor rejection, commit/rollback/cancel/panic, pool reuse and consumer link timing. Migration checks use disposable DBs only with authorization; production is never a test fixture. Domain invariants need concurrency scenarios for owner retention, quotas and invoice finalization.

If user says no tests, comply, record NOT RUN and implementation completeness separately; never claim verified security. Do not add repetitive tests for low-impact docs. Required verification skipped means IMPLEMENTED_UNVERIFIED, not VERIFIED/DONE. Useful future unit command: `cd backend && go test ./internal/database ./internal/modules/listing`; this does not establish live RLS correctness.

Related: [Documentation index](../README.md).
