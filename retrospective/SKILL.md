---
name: retrospective
description: "Phase 8 of the SDLC, and the only thing that closes the loop: walking the frozen design against the shipped code, cutting drift issues, appending Key Decisions, recording lessons in TODO_PLAN.md, and handing the status transition to a human. Load whenever an implementation lands -- green tests and a clean review are not the end of the work. This phase never elides, including when the change shipped nowhere."
---

# SKILL: Retrospective (Phase 8)

> **Purpose:** find out whether you built what was designed, and turn what
> you learned into something the next agent will actually read.
> **Runs:** after Release (and 7a), in a **docs-only PR separate from the
> feature PR**.

**A green test suite and a clean bot review say nothing about whether you
built what was designed.** Only this phase does. It is not optional, it is
not "if there is time," and it does not elide.

This phase used to live inside the design skill, where the freeze rule
told implementers not to be. That is why it was skipped: the one checklist
that closes the loop was hidden behind the rule that kept you out of it.

---

## The checklist

Work through all six. A docs-only PR, never bundled into the feature PR --
doc changes buried in a large code diff do not get read, and that is
exactly how unreviewed decisions ship.

### 1. Cut drift issues

Walk the design doc section by section against the code. Every divergence
gets an issue, with `file:line` and a concrete consequence. Cross-link them
so the set is reviewable together.

| Kind | Example | Action |
|---|---|---|
| Spec'd but not built | A registry entry, a field, an enum variant you dropped | Issue |
| Built but not spec'd | Security flags, a new error type, a timeout policy | Issue **and** record it in `docs/arch/` (phase 7a) |
| Rule violated | Doc says "fail closed, exclude X"; you shipped X anyway | Issue, flagged as a **decision needed** -- the dangerous kind |
| Shape changed | Fields merged, split, or moved from data to behavior | Issue **and** record it in `docs/arch/` |
| Provisional resolved | Doc marks flags "provisional, verify at implementation time" | **Not drift** -- the doc told you to. Record the verified values |

**Recording and accusing are different acts.** For anything the code does
that the design never specified, the as-built records it as fact (that is
its job) *and* an issue asks whether it should have been designed. Doing
only the first launders an unreviewed decision into apparent architecture;
doing only the second leaves the as-built lying by omission.

The "rule violated" row matters most. If your implementation breaks a
stated constraint -- especially a security constraint -- say so out loud in
its own issue, framed as a decision for a human. **Do not soften the rule
in the doc so the code conforms.**

### 2. Append Key Decisions

The design doc's Key Decisions table is an append-only decision log, and it
is the *only* section an implementer may touch:

- **Append only.** Never rewrite or delete an existing row. A reversed
  decision gets a new row saying so, with the reason.
- **Each row cites its authorizing issue.** If nothing authorized it, it is
  drift -- file it first, then the issue is the citation.

Every other section is frozen until a human amends it. -> the design skill

### 3. Record lessons learned

Record what surprised you, what bit you, what the next agent must not
repeat -- **at the narrowest layer whose readers need it** (the sdlc
skill, law 15). A lesson that is already settled goes straight to its
durable layer: a code comment for a file-local implementation trap,
`docs/arch/` for a component constraint, the repo's `AGENT.md` for
something every session in the repo must know first, a shared skill for
a fleet-universal lesson. `TODO_PLAN.md`'s Lessons Learned takes only
what is still *unsettled* about the work in progress. An issue is never
a lesson's home: issues are transitory and vanish when the root cause is
fixed.

**A lesson needs the mechanism, not the symptom.** "X inherits the global
config and starts OAuth flows" beats "X was noisy." The symptom tells the
next agent they will suffer; the mechanism tells them how to avoid it.

Good lessons share a shape: *what you expected, what actually happened, and
the causal reason for the gap.* If you cannot state the third part, you
have not finished diagnosing -- say so honestly rather than writing a
lesson that only records confusion.

### 4. Record discovered issues

Anything you found that is *not* drift: pre-existing bugs, deferred work
the doc names as future, follow-ups you chose not to do. File them. Do not
leave them in a PR description, where they die when the PR merges.

### 5. Update TODO_PLAN

Mark the phase shipped, and list the outstanding drift issues under it, so
the work stays **visibly incomplete** until they are settled. -> the
todo-plan skill

### 6. Hand off the status transition

**Only a human moves a design doc to IMPLEMENTED**, and only once the drift
issues are closed. IMPLEMENTED means shipped, as-built updated, drift
closed -- so the status is a lie while drift is open, and an implementer
never marks its own work implemented.

State plainly in the handoff: what shipped, what drifted, what is still
open, and that the transition is the human's call.

---

## The virtuous cycle

The retrospective is not an archive. Its output is the input to the next
loop, and each artifact has a destination that determines whether anyone
ever reads it:

| What you learned | Where it goes | Which phase reads it |
|---|---|---|
| The design was wrong about the problem | An issue, or a new concept note | 1 Concept |
| A decision needs revisiting | Design doc Key Decisions + an issue | 2 Design |
| The shape of the code fights us | `docs/arch/` "lessons the shape taught us" | 3 Architecture |
| An estimate was badly off | `TODO_PLAN.md` Lessons Learned | 3b Planning |
| A test class was missing | The testing skill, or the repo's test conventions | 4 Behaviors |
| A gate missed something it should have caught | The gates skill, or the repo's CI config | 6 Gates |

**Context goes where the work will read it, not into a session summary.**
A session gets archived and nobody re-reads it. Something the person
picking up issue #N needs is a comment on #N; something about the repo's
conventions goes in its agent instruction file; something about how agents
should work goes in the relevant skill.

**An issue routes work; it never holds a lesson.** Issues are transitory
-- they vanish the moment the root cause is addressed, taking anything
parked in them along. The rows above that point at an issue are routing
*pending decisions and work*; the lesson itself, once settled, lives at
its layer (the sdlc skill, law 15).

**When the same lesson recurs, the lesson is not the deliverable -- the
skill change is.** A third repetition means the doctrine is wrong or
missing, not that agents keep being careless. Propose the change.

---

## Exit gate

The loop is closed when: every divergence is filed, Key Decisions cites its
authorizations, `TODO_PLAN.md` carries the lessons and the open drift, and
a human has what they need to rule on the status transition.

Shipping code is not the same as shipping what was designed.

## Related

- the design skill -- the frozen doc this phase walks against
- the architecture skill -- phase 7a, which records what this phase accuses
- the todo-plan skill -- where lessons and open drift live
- the github-workflow skill -- issue anatomy for the drift issues you cut
