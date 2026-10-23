# Agent setup installation blocker

The environment automatically rejected creation of `.agents/workflows/start-session.md`: “writing outside of the project; rejected by user approval settings.” `.agents/` is a read-only protected path in this session. No alternate write mechanism was used.

All requested contents are prepared here as reviewable documents. They are usable via root AGENTS.md references but are not installed at the requested `.agents/` locations. DOC-001 remains BLOCKED on that exact acceptance condition. An authorized operator can install matching files after inspecting current destination contents; preserve any intervening changes and recheck links. Future agents must not bypass the permission restriction.

| Prepared directory | Intended destination | Count |
|---|---|---|
| roles/ | .agents/roles/ | 8 |
| workflows/ | .agents/workflows/ | 5 |
| prompts/ | .agents/prompts/ | 4 |

Installation is a repository operation, not approval to develop features. Role/workflow text uses repository-root-relative paths in code spans to remain valid after relocation. Local Markdown navigation is limited to sibling files. For next implementation work explicitly select SEC-001; do not silently skip the blocked initialization task.

Related: [Documentation index](../README.md).
