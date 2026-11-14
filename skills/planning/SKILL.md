---
name: planning
description: "Phase 3b of the SDLC, the epilogue to architecture: turning an approved design plus the as-built into a phased, test-first (RED->GREEN->COMMIT) route; produces task files under tasks/ sequenced with blocked_by, plus the ordered Now list in the repo's root TODO_PLAN.md -- never a standalone plan document. Skip when just maintaining existing tasks or the plan (todo-plan) or making a single small change (coding)."
---

# SKILL: Implementation Planning (Phase 3b)

> **THIS SKILL PRODUCES TASKS, NOT A DOCUMENT.** The phased route you
> build here is recorded as **task files under `tasks/`** -- one per unit
> of work that ends in a commit, sequenced with `blocked_by`. The repo's
> root `TODO_PLAN.md` gains only the ordered "Now" list naming the next
> three to seven of them. Never a standalone or per-feature plan document.
> The todo-plan skill is authoritative on the task schema, IDs, edges, and
> the plan file's shape. This skill covers only the *methodology* of
> breaking work into testable, committable phases. Where the template
> below reads like a standalone document, treat it as the shape of your
> *thinking*: its content is distributed across task files, not written
> into one. If the repo instead has a legacy mono-file (a `TODO.md` or
> `BUGS.md`, or a `TODO_PLAN.md` carrying task bodies), migrate it into
> `tasks/` first, per the todo-plan skill, before authoring the route.

> **Purpose:** Create resilient, BDD-driven implementation plans that fight compact amnesia
> **When to use:** After the architecture phase has named the seams, before any behavior is written
> **Learned from:** Pantry TODO_PLAN (excellent) vs CR-MAGIC TODO_PLAN (poor)

## Planning needs two endpoints

A plan is the **route from where you actually stand to where the design
says you are going.** It needs both:

- **The target** -- the approved design record (what and why) and the
  approved architecture record (how it intends to), both in `docs/design/`.
- **The start** -- the as-built (`docs/arch/`). What is really there now.

That is why this phase is an epilogue to architecture rather than a
prologue to the tests: **a route computed without the as-built is
fiction**, because it plans against an imagined codebase. Read both before
writing a single phase.

It is also why this is where scope gets cut. Planning is the first phase
that meets real code, so it is the first phase where cost is real. A phase
count that grew when you looked at the actual tree is the process working,
not a failure -- say so out loud rather than quietly padding the estimate.

Architecture and planning elide **together** or not at all. -> the
architecture skill

---

## Core Philosophy: Test-First, Commit Often, Document Always

**The Pillars of Amnesia-Resistant Planning:**

- **RED -> GREEN -> COMMIT** -- Never implement without a failing test first
- **Small Steps** -- Each step = ONE test passing = ONE commit (not 7 features)
- **Learning Checkpoints** -- Force documentation of discoveries every 2-3 commits

**Why this matters:**

- Compact amnesia can strike mid-phase
- Last commit message = breadcrumb trail back to context
- Failing tests = clear "what's next" signal
- Learning notes = preserved decision context

---

## Anti-Patterns to AVOID [NO]

### Implementation-First Planning

**BAD (Implementation-First):**
```markdown
### Step 1.2: Implement Action Execution Logic

- [ ] START_AGENT -> calls AgentClient.run()
- [ ] RESUME_AGENT -> calls AgentClient.resume()
- [ ] TERMINATE_AGENT -> calls AgentClient.terminate()
- [ ] START_POLLING -> calls CommentClient poll loop
- [ ] DO_PROMOTION -> calls promotion flow
- [ ] PROMPT_HUMAN -> displays banner, reads input
- [ ] CLEANUP -> releases locks, saves state

**Commit Point:** feat(component): implement all action handlers
```

**Problems:**

- 7 features before commit = hours of work
- No tests mentioned
- If amnesia hits mid-list, must re-read all code to figure out state
- "Implement then test" encourages skipping tests

### Coarse Commit Granularity

**BAD:**
```markdown
**Commit Strategy:**

- After each phase completes
- After test suites pass
```

**Problems:**

- "Phase" = 5-10 steps = hours of work
- "Test suites" = when? After all 20 tests? Or each?
- No recovery points mid-phase

### Vague Acceptance Criteria

**BAD:**
```markdown
**Acceptance:**

- RunController can start, drive FSM, execute actions
- State persisted before mutations
- Graceful shutdown works
```

**Problems:**

- How do you verify? Manual testing?
- Not test-driven
- Subjective ("works" = ???)

### Missing Amnesia Recovery Protocol

**BAD:**

- No "how to resume" section
- No explicit connection between commits and TODO steps
- No guidance on reading context from last session

---

## The BDD TODO_PLAN Template [OK]

The shape of the thinking a plan must cover, not a file template: a
philosophy and recovery section (into `TODO_PLAN.md`), phases of test-first
steps (each a task file under `tasks/`, sequenced with `blocked_by`), a
definition of done, and the ordering (its Now list). The todo-plan skill
says where each part lives.

