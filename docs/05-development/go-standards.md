# Go standards

## Current baseline
`backend/go.mod` names github.com/bhuiyanmarzan/eghissab-v1 and Go 1.27.0. Use standard `database/sql` with pgx stdlib; no ORM migration is authorized. Formatting and build/toolchain behavior were not executed in DOC-001.

## Required practice for future code
- Propagate request/job context through service and repository methods; use QueryContext/ExecContext and explicit timeouts where appropriate. Do not replace request context with Background inside repositories.
- Use SQL placeholders for values; whitelist identifiers/order options. Close rows, check rows.Err, and handle sql.ErrNoRows deliberately.
- Construct dependencies at composition roots. Depend on small interfaces; isolate domain policy from HTTP and SQL error details. Wrap errors with %w and map expected domain errors to stable HTTP codes without leaking internals.
- Service owns transaction lifetime. All operations in a scoped workflow use the same authorized executor; commit only on success, rollback on error/panic/cancellation. Specify nested semantics instead of silently opening an unrelated transaction.
- Validate server-derived identity/scope before transaction-local set_config. Generic transactions must not satisfy tenant-authorized guards. NoopTxManager is a testing helper, never production wiring.
- Use structured slog and request IDs; do not log passwords, tokens, DSNs, MFA secrets or unnecessary personal data.
- Load/validate configuration once; separate migration/runtime roles and fail closed on unsafe production configuration. Close resources on failed startup as well as shutdown.
- Retain HTTP read/write/idle timeouts and graceful signal shutdown. Changes to operational behavior must be documented.
- Input validation and DTOs: Define all HTTP request/response payloads in a module-level `dto.go`. Request structs must implement `Validate() error` returning a field-specific `*ValidationError{Field, Msg}` with trimmed string comparisons and length/character validation. Handlers check `errors.As(err, &verr)` and respond with HTTP 422 Unprocessable Entity using `httpx.ValidationError(w, http.StatusUnprocessableEntity, verr.Msg, httpx.CodeValidationFailed, verr.Field)`. Accompany every DTO with full unit tests in `dto_test.go` covering both valid and boundary/invalid cases.

Evidence: `backend/cmd/api/main.go`, `internal/config/config.go`, `internal/database/`, `internal/modules/listing/`, `internal/modules/identity/`. Known deviations: [issues](../00-ai-context/known-issues.md).

Related: [Documentation index](../README.md).
