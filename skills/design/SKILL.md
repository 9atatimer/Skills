---
name: design
description: "Phase 2 of the SDLC: writing, reviewing, or improving a design doc; use before starting any feature that lacks one. Covers the required sections incl. Behaviors (the Given/When/Then surface) and Rejections, what a design record may not hold (seams, signatures, vendors, numbers -- the architecture and as-built records own those), the freeze once merged, and where lifecycle lives (git and GitHub, never the document). Product only: skip for developer tooling (self-contained dev QoL, invisible to the product), which gets a docs/ops/ runbook instead (sdlc, Product or tooling). Skip also when naming seams or updating the as-built (architecture), building the phased plan (planning), or implementing against an approved design (coding)."
---

# SKILL: Design Document Authoring & Review (Phase 2)

> **Exit gate:** the record is complete and a human merges it.
> Merged is the approval (Lifecycle is metadata). From then on its body
> is frozen; only the append-only Key Decisions log moves.
> The merge is what opens phase 3: the architecture record is written
> against this one, never alongside it.
> **References:** `docs/design/TEMPLATE.md`; a repo's `docs/design/STYLE-GUIDE.md`, where
> present, is a local copy for humans and yields to this skill where they differ

---

## The Design-Doc Rule (read first)

**No product implementation without an approved design doc.** Developer
tooling -- self-contained, dev-facing, invisible to the product -- gets no
design doc; it gets a runbook at `docs/ops/<tool>.md`. The classification
test is in the sdlc skill, "Product or tooling"; when in doubt, it is
product.

| You are designing... | Write | Where |
|---|---|---|
| A single tool / package / component | `DESIGN.<name>.md`, then `ARCHITECTURE.<name>.md` once it is approved | `docs/design/` |
| How two specific components connect | `INTEGRATION.md` | `docs/design/` |

* **Every product component gets its own `DESIGN.<name>.md`.** One
  component, one design doc.
* A design doc that spans multiple tools describes the boundaries and
  contracts between them and links out to each `DESIGN.<name>.md`.
* The design doc answers **what** and **why**; `tasks/` and the root
  `TODO_PLAN.md` (via the planning skill) answer **how** and **in what
  order**; the code (via the coding skill) is the result.

### What each record may hold

Three records, three kinds of fact, and each constrains the next step:

| Record | Holds | Does not hold |
|---|---|---|
| Design (`docs/design/`) | what the system can and cannot do: capabilities, constraints, scope in and out | numbers, labels, thresholds |
| Architecture (`docs/design/ARCHITECTURE.<name>.md`, phase 3) | how it intends to do that: the seams, the module map, the use-case signatures, the mechanism behind each capability, which seam carries each bound | capabilities the design did not grant; tuned values |
| As-built (`docs/arch/`) | what runs: the components, the seams as coded, and **every tuned value** | intentions |

A policy value, an appearance or a tuning is neither a design nor an
architecture decision: the design says the value exists, is bounded and is
a parameter; architecture says which seam carries it; the as-built records
what it is set to. Never write a number into a design record. Read
`references/phases-drift-behaviors.md`, "Why the record does not hold
numbers", before you put a number in a design record or argue to keep one.

### `docs/design/` is not `docs/arch/`

**The as-built lives in `docs/arch/` and is not a design doc.** The two
trees fail in opposite directions, which is why they are separate:

`docs/design/` is what we intend to build (body frozen once merged); `docs/arch/`
is what is deployed right now (living, never frozen). Read
`references/phases-drift-behaviors.md`, "The two trees", before you decide whether a fact goes in
`docs/design/` or `docs/arch/`.

Never place an as-built document in `docs/design/`, and never describe
unshipped intentions in `docs/arch/`. -> the as-built skill

**The freeze covers a record's body, and only design and architecture
records.** Key Decisions is still append-only (Lifecycle is metadata);
`STYLE-GUIDE.md` and `TEMPLATE.md` have no approval lifecycle and evolve
freely.

---

## What stays out of a design record

A design record is the capability contract. It holds what the system can
and cannot do, for whom, within what bounds, and what is out of scope. It
does not hold how:

| Belongs to | Not here |
|---|---|
| the architecture record (the architecture skill) | a seam, a port, a policy object, a module, a layer, a use-case signature, a store, a wire format, a vendor, an SDK, a release class, a failure mode and how it is debugged |
| the as-built (the as-built skill) | a number, a threshold, a window, a limit, a label, a version floor, a "who is shown first" |

