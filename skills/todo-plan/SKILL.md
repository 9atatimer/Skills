---
name: todo-plan
description: "The repo's plan and its task files -- reading, updating, or pruning them. TODO_PLAN.md at the root holds strategy (what is happening now, in what order, and why); every unit of work is its own file under tasks/, defect or feature alike. Covers the task schema, IDs, edges, closing, and lessons lifecycle. Skip for first-time authoring of a phased plan from a design doc (planning)."
---

# Skill: The Plan and Its Tasks

> **ONE PLAN, MANY TASKS -- READ THIS FIRST.** A repository has exactly
> **one** plan file, `TODO_PLAN.md`, at the **repo root**. It holds
> strategy: what is happening now, in what order, and why. It does **not**
> hold task bodies. Every unit of work is its own file under `tasks/`.
> Never create `TODO_PLAN.<feature>.md`, and never move a task body back
> into the plan.

The split exists because the two halves have different costs. Editing one
large file is expensive and error-prone -- retries, token burn, and silent
no-op replacements. Reading one small file is cheap. So the things that
change constantly are small files, and the one file that must be read on
every cold start stays short.

---

## What goes where

| | Lives in | Because |
|---|---|---|
| What to do next, in what order | `TODO_PLAN.md` | It is not derivable from any task. It is a standing decision that changes weekly, and no node can hold it. |
| A unit of work | `tasks/<id>-slug.md` | One writer, one small file, clean merges. |
| Its dependencies and its authority | that task's frontmatter | The task is the only thing that can be authoritative about itself. |
| A lesson | its layer -- the sdlc skill, law 15 | Only unsettled ones (`about: wip`) stay in the plan. |
| Completed work | `tasks/done/`, and git history | The plan is not a changelog. |

---

## The task file

```markdown
---
id: red-cock-hills
kind: task
title: one line, so an index can be built without reading the prose
created: YYYY-MM-DD
issue: 47
blocked_by: [alpha-gamma-alpha]
implements: docs/design/DESIGN.auth.md
---

The body.
```

Four fields are required -- `id`, `kind`, `title`, `created`. The other
three are edges, and each is present only when it exists.

**Filename:** `<id>-short-slug.md`, e.g. `red-cock-hills-ghost-meter.md`.
The ID is the join key, the slug is for humans reading `ls`, and the path
is free to change. Resolve by prefix glob: `tasks/**/<id>-*.md`.

### There is no `status:` field

Every state you would put in one is already derivable, and a second copy
would only disagree with the first:

- **done** -- the file is in `tasks/done/`.
- **blocked** -- `blocked_by` names a task that is not in `done/`.
- **open** -- neither of the above.

Do not add one back. A field that restates the filesystem is a field that
goes stale.

### `kind`

```yaml
kind: task | bug
```

**A kind earns a slot only if skill text that already exists branches on
it.** Not "could branch" -- does, today. A kind nothing acts on is a label
people argue about and no tool reads, which is worse than having none.

- `task` -- the default.
- `bug` -- law 14 governs its body, and law 5 demands a RED test before
  the fix. Two rules, both already written, both keyed on this value.

`spike` passes the test on the merits: its exit condition is genuinely
different -- it closes by producing a finding, and its code is deleted
rather than merged (the concept skill). Add it the first time you actually
track one. `chore`, `docs`, `research`, and `epic` do not pass; nothing
branches on them.

`refactor` is the near-miss worth naming, because it has a plausible rule
-- "no behavior change, so no new RED test." That is also the exact
sentence used to skip tests, so encoding it as a kind hands out the
exemption in writing. Leave it out.

### A bug's body is evidence; a task's body is intent

Law 14 applies to a local `kind: bug` exactly as it applies to a GitHub
Issue: **body = the defect (symptom, impact, evidence); the fix goes in a
comment or a later section, never the body.** A fix in the body reads as
spec and rots; the defect statement stays true. Title the defect, not the
patch, and re-derive the fix from the current design when you pick it up.

A task's body is the opposite -- it is intent, and it goes stale the
moment the design moves. Check it against `implements:` before you trust
it.

---

## Edges

Three, and each is declared on the **dependent** end -- the end that must
survive its target being closed or deleted, and the end an agent reads
before starting work.

