---
name: testing
description: "Phase 4 of the SDLC: writing or reviewing tests in any language -- universal principles -- no hanging tests, no real I/O or sleeps in unit tests, skip (never xfail) anything that might hang, fakes over mocks, RED tests fail because code doesn't exist (never placeholder assertions). Pair with the language-specific testing skill."
---

# Testing Standards (Phase 4: Behaviors)

This document defines **universal testing principles** applicable across all languages,
frameworks, and projects. It is written for coding agents and must be followed exactly.

## Where behaviors come from

Phase 4 is not "write some tests." It is the phase that turns the two
approved artifacts into executable claims, and there are **three distinct
sources**. A suite drawn from only some of them has a predictable blind
spot.

**Use-case behaviors** come from the design record's Behaviors table (the
Given/When/Then) joined to the architecture record's use-case surface (the
application-layer function that carries each row and the ports it takes),
and they are the tests that are kept. The RED test calls **that function by that signature**,
with an in-memory fake behind each port the row lists, and asserts on the
domain value it returns or the fake it wrote to. It does not go through
the CLI or the HTTP route in front of the use case (that is an entry-point
test, and thin entry points rarely need one), and it does not reach past
it into a helper (that is a domain test, below). Driving the use case
directly is what makes the test survive a rewrite of either neighbour.

> Row: "an unreadable verdict never fails a clean PR" ->
> `judge_assertion(assertion, completion=FakeCompletion(returns=garbage))`
> returns a Verdict that is `inconclusive`, not `fail`.

