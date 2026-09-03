# Scope: the LLM-friendly repo layout

> **NOT a design record, and not approved.** This is scoping output -- a
> survey of what a layout change would touch, recorded so the work does not
> have to be re-derived. It settles nothing. Phase 2 writes the design
> record; this is the input to that conversation.
>
> **Date:** 2026-09-02  **Surveyed by:** an agent session, at Todd's request
> **Status:** blocked on one decision (see Blocking decision)

## What is proposed

Replace the current singleton-plan layout with one where every item is its
own file:

```
PLAN.md              living short-term strategy; references the files below
bugs/                one Markdown file per defect
todos/               one Markdown file per task
todos/done/          completed tasks
lessons/             one Markdown file per lesson learned
docs/ops/            runbooks and operational procedure
docs/concept/        phase 1 -- intent, unfunded, disposable
docs/design/         phase 2 -- aspirational, frozen at APPROVED
docs/asbuilt/        phase 7a -- factual, living, never frozen
```

The motivation is context economy. A cold-start agent currently has to load
a whole plan file to find one item; quillmap's is 226KB. Individual files
let an agent grep, read one, and stop.

## Blocking decision

**Are `bugs/` and `todos/` the canonical store, a local cache of GitHub
Issues, or only for pre-issue items?**

Nothing else can be built until this is answered. It determines the splitter
output, the rewrite of `todo-plan` and `retrospective`, and whether two live
gadmin scripts get retargeted or retired.

It collides with three things that currently point the other way:

- The global agent instructions: *cut a GitHub Issue before working on the
  fix*.
- `sdlc` law 14 (defects are Issues) and law 15 (*"Issues are NOT a lessons
  layer... route pending work there, never park a lesson"*).
- `gadmin`'s `admin/migrate-todo-plan.mjs` (238 lines) already mints one
  Issue per `- [ ]` row out of the plan's Open Tasks section, and
  `admin/issue-plan-sync.mjs` (149 lines) syncs the other direction.

One reading, offered as a starting point rather than a recommendation:
canonical-local with Issues as the outward projection is the more
LLM-friendly answer, because an agent greps `bugs/` for free while
`gh issue list` costs a round trip and auth. But that inverts
`issue-plan-sync` rather than merely repointing it.

## Naming, to settle in the same breath

- **`docs/asbuilt/` vs today's `docs/arch/`** -- worth doing. The
  `architecture` skill currently spends prose explaining that `docs/arch` is
  factual and not aspirational; the folder name would carry that for free.
  12 references, cheap.
- **`docs/concept/` vs today's `docs/concepts/`** -- plural is what is on
  disk in three repos. Pick one and enforce it mechanically.
- **`PLAN.md` vs `TODO_PLAN.md`** -- the rename is the small part. The real
  change is semantic: today's file does five jobs (orientation, active work,
  lessons, completed log, next steps); the new one does one.
- **`todos/done/` needs a retention rule up front**, or it becomes the
  landfill that "Completed Tasks" already is. Today's `todo-plan` skill
  explicitly says *"superseded plans are not kept as files -- git history
  holds the past"*, which `done/` contradicts unless scoped (current cycle
  only, pruned at retrospective).

## Skills affected

Source of truth is `skills/` in this repo. **HEAD of `main` IS the fleet
rollout** -- no tag, no pin -- so a merge makes every repo on the machine
non-conforming at once. That ordering constraint drives the sequencing
below.

13 of 24 skills carry layout references (verified 2026-09-02):

| Skill | lines | plan | design | arch | concept | work |
|---|---|---|---|---|---|---|
| `planning` | 873 | 18 | 1 | 1 | 0 | **rewrite -- heaviest** |
| `todo-plan` | 176 | 10 | 2 | 1 | 0 | **rewrite; its whole premise dies** |
| `design` | 429 | 5 | 11 | 9 | 1 | moderate |
| `sdlc` | 233 | 4 | 4 | 7 | 3 | moderate, highest leverage |
| `wrapup` | 86 | 7 | 0 | 2 | 0 | lessons routing |
| `retrospective` | 166 | 6 | 0 | 4 | 0 | lessons routing |
| `architecture` | 271 | 0 | 4 | 12 | 0 | mostly the arch -> asbuilt rename |
| `concept` | 228 | 0 | 1 | 1 | 4 | singular/plural |
| `github-workflow` | 387 | 2 | 1 | 0 | 0 | light |
| `coding` | 277 | 0 | 2 | 1 | 0 | light |
| `gates` | 674 | 1 | 1 | 0 | 0 | light |
| `designomatic` | 109 | 0 | 4 | 0 | 0 | light |
| `release` | 256 | 0 | 1 | 2 | 0 | light |

Plus `skills/README.md` (1 plan, 2 design).

Specific load-bearing text:

- `todo-plan/SKILL.md:8` -- the **SINGLETON** law: *"A repository has exactly
  one TODO_PLAN.md, and it lives at the repo root. Never create
  TODO_PLAN.<feature>.md, never place a plan file under docs/, never split
  the plan across files."* This is the sentence the whole change contradicts.
- `sdlc/SKILL.md` law 9 (plan lives in TODO_PLAN.md), law 15 (the lessons
  layer table, whose first row is `TODO_PLAN.md` Lessons Learned), the
  eight-phase diagram, and the phase/artifact table.
- `planning/SKILL.md:3` and `:134` -- "the repo's single root TODO_PLAN.md,
  never a separate file."

**Nothing anywhere mentions `docs/ops/`.** It exists de facto in
template-base and template-tools only; tds-utils uses `docs/runbooks/`,
tds-internal keeps loose `runbook.*.md` at the `docs/` root. It needs a
skill owner -- `release` is the natural one.

