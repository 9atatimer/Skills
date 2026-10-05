---
name: architecture
description: "Phase 3 of the SDLC: writing the architecture record, docs/design/ARCHITECTURE.<name>.md -- how the system intends to deliver what its approved design says it can do. Names every axis of change and maps each to one seam (port, policy, parameter), draws the module map (domain / application / ports / adapters / composition root), gives each design behavior its use-case signature, places every design-named bound in the seam that carries it, states operability, and proposes tech-radar rows. Written after the design is APPROVED and against the as-built; frozen at its own APPROVED. Load before planning any change that adds a component, seam, or dependency. Skip for a change that adds none of those (it elides with planning), for the as-built (the as-built skill), and for developer tooling (sdlc, Product or tooling)."
---

# SKILL: Architecture (Phase 3)

> **Purpose:** say how the system intends to do what the design says it
> can do, in a record of its own that constrains the plan and the code.
> **Input:** an APPROVED design record and the as-built.
> **Output:** `docs/design/ARCHITECTURE.<name>.md`, frozen at APPROVED.
> **Exit gate:** a human marks the architecture record APPROVED.

---

## The three records (read first)

| Record | Holds | Does not hold | Lifecycle |
|---|---|---|---|
| Design, `docs/design/DESIGN.<name>.md` | what the system can and cannot do: capabilities, constraints, scope in and out, the domain language, the bounds that exist | seams, signatures, vendors, stores, numbers | frozen at APPROVED (the design skill) |
| Architecture, `docs/design/ARCHITECTURE.<name>.md` | how it intends to do that: the seams, the module map, the use-case surface, the mechanism behind each capability, which seam carries each bound, operability | capabilities the design did not grant; tuned values | frozen at its own APPROVED (this skill) |
| As-built, `docs/arch/` | what runs: components, seams as coded, flows, deployment facts, **every tuned value** | intentions | living, never frozen (the as-built skill) |

Each record constrains the next step. A design that names a port has
decided mechanism before anyone reviewed the capability; an architecture
that grants a capability has designed without approval; an as-built that
describes intent is worthless to the next designer. A number, a label, a
threshold or a "who first" is never a design or architecture fact: the
design says the value exists and is bounded, this record says which seam
carries it, the as-built says what it is set to.

**Phase 3 reads `docs/arch/` and writes nothing to it.** Everything this
phase produces lands in the architecture record.

---

## Before you write

- **The design is APPROVED and frozen.** This record is written against
  it, not alongside it. A capability the design does not grant is not
  yours to add: cut an issue against the design and stop. A capability the
  design grants that no mechanism can deliver is the same issue in the
  other direction, and the honest outcome is a design amendment, never a
  quiet narrowing here.
- **Read the as-built.** Start in `docs/arch/`. You are placing a change
  into a system that exists, and the as-built is the only document that
  claims to describe it truthfully. If it is missing or visibly stale, say
  so: a stale as-built makes every seam and every estimate fiction.
- **Keep the design's language.** Every noun in a signature here is a term
  the design's Domain Language defines, under one spelling. Two names for
  one concept here become two modules for one concept in phase 5.

---

## Name the axes of change (the seams)

The core work of the phase. Separate what is **stable** (the meaning:
rules and decisions in the problem's language, which the design already
fixed) from what is **volatile** (the mechanisms: vendors, wire formats,
storage, model ids, platforms), and give each volatile axis exactly one
explicit seam: a port, a policy, or a parameter.

The idea itself, its mechanical tests (Grep / Swap / Decision / Arrow /
Change) and its smells are the coding skill, Section 1; that is the
authority and this phase does not restate it. What this phase adds is
*when*: before the plan, not during the code. A seam discovered while
coding was never reviewed.

Two failure modes, equally real:

- **Missing seam.** If "we now also use `<new vendor>`" would force an
  edit to the core, an axis is unnamed.
- **Ceremony.** A port with one forever-implementation is cost with no
  benefit. Seam only at real axes of change; a seam considered and
  rejected goes in this record's Rejections with its reason. The bar: a
  fake and a real implementation on day one, or a second mechanism that is
  plausibly coming.

A judgement with a bounded answer -- classify, gate, route, triage, judge
-- is an axis of its own: rules, a small encoder, a decision model and an
LLM can all make it. The decision-models skill names its port.

**Policies are values, not ports.** A pure function that the design names
as a rule (a scoring policy, a matching policy, an exposure policy) is a
domain value passed into a use case, so a test can drive the use case with
any policy and no adapter. It is a seam because it will be retuned; it is
not a port because nothing behind it does I/O.

---

## Draw the module map (the layers)

Seams say where the core meets the world. They say nothing about the
inside of the core, and a change whose only architectural output is a seam
list gets a hexagon with the workflow smeared across whatever calls it. The
second output is the **module map**: each unit of the change, core and edge
alike, assigned to one layer, with one composition root per runtime.

| Layer | Holds | Rule |
|---|---|---|
| domain | rules, values, invariants, named policies | pure; no port reaches it |
| application | the use cases, one per behavior in the design's Behaviors table | ports as keyword dependencies; domain values in and out |
| ports | one interface per seam in the seam list | owned by the core; imports only domain types |
| adapters | one implementation per port per mechanism | the edge: the only layer that imports a vendor, `fs`, `fetch`, or `process.env` |
| composition root | the container: one per runtime (CLI, server, worker, each app) | the only code that names a concrete adapter |

The map is small -- a table of unit, layer, runtime -- and it is judged by
the coding skill's Trace, Purity and Wiring tests before a line is
written. Layers are not directories; a one-file tool keeps them as three
regions of one file.