| Field | Points at | Meaning |
|---|---|---|
| `blocked_by: [<id>, ...]` | task IDs | hard sequencing; do not start until they are in `done/` |
| `implements: <path>` | a design record, or a concept story | the authority this task serves |
| `issue: 47` | a GitHub Issue number | the remote mirror of this task, when one exists |

**Reference tasks by ID, never by path.** Closing a task moves it into
`tasks/done/`, which changes its path; an ID survives that, and so does a
retitle. Resolve with a glob: `tasks/**/<id>-*.md`.

**No reverse edges are stored.** They are one grep:

```
grep -rl '<id>' tasks/           # what does finishing this unblock
grep -rL 'issue:' tasks/*.md     # local tasks with no Issue cut yet
grep -rl 'kind: bug' tasks/      # what is broken
```

grep is the query engine for **point** queries, and they stay in grep.

**Transitive** queries -- what does finishing this ultimately unblock, is
there a cycle, what is the critical path -- are recursive and genuinely
awkward in grep. Those are what the task database is for.

### The database is derived

The database is an index over `tasks/`, built by the tooling, **gitignored
and rebuildable from the task files alone**. If it burns down you lose
nothing and you rebuild it.

That is a hard rule, not a preference: the moment anything writes metadata
to the database that is not in a task file, truth is split and the files
stop being canonical. Read from it freely. Never treat an answer it gives
as authoritative over the file.

Never commit it. An index in git is a large file rewritten on every commit,
which is the exact cost this layout exists to avoid.

### Local tasks and GitHub Issues

The local store works with no network and no GitHub, which is the point:
the SDLC must still run for an offline or purely local project. When a
repo does use Issues, `issue:` is the bridge, and the Issue is the outward
projection -- cut it per the github-workflow skill and record the number.
Local objects are **tasks**; remote ones are **Issues**. Keep the two
words distinct in everything you write.

---

## IDs

**An ID is an opaque string, minted by the naming tool. Never compose one
by hand, and never parse one.**

It may look like `red-cock-hills` or `alpha-gamma-alpha` or anything else
the tool emits. The scheme is the tool's business and may change; nothing
else in the fleet is allowed to depend on its shape.

Three rules follow, and they are the whole of it:

- **Never infer anything from an ID.** Not creation order, not kind, not
  the area of the code it touches. IDs do not sort, and two adjacent-looking
  names have no relationship. `created:` is the only ordering there is.
- **Never mint one yourself.** The tool checks the new name against every
  existing task -- including `tasks/done/` -- and retries on collision. A
  hand-written ID skips that check, and a duplicate ID is a silently
  corrupted graph.
- **An ID is permanent.** Retitling a task, reclassifying it, or closing it
  all leave the ID untouched. It is the only stable thing a task has.

**The kind never appears in the ID**, for the same reason nothing else
does: reclassifying a task as a bug must stay a one-word edit, not a rename
that breaks every `blocked_by` pointing at it.

Opaque names are why two branches need no coordination to create tasks.
There is no counter to keep in sync and nothing to renumber at merge time;
the namespace is large enough that independent mints do not collide.

### Verify inbound references, always

`T-003` mistyped will not resolve and is obviously wrong. `red-cock-hills`
mistyped as `red-cock-hill` -- or invented outright -- looks entirely
legitimate, because word-triples are exactly the shape a language model
confabulates fluently.

So **every `blocked_by` you write must be checked against a task that
actually exists**, by glob or by asking the tool, at the moment you write
it. Do not rely on it looking right. The linter's dangling-reference check
is not hygiene here; it is the only thing standing between a plausible
typo and a broken graph, and it belongs in CI rather than on request.

---

## `TODO_PLAN.md`

Short. It is read on every cold start, so every line in it is charged to
every future session.

```markdown
# {Project Name} -- TODO Plan

> **Status:** Active | Complete
> **Updated:** YYYY-MM-DD
> **Design:** link to the design doc, if applicable

## How to Use This File

Rules for agents in this repo: branch workflow, commit conventions, the
test command. A short table of key reference documents.

## Where Things Stand

Orientation for a cold-start agent, in prose: what exists, what works,
what the shape of the thing is. Narrative, not a log -- git history and
`tasks/done/` hold the record of what happened.

## Now

Three to seven task IDs, ordered, with one line each on why this order.
This is the only list in this file, and it is the only thing here that no
task could hold.

## Blockers

What is blocking progress that is not itself a task -- an external
dependency, a decision waiting on a human. With a date and the unblock
action.

## Lessons Learned

Unsettled lessons only (`about: wip`). See below.
```