Read `references/templates-and-examples.md`, "The BDD TODO_PLAN Template [OK]", for the full structure, when you lay out a plan.

## Key Principles Explained

### RED -> GREEN -> COMMIT Cycle

**Always follow this sequence:**

- **Write test (RED)**: Test fails because feature doesn't exist
- **Implement feature (GREEN)**: Make test pass with simplest code
- **Commit (CHECKPOINT)**: Save progress with clear message
- **Repeat**: Next test

**Why:**

- Each commit is a recovery point
- Commit message = "I just made test_X pass"
- If amnesia hits, last commit tells you exactly what works

**Example commit sequence:**
```
test(auth): add password validation test (RED)
feat(auth): implement password validation (GREEN)
test(auth): add email format test (RED)
feat(auth): implement email validation (GREEN)
docs(auth): update TODO with validation learnings
```

### One Test = One Commit

**NOT:**
```markdown

- [ ] Implement all validators
- [ ] Test all validators

Commit: feat(auth): implement all validation
```

**YES:**
```markdown

- [ ] Write test_password_length (RED)
- [ ] Implement password_length validator (GREEN)
  -> Commit: feat(auth): add password length validation (GREEN)

- [ ] Write test_email_format (RED)
- [ ] Implement email_format validator (GREEN)
  -> Commit: feat(auth): add email format validation (GREEN)
```

### Learning Checkpoints Every 2-3 Commits

**Trigger checkpoint when:**

- 2-3 tests have passed (2-3 commits)
- 30+ minutes elapsed
- You make a significant discovery
- You change approach

**What to capture:**

- **What worked:** "Using pytest fixtures simplified test setup"
- **What was hard:** "Mock data generation was tedious"
- **Discoveries:** "Found existing helper in utils.py"
- **Decisions:** "Chose regex over parser for simplicity"
- **Next time:** "Start with property-based tests earlier"

**Why:**

- Preserves context across sessions
- Prevents re-learning same lessons
- Shows progress even if amnesia hits

### Explicit Amnesia Recovery Protocol

**Include this section in EVERY TODO_PLAN:**

```markdown
## RESUMING AFTER COMPACT AMNESIA 

If you lose context mid-session:

- **Check last commit:** `git log -1 --oneline`
- **Read commit message:** Tells you what test passed
- **Check `TODO_PLAN.md`'s Now list**, then open that task file: find
   where you were, see what is next
- **Run tests:** `[test command]` -- what's still RED?
- **Read last learning checkpoint:** Context of decisions made
- **Continue from next RED test**
```

**Why:**

- Explicit recovery procedure
- Assumes zero memory retention
- Treats TODO_PLAN as external memory

---

## Testing Philosophy Guidelines

### Test Separation (Copy from Pantry)

Always include this in TODO_PLANs:

```markdown
## Testing Philosophy (CRITICAL)

### Test Separation (Strict)

**Separate buckets -- never mix:**

- **Unit Tests** (`tests/unit/**/*.test.[ext]`)
   - Run with: `[command]`
   - Environment: `[test env]`
   - All external dependencies MOCKED
   - **Timeout: 250ms default** (enforced)
   - **NO sleep(), NO wall-clock dependencies**
   - Deterministic, fast, isolated

- **Integration Tests** (`tests/integration/**/*.test.[ext]`)
   - Run with: `[command]`
   - Real external services
   - Longer timeout allowed (30s default)
   - Still NO sleep() - use await on real operations

- **E2E Tests** (`tests/e2e/**/*.test.[ext]`)
   - Run with: `[command]`
   - Full system test
   - Slowest, most realistic
```

### No Sleep Policy

Always include:

```markdown
### No Sleep Policy (Absolute)

**NEVER use `sleep()`, `setTimeout()`, or wall-clock delays in tests.**

**Instead:**

- Mock timers: `vi.useFakeTimers()` (JS); in Python prefer DI of a Clock, or `time-machine` in integration tests (never `freezegun` -- see the testing-python skill)
- Mock async operations: Return resolved promises immediately
- Use `await` on real async operations (integration tests only)
```

---

## Language-Specific Adaptations

Python and TypeScript wording for the test-separation section.

Read `references/templates-and-examples.md`, "Language-Specific Adaptations", for the stack you are planning in.

## Commit Message Format

### Standard Format

```
<type>(<scope>): <subject> (<test-status>)

<type>: test | feat | fix | docs | refactor
<scope>: module/component name
<subject>: what changed (imperative mood)
<test-status>: (RED) | (GREEN) | omit for docs/refactor
```

### Examples

**Writing tests:**
```
test(auth): add password validation test (RED)
test(github): add comment classification tests (RED)
test(workspace): add lock acquisition test (RED)
```

**Implementing features:**
```
feat(auth): implement password validation (GREEN)
feat(github): implement comment classifier (GREEN)
feat(workspace): implement lock acquisition (GREEN)
```

**Learning checkpoints:**
```
docs(auth): update TODO_PLAN with validation learnings
docs(github): update TODO with polling strategy decisions
```

