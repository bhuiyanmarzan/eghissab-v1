# Modular monolith

FACT: one API executable registers health/listing modules; migration executable is separate. Listing follows handler/service/repository/model/DTO files. Compatibility wrappers remain under `internal/handlers` and `internal/db`.

Target rule: domain module owns its persistence and exposes narrow services/query interfaces. Application composition wires dependencies; handlers parse/validate input, services enforce business rules/transactions, repositories perform SQL. Avoid cross-module repository imports, direct table writes and shared “god” services. Shared infrastructure has no domain-specific policy.

Do not reorganize unrelated code during feature tasks. Established boundary changes require explicit approval. See [module boundaries](module-boundaries.md).

Related: [Documentation index](../README.md).
