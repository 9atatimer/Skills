---
name: design
description: "Phase 2 of the SDLC: writing, reviewing, or improving a design doc; use before starting any feature that lacks one. Covers the required sections incl. Behaviors (the Given/When/Then surface) and Rejections, what a design record may not hold (seams, signatures, vendors, numbers -- the architecture and as-built records own those), the freeze at APPROVED, and the status ladder. Product only: skip for developer tooling (self-contained dev QoL, invisible to the product), which gets a docs/ops/ runbook instead (sdlc, Product or tooling). Skip also when naming seams or updating the as-built (architecture), building the phased plan (planning), or implementing against an approved design (coding)."
---

# SKILL: Design Document Authoring & Review (Phase 2)

> **Purpose:** Author, review, and improve design documents that are useful to both AI agents and human engineers.
> **When to use:** Before implementing a new system, major feature, or architectural change.
> **Exit gate:** the record is complete and a human marks it APPROVED.
> From then on its body is frozen; only the status and the append-only Key
> Decisions log move. APPROVED is what opens phase 3: the architecture
> record is written against this one, never alongside it.
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
  contracts between them, and links out to each `DESIGN.<name>.md` rather
  than duplicating them.
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

A policy value ("how long is it kept"), an appearance ("what is the tier
called"), or a tuning ("who is shown first") is neither a design decision
nor an architecture decision. The design says the value exists, is bounded,
and is a parameter, and names the bound in the problem's language ("sightings
are kept strictly shorter than mutuals"); architecture says which seam
carries it; the as-built records what it is set to. A number written into a
design record freezes a tuning as if it were a capability, and every retune
then reads as drift.

### `docs/design/` is not `docs/arch/`

**The as-built lives in `docs/arch/` and is not a design doc.** The two
trees fail in opposite directions, which is why they are separate:

| | `docs/design/` | `docs/arch/` |
|---|---|---|
| Describes | what we intend to build | what is deployed right now |
| Lifecycle | **body frozen at APPROVED** | **living, never frozen** |
| Wrong when | rewritten to match the code | contains anything not yet shipped |

Never place an as-built document in `docs/design/`, and never describe
unshipped intentions in `docs/arch/`. -> the as-built skill

**The freeze covers a record's body, and only design and architecture
records.** The status still advances (APPROVED -> IMPLEMENTED -> SUPERSEDED) and Key
Decisions is still append-only -- see Status Transitions. And
`STYLE-GUIDE.md` / `TEMPLATE.md`, which live in `docs/design/` as reusable
process guidance rather than descriptions of an intended system, have no
approval lifecycle and evolve freely.

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
anonymity bound is six" is the as-built. A design that names a mechanism
has decided it before anyone reviewed the capability, and the freeze then
makes the mechanism unreviewable; one that names a number freezes a tuning
as if it were a capability, and every retune reads as drift.

What the design does say about mechanism is nothing, and what it says
about bounds is that each exists and what constrains it: "sightings are
kept strictly shorter than mutuals", "the anonymity bound is at least the
scanner and one other". The architecture record places each bound in a
seam; the as-built records the value.

---

## Behaviors (the BDD surface)

Goals say what success looks like. They do not say what a person does and
then observes. **This section is required**: one row per behavior, as the
Given/When/Then that phase 4 will keep as a test, and it is the section
phases 3, 4 and 5 all read. The architecture record gives each row its
use-case signature and ports; this record gives each row its meaning.

```
| Behavior | Given / When / Then |
|---|---|
| An assertion is judged | Given a PR and an assertion, When the judge runs, Then a Verdict names pass/fail and the evidence |
| An unreadable verdict never fails a clean PR | Given a judgement that cannot be read, When the judge runs, Then the Verdict is inconclusive, not fail |
```

The rules the table must satisfy:

- **Every noun is in the Domain Language.** If the row says `Verdict`,
  the Domain Language defines `Verdict`, and the architecture record and
  the code spell it the same way. One concept, one name, everywhere.
- **A behavior is observable from outside.** Something a person or a
  calling component does, and what they then see. What they do not see
  is a behavior too ("B is told nothing"), and is often the one that
  matters.
- **Error paths are rows.** A happy path and what happens when a
  precondition fails are separate kept tests, so they are separate rows,
  named so the architecture record can trace each to one use case.
- **The Given/When/Then is the test that will be kept.** A row that
  cannot be written as a failing test is not a behavior; move it to Goals
  or delete it.
- **Rules are not rows.** "The tax rate for digital goods is zero" is a
  domain rule a behavior calls; it belongs in Design, stated once, in the
  problem's language.
- **No signature, no port, no store.** Those are the architecture
  record's use-case surface, which cites these rows by name.

A design record without this table describes a system nobody can observe.
It is not complete, and it must not be approved.

---

## When to Invoke This Skill

- User asks to write, draft, or create a design doc
- User asks to review or improve an existing design doc
- User is about to start a feature that lacks a design doc
- User asks "how should we design X?"

---

## Authoring a New Design Doc

### Gather Context

Before writing, understand:

- **What problem are we solving?** (not what we're building)
- **Who is the audience?** (AI agents implementing it + human reviewers)
- **What already exists?** Check `docs/design/` for related docs, and
  `docs/concepts/<idea>/` for a phase 1 record of this idea
- **What are the constraints?** (tech stack, timeline, dependencies)

#### If a concept exists, phase 2 converts it

A concept (-> the concept skill) holds a statement of work and user
stories: intent at full width, deliberately unconverged, and possibly not
all achievable. **Converting it is this phase's job, and much of it is a
conversation with the human, not a transcription.**

| The concept holds | Becomes | Who converts it |
|---|---|---|
| The idea | Overview | you, from the text |
| Aspirations and user stories | Goals, and what is deferred | the human, in conversation |
| What the human settled | Key Decisions rows, citing the concept | you |
| What is still open | Open Questions | you |
| What the idea leans on | dependencies and sequencing | you |
| Anything the agent assumed | confirmed or dropped | the human, before anything else |
| Alternatives dismissed aloud | Rejections | you, from the record |

These rules govern that conversion:

- **A concept with no Goals, Non-Goals or Rejections is complete.** Those
  are outputs of this phase. Do not treat their absence as a defect in the
  concept, and never send work back to phase 1 to manufacture them.
- **This is where feasibility enters.** Concept was forbidden to say "we
  cannot do that." You may -- and an aspiration you cannot reach becomes a
  Non-Goal or a Rejection with a reason, in front of the human, never
  silently.
- **The concept is not authority.** It is unfunded, non-binding, and never
  frozen. Cite it as the origin of a decision; never as approval for one.
  Do not edit it to match the design, and do not delete it.

**A concept is hoped for, not assured.** Most work arrives here without one
-- from an accepted issue, or straight from a human. That is elision
working as intended, not a gap to backfill: gather the same context from
the issue and the conversation and carry on.

### Start from the Template

Copy `docs/design/TEMPLATE.md` to a new file following naming conventions:

| Pattern | Use For |
|---------|---------|
| `DESIGN.<name>.md` | Feature or component design |
| `INTEGRATION.md` | How components connect |

(As-built system documentation is not a design doc -- it belongs in
`docs/arch/`. See the as-built skill. The architecture record is written
after this one is approved; see the architecture skill.)

### Fill Sections in Order

**Do not skip sections.** Write them in this order:

- **Header block** -- Status starts as DRAFT, fill date and authors
- **Overview** -- 2-3 sentences. If you can't explain it briefly, you don't understand it yet
- **Problem and approach** -- three short parts, before any goal: the problem (what the existing answers get wrong and what this one must solve), the approach (the handful of moves that solve it, each one sentence), and a tradeoffs table (what is given up, why it is worth it). A reader needs the shape before the rules
- **Goals** -- capabilities and constraints, each testable, each with a stable id (`G1`...) so a Behaviors row and the architecture record can cite it
- **Non-Goals** -- explicit scope boundaries. Think: "what will someone ask for that we should say no to?"
- **Design** -- the rules and capabilities, one subsection per concern, in the problem's language; what each part is responsible for, never how it is built
- **Behaviors** -- the BDD surface: one row per behavior, Given/When/Then. See "Behaviors" above
- **State Machine** -- if the system has lifecycle states (most do), document transitions
- **Domain Language** -- every noun the Goals, Behaviors and State Machine use, defined once, with its invariants; no tables, no fields, no storage
- **Parameters** -- every bound the design names, and the constraint on it; no values, no owner (the architecture record places each)
- **Security Considerations** -- the threats and the constraint each imposes on the system; the mitigation's mechanism is the architecture record's
- **Ships where** -- one line: the stages and platforms it is for, or "ships nowhere"
- **Key Decisions** -- table of choices with rationale. This is the most valuable section for future readers
- **Open Questions** -- be honest about unknowns. This builds trust
- **Rejections** -- alternatives considered and explicitly dismissed, each with a one-line reason. Distinct from Non-Goals (which is scope) and Key Decisions (which is what was chosen)
- **Future Considerations** -- explicitly deferred work
- **Related Documents** -- links to other design and architecture records

### Apply the Style Guide

This skill is the standard. A repo's `docs/design/STYLE-GUIDE.md`, where one
exists, is a local copy for human readers; where it differs from this skill,
this skill wins and the copy is stale.

The prose rules. A record is read by people deciding whether to approve
it and by agents building from it; both need plain, specific text.

- **One sentence, one job.** No stacked clauses. No parenthetical carrying
  a second idea. No trailing "which is what makes..." justification: if the
  reason matters, it is its own sentence or its own column.
- **Short.** A goal is one or two sentences. A definition is noun, meaning,
  invariant. A rationale is a sentence, not a paragraph.
- **Plain words.** "Random tag", not "opaque identifier". No metaphor in
  the technical body; the Overview may have one line of it.
- **Shape before rules.** Problem, approach and tradeoffs come before the
  goals, so the reader knows why each rule exists when they reach it.
- **Tradeoffs are a table:** what is given up, why it is worth it. A
  tradeoff hidden in a rationale cell is a tradeoff nobody reviewed.
- **Origin is a column, not a clause.** In Key Decisions, the "why" is a
  plain sentence and where it was decided sits beside it.
- **Be explicit** -- No "handle errors gracefully"; state the bound and the failure posture ("retries are bounded; on exhaustion it fails closed") and name the parameter that carries the count. The count itself is a tuned value and lives in the as-built
- **Be testable** -- No "fast response times"; name the observable and the bound ("resolve latency is measured at P95 and has a ceiling") so a test can read the ceiling from configuration. The target is tuned, not designed
- **Be unambiguous** -- No "the system"; name the specific component
- **Prefer tables over prose** -- State machines, decisions, responsibilities all belong in tables
- **Use ASCII diagrams** -- They work everywhere, including in AI agent prompts

The test for a draft: read the Overview and the Problem and approach
aloud. If a sentence needs a second pass, split it. A record that reads
as generated -- long sentences, every clause hedged, every rule followed by
its reason in the same breath -- is sent back before a human reads it.

---

## Reviewing an Existing Design Doc

**Run the panel before you ask a human.** `designomatic run <draft> --panel
design-review` puts several distinct lenses over the document against the
SDLC skills themselves -- this one and architecture, the same standard the
checklist below states.
This matters most for a document *you* drafted: reviewing your own draft
re-reads your intent rather than the text, and a panel is the cheapest
correction for that. -> the designomatic skill

The checklist stays yours to apply. The panel is a first pass, not an
approval, and only a human marks a record APPROVED.

### Quality Checklist

Run through these checks:

**Structure:**

- [ ] Has all required sections (header, overview, goals, non-goals, design, behaviors, domain language, parameters, key decisions, open questions, rejections)
- [ ] Header has status, date, authors
- [ ] Status uses standard vocabulary (DRAFT / REVIEW / APPROVED / IMPLEMENTED / SUPERSEDED)

**Content quality:**

- [ ] Overview is 2-3 sentences, explains the "why"
- [ ] Goals are testable and measurable, and no goal, rule or decision carries a tuned value that belongs in the as-built
- [ ] Non-goals explicitly exclude likely scope creep
- [ ] State machines have both diagram AND transition table
- [ ] Key decisions have rationale (not just the choice)
- [ ] Open questions are honest about unknowns
- [ ] Rejections section captures alternatives that were considered and dismissed, each with a one-line reason

**Style:**

- [ ] No vague language ("gracefully", "efficiently", "properly")
- [ ] Problem and approach precede the goals, with a tradeoffs table
- [ ] Sentences do one job each; no stacked clauses, no trailing justifications
- [ ] No walls of text -- uses tables, lists, diagrams
- [ ] ASCII-only in diagrams and prose (no smart quotes, no Unicode arrows)
- [ ] Consistent heading levels (no skipping H2 -> H4)
- [ ] Blank lines after headings and before lists

**Completeness:**

- [ ] Could an AI agent implement this without asking clarifying questions?
- [ ] Could a new team member understand the "why" behind each decision?
- [ ] Are error cases and edge cases documented?
- [ ] Does every behavior have a Given/When/Then row, including the error paths and the "is told nothing" paths?
- [ ] Does every noun in Goals, Behaviors and State Machine appear in the Domain Language under exactly one name?
- [ ] Is every bound the record names in the Parameters table with its constraint, and does no bound carry a value?
- [ ] Is the record free of mechanism: no seam, port, signature, store, vendor, release class or failure mode? (those are the architecture record's; see "What stays out of a design record")

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

- **Read the full doc first** -- Understand the intent before suggesting changes
- **Check against the template** -- Identify missing sections
- **Apply this skill's style rules** -- Fix vague language, add tables, improve diagrams
- **Preserve the author's intent** -- Improve clarity without changing decisions
- **Add, don't remove** -- Missing sections should be added; existing content should be refined

### Common Improvements

| Problem | Fix |
|---------|-----|
| Missing non-goals | Ask: "what will users request that's out of scope?" |
| Vague goals | Name the observable and its bound (a latency ceiling, an error-rate ceiling, a coverage floor); the number is tuned and lives in the as-built |
| No state machine | Look for lifecycle states in the design section and extract them |
| Prose-heavy design | Convert responsibilities and transitions to tables |
| Missing key decisions | Look for implicit choices and make them explicit with rationale |
| No open questions | Every design has unknowns -- be honest about them |
| No rejections section | Look at the conversation/PR history for alternatives that were debated and dropped; surface them with one-line reasons so they don't get relitigated |

---

## Connecting Design Docs to Implementation

A design doc's value is realized when it drives implementation:

- **Architecture (phase 3):** once this record is APPROVED, write
   `ARCHITECTURE.<name>.md` beside it: the seams, the module map, each
   Behaviors row's use-case signature, where each bound is carried, and
   operability, against the as-built in `docs/arch/`. It freezes at its own
   APPROVED. -> the architecture skill
- **Planning (phase 3b):** break the design into test-first phases,
   recorded as task files under `tasks/` and ordered in the repo's root
   `TODO_PLAN.md`. -> the planning skill
- **Behaviors and Code (phases 4-5):** implement RED -> GREEN -> COMMIT
   against both records -- each RED test asserts a Behaviors row's Then,
   calling the use case the architecture record gives that row, by that
   signature. **Both records are frozen from APPROVED onward** -- see Drift
   below
- **Retrospective (phase 8):** walk the doc against the code and file
   every divergence. Do **not** silently "update the doc to match". -> the
   retrospective skill

### Where this doc sits

```
docs/design/DESIGN.feature.md         (what it can and cannot do -- FROZEN at APPROVED)
         |
         v
docs/design/ARCHITECTURE.feature.md   (how it intends to -- written against docs/arch/,
         |                             FROZEN at its own APPROVED)
         v
tasks/ + TODO_PLAN.md                 (how to build it, and in what order)
         |
         v
Implementation                    (the code)
         |
         v
docs/arch/                       (updated at 7a with what actually shipped)
```

The design record answers **what** and **why**. The architecture record
answers **how it intends to**. The as-built answers **what is actually
there**. The tasks answer **how to get there**, and the plan **in what
order**.

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

Every other section -- Overview, Goals, Non-Goals, Design, Behaviors,
State Machine, Domain Language, Parameters, Security, Open Questions -- is
frozen until a human amends it. The architecture record freezes the same
way at its own APPROVED.

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
  Human-only. All of the conditions, not merely the merge: code that is merged
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
implementing it. See Drift above. **APPROVED is also the gate to phase 3:**
the architecture record is written against a frozen design, so a design
still in DRAFT or REVIEW has no architecture record yet.
