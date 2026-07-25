---
name: design
description: "Writing, reviewing, or improving a design doc; use before starting any feature that lacks one. Covers DESIGN.<name>.md vs ARCHITECTURE.md choice, required sections incl. Rejections, and naming axes of change. Skip when implementing against an approved design (coding) or building the phased plan (planning)."
---

# SKILL: Design Document Authoring & Review

> **Purpose:** Author, review, and improve design documents that are useful to both AI agents and human engineers.
> **When to use:** Before implementing a new system, major feature, or architectural change.
> **References:** `docs/design/TEMPLATE.md`, `docs/design/STYLE-GUIDE.md`

---

## The Design-Doc Rule (read first)

**No implementation without an approved design doc.** Two document kinds, and the
choice between them is mechanical:

| You are designing... | Write | Where |
|---|---|---|
| A single tool / package / component | `DESIGN.<name>.md` | `docs/design/` |
| A system that spans **multiple tools** (how they fit together) | `ARCHITECTURE.md` | `docs/design/` |
| How two specific components connect | `INTEGRATION.md` | `docs/design/` |

* **Every tool gets its own `DESIGN.<name>.md`.** One tool, one design doc.
* **A mix of tools gets an `ARCHITECTURE.md`** that describes the boundaries,
  responsibilities, and contracts between the tools' design docs -- it links
  out to each `DESIGN.<name>.md` rather than duplicating them.
* The design doc answers **what** and **why**; the root `TODO_PLAN.md` (via
  the planning skill) answers **how** and **in what order**; the code
  (via the coding skill) is the result.

---

## Name the Axes of Change (the seams)

A design doc's most useful architectural work is to separate what is **stable**
(the meaning -- decisions and rules in the problem's language) from what is
**volatile** (the mechanisms -- vendors, wire formats, storage, model ids), and
to name each volatile axis as one explicit seam. This is the single idea behind
Clean / Hexagonal / DDD; see the coding skill, Section 1.

In the **Architecture Overview** and **Design** sections, make this concrete:

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
| `ARCHITECTURE.md` | System-level design |
| `INTEGRATION.md` | How components connect |

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

1. **Before coding:** Read the design doc. If anything is unclear, improve the doc first
2. **During planning:** Use the planning skill to break the design into phases, recorded in the repo's single root `TODO_PLAN.md` (per the todo-plan skill)
3. **During coding:** Use the coding skill to implement against the design doc. **The doc is frozen while you code** -- see Drift below
4. **After implementation:** Run the aftermath checklist below. Do **not** silently "update the doc to match"

### Design Doc -> TODO_PLAN Flow

```
docs/design/DESIGN.feature.md    (what to build and why)
         |
         v
TODO_PLAN.md                     (how to build it -- the repo-root singleton)
         |
         v
Implementation                    (the code)
```

The design doc answers **what** and **why**. The TODO_PLAN answers **how** and **in what order**.

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
the aftermath**. File it. A human decides whether to amend the design or change
the code, through the design process.

### What counts as drift

Anything the doc specifies that the code does not do, and anything the code does
that the doc does not specify. All of it:

| Kind | Example | Action |
|---|---|---|
| Spec'd but not built | A registry entry, a field, an enum variant you dropped | Issue |
| Built but not spec'd | Security flags, a new error type, a timeout policy | Issue |
| Rule violated | Doc says "fail closed, exclude X"; you shipped X anyway | Issue, flagged as a **decision needed** -- this is the dangerous kind |
| Shape changed | Fields merged, split, or moved from data to behavior | Issue |
| Provisional resolved | Doc marks flags "provisional, verify at implementation time" | **Not drift** -- the doc told you to. Record the verified values in the aftermath |

The "rule violated" row is the one that matters most. If your implementation
breaks a stated constraint -- especially a security constraint -- say so out
loud in its own issue, framed as a decision for a human. Do not soften the rule
in the doc so the code conforms.

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

## Aftermath (run this when implementation lands)

Implementation is not done when the tests pass. Work through this checklist,
in a **docs-only PR separate from the feature PR**:

1. **Cut drift issues.** Walk the doc section by section against the code. Every
   divergence gets an issue per the table above, with file:line and a concrete
   consequence. Cross-link them so the set is reviewable together.
2. **Record Key Decisions.** Append the decisions made during implementation to
   the doc's Key Decisions table, each citing its authorizing issue.
3. **Record lessons learned.** Add to `TODO_PLAN.md`'s Lessons Learned section:
   what surprised you, what bit you, what the next agent must not repeat. A
   lesson needs the *mechanism*, not just the symptom -- "X inherits the global
   config and starts OAuth flows" beats "X was noisy."
4. **Record discovered issues.** Anything you found that is *not* drift --
   pre-existing bugs, deferred work the doc names as future, follow-ups you
   chose not to do. File them; do not leave them in a PR description.
5. **Update TODO_PLAN.** Mark the phase shipped, and list the outstanding drift
   issues under it so the work is visibly incomplete until they are settled.
6. **Status transition.** Only a human moves the doc to IMPLEMENTED, and only
   once the drift issues are closed -- because IMPLEMENTED means "code matches
   the design," which is false while drift is open.

> A green test suite and a clean review say nothing about whether you built what
> was designed. Only the aftermath does.

---

## Status Transitions

```
DRAFT  -->  REVIEW  -->  APPROVED  -->  IMPLEMENTED
                |                            |
                v                            v
            (revise)                    SUPERSEDED
```

- **DRAFT -> REVIEW:** Author believes doc is complete enough for feedback
- **REVIEW -> APPROVED:** Reviewers agree on the approach
- **APPROVED -> IMPLEMENTED:** Code matches the design -- **human-only, and only
  once every drift issue is closed.** An implementer never marks its own work
  IMPLEMENTED, and the status is a lie while drift is open
- **IMPLEMENTED -> SUPERSEDED:** A newer design replaces this one (link to it)
- **REVIEW -> DRAFT:** Significant revisions needed (back to drafting)

**APPROVED is a freeze.** From APPROVED onward the doc changes only by human
amendment through the design process -- never as a side effect of someone
implementing it. See Drift above.
