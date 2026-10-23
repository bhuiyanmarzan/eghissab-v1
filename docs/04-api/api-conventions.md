# API conventions

## Existing API evidence
`backend/internal/modules/health/module.go` and `listing/module.go` register the following. Source implementation does not imply runtime verification.

| Method/path | Success | Known application errors | Authorization |
|---|---|---|---|
| GET /healthz | 200, {"status":"hot reload working now"} | no explicit handler error | public |
| GET /listings | 200, array of listing DTOs, at most 100 | 500 internal_error | none |
| POST /listings | 201, id/title/created_at | 400 malformed_json; 422 validation_failed; 500 internal_error | none |
| DELETE /listings/{id} | 204 empty body, including absent ID | 500 internal_error | none |
| POST /auth/register | 202, {"message":"..."} | 400 malformed_json; 422 validation_failed; 429 rate_limited; 503 delivery_unavailable; 500 internal_error | public / rate-limited |

No GET /listings/{id} route is registered even though service/repository methods exist. Listing requires a table absent from migrations. Nginx strips /api/ prefix when forwarding; API routes themselves have no prefix. `X-Request-ID` is accepted/generated and echoed by middleware; supplied values are not identity evidence. Both `listing` and `identity` modules adhere to DTO validation with 422 `validation_failed` responses.

JSON errors: `{ "error": { "code": "...", "message": "...", "field": "optional" } }` (`backend/internal/httpx/errors.go`). Existing POST decoder does not reject unknown fields/trailing content or bound body size explicitly. String length checks use Go byte lengths after trim. No pagination contract beyond limit 100, no API versioning/idempotency/rate-limit contract.

## Target conventions, pending task-specific approval
Bound request bodies; validate DTOs; stable error mapping; use server-side authorization; redact sensitive data; document pagination/versioning/idempotency before use. Contract changes require approval when breaking existing callers. See [OpenAPI](openapi.yaml) for the inspected surface and [authentication API](authentication-api.md) for missing operations.

Related: [Documentation index](../README.md).
