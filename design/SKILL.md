---
name: design
description: "Phase 2 of the SDLC: writing, reviewing, or improving a design doc; use before starting any feature that lacks one. Covers the required sections incl. Rejections, the freeze at APPROVED, and the status ladder. Skip when naming seams or updating the as-built (architecture), building the phased plan (planning), or implementing against an approved design (coding)."
---

# SKILL: Design Document Authoring & Review (Phase 2)

> **Purpose:** Author, review, and improve design documents that are useful to both AI agents and human engineers.
> **When to use:** Before implementing a new system, major feature, or architectural change.
> **Exit gate:** the record is complete -- *including its seams, which are
> phase 3* -- and a human marks it APPROVED. From then on its body is frozen;
> only the status and the append-only Key Decisions log move.
> **References:** `docs/design/TEMPLATE.md`, `docs/design/STYLE-GUIDE.md`

---

## The Design-Doc Rule (read first)

**No implementation without an approved design doc.**

| You are designing... | Write | Where |
|---|---|---|
| A single tool / package / component | `DESIGN.<name>.md` | `docs/design/` |
| How two specific components connect | `INTEGRATION.md` | `docs/design/` |

* **Every tool gets its own `DESIGN.<name>.md`.** One tool, one design doc.
* A design doc that spans multiple tools describes the boundaries and
  contracts between them, and links out to each `DESIGN.<name>.md` rather
  than duplicating them.
* The design doc answers **what** and **why**; the root `TODO_PLAN.md` (via
  the planning skill) answers **how** and **in what order**; the code
  (via the coding skill) is the result.

### `docs/design/` is not `docs/arch/`

**The as-built lives in `docs/arch/` and is not a design doc.** The two
trees fail in opposite directions, which is why they are separate:

| | `docs/design/` | `docs/arch/` |
|---|---|---|
| Describes | what we intend to build | what is deployed right now |
| Lifecycle | **body frozen at APPROVED** | **living, never frozen** |
| Wrong when | rewritten to match the code | contains anything not yet shipped |

Never place an as-built document in `docs/design/`, and never describe
unshipped intentions in `docs/arch/`. -> the architecture skill

**The freeze covers a design record's body, and only design records.** The
status still advances (APPROVED -> IMPLEMENTED -> SUPERSEDED) and Key
Decisions is still append-only -- see Status Transitions. And
`STYLE-GUIDE.md` / `TEMPLATE.md`, which live in `docs/design/` as reusable
process guidance rather than descriptions of an intended system, have no
approval lifecycle and evolve freely.

---

## Name the Axes of Change (the seams)

