# Design records -- phase links, drift detail, behavior rules

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when `SKILL.md` points to it.

Contents:

- Connecting Design Docs to Implementation
- Drift detail
- Behaviors rules and example
- A worked example before the freeze
- Why the record does not hold numbers
- The tracking issue and the merged-but-unshipped gap
- Why the retrospective moved out
- What the design says about bounds
- Why only the retrospective closes the loop
- Why a panel matters most for your own draft
- The two trees
- Why a design names no mechanism and no number

## Connecting Design Docs to Implementation

A design doc's value is realized when it drives implementation:

- **Architecture (phase 3):** once this record is merged, write
   `ARCHITECTURE.<name>.md` beside it: the seams, the module map, each
   Behaviors row's use-case signature, where each bound is carried, and
   operability, against the as-built in `docs/arch/`. It freezes once it
   is merged. -> the architecture skill
- **Planning (phase 3b):** break the design into test-first phases,
   recorded as task files under `tasks/` and ordered in the repo's root
   `TODO_PLAN.md`. -> the planning skill
- **Behaviors and Code (phases 4-5):** implement RED -> GREEN -> COMMIT
   against both records -- each RED test asserts a Behaviors row's Then,
   calling the use case the architecture record gives that row, by that
   signature. **Both records are frozen once merged** -- see Drift
   below
- **Retrospective (phase 8):** walk the doc against the code and file
   every divergence. Do **not** silently "update the doc to match". -> the
   retrospective skill

### Where this doc sits

```
docs/design/DESIGN.feature.md         (what it can and cannot do -- FROZEN once merged)
         |
         v
docs/design/ARCHITECTURE.feature.md   (how it intends to -- written against docs/arch/,
         |                             FROZEN once merged)
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

## Drift detail

This is a real failure mode, not a hypothetical. It happened here: an
implementation swarm rewrote the flag tables, deleted the data-model fields it
had chosen not to build, and converted the Open Questions into RESOLVED
entries -- inside a `+4574` feature PR where 87 lines of doc churn were
invisible. The rewritten doc no longer stated the security rule the code was
violating. It shipped.

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

## Behaviors rules and example

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

## A worked example before the freeze

**Run one worked example through it before it freezes.** A record that
specifies a protocol, a workflow or a state machine hides bugs prose review
does not see. A concrete instance makes every rule run, and so does
adversarial review of that instance. Porting g1n1's Panel to a runnable
workflow file and reviewing it found two contract bugs that prose review and
a six-lens audit missed. Attribute propagation through fork and join was
unstated. An enabling rule deadlocked work gates over input attributes.

## Why the record does not hold numbers

A policy value ("how long is it kept"), an appearance ("what is the tier
called"), or a tuning ("who is shown first") is neither a design decision
nor an architecture decision. The design says the value exists, is bounded,
and is a parameter, and names the bound in the problem's language ("sightings
are kept strictly shorter than mutuals"); architecture says which seam
carries it; the as-built records what it is set to. A number written into a
design record freezes a tuning as if it were a capability, and every retune
then reads as drift.

## The tracking issue and the merged-but-unshipped gap

**The open tracking issue carries the merged-but-unshipped gap.** A
merged record whose code is not yet released is not in the shared
architecture that `docs/arch/` describes; the issue stays open until the
retrospective lands. That is what lets the as-built stay strictly
factual instead of needing a "pending" marker.

The Implemented and Superseded states in full:

- **Implemented:** shipped, and its retrospective landed -- the
  PR carrying the retrospective merged and the tracking issue closed (the
  retrospective skill). The retrospective does not land, and does not
  close the tracking issue, while drift cut from it is open
- **Superseded:** the PR that lands the replacing record deletes the old
  one. The replacement cites it in Related Documents, by path and the
  commit that removed it; git history keeps it

## Why the retrospective moved out

It used to live here, which is why it got skipped: the freeze rule above
tells implementers not to be in this skill, so the one checklist that
closes the loop was hidden behind the rule that kept them out of it.

## What the design says about bounds

What the design does say about mechanism is nothing, and what it says
about bounds is that each exists and what constrains it: "sightings are
kept strictly shorter than mutuals", "the anonymity bound is at least the
scanner and one other". The architecture record places each bound in a
seam; the as-built records the value.

## Why a panel matters most for your own draft

This matters most for a document *you* drafted: reviewing your own draft
re-reads your intent rather than the text, and a panel is the cheapest
correction for that. -> the designomatic skill

## The two trees

| | `docs/design/` | `docs/arch/` |
|---|---|---|
| Describes | what we intend to build | what is deployed right now |
| Lifecycle | **body frozen once merged** | **living, never frozen** |
| Wrong when | rewritten to match the code | contains anything not yet shipped |

## Why a design names no mechanism and no number

A design that names a mechanism
has decided it before anyone reviewed the capability, and the freeze then
makes the mechanism unreviewable; one that names a number freezes a tuning
as if it were a capability, and every retune reads as drift.

## Why only the retrospective closes the loop

A green test suite and a clean review say nothing about whether you built what was designed. Only the retrospective does.
