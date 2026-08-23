---
name: concept
description: "Phase 1 of the SDLC: turning a human's rough intention -- a problem OR an aspiration -- into a statement of work and user stories under docs/concepts/<idea>/, so a phase 2 conversation opens knowing what is on the table and what is not. Concept expresses intent; it does not design or architect. Load when the ask is vague, novel, aspirational, or has nothing written behind it yet. Skip when a funded issue or an approved design record already frames the work."
---

# SKILL: Concept (Phase 1)

> **Purpose:** get what is in the human's head onto disk, at full width,
> before anything hardens.
> **Deliverable:** `docs/concepts/<idea>/` -- a statement of work, and user
> stories.
> **Exit gate:** a human funds it.
> **Next:** the design skill (phase 2).

Concept is the only phase where being wrong costs nothing. Every later
phase is more expensive to reverse: a design record gets reviewed, an
architecture gets coded against, a release gets deployed. Spend the
cheapness here.

## What a concept is

A concept is an **intention**, expressed. Two kinds arrive, and both are
legitimate:

| Kind | Sounds like | What it needs to be worth capturing |
|---|---|---|
| A problem | "flagging a page takes four clicks and nobody does it" | nothing more than the observation |
| An aspiration | "reading fiction here should be as good as playing" | nothing more than wanting it |

Concepts are **not completed thoughts.** Aspirations are **not necessarily
achievable.** Neither fact is a defect to be corrected in this phase.

Three rules follow from that, and they are the whole discipline of phase 1:

1. **Never filter for feasibility.** "We cannot do that" is a phase 2
   sentence. An unachievable want is still the most accurate statement of
   what the human is after, and design needs it in order to find the
   reachable thing next to it. Write it down as said.
2. **Never converge.** The pull toward "so here is the answer" is strong,
   and it is the failure mode of this phase. Half-formed is a valid state
   for a concept to be in when the session ends.
3. **Never decide.** You may record what the human decided in front of
   you. You may not decide anything on their behalf, including what is out
   of scope.

## What a concept is not

**It is not design, and it is not architecture** -- unless the idea is
literally about design or architecture, in which case it is a concept
*about* structure and still does not settle any of it.

| Anti-pattern | Why it is wrong here |
|---|---|
| Mechanism -- components, tables, columns, ports, vendors, endpoints | Concept says what someone experiences and what must be true. The moment it says *how*, phase 2 inherits a decision nobody reviewed. |
| Goals / Non-Goals / Rejections | Those are design's sections, derived in phase 2 *with* the human. A concept that lacks them is finished, not incomplete. |
| A design record "while I am here" | A doc that skipped review reads as approved later. |
| Production code | Concept code answers one question and then dies. See Spikes. |
| Scope | What is in and out is a phase 2 conversation. Concept widens; design narrows. |

The mechanism ban has one honest edge: naming an existing part of the
system to locate the idea ("this would sit next to the wiki page") is
placement, not design. Choosing what to build it out of is design.

## The deliverable

```
docs/concepts/<idea>/
    CONCEPT.md              the statement of work
    STORIES.<theme>.md      user stories, one file per theme
```

`docs/concepts/` is the fleet default; a repo's `AGENT.md` may name a
different home and wins if it does. The tree is **disposable** -- unfunded,
non-binding, never frozen, and nothing downstream may cite it as authority.
It is neither `docs/design/` (intent, frozen at APPROVED) nor `docs/arch/`
(fact, living).

### CONCEPT.md -- the statement of work

High level. A few pages at most, and mostly the idea itself.

```markdown
# <Idea>

> **Phase:** 1 -- CONCEPT. Unfunded, non-binding, not a design record.
> **Date:** <date>  **Author:** <human> (captured with AI assistance)

## The idea

The aspiration or the problem, in the human's voice. A few paragraphs.
This is the document; everything else is index and residue.

## Story sets

| File | Theme |
|---|---|
| STORIES.<theme>.md | one line on what holds this set together |

## Notes

What the human settled while talking, what is still open, and anything the
idea leans on that does not exist yet. A few lines each, or nothing.
```