**No task list, no checklists, no phase breakdowns.** Those are `tasks/`.
An index of every task here is the thin-index anti-pattern with extra
steps: it duplicates the filenames, it is hand-maintained, and it is
wrong within a week. `ls tasks/` is free and always correct.

**Keep "Now" honest.** If it has fifteen entries it is not a decision, it
is the backlog again. Cut it back to what you would actually do next.

---

## Working the tasks

### Adding

- One task per unit of work that ends in a commit. If it needs a phase
  breakdown, it is several tasks with `blocked_by` between them.
- Give it `implements:` if a design record or story authorizes it. A task
  with no authority and no defect behind it is worth questioning.
- Discovered work gets its own file immediately, not a note at the bottom
  of the task you are on.

### Closing

Move the file into `tasks/done/`. Do not edit it to say "done" -- the
directory is the state.

**`tasks/done/` holds the current cycle only.** At each retrospective,
delete every entry whose work has shipped and whose lessons have
graduated. It exists so an in-flight cycle can see what it already
finished, not as an archive; git history is the archive. Left unpruned it
becomes the landfill this layout was built to end.

### Deleting

A task that turns out to be unnecessary is **deleted**, not struck
through and not annotated as superseded. There is no `supersedes:` field
for the same reason: git history holds the past, and a tombstone is a file
every future `ls` has to read past.

---

## Lessons Learned

`TODO_PLAN.md`'s Lessons Learned holds **unsettled lessons on the work in
progress** -- and only those. It is an inbox, not an archive. Settled
lessons graduate to the layer whose readers need them (the sdlc skill,
law 15). Every layer costs its readers a read; keeping a settled lesson
here charges it to every future session on this plan.

Record a lesson when an assumption was wrong, a tool did not behave as
documented, a non-obvious root cause cost real time, an approach was tried
and rejected, or something worked unexpectedly well.

**Format:**

```markdown
### {N}. {Short title}

about: {layer}

{What happened and what to do differently. 2-4 sentences max.}
```

A good lesson saves someone 30+ minutes in a future conversation.

**`about:` names the layer the lesson is for.** It is law 15's routing
decision, recorded at the moment you write the lesson instead of
rediscovered at triage months later -- when whoever is triaging no longer
has the context that made the routing obvious.

| `about:` | The lesson's layer |
|---|---|
| `wip` | none yet -- unsettled, belongs in this file |
| a repo path, e.g. `goldfish/shell.py` | a code comment in that file |
| `component:<name>` | `docs/arch/<name>` -- only once it ships (the folder law) |
| `repo` | the repo's `AGENT.md` |
| `skill:<name>` | that shared skill |
| `global` | the global agent instructions |

**Only `wip` belongs in this file.** Everything else is a lesson that has
already settled and is naming its own destination, so write it there
directly and never record it here first.

Two things the field is good for beyond routing:

- **A lesson you cannot label is one you have not finished diagnosing.**
  If you cannot say which layer's readers need this, you are still
  describing a symptom. Say so plainly rather than filing `wip` as a
  parking space.
- **The same `about:` recurring across lessons is the signal to change
  the layer itself.** Three lessons pointing at one skill means the
  doctrine is wrong, not that agents keep being careless.

**A task is never a lesson's home**, and neither is an issue. Both are
transitory -- they vanish when the work is done, taking anything parked in
them along.

**Do not record:** obvious things, anything already in a style guide or
the repo's agent instruction file, implementation details that belong in
code comments, or settled lessons.

**Graduation (mandatory triage).** At every retrospective, and at any
wrapup whose sweep touches this file, walk the whole list; each entry gets
exactly one of:

- **Promote**: `about:` is anything other than `wip` -- move the lesson to
  that layer and delete it here. The field already decided; triage only
  executes it.
- **Keep**: still `wip`, still tied to the work in progress.
- **Delete**: superseded, or its root cause is fixed. Delete outright --
  never annotate an entry as "Historical"; git history holds the past.

---

## Hygiene

- Prune at the start of any major work session: stale entries in `Now`,
  tasks whose authority has moved, `done/` from a shipped cycle.
- `PLAN.md` is not this file. Several repos gitignore it to catch
  agent-dropped plan files; leave that ignore in place.
