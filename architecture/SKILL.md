---
name: architecture
description: "Phase 3 and 7a of the SDLC: naming the seams a change will add (before code) and recording the as-built of the deployed system in docs/arch/ (at release). Covers the docs/design vs docs/arch folder law, as-built content and HTML diagrams, and tech-radar row ownership. Load before planning any change that adds a component, seam, or dependency, and again when a change ships. Skip for a change that adds none of those and ships nowhere."
---

# SKILL: Architecture (Phases 3 and 7a)

> **Purpose:** know what the system actually is, and name what a change
> will add to it.
> **Two entry points, one skill:** phase 3 looks forward, phase 7a records
> what shipped.

---

## The Folder Law (read first)

| | `docs/design/` | `docs/arch/` |
|---|---|---|
| Describes | what we intend to build | what is deployed right now |
| Truth kind | aspirational | factual |
| Lifecycle | **body frozen at APPROVED** | **living, never frozen** |
| Written by | the designer, before code | the releaser, after shipping |
| Wrong when | rewritten to match the code | contains anything not yet shipped |

**That opposition is why they are separate trees.** They fail in opposite
directions, so one document cannot be both. A design doc edited to match
the code destroys the only artifact that could show drift. An as-built
containing intentions is worse than no as-built, because a reader cannot
tell which parts are real.

**The law governs design records, not the process artifacts beside them.**
`DESIGN.<name>.md` and `INTEGRATION.md` are design records: they describe a
specific intended system, they carry a status, and they freeze.
`STYLE-GUIDE.md`, `TEMPLATE.md`, and any other reusable process guidance in
`docs/design/` are not -- they have no approval lifecycle and evolve freely.
Improving them is continuous improvement, not drift.

**What freezes is the design record's body.** Its lifecycle metadata still
moves: the status advances APPROVED -> IMPLEMENTED -> SUPERSEDED, and the
Key Decisions log is append-only. Freezing the body is what makes drift
visible; freezing the status would make the ladder unusable.

Two rules follow, and they are absolute:

- **Phase 3 reads `docs/arch/` and writes nothing to it.** The forward
  half of this skill produces a seam list that lands *in the design doc*.
- **A `docs/arch/` edit with no corresponding shipped change is a smell.**
  Architecture trails reality; it never leads it.

---

## Phase 3: Architecture (intended)

Runs **before the approval gate**, not after it. Answers: *given what we
actually have, what does this change add to it?*

This ordering is forced by the freeze. Everything this phase produces lands
inside the design record (see Output below), and an APPROVED record is
frozen -- so seam-naming has to finish while the doc can still be edited. A
design record with no named seams is not finished and must not be approved;
approval covers the design *and* its seams as one reviewed artifact. If you
find a missing seam after approval, that is drift: cut an issue, do not
quietly edit the record. -> the retrospective skill

### 1. Read the as-built first

Start in `docs/arch/`. You are placing a change into a system that already
exists, and the as-built is the only document that claims to describe it
truthfully. If `docs/arch/` is missing or visibly stale, say so -- a stale
as-built makes every downstream estimate fiction, and fixing it is cheaper
now than after you have planned against a fantasy.

### 2. Name the axes of change (the seams)

