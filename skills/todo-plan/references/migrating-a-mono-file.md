# Todo-plan -- migrating a mono-file

Procedure moved out of this skill's `SKILL.md`. A section named here
and not found below is in `SKILL.md`.

## Migrating a mono-file

You will meet repos from before this layout: one file holding everything.
The shapes to recognize:

- `TODO_PLAN.md` carrying task bodies, checklists, phase breakdowns, a
  bug list, or a lessons archive inline.
- A standalone `TODO.md`, `BUGS.md`, `TODOS.md`, or `LESSONS.md` at the
  root or under `docs/`.
- Numbered items ("7. Fix the retry loop") that other notes cite by
  position.

**Migrate before you work the plan, not alongside it.** A half-migrated
repo has two sources of truth, which is worse than either alone. The
migration is one docs-only commit, separate from any feature work.

- **Each open item becomes its own file under `tasks/`.** Mint an ID per
  the tier rules above -- never reuse the item's old number as the ID.
  Defects get `kind: bug` and a body restated as evidence per law 14;
  everything else is `kind: task`. An item too vague to give a title is
  an item to raise with the human, not to copy over.
- **Old numbers die with the migration -- fix every citer now, not
  later.** A number that was only a position vanishes. Where something
  else genuinely cites "item 7", update the citer in the same migration
  commit: for an open item, point it at the minted task ID (and put
  "formerly item 7 of TODO.md" in the task body so grep still resolves
  the old phrase); for a completed item, whose body is deleted, replace
  the citation with a self-contained historical note ("formerly item 7
  of TODO.md, done") -- deferring the repair leaves it dangling forever,
  because nothing will exist to resolve it against.
- **Completed items are deleted, not moved to `tasks/done/`.** `done/`
  holds the current cycle; the mono-file's history is not a cycle, and
  git history already holds it.
- **Lessons route by law 15.** Settled ones go straight to their layer;
  only genuinely unsettled ones enter the plan's Lessons Learned, with
  `about: wip`.
- **Then leave exactly one plan file: the root `TODO_PLAN.md`, on the
  schema above.** A standalone legacy file (`TODO.md`, `BUGS.md`,
  `TODOS.md`, `LESSONS.md`) beside a real plan is deleted outright once
  drained. If the legacy file *was* the repo's only plan, reduce it to
  the schema and rename it to `TODO_PLAN.md` at the root -- never leave
  the plan under a noncanonical name. Nothing that survives may still
  hold a task body.

---
