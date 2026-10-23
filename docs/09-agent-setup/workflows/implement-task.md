# Implement Task

1. Read root AGENTS.md, task acceptance criteria, owning module docs and relevant code.
2. Check dependencies and record IN_PROGRESS plus owner/file scope before implementation.
3. Implement only authorized scope. Preserve migrations/data; parameterize SQL; enforce server-derived context and module boundaries.
4. Coordinate shared migrations/interfaces/API contracts. Parallel code edits need separate scopes and branches/worktrees; do not overwrite concurrent changes.
5. Record material design decisions; seek approval only where required before implementing unapproved choices.
6. Run permitted, task-relevant verification. If user prohibits tests, report NOT RUN and keep required checks outstanding.
7. Follow [review-task](review-task.md), then [finish-session](finish-session.md). Do not start a second task.