A `bugs` skill may be warranted (defect file anatomy plus the Issue
relationship), or it folds into `gates`/`github-workflow`.

## Tooling coupling

**goldfish** (`tds-utils/goldfish/`) reads the plan and will go blind:

- `core.py:92` -- first unchecked task from a TODO_PLAN.md
- `core.py:577` -- open-task count in the report
- `shell.py:331` -- reads `workdir / "TODO_PLAN.md"`
- `shell.py:425-432` -- LLM summarization of a plan file
- `shell.py:529-534` -- fetches `contents/TODO_PLAN.md` over `gh api` for
  repo-zoom
- smoketests: `test/smoketest_goldfish/{03_todo_plan_next_task,07_repo_zoom,config}.sh`

Real work, not a sed.

**gadmin** (`template-tools/packages/naatm-admin/admin/`):

- `migrate-todo-plan.mjs` (238 ln) and `issue-plan-sync.mjs` (149 ln) --
  retarget or retire per the blocking decision
- smoketests `06_sync_plan_preserves_scratchpad.sh`,
  `07_migrator_parses_todo_plan.sh`

**ast-mcp**: `packages/ast-mcp/tests/domain/outlineView.test.ts` -- fixture
only, trivial.

## Tooling to build

1. **Frontmatter schema, first.** Individual files need YAML that lets tools
   index without an LLM. Design it before the splitter, not after. A straw
   man is running in `9atatimer/bardar` (see Pilot).
2. **Splitter.** Feasible -- the structure is regular. H2 sections are
   near-canonical, items are `### TITLE (issue #N, date)` with checkbox
   bodies, and every lesson is one top-level bullet with a bolded title that
   yields a clean slug. Needs a section-alias table because headings drift:
   `Open Tasks` / `Pending Work`, `Completed Tasks` / `Resolved Issues`,
   `What We've Accomplished`, `Active Work: <name>`, `Lessons Learned`,
   `Blockers`, `Open Decisions`, `Suggested Next Steps`. Nested `AMENDMENT`
   bullets must stay with their parent.
3. **Linter** (`tds-layout-check`, or a ci.magic assertion). Without it
   thirty repos drift immediately.

## Repos to rework

No repo has a `BUGS.md` -- defects are already Issues everywhere. No repo
has `lessons/`.

**Tier 1 -- convert first (active, large plans, or they host the tooling):**

| Repo | plan | note |
|---|---|---|
| `naatm/template-base` | 36KB | **convert first** -- new repos are born from it |
| `tds-utils` | 98KB | hosts goldfish |
| `naatm/template-tools` | 94KB | hosts gadmin, ast-mcp, clai |
| `twobitsw/quillmap` | 226KB | the worst case; the reason to do this |
| `tds-internal` | 11KB | |
| `9atatimer/Skills` | none | the skills themselves |

**Tier 2 -- active, moderate:** `naatm/GammaGo` 66KB,
`goodplates/grubsta.2` 40KB, `9atatimer/airframe` 35KB,
`naatm/ai-gm` 27KB, `naatm/flashcard` 25KB, `naatm/airtofwair` 24KB,
`twobitsw/freetraderlue` 17KB, `9atatimer/bitbot` 12KB, `9atatimer/g1n1`
12KB, `naatm/cr-magic` 4KB.

**Tier 3 -- dormant, convert lazily on next touch:**
`9atatimer/roll20-dm` 39KB, `interviews/resume` 29KB, `job-hunt` 20KB,
`OSS/story-writing` 13KB, `9atatimer/openclaw` 7KB, `Domains` 4KB,
`9atatimer/freetraderlue` 3KB, `ghl-backup` 0KB.

**Excluded -- duplicate checkouts, convert the canonical one only:**
`tds-utils.{golden,surgery,surgery2,backup.2026.8.8}`, `smoketest-work/*`,
`.worktrees/*`, `9atatimer/template-tools` (dupe of `naatm/`),
`lab54/grubsta` and `amp-cli/grubsta` (dupes of `goodplates/grubsta.2`),
`OSS/opencode` (dupe of `9atatimer/opencode`).

**Excluded -- forks of OSS:** everything under `google/`, `meta/`,
`llamalabs/`, plus `misc/pgtap`, `naatm/Chatterbox-TTS-Server`,
`OSS/alltalk_tts`, `OSS/github-mcp-server`, `9atatimer/eltainer`,
`9atatimer/eldocker.retired`, `9atatimer/VibeVoice.2`.

**Needs a manual fork check:** several `9atatimer/*` repos are OSS forks
with **no `upstream` remote configured**, so detection cannot be scripted --
`copilot.el`, `OSS/dia`, `9atatimer/opencode`, `9atatimer/VibeVoice`,
`OSS/mcp-servers`, `OSS/vaarn.github.io`.

## Sequencing

The skills merge is the point of no return, because HEAD is the rollout. It
should land after the tooling exists, not before.

1. Answer the blocking decision.
2. Freeze the layout as a design record (this document is its input).
3. Design the frontmatter schema.
4. Build the splitter and the linter, test-first.
5. Rewrite the skills.
6. Convert `naatm/template-base`, so new repos are born correct.
7. Convert `tds-utils` and `naatm/template-tools` -- they host goldfish and
   gadmin, so the tooling updates land with the conversion.
8. Update goldfish and gadmin.
9. Tier 2 in batches. Tier 3 on touch.

## Pilot

`9atatimer/bardar` (private) was created 2026-09-02 using this layout from
scratch, and is a working reference for the converted shape. Its `AGENT.md`
records the three deltas from the skills as written, and a **provisional**
frontmatter schema under `todos/` -- explicitly a straw man for this work to
react to, not a standard to inherit. It is a concept-phase repo with no
code, so it exercises the docs half of the layout only.