This is the core work of the phase. Separate what is **stable** (the
meaning -- decisions and rules in the problem's language) from what is
**volatile** (the mechanisms -- vendors, wire formats, storage, model ids),
and give each volatile axis exactly one explicit seam: a port, a policy, or
a parameter.

The idea itself, its mechanical tests (Grep / Swap / Decision / Arrow /
Change), and its smells are the coding skill, Section 1 -- that is the
authority, and this phase does not restate it. What this phase adds is
*when* the work happens: **before the plan, not during the code.** A seam
discovered while coding is a seam that was never reviewed.

Two failure modes, equally real:

- **Missing seam.** If "we now also use `<new vendor>`" would force an
  edit to the core, an axis is unnamed.
- **Ceremony.** A port with one forever-implementation is cost with no
  benefit. Seam only at real axes of change (YAGNI); if you considered a
  seam and rejected it, that belongs in the design doc's Rejections.

### 3. Propose tech-radar rows

**The radar is owned by this phase and consulted in phase 5.** Anything
off-the-shelf that this change introduces gets proposed here, in the design
doc, with the ring you are placing it in and a one-line rationale.

The row itself lands with the code that uses it (the tech-radar skill's
existing rule -- the radar must never drift ahead of or behind the code),
and it is audited at 7a. Proposing in phase 3 is what makes the choice
reviewable *before* it is load-bearing.

### 4. Output

Everything from this phase lands **inside the design doc**, not in
`docs/arch/`:

| Work | Lands in |
|---|---|
| The seam list, each axis mapped to one port/policy/parameter | Architecture Overview + Design |
| Each seam choice with its rationale | Key Decisions |
| Seams considered and rejected as ceremony | Rejections |
| Proposed radar rows | Key Decisions (and the radar, with the code) |
| Components this change touches that the as-built already describes | Related Documents |

### Exit gate

Every volatile axis this change introduces is named and mapped to exactly
one seam; every new dependency has a proposed ring. The design record is now
complete and approvable -- **a human approves, and the record freezes.**
Then phase 3b (planning) can compute the route.

---

## Phase 3b: Planning is this phase's epilogue

Planning belongs here, immediately after, because **a plan is the delta
between two endpoints and needs both**: the design supplies the target, the
as-built supplies the start. A route computed without the as-built is
fiction -- it plans against an imagined codebase.

This is also why planning is where scope gets cut. It is the first phase
that meets real code, so it is the first phase where cost is real.

Architecture and planning elide *together* or not at all. -> the planning
skill

---

## Phase 7a: Architecture (as-built)

Runs with Release, before the retrospective.

### The as-built tracks what is DEPLOYED

Not what is merged. The as-built describes the shared system other
developers must code against, and CD is not universal -- merged is not
shipped.

Read "release" broadly: **deploy, publish, or tag.** A monorepo of npm
packages releases by publishing; a Worker releases by deploying; a library
releases by tagging. Whichever it is, that is the moment the change becomes
shared, and that is when the as-built moves.

Work that ships nowhere changes no shared architecture. That is a correct
no-op, not an exception to be worked around.

**The merged-but-unreleased gap is carried by the design doc's status**, so
it does not need a "pending" marker in `docs/arch/` (which would put
intentions back into the as-built):

- **APPROVED** -- designed, possibly merged, not yet in the shared
  architecture.
- **IMPLEMENTED** -- shipped, as-built updated, drift closed. Human-only.

### What the as-built contains

One topic directory per system or bounded context, plus a root index:

```
docs/arch/
  ARCHITECTURE.md            the INDEX: inventory (rows link to topics),
                             cross-cutting friction, radar reality
  <whole-repo>.html          whole-repo topology diagrams
  <topic>/ARCHITECTURE.md    the topic's as-built: components, seams, flows
  <topic>/<topic>.html       the topic's at-a-glance page
```

The markdown carries the parseable detail for agents; the html carries
the at-a-glance view for humans; both must agree.

Content, in the order a new reader needs it:

1. **Component inventory.** What exists, what each one is responsible for,
   and where its source lives.
2. **The seams.** Each port/policy/parameter that is actually in the code,
   and what implementations sit behind it today. This is the section that
   makes the Swap test answerable without reading the source.
3. **Flows.** How a request, an event, or a deploy actually moves through
   the components.
4. **Deployment facts.** Where each component runs, what it is triggered
   by, what it depends on at runtime.
5. **Radar reality.** Which off-the-shelf tech is genuinely in use, and on
   which ring. Reconcile against the tech-radar skill.
6. **Lessons the shape taught us.** Where the current structure fights us.
   This is the input the next design phase reads.

### Diagrams are HTML

Architecture diagrams live in `docs/arch/` as HTML. They render in a
browser without a toolchain, they diff as text, and they carry more than
ASCII can (color, layering, labelled edges) for a document whose whole job
is to be looked at.

- Self-contained: inline the CSS and any SVG. No external fetches, so the
  file works from a clone with no network.
- The ASCII-only rule governs `.md` prose; it does not forbid an `.html`
  diagram file. Design docs keep their ASCII diagrams (the markdown skill).
- A diagram that disagrees with the prose is a defect -- update both or
  neither.

### The 7a checklist

1. **Update the component inventory** for anything added, removed, or
   renamed by this release.
2. **Update the seams** -- new ports, new implementations behind existing
   ports, seams that turned out to be ceremony and were inlined.
3. **Regenerate or hand-edit the diagrams** so they match the prose.
4. **Audit the radar.** Every dependency this release actually uses is on
   the radar, on the ring it was proposed at. A dependency that landed
   without a row is a finding for the retrospective, not something to
   quietly add.
5. **Record what the shape taught you**, if anything.
6. **Record built-but-not-designed facts.** See below -- this is the half
   of drift that belongs here rather than in an issue.

### Drift: this phase records, the issue accuses

When the code does something the design never specified, **two things
happen, and they are not alternatives**:

- **`docs/arch/` records it as fact.** That is the as-built's whole job. An
  as-built that omits what exists because it was never designed is broken.
- **An issue still raises whether it should have been designed.** Recording
  a thing is not approving it.

Architecture absorbs the *recording*; the design process keeps the
*accusation*. The freeze on `docs/design/` is unchanged -- nothing here
licenses editing a design doc to match the code. The drift walk itself is
the retrospective skill.

### Exit gate

`docs/arch/` describes the deployed system, diagrams agree with the prose,
and the radar matches reality. Then the retrospective can diff the frozen
design against a true as-built.

---

## Related

- the design skill -- phase 2, and the frozen half of the folder law
- the coding skill, Section 1 -- the stable-core/volatile-edges idea and
  its mechanical tests
- the planning skill -- phase 3b, this phase's epilogue
- the tech-radar skill -- the rings; owned here, consulted in phase 5
- the retrospective skill -- phase 8, which reads the fresh as-built
