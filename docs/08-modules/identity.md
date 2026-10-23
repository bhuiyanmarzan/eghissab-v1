# Identity module

Status: IMPLEMENTED_UNVERIFIED. Source: backend/internal/modules/identity/{handler,service,repository,security,mail}.go. Composition: backend/cmd/api/main.go. Uses database/sql via existing TxManager, existing httpx errors and slog; no second infrastructure stack.

Public interfaces: Module.RegisterRoutes, Module.RequireAuth, FromContext, Service registration/verification/login/refresh/authentication/profile/logout methods, VerificationMailer and SMTP adapter. Configuration and startup role/RLS checks fail closed. No organization/store membership or platform privilege is claimed by an authenticated Principal.

Owns existing users, contacts, identities, sessions and verification challenges plus auth_attempts; MFA table is protected but no MFA workflow added. Migration 000004 adds session rotation state, indexes, RLS/grants and restricted bootstrap functions. See [API](../04-api/authentication-api.md), [architecture](../02-architecture/authentication-flow.md), [setup](../07-deployment/authentication-setup.md).
