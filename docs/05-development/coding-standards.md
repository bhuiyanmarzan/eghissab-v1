# Coding standards

Use the repository's current structure; inspect related source before edits. Keep changes inside assigned ownership, avoid unrelated reformatting/dependency upgrades and preserve compatibility until a breaking change is approved. Label proposals and unresolved decisions. Do not include secrets in source, logs, fixtures or memory.

Keep handlers thin, business invariants in services and persistence in repositories. Cross-module calls use explicit interfaces. Validate inputs and enforce authorization server-side, regardless of frontend guards. Version schema changes with forward migrations; never rewrite applied history. Record API/interface changes in owning documentation and task handoff. See [Go standards](go-standards.md), [testing](testing-strategy.md), and [DoD](definition-of-done.md).

Related: [Documentation index](../README.md).