**Three headings. Add a fourth only when the idea genuinely needs it** -- a
definition the whole idea turns on ("a story has an arc; lore is
reference"), or a worked example. Never add one to be thorough, and drop
any that has nothing real in it.

**A subject that belongs to design does not get a section here, even a
sketch one.** Licensing, rights, money, permissions, moderation mechanics:
if the idea touches one, that is a sentence inside The idea, or a story, or
a line in Notes. A heading of its own turns a want into a half-design that
nobody reviewed -- and it is the most common way this artifact goes wrong.

Say which things the human settled and which are still open. That is the
only bookkeeping this document owes anyone: design needs to know which
sentences are the human's and which are nobody's yet.

### STORIES.<theme>.md -- the user stories

Stories are how an intention becomes legible without becoming a design.
Each is one sentence in the form:

> As a `<role>`, I can `<do or experience something>`.

- **Role first.** Naming the roles is most of the work -- author, reader,
  moderator, complainant, the AI itself. Roles generate stories; a story
  with no role is a requirement in disguise.
- **Experience only.** "As a reader, I can see where the fiction differs
  from canon" -- not "an AI diff service renders a delta view."
- **Aspirational stories stay in.** If a story may not be buildable, keep
  it and say so in the concept's Notes. Deleting it deletes the intent.
- **A story is not an acceptance criterion.** Criteria are phase 4, derived
  from an approved design, and they are testable. These are not.

**A theme is whatever holds a set together** -- a surface (authoring,
reading), a process (flagging, take-down, disputes), or a rule that cuts
across all the others (what the AI may and may not do). Group by what the
human keeps circling back to, then show them the grouping: the split
itself is a finding, and it usually previews how the work divides into
design records later.

## Running a concept session

The input to this phase is a human's head, so eliciting well *is* the
skill:

- **Ask about the experience, never the mechanism.** "What does the reader
  see?" gets you a concept. "Where would we store that?" gets you a bad
  design.
- **One question at a time, in plain text.** No option menus, no
  multiple-choice widgets. Ask, then wait.
- **Play it back in their words**, not yours. If you find yourself
  improving their phrasing, you are already converging.
- **Follow their energy.** The part they keep returning to is the concept;
  the part you find structurally interesting usually is not.
- **Write down what they settle, the moment they settle it**, and read it
  back. That is what "Settled in session" is.
- **Stop when they stop.** A template with empty sections is not a reason
  to keep asking. Drop the sections instead.

Ask about scope only to *record* an answer the human volunteers. Never
prompt for one.

## Spikes

Throwaway code that answers one question is legitimate here, under three
conditions:

1. **One question, written down first.** "Can Workers stream through a
   Durable Object?" -- not "explore Workers."
2. **Time-boxed and deleted.** The code dies; the finding is what you
   keep.
3. **The finding is evidence, not spec.** A spike proves something is
   possible, never that it is the design. Re-derive in phase 2.

Record the finding in the concept's Notes, or on the issue -- wherever
the next phase will actually read it.

## Entering mid-flow

**You will not always arrive at phase 1 with phase 1's inputs, and the
phases downstream will not always get phase 1's outputs.** Treat every
input as hoped for, never assured:

| You find | Do |
|---|---|
| No concept, but a funded issue or an approved design | Concept has elided. Go to phase 2; do not reconstruct a concept to fill a slot. |
| A concept with a statement of work and no stories, or stories and no statement of work | Valid. Work with what is there; add the other half only if the human wants it. |
| A concept that already contains design or mechanism | Do not rewrite history. Note in phase 2 that those parts were never reviewed, and re-derive them there. |
| A half-written design record and the human wanting to back up and think | Open a concept beside it. Backing up is allowed; deleting the design record is not yours to do. |
| An idea arriving mid-implementation | Capture it as a concept and keep it out of the running work. New intent does not get to edit a frozen design. |

The phase is defined by what it is *for*, not by a complete file set.

## Exit gate

Concept ends when a human funds the work -- an accepted issue, or an
explicit "go design it." Not before, and not by your own judgment that it
is ready.

**Concept elides entirely when the work starts from an accepted issue.**
An issue someone already agreed to *is* a funded intention; do not re-run
the phase to produce what you were handed.

An unfunded concept is not a failure. It stays on disk, costs nothing, and
is picked up or dropped later. Do not chase it to a decision.

## Handoff to design

Phase 2 opens by reading the concept, and the concept's job is done the
moment that conversation can start well. Design **converts**; concept does
not pre-convert.

| Concept holds | Phase 2 turns it into | Who does the turning |
|---|---|---|
| The idea | Overview | the agent, from the text |
| Aspirations and stories | Goals, and what is deliberately deferred | the human, in conversation |
| What the human settled | Key Decisions rows | the agent, citing the concept |
| What is still open | Open Questions | the agent |
| What the idea leans on | dependencies and sequencing | the agent |
| Alternatives the human dismissed aloud | Rejections | the agent, from the record |

Nothing in that table is owed by phase 1. A concept with no Goals, no
Non-Goals and no Rejections has not failed to finish -- those are outputs
of the phase 2 conversation, and manufacturing them here hands the human a
decision they never made.
