---
name: concept
description: "Phase 1 of the SDLC: exploring a problem before any design doc exists -- free-form notes, throwaway spikes, framing the problem so a human can decide whether to fund it. Exit gate: someone funds it. Load when the ask is vague, novel, or has no issue behind it yet. Skip when the work starts from an accepted issue (concept elides) or an approved design doc already exists (design)."
---

# SKILL: Concept (Phase 1)

> **Purpose:** think in public, cheaply, before anything hardens.
> **Exit gate:** a problem statement a human will fund.
> **Next:** the design skill (phase 2).

Concept is the only phase where you are allowed to be wrong at no cost.
Every later phase gets more expensive to reverse: a design doc gets
reviewed, an architecture gets coded against, a release gets deployed.
Spend the cheapness here rather than discovering the problem was
misframed in phase 5.

## What this phase produces

**A problem statement, not a solution.** The deliverable is enough shared
understanding that a human can say "yes, build that" or "no, that is not
the problem." Concretely, one of:

- A GitHub issue stating the defect or the opportunity.
- A free-form note in the session, or a scratch file the human asked for.
- A spike: throwaway code that answers one question, then dies.

Nothing here is spec. Nothing here is binding. That is the point.

## What this phase must NOT produce

| Anti-pattern | Why it is wrong |
|---|---|
| A design doc "while I am here" | A doc that skipped review reads as approved later. Design has its own phase and its own gate. |
| Production code | Concept code exists to answer a question. If it survives to phase 5 it arrived without a design, a plan, or a test. |
| A settled decision | You may *recommend*. Deciding is the human's move at the exit gate. |
| Scope | Concept frames a problem. What is in and out is a Goals/Non-Goals question, and that is phase 2. |

## Spikes

A spike is legitimate and useful, under three conditions:

1. **One question.** Write the question down before you start. "Can
   Workers stream a response through a Durable Object?" -- not "explore
   Workers."
2. **Time-boxed and thrown away.** Say up front what you will spend. When
   it is done, the code is deleted; the *finding* is what you keep.
3. **The finding is evidence, not spec.** A spike proves something is
   possible, not that it is the design. Re-derive the design in phase 2.

Record the finding where the next phase will read it -- a comment on the
issue, or the design doc's Open Questions once one exists.

## Framing the problem well

The best concept work is almost entirely about the problem statement:

- **State the symptom and its impact**, with evidence. What is observably
  wrong or missing, for whom, and how often.
- **Name what you do not know.** An honest unknown is worth more than a
  confident guess; it becomes an Open Question in phase 2.
- **Sketch alternatives, plural.** A single option presented alone is not
  a choice. Two or three, each with its one-line cost, lets the human
  actually decide -- and the discarded ones become the design doc's
  Rejections section, which is what stops them being relitigated later.
- **Do not converge early.** The pull toward "here is the answer" is
  strong and it is the failure mode of this phase.

## Exit gate

Concept ends when a human funds the work -- an accepted issue, or an
explicit "go design it." Not before.

**Concept elides entirely when the work starts from an accepted issue.**
An issue someone already agreed to *is* a funded problem statement; do not
re-run the phase to produce what you were handed. Go to phase 2.

## Handoff to Design

The design doc inherits from concept:

| Concept produced | Lands in the design doc as |
|---|---|
| The problem statement | Overview |
| What success looks like | Goals |
| What you deliberately left out | Non-Goals |
| Alternatives you sketched and dropped | Rejections |
| Honest unknowns | Open Questions |
| Spike findings | Evidence cited by Key Decisions |

If concept produced none of these, it has not finished.