**A row that states a rule over inputs is not pinned by its example.**
"Placement respects a lock" was pinned by one fixture whose inputs already
sat where the rule sends them, so it passed while the rule was false
(tds-utils Issue#423). Such a row needs a property test, or at least the
adversarial case -- the input the rule exists to redirect -- not the
illustrative one.

**Domain rules** come from Design and Data Model: the pure functions and
invariant-bearing types the use cases call. Their tests take values and
assert on values, with **no fake at all**. A domain test that needs a fake
is a Purity test failure in the code, not a gap in the test kit.

**Design goals** still count. Each Goal is a testable success criterion by
construction -- that is why the design skill demands Goals be verifiable.
Most goals are already covered by a use-case row; one that is not is
either a missing row (add it, before approval) or a cross-cutting
property (latency, a security rule, a state-machine transition) that gets
its own test. Each Non-Goal is worth a test only where its violation would
be silent.

**Architect behaviors** come from the seams named in phase 3. These are
the mechanical tests of the coding skill, Section 1.2, written as real
test cases rather than left as review-time opinions:

| Architect behavior | The test |
|---|---|
| Grep | the core names no vendor, SDK, `fetch`, `process.env`, `fs`, or model string |
| Swap | a second implementation registers behind the seam with zero core edits |
| Arrow | every import crosses inward |
| Trace | every row of the design's Behaviors table resolves, through the architecture record's use-case surface, to one exported application function with that signature |
| Purity | no domain module imports a port or takes a callable that does I/O |
| Wiring | the composition root builds with every port faked |
| Decision | each named decision resolves in one place, in the problem's language |
| Language | every noun in a use-case signature is defined in the design, under one spelling |

These are cheap, durable, and catch the failure that unit tests never
will -- a leak into the core reads as a passing test suite right up until
the day you need the seam. Write them in phase 4 like any other RED test.

**A RED test fails because the behavior does not exist yet** -- never
because of a placeholder assertion.

**Derive the whole list here; go RED one behavior at a time.** Enumerating
every design and architect behavior is phase 4's thinking, and doing it up
front is what stops you discovering scope in phase 5. Writing all of those
tests before any of them goes GREEN is a different thing, and it is a
test-first waterfall: the earlier behaviors sit implemented while the later
ones sit failing, and no commit is ever one behavior wide. Enumerate the
list, then loop phases 4-6 per behavior -- RED, GREEN, COMMIT.

For framework-specific standards, load the companion skill matching the code
under test -- and only that one:

- the testing-node skill -- Node.js / TypeScript outside Nuxt
- the testing-nuxt skill -- Nuxt 4 / Vue 3 (incl. Playwright E2E)
- the testing-python skill -- Python / pytest

Skip companions whose stack the repo does not use; never cite or follow a
pointer to a standard the repo has no code for (a bash-only repo needs none
of the three).

---

# Goals and Principles

### Test Behavior, Not Internal Implementation (Black Box)

- Test visible behavior: state transitions, emitted events/actions, side effects, output
- **Strictly forbidden:** Testing internal variables, private methods, or implementation details
- **The public API is the use-case surface** -- the application-layer functions the architecture record names, one per design behavior -- plus the pure domain functions beneath them. A handler in front of a use case is an entry point, not the API
- Test exclusively via:
  - Public API boundaries
  - Observable state changes
  - Emitted events or returned values
  - Side effects at system boundaries

**Bookkeeping needs no test.** A test asserts a contract someone depends
on, and its failure message names the harm. If you cannot say who is
harmed and what they observe when it breaks, there is no behavior, so
there is no test -- and no RED-first either, because it was never a
defect. `.gitignore` entries, lint and formatter config, comments, file
layout, dependency housekeeping: a one-line commit, nothing more. The
check is the victim, not the file type. A `files` list that decides what
ships is a behavior (a change that cannot publish itself); an ignore line
is not.

### A name is not a behavior

A test must do what its name says, and must be able to fail. A test with no
assertion, or whose only assertion is that nothing raised, says so in its
name or gets the assertion it implies; a test that names a behavior and
asserts an internal value is not the one to keep. Setup may reach into
the store; the *acting* and the *asserting* go through the door the human
uses. Read `references/test-pitfalls.md`,
"A name is not a behavior", for the worked example before you write or review a
Given/When/Then test whose body you doubt.

### Reliability and Determinism

- Tests must be **non-flaky**, **order-independent**, and **hermetic**
- Every test must clean up all mocks, state, timers, and fixtures
- External dependencies **must be faked** in unit tests

### Performance Requirements (CRITICAL)

**Unit tests complete in milliseconds. A test that takes over 1 second is BROKEN.**

- **Target:** Each unit test case completes in < 100ms
- **Hard limit:** Any test taking > 1 second indicates a design flaw
- **Hanging tests are critical failures** -- worse than a failing test

#### Common Causes of Slow/Hanging Tests

- **Real I/O instead of fakes** -- Network calls, file system, databases, subprocesses
- **Sleep statements** -- Never use real sleeps in unit tests; use fake clocks or event coordination
- **Unbounded waits** -- Waiting on events/promises without guaranteed resolution
- **Flaky or unimplemented tests left running** -- See below

#### Skip Flaky Tests, Don't Run and Hope

If a test is flaky, unimplemented, or might hang -- **skip it entirely**. Do not run it and hope.

Every test framework has two mechanisms: **skip** and **expected failure**. They are not interchangeable.

- **Skip** means the test is NOT executed at all. The runner sees the skip marker and moves on immediately. Use skip for tests that might hang, test unimplemented features, or depend on unavailable resources.
- **Expected failure** (xfail, .fails, etc.) means the test IS executed, but failure is tolerated. If the test hangs, expected failure does nothing to save you. Use ONLY for tests that fail fast and reliably -- a known bug you haven't fixed yet.

### Guiding Philosophy

**We want our tests to break when our code is broken, not when our code has changed; we want bug detection, not change detection.**

---

# Test Layers & Definitions

We strictly define the layers of testing. Do not blur the lines between them.

### Unit Tests

- **Definition:** Deterministic, in-process tests
- **Scope:** Single function, class, or component in isolation
- **Faking:** All external dependencies must be faked
- **Goal:** Verify logic correctness and edge cases

### Integration Tests

- **Definition:** Nondeterministic (potentially), on-host tests
- **Scope:** Two or more real components working together
- **Faking:** Do NOT fake the communication layer between components. They must actually talk to each other.
- **Goal:** Verify the wiring and contracts between components

### End-to-End (E2E) Tests

- **Definition:** Nondeterministic, on-network tests
- **Scope:** The full system stack, including real external services
- **Faking:** Zero fakes. Real APIs, real I/O.
- **Goal:** Verify the system actually works in the real world

---

# Test Doubles: Fakes Over Mocks

### Why Fakes

- Fakes (in-memory implementations of real interfaces) enforce the contract at the type level
- Fakes don't need `.return_value` chains or fragile mock wiring
- Fakes catch interface drift -- if the interface changes, the fake fails to compile/typecheck
- Fakes are reusable across tests without per-test configuration

### When Mocks Are Acceptable

- Verifying that a specific call was made (spy behavior)
- One-off tests where building a full fake would be disproportionate
- Never as the default strategy

### A fake process must model the real one's lifetime

A fake standing in for something long-lived (a browser, a server, a daemon)
has to stay running, and the test reaps it in teardown; a stub that exits
immediately looks like a crash. Cover the process that dies before it is
ready as its own test. Read `references/test-pitfalls.md`, "A fake process must
model the real one's lifetime", before you write any process double or when
flakes move between cases that share a fixture.

### Drive a script the way its caller does

Read how the production caller invokes the thing (workflow step, cron line,
hook) and copy that shape; at least one case runs the exact production
invocation, and a CLI's documented subcommand/flag forms are tested as
documented. Read `references/test-pitfalls.md`, "Drive a script the way its
caller does", before you write the first case for a script or CLI.

### Test Isolation

Every test must start with clean state:

- Fakes created per-test (never shared mutable state between tests)
- Temp directories auto-cleaned by the test framework
- No global state mutation -- if unavoidable, restore in teardown
- A test that drives code which detects its environment (a cloud
  sandbox, CI, a TTY) clears the detector's inputs first, for example
  `unset CLAUDE_CODE_REMOTE` at the top of the suite. Ambient signals
  from the machine running the test otherwise leak into every child
  call, and a case meant to be a no-op writes to the real host. Each
  case that needs the environment opts in with a scratch path.
- Deleting a feature deletes its tests, and adds an inverse assertion
  that the feature is gone (the tool is not invoked, the file is not
  written). Without it the feature can return and no test notices.

### A guard needs an accept case

A check that refuses things needs a test that valid input gets through,
including the empty input (nothing in scope, only removals). Once per new
guard, mutate it both ways -- refuse all, accept all -- and confirm the suite
goes red each time. Read `references/test-pitfalls.md`, "A guard needs an accept
case", for the evidence before you write or review a guard's tests.

### A guard asserts the parsed value

Assert on the parsed value, not a substring, and revert each fix to see
its test go red. Read `references/test-pitfalls.md`, "A guard asserts the
parsed value", before writing a guard over a file.

### A fake cannot test a third-party tool's behavior

A fake of an external CLI encodes your assumption about it. When a claim is
about what a third-party tool does, at least one test runs the real binary,
with its side-effect edges faked, and is skipped, never faked, when the tool
is absent. Read `references/test-pitfalls.md`, "A fake cannot test a
third-party tool's behavior", before you fake an external CLI.

### Pin an outside constant as a literal

A test whose expectation comes from the code under test re-runs that
code and compares it with itself, so it cannot fail. It reads as
coverage and hides exactly the bug it was written for. Pin any constant
that comes from outside the codebase (a vendor's path, a wire format, a
magic byte) as a literal, checked against the vendor's shipped source,
not your own copy of it. To probe a suspect test, change the value under
test to something absurd and re-run: a test that still passes was
testing nothing. A fixture phrased as "the first X the policy names" is
the usual suspect.

### Know what runs each test

A test file no runner invokes looks exactly like a passing one. The
change that adds a test file also wires it into something that runs
without you: the unit suite, a CI job, a deploy check. The converse
holds too: "I could not run it here" is not "it has not been run".
State what you could not verify here, and check what the pipeline
verifies on push, before reporting a gap.

### A flow that leaves the app needs a round-trip test

Contract tests over fakes prove each unit keeps its interface, not that
the units are wired together. A flow that leaves the app and comes back
(an OAuth redirect, a webhook, a payment return) needs round-trip
coverage, or a live walkthrough, before it is done.

### A green result proves only what its setup allowed

Before recording a result as the answer to a question, check that the
test's preconditions match the question's. A sign-in tested with signup
open says nothing about signup closed.

---

# Test Development Workflow

Write skeleton tests against the real, not-yet-built API; set up the
fakes first; make one test pass at a time, simplest first.

Read `references/workflow-and-debugging.md`, "Test Development Workflow", when you create or overhaul a suite.

# Debugging Failing Tests

Isolate the failing test, fix the simplest failure first, and examine
both the test and the code under test.

Read `references/workflow-and-debugging.md`, "Debugging Failing Tests", when a test fails and the cause is not obvious.

# Test Naming

Tests should read as behavioral specifications:

```
test_<action>_<scenario>_<expected_outcome>
```

Every test should have a description following Given-When-Then:
```
Given <precondition>, When <action>, Then <expected result>.
```

---

# Quick Checklist

- [ ] Test written FIRST (Red-Green-Refactor)
- [ ] Tests describe behavior, not implementation
- [ ] Given-When-Then structure
- [ ] No sleeps in tests
- [ ] Fakes preferred over mocks
- [ ] Each test is hermetic (no shared mutable state)
- [ ] Linter and type checker pass
