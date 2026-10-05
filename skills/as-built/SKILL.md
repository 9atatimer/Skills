---
name: as-built
description: "Phase 7a of the SDLC: recording the as-built of the deployed system in docs/arch/ at release -- the components, the seams as coded and what sits behind each, every tuned value per stage, the use-case surface, flows, deployment facts, radar reality, and the lessons the shape taught. Living and factual, never frozen; written by the releaser after shipping, never by the designer before. Load when a change deploys, publishes or tags, and whenever a task reads docs/arch/ to learn what is really there. Skip for intent (the design and architecture skills) and for developer tooling, whose record is a docs/ops/ runbook."
---

# SKILL: As-built (Phase 7a)

> **Purpose:** keep `docs/arch/` a true description of what is deployed,
> so the next design, plan and retrospective have a real starting point.
> **Runs:** with Release, before the retrospective.
> **Written by:** the releaser, after shipping. Never the designer.

---

## The Folder Law (read first)

| | `docs/design/` (design and architecture records) | `docs/arch/` |
|---|---|---|
| Describes | what we intend to build, and how | what is deployed right now |
| Truth kind | aspirational | factual |
| Lifecycle | **body frozen at APPROVED** | **living, never frozen** |
| Written by | the designer and the architect, before code | the releaser, after shipping |
| Wrong when | rewritten to match the code | contains anything not yet shipped |

**That opposition is why they are separate trees.** They fail in opposite
directions, so one document cannot be both. A record edited to match the
code destroys the only artifact that could show drift. An as-built
containing intentions is worse than none, because a reader cannot tell
which parts are real.

Two rules follow, and they are absolute:

- **Nothing enters `docs/arch/` until it ships.** Deployed, published or
  tagged. Merged is not shipped; the design record's status (APPROVED vs
  IMPLEMENTED) carries that gap, so this tree never needs a "pending"
  marker.
- **An edit here with no corresponding shipped change is a smell.** The
  as-built trails reality; it never leads it.

---

## The as-built tracks what is DEPLOYED

Read "release" broadly: **deploy, publish, or tag.** A monorepo of npm
packages releases by publishing; a Worker by deploying; a library by
tagging. Whichever it is, that is the moment the change becomes shared,
and that is when the as-built moves. Work that ships nowhere changes no
shared architecture; that is a correct no-op.

The merged-but-unreleased gap is carried by the design record's status:

- **APPROVED** -- designed, possibly merged, not yet in the shared
  architecture.
- **IMPLEMENTED** -- shipped, as-built updated, drift closed. Human-only.

---

## What the as-built contains

One topic directory per system or bounded context, plus a root index:

```
docs/arch/
  ARCHITECTURE.md            the INDEX: inventory (rows link to topics),
                             cross-cutting friction, radar reality
  <whole-repo>.html          whole-repo topology diagrams
  <topic>/ARCHITECTURE.md    the topic's as-built: components, seams, values, flows
  <topic>/<topic>.html       the topic's at-a-glance page
```

The markdown carries the parseable detail for agents; the html carries
the at-a-glance view for humans; both must agree.

Content, in the order a new reader needs it:

- **Component inventory.** What exists, what each is responsible for, and
  where its source lives.
- **The seams.** Each port/policy/parameter actually in the code, and what
  implementations sit behind it today. This is what makes the Swap test
  answerable without reading the source.
- **The tuned values.** What every parameter is set to, per stage: the
  retention windows, the thresholds, the limits, the labels, the version
  floors. The design names that each exists and its bound; the
  architecture names the seam that carries it; this is the only record
  that holds the number, so a retune is an as-built edit and never drift.
- **The use-case surface.** The application-layer functions that exist,
  each with the behavior it carries and the ports it takes, and where the
  composition root for each runtime lives. This is the API the next design
  composes against.
- **Flows.** How a request, an event or a deploy actually moves through
  the components.
- **Deployment facts.** Where each component runs, what triggers it, what
  it depends on at runtime.
- **Radar reality.** Which off-the-shelf tech is genuinely in use, on which
  ring. Reconcile against the tech-radar skill.
- **Lessons the shape taught us.** Where the current structure fights us.
  This is the input the next architecture phase reads.

---

## Diagrams are HTML

Architecture diagrams live in `docs/arch/` as HTML. They render in a
browser without a toolchain, they diff as text, and they carry more than
ASCII can for a document whose whole job is to be looked at.

- Self-contained: inline the CSS and any SVG. No external fetches.
- The ASCII-only rule governs `.md` prose; it does not forbid an `.html`
  diagram. Design and architecture records keep their ASCII diagrams (the
  markdown skill).
- A diagram that disagrees with the prose is a defect: update both or
  neither.

---

## The 7a checklist

- **Update the component inventory** for anything added, removed or
  renamed by this release.
- **Update the seams**: new ports, new implementations behind existing
  ports, seams that turned out to be ceremony and were inlined.
- **Record the tuned values** this release set or changed, per stage.
- **Regenerate or hand-edit the diagrams** so they match the prose.
- **Audit the radar.** Every dependency this release uses is on the radar,
  on the ring it was proposed at. One that landed without a row is a
  finding for the retrospective, not something to quietly add.
- **Record what the shape taught you**, if anything.
- **Record built-but-not-designed facts.** See below.

---

## Drift: this phase records, the issue accuses

When the code does something neither record specified, **both of these
happen, and they are not alternatives**:

- **`docs/arch/` records it as fact.** That is the as-built's whole job.
  An as-built that omits what exists because it was never designed is
  broken.
- **An issue still raises whether it should have been designed.**
  Recording a thing is not approving it.

The as-built absorbs the *recording*; the design process keeps the
*accusation*. The freeze on `docs/design/` is unchanged; nothing here
licenses editing a design or architecture record to match the code. The
drift walk itself is the retrospective skill.

---

## Exit gate

`docs/arch/` describes the deployed system, the tuned values are recorded
per stage, diagrams agree with the prose, and the radar matches reality.
Then the retrospective can diff the frozen records against a true
as-built.

---

## Related

- the architecture skill -- phase 3, which reads this tree and never
  writes it
- the design skill -- phase 2, the frozen half of the folder law
- the release skill -- phase 7, which this phase fires with
- the tech-radar skill -- the rings this phase audits
- the retrospective skill -- phase 8, which reads the fresh as-built
