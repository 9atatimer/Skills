---
name: wrapup
description: "The session epilogue, typically human-invoked (/wrapup) before a session is archived: first preserve any uncommitted or unpushed work on the session's feature branch, then sweep what the session produced into durable homes -- comments on the issues it touched, new issues for what it discovered, TODO_PLAN lessons and status, as-built corrections -- batching all file edits into at most ONE docs-only PR. Records only what would be wasteful to forget; 'nothing worth recording' is a valid outcome. If an implementation landed this session and phase 8 has not run, run the retrospective skill first -- wrapup is not a substitute for it."
---

# SKILL: Wrapup (session epilogue)

> **Purpose:** a session's discoveries die with its archive unless they
> are routed to where the next reader actually works. This is the
> pre-archive sweep the human otherwise has to type by hand.
> **Exit:** a one-paragraph summary of what was recorded and where.
> Then stop.

Wrapup is **not a phase**. It runs at the end of any session, in any
state -- discussion sessions, half-finished implementations, reviews,
spikes. It is the session-scoped cousin of the retrospective:

- **If an implementation landed and phase 8 has not run, run the
  retrospective skill first.** It never elides, and wrapup does not
  replace it. Wrapup then covers only what phase 8 did not.
- If phase 8 already ran, wrapup does not re-run it or duplicate its
  outputs.

## First: preserve the work itself

Before any routing, inspect every repository the session touched:
uncommitted changes (`git status`) and unpushed commits on the working
branch. Unfinished code is not "context" -- it is the session's primary
artifact, and in an ephemeral sandbox, archiving discards it
permanently. Commit and push it on the session's feature branch per the
github-workflow skill (never the default branch; work-in-progress state
is fine to push on a feature branch -- a PR can wait). If pushing is
impossible (no network, no credentials), do NOT proceed quietly: say so
and end with a precise handoff -- repo, branch, diff stat, and what
remains -- so the human can decide before the container is reclaimed.
Only then run the sweep.

## The sweep

Walk the session once and route each artifact to the one place the
next reader of that subject will look. Context goes where the work
will read it -- never into the session summary, which is about to be
archived and re-read by nobody.

| What the session produced | Durable home |
|---|---|
| Progress, evidence, or a decision on an existing issue #N | A comment on issue #N |
| A defect or opportunity discovered | A new issue -- defect in the body, solution thinking in a comment (issue anatomy, the github-workflow skill) |
| Task state changed: done, blocked, descoped | the task file: move to `tasks/done/`, set `blocked_by`, or delete it. External blockers go in `TODO_PLAN.md` Blockers |
| The order of what to do next changed | `TODO_PLAN.md` "Now" |
| Work discovered that nobody is doing yet | a new file in `tasks/`, `kind: task` or `bug` |
| A lesson with a mechanism, still unsettled, tied to the work in progress | `TODO_PLAN.md` Lessons Learned |
| A lesson with a mechanism, settled | Its layer per the sdlc skill, law 15: code comment (file-local), `docs/arch/` (component -- ONLY if the change shipped, the 7a rule; otherwise it waits in `TODO_PLAN.md`), `AGENT.md` (repo), or a proposed skill change (fleet-universal). Never an issue -- issues vanish when the root cause is fixed |
| A deployed-system fact that changed or was wrong | `docs/arch/` -- ONLY if the change actually shipped; the 7a rule is unchanged |
| The same correction made for the second or third time | A proposed skill change (an issue on the skills repo), not another lesson nobody reads |
| A repo convention that got clarified | The repo's agent instruction file (`AGENT.md` / `AGENTS.md` / `CLAUDE.md`) |
| Everything else session-local: reasoning, dead ends, scratch state | Let it die with the session. That is what archiving is for. (Code is never in this row -- see "First: preserve the work itself") |

When the sweep touches `TODO_PLAN.md`, also run the todo-plan skill's
graduation triage over the whole Lessons Learned list -- promote/keep/
delete every entry, not only this session's additions. A sweep that
never opens the file skips this; the retrospective's mandatory triage
is the backstop that keeps the list from accumulating.

## The two laws

**1. Record only what is wasteful to forget.** The test for each
candidate: would a future session burn real time rediscovering this?
If yes, record it in its home above. If no, drop it. An empty sweep is
a *success* outcome -- say "nothing worth recording" and stop. Never
pad `TODO_PLAN.md`, a design doc, or the as-built to prove the session
happened; a plan file full of ceremony entries is harder to resume
from than a terse one.

**2. At most one PR.** Batch every file edit the sweep produces --
TODO_PLAN updates, as-built corrections, instruction-file lines -- into
ONE docs-only PR. Issue comments and new issues need no PR at all, so
a sweep that routes everything to issues correctly produces zero PRs.
Wrapup starts no new work: anything nontrivial it uncovers becomes an
issue for a future session, never a task picked up now, and never a
closing-paragraph escalation ("one more thing..."). If it mattered, it
is in the sweep's output; if it is not there, it did not matter.

## Exit

Tell the human, in one short paragraph: what was recorded and where
(links), what was deliberately dropped, and whether a PR was opened.
Then stop.
