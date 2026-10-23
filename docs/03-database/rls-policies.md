# RLS policies and grants

Migration 000004 adds the identity authentication boundary without rewriting migrations 000001–000003. Status: source implemented; live role/policy verification NOT RUN.

| Tables | Runtime eghissab_app | Dedicated identity executor |
|---|---|---|
| identity.users | SELECT only where id=app.current_user_id() | SELECT/INSERT/UPDATE through auth functions |
| identity.user_contacts | SELECT only where user_id=app.current_user_id() | SELECT/INSERT/UPDATE through auth functions |
| identity.user_identities, user_sessions, verification_challenges, mfa_factors, auth_attempts | no direct table privileges/policies | SELECT/INSERT/UPDATE; explicit RLS policy |
| platform.roles, platform.role_assignments | prior direct runtime grants revoked; no platform API added | no grants |

All seven identity tables ENABLE and FORCE RLS. Public/runtime identity-table grants are revoked before limited profile/contact SELECT is restored. Functions auth_budget/register/resend/verify/credentials/login/refresh/authorize/logout are SECURITY DEFINER, fixed search_path (pg_catalog,identity,pg_temp), no dynamic caller SQL, owned by eghissab_identity_executor (NOLOGIN, NOSUPERUSER, NOCREATEROLE, NOCREATEDB, NOINHERIT, NOBYPASSRLS). PUBLIC execution is revoked; execution is granted explicitly to eghissab_app. Executor schema CREATE is granted only while assigning function ownership and then revoked. No runtime/executor role memberships are allowed. Runtime attributes are hardened and API startup rejects role ownership/elevated attributes, missing RLS and missing auth migration.

Profile queries set app.user_id with set_config(...,true) inside the service transaction. Anonymous bootstrap never pretends an unauthenticated request has user/organization context. The API authenticates credentials/JWTs and calls restricted operations; database runtime credentials are still a trusted application boundary. Custom RLS settings can be set by that role, so this is not protection against a fully compromised API/database credential.

The existing TxManager now distinguishes generic and scoped executors and pins tenant scope. Identity-only transactions do not supply an organization or qualify as tenant transactions. Future organization/store code must validate membership before setting scope; no policies or schemas for absent modules are invented.

Historical migration 000003 still contains broad default privileges and an example password. This forward migration removes current identity/platform runtime grants, but future migrations must explicitly review grants/policies because historical defaults still apply to new objects created by the same migration owner. Rotate the example runtime password administratively; no production secret is generated or changed here. See [setup/verification](../07-deployment/authentication-setup.md).