---

## Give each behavior its use case (the use-case surface)

The design's Behaviors table says what a person does and observes, as
Given/When/Then, with no signature. This record gives each of those rows
its home: one application-layer function, with its signature, so the
boundary between what a caller calls and what the domain decides is drawn
here, reviewed, and frozen, rather than improvised in a handler at phase 5.

```
| Design behavior | Use case (signature) | Ports |
|---|---|---|
| A person flags interest | `declare_interest(from: Account, to: Account, *, interests: InterestStore, notifier: NotifierPort, clock: Clock, policies: Policies) -> InterestOutcome` | InterestStore, NotifierPort, Clock |
| Interest across a block is inert | (same use case; a scenario) | InterestStore |
```

The rules the table must satisfy:

- **Every design row appears exactly once**, by its name, and resolves to
  one function. Several rows may share a function: a happy path and its
  error paths are scenarios of one use case.
- **Inputs and outputs are the design's domain values**, never a wire
  format, an SDK type or an adapter handle. That is what makes use cases
  composable and testable with no handler in front.
- **Ports arrive as keyword dependencies**, after the values, and the
  Ports column names only seams from this record's seam list. A port that
  appears here and nowhere else is an axis nobody named.
- **Every return is a named outcome value** the design's Domain Language
  defines, and an outcome never carries more than the design allows it to
  reveal.
- **Phase 4 writes the RED test against exactly this signature**, with
  fakes behind exactly these ports (the testing skill), and asserts the
  design row's Then.

---

## Place every bound (the parameters)

The design names each bound that exists and the constraint on it, with no
value. This record says which seam carries each one: a parameter set the
composition root supplies, a policy value, or a store's configuration. A
bound the design names that this record does not place is a tuned value
nobody will know where to set; a value written here is drift the moment
it is retuned. The as-built holds the numbers.

---

## State the mechanism, then operability

For each capability the design grants, one short subsection: the
components that deliver it, the seams they cross, and the flow. Tables
over prose. The design's Security Considerations become mitigations here;
its threats are already stated.

Operability is this record's, because it is how the thing is run:

| Question | Answer |
|---|---|
| Release class | one of the release classes R0 to R3 the release skill defines, with the triggers that set it |
| Stages and platforms | where it runs; version floors are tuned values in the as-built |
| Likeliest failures | one row each: how it is seen, how it is debugged, which parameter or seam is involved |
| Rollout and rollback | flags, staged rollout, what cannot be rolled back |
| Data warehouse | what this system writes, or "nothing is ledgered" with the reason |

---

## Propose tech-radar rows

**The radar is owned by this phase and consulted in phase 5.** Anything
off-the-shelf this change introduces is proposed here with the ring and a
one-line rationale. The row itself lands with the code that uses it (the
tech-radar skill) and is audited by the as-built skill.

---

## The record

`docs/design/ARCHITECTURE.<name>.md`, from `references/TEMPLATE.md` in
this skill. Sections, in order: header (status, date, authors, the design
record it implements and its status), Overview, Component diagram (ASCII),
Seams, Module map, Use-case surface, Mechanism (one subsection per
capability), Parameters placed, Operability, Radar proposals, Key
Decisions, Open Questions, Rejections, Related Documents.

| Work | Lands in |
|---|---|
| The seam list, each axis mapped to one port/policy/parameter | Seams |
| Each unit in one layer; one composition root per runtime | Module map |
| Each design behavior traced to one signature | Use-case surface |
| Which seam carries each design-named bound | Parameters placed |
| Each mechanism choice with its rationale | Key Decisions |
| Seams considered and rejected as ceremony; mechanisms dismissed | Rejections |
| Proposed radar rows | Radar proposals (and the radar, with the code) |
| Components this change touches that the as-built already describes | Related Documents |

What does not land here: a capability, a scope boundary, a threat, a
state machine, a domain noun. Those are the design's; cite them, never
restate them.

---

## Check the seams before the human does

Run `designomatic run <draft> --panel seam-review`: a one-cycle panel
asking exactly this phase's question -- is each axis named, does each map
to one seam, is anything seamed that has one implementation forever. Ask
the layer question in the same pass: is every behavior traced to one
application function, is any domain module handed a port, is there one
composition root per runtime. -> the designomatic skill

---

## Exit gate

Every volatile axis is named and mapped to exactly one seam; every design
behavior is traced to one use case with a pure domain beneath it and one
composition root per runtime; every design-named bound is placed; every
new dependency has a proposed ring; operability is stated. **A human
approves, and the record freezes.** Then phase 3b (planning) computes the
route.

**Drift.** From APPROVED onward this record changes only by human
amendment. A seam found while coding is drift: cut an issue, do not edit
the record. The retrospective walks the code against both frozen records.

---

## Phase 3b: Planning is this phase's epilogue

A plan is the delta between two endpoints: the design and this record
supply the target, the as-built supplies the start. Architecture and
planning elide *together* or not at all: when a change adds no seam, no
component and no dependency, there is nothing to architect and the route
is one obvious step. -> the planning skill

---

## Related

- the design skill -- phase 2, the record this one implements
- the as-built skill -- phase 7a, the record this one reads first
- the coding skill, Section 1 -- the stable-core/volatile-edges idea and
  its mechanical tests
- the planning skill -- phase 3b, this phase's epilogue
- the tech-radar skill -- the rings; owned here, consulted in phase 5
- the decision-models skill -- the seam for a bounded judgement
- the retrospective skill -- phase 8, which walks both frozen records