A design doc's most useful architectural work is to separate what is **stable**
(the meaning -- decisions and rules in the problem's language) from what is
**volatile** (the mechanisms -- vendors, wire formats, storage, model ids), and
to name each volatile axis as one explicit seam.

**That work is phase 3 and its authority is the architecture skill** -- but
its output lands *here*, in this doc's Architecture Overview, Design, Key
Decisions, and Rejections sections, and it lands **before approval.** A
design doc with no named seams is not finished and must not be approved; the
freeze would make the seams unwritable. A seam first discovered while coding
was never reviewed, and is drift.

The short form, so a doc can be judged without loading phase 3:

- **List what is likely to change** (the Change test). Each axis maps to exactly
  one seam -- a port, a policy, or a parameter -- not a hardcoded value.
- **Keep vendor/mechanism names out of the core.** A model id, an SDK, or an env
  var belongs at an edge; say so explicitly.
- **State each decision once, in the problem's language** (a named policy), not
  as scattered conditionals.
- **Do not over-seam (YAGNI).** Introduce a port only where there are, or
  plausibly will be, two implementations, or it crosses a vendor/process
  boundary. A single-implementation-forever port is ceremony; call that out in
  Rejections if it was considered.

A good Key Decisions table row often *is* an axis of change plus the seam chosen
for it (e.g. "LLM vendor -> CompletionPort, model id supplied at the edge").

---

## When to Invoke This Skill

- User asks to write, draft, or create a design doc
- User asks to review or improve an existing design doc
- User is about to start a feature that lacks a design doc
- User asks "how should we design X?"

---

## Authoring a New Design Doc

### 1. Gather Context

Before writing, understand:

- **What problem are we solving?** (not what we're building)
- **Who is the audience?** (AI agents implementing it + human reviewers)
- **What already exists?** Check `docs/design/` for related docs
- **What are the constraints?** (tech stack, timeline, dependencies)

### 2. Start from the Template

Copy `docs/design/TEMPLATE.md` to a new file following naming conventions:

| Pattern | Use For |
|---------|---------|
| `DESIGN.<name>.md` | Feature or component design |
| `INTEGRATION.md` | How components connect |

(As-built system documentation is not a design doc -- it belongs in
`docs/arch/`. See the architecture skill.)

### 3. Fill Sections in Order

**Do not skip sections.** Write them in this order:

1. **Header block** -- Status starts as DRAFT, fill date and authors
2. **Overview** -- 2-3 sentences max. If you can't explain it briefly, you don't understand it yet
3. **Goals** -- Testable success criteria. Each goal should be verifiable
4. **Non-Goals** -- Explicit scope boundaries. Think: "what will someone ask for that we should say no to?"
5. **Architecture Overview** -- ASCII diagram of major components and data flow
6. **Design** -- The meat. Break into subsystems, each with responsibilities and interfaces
7. **State Machine** -- If the system has lifecycle states (most do), document transitions
8. **Data Model** -- Tables, fields, relationships, constraints
9. **Security Considerations** -- Auth, secrets, attack vectors, mitigations
10. **Key Decisions** -- Table of choices with rationale. This is the most valuable section for future readers
11. **Open Questions** -- Be honest about unknowns. This builds trust
12. **Rejections** -- Alternatives considered and explicitly dismissed, each with a one-line reason. Prevents future maintainers from relitigating settled decisions. Distinct from Non-Goals (which is scope) and Key Decisions (which is what was chosen) -- this captures what was *not* chosen and why
13. **Future Considerations** -- Explicitly deferred work
14. **Related Documents** -- Links to other design docs

### 4. Apply the Style Guide

Follow `docs/design/STYLE-GUIDE.md` rigorously:

- **Be explicit** -- No "handle errors gracefully"; specify retry counts, timeouts, fallback behavior
- **Be testable** -- No "fast response times"; specify P95 latency targets
- **Be unambiguous** -- No "the system"; name the specific component
- **Prefer tables over prose** -- State machines, decisions, responsibilities all belong in tables
- **Use ASCII diagrams** -- They work everywhere, including in AI agent prompts

---

## Reviewing an Existing Design Doc

**Run the panel before you ask a human.** `designomatic run <draft> --panel
design-review` puts several distinct lenses over the document against this
repo's own `STYLE-GUIDE.md` -- the same standard the checklist below states.
This matters most for a document *you* drafted: reviewing your own draft
re-reads your intent rather than the text, and a panel is the cheapest
correction for that. -> the designomatic skill

The checklist stays yours to apply. The panel is a first pass, not an
approval, and only a human marks a record APPROVED.

### Quality Checklist

Run through these checks:

**Structure:**

- [ ] Has all required sections (header, overview, goals, non-goals, design, key decisions, open questions, rejections)
- [ ] Header has status, date, authors
- [ ] Status uses standard vocabulary (DRAFT / REVIEW / APPROVED / IMPLEMENTED / SUPERSEDED)

**Content quality:**

- [ ] Overview is 2-3 sentences, explains the "why"
- [ ] Goals are testable and measurable
- [ ] Non-goals explicitly exclude likely scope creep
- [ ] Architecture has a diagram (ASCII preferred)
- [ ] State machines have both diagram AND transition table
- [ ] Key decisions have rationale (not just the choice)
- [ ] Open questions are honest about unknowns
- [ ] Rejections section captures alternatives that were considered and dismissed, each with a one-line reason

**Style:**

- [ ] No vague language ("gracefully", "efficiently", "properly")
- [ ] No walls of text -- uses tables, lists, diagrams
- [ ] ASCII-only in diagrams and prose (no smart quotes, no Unicode arrows)
- [ ] Consistent heading levels (no skipping H2 -> H4)
- [ ] Blank lines after headings and before lists

**Completeness:**

- [ ] Could an AI agent implement this without asking clarifying questions?
- [ ] Could a new team member understand the "why" behind each decision?
- [ ] Are error cases and edge cases documented?
- [ ] Are the axes of change named, each mapped to one seam, with vendor/mechanism names kept out of the core? (no single-impl-forever ports)

### Review Output Format

When reviewing, organize feedback as:

```
## Design Doc Review: [Title]

### Blocking Issues

- [Issues that must be fixed before implementation]

### Suggestions

- [Improvements that would strengthen the doc]

### Questions

- [Clarifications needed from the author]

### Strengths

- [What the doc does well -- reinforce good patterns]
```

---

## Improving a Design Doc

When asked to improve an existing doc:

1. **Read the full doc first** -- Understand the intent before suggesting changes
2. **Check against the template** -- Identify missing sections
3. **Apply the style guide** -- Fix vague language, add tables, improve diagrams
4. **Preserve the author's intent** -- Improve clarity without changing decisions
5. **Add, don't remove** -- Missing sections should be added; existing content should be refined

### Common Improvements

| Problem | Fix |
|---------|-----|
| Missing non-goals | Ask: "what will users request that's out of scope?" |
| Vague goals | Add numbers: latency targets, error rates, coverage |
| No state machine | Look for lifecycle states in the design section and extract them |
| Prose-heavy design | Convert responsibilities and transitions to tables |
| Missing key decisions | Look for implicit choices and make them explicit with rationale |
| No open questions | Every design has unknowns -- be honest about them |
| No rejections section | Look at the conversation/PR history for alternatives that were debated and dropped; surface them with one-line reasons so they don't get relitigated |

---

## Connecting Design Docs to Implementation

A design doc's value is realized when it drives implementation:

1. **Architecture (phase 3):** name the seams the change adds, against the
   as-built in `docs/arch/`. The output lands in this doc. -> the
   architecture skill
2. **Planning (phase 3b):** break the design into test-first phases,
   recorded in the repo's single root `TODO_PLAN.md`. -> the planning skill
3. **Behaviors and Code (phases 4-5):** implement RED -> GREEN -> COMMIT
   against the design doc. **The doc is frozen from APPROVED onward** --
   see Drift below
4. **Retrospective (phase 8):** walk the doc against the code and file
   every divergence. Do **not** silently "update the doc to match". -> the
   retrospective skill

### Where this doc sits

```
docs/design/DESIGN.feature.md    (what to build and why -- FROZEN at APPROVED)
         |
         v
docs/arch/                       (what already exists -- read, not written, at phase 3)
         |
         v
TODO_PLAN.md                     (how to build it -- the repo-root singleton)
         |
         v
Implementation                    (the code)
         |
         v
docs/arch/                       (updated at 7a with what actually shipped)
```

The design doc answers **what** and **why**. The as-built answers **what is
actually there**. The TODO_PLAN answers **how** and **in what order**.

---

## Drift: the doc does not get warped

**An approved design doc is frozen for the implementer.** It is the contract the
implementation is checked against. The moment you edit it to describe what you
actually built, you destroy the only artifact that can show you drifted -- and
you launder an unreviewed decision into apparent spec.

This is a real failure mode, not a hypothetical. It happened here: an
implementation swarm rewrote the flag tables, deleted the data-model fields it
had chosen not to build, and converted the Open Questions into RESOLVED
entries -- inside a `+4574` feature PR where 87 lines of doc churn were
invisible. The rewritten doc no longer stated the security rule the code was
violating. It shipped.

### The rule

> **During POC / MVP / any implementation: drift gets cut as issues. The design
> doc does not get edited by the implementer.**

When the code and the doc disagree, that disagreement **is the deliverable of
the retrospective**. File it. A human decides whether to amend the design or
change the code, through the design process.

### What counts as drift

Anything the doc specifies that the code does not do, and anything the code
does that the doc does not specify. **The drift walk itself -- the kinds,
and what to file for each -- is the retrospective skill (phase 8).** Two
things must be true here, at design time, for that walk to be possible
later:

- The doc says something specific enough to diverge *from*. "Handle errors
  gracefully" cannot drift; "retry twice, then fail closed" can.
- The doc stays frozen, so the divergence is visible at all.

One split is worth knowing before you get there: for anything the code does
that the doc never specified, the as-built **records** it as fact (phase 7a)
*and* an issue **accuses** -- asks whether it should have been designed.
Recording is not approving, and this doc is not where either happens.

### One legitimate exception

The doc's **Key Decisions** table is an append-only decision log, not spec. New
decisions made during implementation belong there -- but:

- **Append only.** Never rewrite or delete an existing row. A decision that was
  reversed gets a new row saying so, with the reason.
- **Each row cites its authorizing issue.** If nothing authorized it, it is
  drift, not a decision -- file it first.
- **In a docs-only PR, never bundled into the feature PR.** Doc changes buried
  in a large code diff do not get read. That is exactly how the failure above
  shipped.

Every other section -- Overview, Goals, Non-Goals, Design/Subsystems, Data
Model, State Machine, Security, Open Questions -- is frozen until a human
amends it.

---

## When implementation lands

Implementation is not done when the tests pass. The closing checklist --
cut drift issues, append Key Decisions, record lessons, file what you
discovered, update `TODO_PLAN.md`, hand off the status transition -- is
**the retrospective skill (phase 8)**, run in a docs-only PR separate from
the feature PR.

It used to live here, which is why it got skipped: the freeze rule above
tells implementers not to be in this skill, so the one checklist that
closes the loop was hidden behind the rule that kept them out of it.

> A green test suite and a clean review say nothing about whether you built
> what was designed. Only the retrospective does.

---

## Status Transitions

```
DRAFT  -->  REVIEW  -->  APPROVED  -->  IMPLEMENTED
                |                            |
                v                            v
            (revise)                    SUPERSEDED
```

- **DRAFT -> REVIEW:** Author believes doc is complete enough for feedback,
  and the reviewer panel has run over it (-> the designomatic skill). A
  human's first read should not be spent on what a panel would have caught
- **REVIEW -> APPROVED:** Reviewers agree on the approach
- **APPROVED -> IMPLEMENTED:** **shipped, as-built updated, drift closed.**
  Human-only. All three conditions, not just the first: code that is merged
  but not released is not in the shared architecture, and the status is a
  lie while drift is open. An implementer never marks its own work
  IMPLEMENTED
- **IMPLEMENTED -> SUPERSEDED:** A newer design replaces this one (link to it)
- **REVIEW -> DRAFT:** Significant revisions needed (back to drafting)

**APPROVED and IMPLEMENTED carry the merged-but-unreleased gap.** APPROVED
means designed, and possibly merged, but not yet in the shared architecture
described by `docs/arch/`. That is what lets the as-built stay strictly
factual instead of needing a "pending" marker.

**APPROVED is a freeze.** From APPROVED onward the doc changes only by human
amendment through the design process -- never as a side effect of someone
implementing it. See Drift above.
