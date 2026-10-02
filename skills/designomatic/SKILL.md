---
name: designomatic
description: "Running a reviewer panel over a concept, design record, or as-built before a human is asked to read it: choosing a panel, the standard it judges against (the SDLC skills, by document kind), reading the outcome, and resuming with guidance. Load when a concept or design doc is drafted, amended, or reviewed -- phases 1 to 3 -- and whenever an agent wants a second opinion on such a document it wrote itself. Skip for code review (gates) and for what a document must contain (concept, design, architecture)."
---

# SKILL: designomatic -- the panel pass on a concept or design record

> **Purpose:** get a concept or design record reviewed by a panel of
> distinct lenses before a human spends attention on it.
> **When:** any time one is drafted or substantially amended, and
> especially when the agent that would review it also wrote it.
> **Not a phase.** It is a tool used inside phases 1 to 3: carrying a
> concept into a design and its load-bearing architecture.

---

## What it is

`designomatic` runs N reviewers over a Markdown document, bundles their
feedback, has an editor apply it, and passes both through a scope gate and a
quality gate. Every participant reads the same **standard: the SDLC skills
themselves**, as provisioned on the machine, chosen by the document's kind:

| Kind | Where it lives | Judged as | Skills |
|---|---|---|---|
| Concept | `docs/concepts/` | unrestricted -- never asked for goals, seams, or feasibility, never converged | sdlc, concept, markdown |
| Design | `docs/design/` (and anything unplaced) | aspirational what-and-why, with load-bearing architecture | sdlc, design, architecture, markdown |
| As-built | `docs/arch/` | pure pragmatism -- only what is deployed | sdlc, architecture, markdown |

Each lens may add skills of its own (the architect applies architecture,
the operator release). **There is no fallback standard: a required skill
that is not provisioned stops the run** -- run `clai provision`, never
work around it.

The thing to understand before using it: **a persona is a stance, not a
standard.** A reviewer's lens decides which parts of the skills it presses
hardest on. It never decides what they say. So improving what the panel
catches is a matter of changing the skill, not of asking for a different
persona.

---

## When to reach for it

| Situation | Panel | Why |
|---|---|---|
| A concept you just wrote, before phase 2 opens on it | `concept-review` | Is the intent clear enough to design from? Judged as a concept, never converged |
| A design record you just drafted, before asking a human | `design-review` | The full pass, operability included. An author reviewing their own draft finds what they were already looking for |
| Seams named at phase 3, before requesting approval | `seam-review` | Narrow and cheap; asks only whether each axis of change maps to one seam |
| A draft that reads well but promises nothing checkable | `falsify` | Catches goals no implementation could violate, which cannot later show drift |
| An early sketch you are not sure is worth continuing | `stub-check` | One reviewer, one cycle |

**The strongest case is a document you wrote yourself.** You cannot review
your own draft: you will re-read your intent rather than the text. A panel of
distinct lenses is the cheapest correction available for that, and under a
subscription it costs quota rather than dollars.

Do **not** reach for it when:

- The document is APPROVED. It is frozen, and designomatic refuses it --
  cut a drift issue instead. -> the design skill
- You want code reviewed. That is the gates skill.
- You want to know what a document must contain. That is the concept,
  design, and architecture skills -- which are also exactly what the panel
  judges against, so reading them is never wasted.

---

## Using it

```bash
designomatic panels list --json      # what this repo defines; pick by name
designomatic personas list --json    # the lenses, and which file defines each
designomatic run docs/design/DESIGN.THING.md --panel design-review
```

Read the run banner. It prints the document kind, the skills, and their
digest -- that is what the panel judged against, and a finding is only
interpretable against it. If the kind is wrong, the whole review is.

| Flag | Use |
|---|---|
| `--panel <name>` | Exact. An unknown name fails preflight; panels are never guessed |
| `--kind concept\|design\|as-built` | Only when the path does not say what the document is |
| `--rubric PATH` | A repo-local supplement read after the skills: it may narrow them, never override them |
| `--guidance "..."` | Constrain the editor: "KISS, this is a prototype" |
| `--allow-frozen` | Amend an APPROVED record. **Human decision only** -- an agent never passes this |

---

## Reading the outcome

| Outcome | Meaning | Do |
|---|---|---|
| Committed | The document improved and the change is on a branch | Read the diff; it is a proposal, not an authority |
| Gate rejected | The editor overreached or produced a lateral change | Resume with guidance naming what to strip |
| Blocked | The pipeline succeeded but landing failed | Land the draft another way |
| Failed | Transport, timeout, or quota | Resume; artifacts are on disk under `.designomatic/runs/<id>/` |

**A run that reports failure usually has its output on disk.** Check the run
directory before concluding the work is lost.

**The panel's output is a proposal, not an approval.** designomatic cannot
mark a document APPROVED and neither can you -- only a human moves that
status. What a green run buys is that a human's first read is not spent on
what a panel would have caught.

---

## Extending it

Both extension points are repo-local and need no release:

- **A lens this repo needs** -- add `.designomatic/personas/<id>.yaml` with
  `optimizes_for`, `trades_away`, `blocks_when`, and optionally `defers_to`
  and the `skills` it applies. State a stance; state no rules. A persona
  naming required sections will contradict the skills the first time they
  move.
- **A panel** -- add to the `panels:` block of `.designomatic.yml`, with a
  `description` a calling agent can choose from and an advisory `phase`.

To change *what the panel catches*, change the skill, here in the Skills
repo: the skills are the standard for humans and the reviewer instructions
for the panel, deliberately the same text. A repo's own
`docs/design/STYLE-GUIDE.md` is no longer read by the panel. A rule only one
repo needs goes in a `--rubric` supplement (or a panel's `rubric:`), which
narrows the skills and never overrides them.
