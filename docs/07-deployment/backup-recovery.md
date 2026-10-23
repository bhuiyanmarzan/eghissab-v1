# Backup and recovery

FACT: persistent PostgreSQL named volume exists; no scheduled backup, retention policy, off-host copy or restore verification found. A volume is not a backup. Runtime backup coverage UNKNOWN.

PROPOSED procedure for OPS-001: agree RPO/RTO and retention with owner; configure encrypted off-host backups with restricted credentials; include schema/roles and needed key recovery; monitor backup failures; restore into isolated environment; verify row counts, constraints, application behavior and restricted-role policies; measure recovery time before claiming readiness. Review migration compatibility before recovery/cutover. Use authorized maintenance windows and validate current backups before destructive operations. Never restore over production or drop volumes without explicit authorization.

No backup/restore commands were executed. Tool/provider choice and storage budget remain unresolved.

Related: [Documentation index](../README.md).