The test for a sentence: if a different mechanism could satisfy it
unchanged, it is design. "A blocked person is absent by every path" is
design; "the exposure gate filters after scoring" is architecture; "the
anonymity bound is six" is the as-built.

A design says nothing about mechanism; about bounds it says that each
exists and what constrains it. Architecture places each bound in a seam;
the as-built records the value. Read `references/phases-drift-behaviors.md`,
"What the design says about bounds", before you write a bound into a
design record.

---

## Behaviors (the BDD surface)

Goals say what success looks like. They do not say what a person does and
then observes. **This section is required**: one row per behavior, as the
Given/When/Then that phase 4 will keep as a test, and it is the section
phases 3, 4 and 5 all read. The architecture record gives each row its
use-case signature and ports; this record gives each row its meaning.

The rules the table must satisfy: every noun is in the Domain Language;
a behavior is observable from outside; error paths are rows; the Given/When/Then
is the test that will be kept; rules are not rows; **no signature, no port,
no store** (those are the architecture record's use-case surface). Read
`references/phases-drift-behaviors.md`, "Behaviors rules and example",
before you write or review the Behaviors table.

A design record without this table describes a system nobody can observe.
It is not complete, and it must not be approved.

---

## When to Invoke This Skill

When asked to write, draft, review or improve a design doc, when a feature
lacks one, or when asked how to design X.

---

## Authoring a New Design Doc

### Gather Context

Before writing, understand the problem, the audience, what exists
(`docs/design/`, `docs/concepts/<idea>/`) and the constraints. Read
`references/authoring.md`, "Gather Context", for the questions.

#### If a concept exists, phase 2 converts it

A concept's statement of work and user stories become the record's
Overview, Goals, Key Decisions and Open Questions. Much of the conversion
is a conversation with the human: they decide which aspirations become
Goals and confirm or drop every assumption first.

Read `references/authoring.md`, "If a concept exists, phase 2 converts it", when a concept exists for the design you are writing.

### Start from the Template

Copy `docs/design/TEMPLATE.md` to `DESIGN.<name>.md` (a feature or
component) or `INTEGRATION.md` (how components connect). As-built system
documentation is not a design doc; it belongs in `docs/arch/`.

### Fill Sections in Order

Write every section in the template's order, header block through
Rejections; skip none.

Read `references/authoring.md`, "Fill Sections in Order", for the order and what each section holds, before you write the first.

### Apply the Style Guide

This skill is the standard; a repo's `STYLE-GUIDE.md` is a copy for
human readers. Plain, short, specific prose: one sentence, one job.

Read `references/authoring.md`, "Apply the Style Guide", for the prose and table rules, before you draft.

## Reviewing an Existing Design Doc

**Run the panel before you ask a human.** `designomatic run <draft> --panel
design-review` puts several distinct lenses over the document against the
SDLC skills (this one and architecture) -> the designomatic skill. It
matters most for a document *you* drafted. The checklist stays yours to
apply; the panel is a first pass, and the merge is the approval.

**Run one worked example through it before it freezes** when the record
specifies a protocol, a workflow or a state machine; read
`references/phases-drift-behaviors.md`, "A worked example before the
freeze", for why.

### Quality Checklist

Check structure, content quality and the boundary with the
architecture and as-built records before you report.

Read `references/authoring.md`, "Quality Checklist", for the checklist, when you review a record.

### Review Output Format

Report a review as blocking issues, suggestions, questions and
strengths.

Read `references/authoring.md`, "Review Output Format", for the template, when you write the review.

## Improving a Design Doc

Read the full doc first, check it against the template, apply this skill's
style rules, preserve the author's intent, and add rather than remove.
Read `references/authoring.md`, "Improving a Design Doc", before you
start.

### Common Improvements

Common gaps: missing non-goals, vague goals, no state machine,
prose-heavy design, implicit decisions, no open questions, no
rejections.

Read `references/authoring.md`, "Common Improvements", for each gap's fix.

## Connecting Design Docs to Implementation

A design doc's value is realized when it drives implementation. Once the
record is merged: write `ARCHITECTURE.<name>.md` beside it (phase 3, the
architecture skill); break the design into test-first phases under `tasks/`
(phase 3b, the planning skill); implement RED -> GREEN -> COMMIT against
both records, each RED test asserting a Behaviors row's Then (phases 4-5).
**Both records are frozen once merged** -- see Drift below. In the
retrospective (phase 8, the retrospective skill) file every divergence; do
**not** silently "update the doc to match". Read
`references/phases-drift-behaviors.md`, "Connecting Design Docs to
Implementation", for each phase's hand-off and the document chain.

---

## Drift: the doc does not get warped

**An approved design doc is frozen for the implementer.** It is the contract the
implementation is checked against. The moment you edit it to describe what you
actually built, you destroy the only artifact that can show you drifted -- and
you launder an unreviewed decision into apparent spec.

### The rule

> **During POC / MVP / any implementation: drift gets cut as issues. The design
> doc does not get edited by the implementer.**

When the code and the doc disagree, that disagreement **is the deliverable of
the retrospective**. File it. A human decides whether to amend the design or
change the code, through the design process.

### What counts as drift

Anything the doc specifies that the code does not do, and anything the code
does that the doc does not specify; the drift walk is the retrospective
skill (phase 8). The doc must say something specific enough to diverge
*from*, and it stays frozen so the divergence is visible. Recording what
the code does that the doc never specified is the as-built's job; an issue
accuses. Read `references/phases-drift-behaviors.md`, "Drift detail", when
you must explain why the freeze exists or what to file.

### One legitimate exception

The doc's **Key Decisions** table is an append-only decision log, not spec.
A design has a handful of key decisions in its lifetime: each one changes
what the design can or cannot do, and the owner made or ratified it.

- **An implementation choice is not a key decision.** A choice made while
  building, where the design was silent, goes in its drift issue and is
  pinned by a test. It never becomes a row; a record that logs every
  choice buries the few that matter.
- **A row records the owner's ruling.** When the owner rules on an issue in
  a way that changes what the design can do, append that ruling, citing
  the issue.
- **Append only.** Never rewrite or delete an existing row. A decision that was
  reversed gets a new row saying so, with the reason.
- **The architecture record's Key Decisions follow the same rule.** A
  mechanism chosen while building goes in its issue, not in that table.
- **In its own commit, on the session's one PR** (the github-workflow skill,
  One open PR per repo per session). A doc change folded into a code commit
  does not get read.