**Why this format:**

- `(RED)` = "I wrote a failing test, didn't implement yet"
- `(GREEN)` = "I made a test pass"
- No status = meta work (docs, refactor)
- On amnesia recovery, grep for `(RED)` to find unfinished work

---

## Phase Structure Template

Each phase states its goal in one sentence, then test-first steps,
each with acceptance criteria, and a learning checkpoint.

Read `references/templates-and-examples.md`, "Phase Structure Template", for the template to copy for each phase.

## Checklist: Before Starting Implementation

Use this checklist before creating TODO_PLAN:

- [ ] Read design doc thoroughly
- [ ] Identify all major components/features
- [ ] Identify the axes of change (what is likely to change); each maps to one seam -- a port, policy, or parameter -- and the seam gets its own test-first step. Do not plan single-impl-forever ports (YAGNI). See the coding skill, Section 1.
- [ ] Break each feature into testable behaviors
- [ ] Walk each task's use cases against the use-case surface (the architecture skill, Give each behavior its use case (the use-case surface)): every port, parameter and value a signature takes is built in that task or in one on its `blocked_by` chain, and the task's acceptance runs only through what that chain has built. Most defects three plan reviews found on one route (tds-utils PR#606) were a use case, an adapter binding or an acceptance command one task ahead of what builds it
- [ ] The task that writes the component's first test also names the CI job, or the existing job's scope, that runs it under `gate` (the gates skill), and lands it before that task's first GREEN commit; otherwise `gate` stays green while nothing runs the tests, until a later integration task adds the job (tds-utils PR#608)
- [ ] Estimate: 1 behavior = 1 test = 1 commit
- [ ] Group behaviors into phases (2-5 commits per phase)
- [ ] Add learning checkpoints every 2-3 commits
- [ ] Write amnesia recovery protocol
- [ ] Include test philosophy section
- [ ] Define acceptance criteria as passing tests
- [ ] Pre-write commit messages
- [ ] Estimate total commits (each = 15-30 min)

---

## Quality Standards

### Good TODO_PLAN Metrics

**Commit granularity:**

- [OK] 1 commit per test passing (ideal)
- [WARN] 2-3 commits per feature (acceptable)
- [NO] 1 commit per phase (too coarse)

**Phase size:**

- [OK] 2-5 steps per phase (ideal)
- [WARN] 6-8 steps per phase (acceptable)
- [NO] 10+ steps per phase (too large, split it)

**Learning checkpoints:**

- [OK] Every 2-3 commits (ideal)
- [WARN] Every phase (minimum)
- [NO] Only at end (insufficient)

**Recovery time:**

- [OK] Can resume in <5 min from last commit (ideal)
- [WARN] Can resume in <15 min (acceptable)
- [NO] Must re-read all code (plan failed)

---

## Common Pitfalls

### "I'll write tests later"

**Problem:** Never happens, technical debt accumulates
**Solution:** Make tests block implementation (RED first)

### "This is too small for a commit"

**Problem:** Commit granularity too coarse, amnesia recovery hard
**Solution:** Commit every test that passes, no matter how small

### "I'll document at the end"

**Problem:** Context lost, learning notes incomplete
**Solution:** Learning checkpoints are mandatory steps

### "Acceptance criteria are obvious"

**Problem:** Subjective, not test-driven
**Solution:** Acceptance = specific tests passing

### "Phase 1 is complex, has 12 steps"

**Problem:** Too large, no recovery points
**Solution:** Split into Phase 1A, 1B, 1C (4 steps each)

### "This unknown blocks the work"

**Problem:** An open question gates building when its answer changes only whether the built thing succeeds at run time
**Solution:** An unknown blocks a step only when its answer changes what gets built; otherwise build, then test the answer

---

## Examples

A good phase is small and test-first; a bad one is large and
implementation-first.

Read `references/templates-and-examples.md`, "Examples", for one of each.

## Summary: The Golden Rules

- **Tests FIRST** -- Write failing test before any implementation
- **One test, one commit** -- Each passing test = checkpoint
- **Small phases** -- 2-5 commits max per phase
- **Learning checkpoints** -- Document every 2-3 commits
- **Amnesia protocol** -- Explicit recovery instructions
- **Clear acceptance** -- Acceptance = tests passing, not vibes

**Remember:** You're writing for a future version of yourself with zero memory. Make it impossible to get lost.

---

## Template Checklist

Before publishing TODO_PLAN, verify:

- [ ] BDD/TDD philosophy section present
- [ ] Testing philosophy section present (with timeouts, no-sleep)
- [ ] Amnesia recovery protocol present
- [ ] Each phase has 2-5 steps maximum
- [ ] Each step = 1-2 commits (not 7)
- [ ] All steps have explicit commit messages pre-written
- [ ] Learning checkpoints every 2-3 commits
- [ ] Acceptance criteria = specific tests passing
- [ ] Definition of Done section present
- [ ] Progress tracking section present
- [ ] Language-specific test commands included

**If any checkbox is unchecked, revise the plan before starting work.**