Every other section -- Overview, Goals, Non-Goals, Design, Behaviors,
State Machine, Domain Language, Parameters, Security, Open Questions -- is
frozen until a human amends it. The architecture record freezes the same
way once it is merged.

**A scope change is an amendment to the body, not a row.** Pulling a
Future Considerations item into scope with a Scope row alone leaves the
body describing the old behavior: one merged record then carries two
policies, and some other file becomes the spec of record (tds-utils Issue#410,
Issue#424). Amend every section the item touches, before the freeze or by
human amendment after it.

---

## When implementation lands

Implementation is not done when the tests pass. The closing checklist --
cut drift issues, append any Key Decision the owner ruled, record lessons,
file what you discovered, update `TODO_PLAN.md` -- is
**the retrospective skill (phase 8)**, run on the session's PR while it is
open, else in one follow-up PR.

---

## Lifecycle is metadata

**A record never carries its own status (owner ruling, 2026-11-01).** No
status line, status field or badge, no "(status: ...)" note on a link,
no "Current Status" section. Each state lives where git and GitHub keep
it:

- **In progress:** the record is on an open PR's branch. Run the
  reviewer panel before the PR (-> the designomatic skill)
- **Approved and frozen:** the record is on the default branch. The
  merge is the approval and the freeze, when a human lands it: a human
  merges the PR or posts its `/land`. An agent never merges or lands its
  own design or architecture record (the github-workflow skill)
- **Implemented:** shipped, and its retrospective landed (the retrospective
  skill); it does not land, and does not close the tracking issue, while
  drift cut from it is open
- **Superseded:** the PR that lands the replacing record deletes the old
  one; the replacement cites it in Related Documents by path and the
  commit that removed it

**The design PR opens or names the tracking issue.** Implementation PRs
cite it with `Refs #N`, never `Closes`; only the PR that carries the
retrospective closes it.

**The open tracking issue carries the merged-but-unshipped gap**, so the
as-built stays strictly factual with no "pending" marker; it stays open
until the retrospective lands. Read `references/phases-drift-behaviors.md`,
"The tracking issue and the merged-but-unshipped gap", for why.

**Lifecycle is never a question.** An agent never writes, sets or
reports a status, and never asks a human to approve one or reminds them
of one, in chat, in a PR or anywhere else: the merge is the approval.

**Merged is a freeze.** From the merge onward the body changes only by
human amendment through the design process -- never as a side effect of
implementing it; Key Decisions stays append-only, as the drift section above says.
**The merge also opens phase 3:** an unmerged design has no architecture
record yet.
