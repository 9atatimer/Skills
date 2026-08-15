---
name: testing
description: "Phase 4 of the SDLC: writing or reviewing tests in any language -- universal principles -- no hanging tests, no real I/O or sleeps in unit tests, skip (never xfail) anything that might hang, fakes over mocks, RED tests fail because code doesn't exist (never placeholder assertions). Pair with the language-specific testing skill."
---

# Testing Standards (Phase 4: Behaviors)

This document defines **universal testing principles** applicable across all languages,
frameworks, and projects. It is written for coding agents and must be followed exactly.

## Where behaviors come from

Phase 4 is not "write some tests." It is the phase that turns the two
approved artifacts into executable claims, and there are **two distinct
sources**. A suite drawn from only one of them has a predictable blind
spot.

**Design behaviors** come from the design doc. Each Goal is a testable
success criterion by construction -- that is why the design skill demands
Goals be verifiable. Each Non-Goal is worth a test only where its
violation would be silent. Each state machine transition, each data-model
constraint, and each rule in the Security section is a behavior.

> Goal: "an unreadable verdict never fails a clean PR" -> a test that feeds
> the judge an unparseable response and asserts the PR is not blocked.

**Architect behaviors** come from the seams named in phase 3. These are
the mechanical tests of the coding skill, Section 1.2, written as real
test cases rather than left as review-time opinions:

| Architect behavior | The test |
|---|---|
| Grep | the core names no vendor, SDK, `fetch`, `process.env`, `fs`, or model string |
| Swap | a second implementation registers behind the seam with zero core edits |
| Decision | each named decision resolves in one place, in the problem's language |
| Arrow | every import crosses inward |

These are cheap, durable, and catch the failure that unit tests never
will -- a leak into the core reads as a passing test suite right up until
the day you need the seam. Write them in phase 4 like any other RED test.

**Both kinds are RED before any code.** A RED test fails because the
behavior does not exist yet -- never because of a placeholder assertion.

For framework-specific standards, load the companion skill matching the code
under test -- and only that one:

- the testing-node skill -- Node.js / TypeScript outside Nuxt
- the testing-nuxt skill -- Nuxt 4 / Vue 3 (incl. Playwright E2E)
- the testing-python skill -- Python / pytest

Skip companions whose stack the repo does not use; never cite or follow a
pointer to a standard the repo has no code for (a bash-only repo needs none
of the three).

---

# 1. Goals and Principles

### 1. Test Behavior, Not Internal Implementation (Black Box)

- Test visible behavior: state transitions, emitted events/actions, side effects, output
- **Strictly forbidden:** Testing internal variables, private methods, or implementation details
- Test exclusively via:
  - Public API boundaries
  - Observable state changes
  - Emitted events or returned values
  - Side effects at system boundaries

### 2. Reliability and Determinism

- Tests must be **non-flaky**, **order-independent**, and **hermetic**
- Every test must clean up all mocks, state, timers, and fixtures
- External dependencies **must be faked** in unit tests

### 3. Performance Requirements (CRITICAL)

**Unit tests complete in milliseconds. A test that takes over 1 second is BROKEN.**

- **Target:** Each unit test case completes in < 100ms
- **Hard limit:** Any test taking > 1 second indicates a design flaw
- **Hanging tests are critical failures** -- worse than a failing test

#### Common Causes of Slow/Hanging Tests

1. **Real I/O instead of fakes** -- Network calls, file system, databases, subprocesses
2. **Sleep statements** -- Never use real sleeps in unit tests; use fake clocks or event coordination
3. **Unbounded waits** -- Waiting on events/promises without guaranteed resolution
4. **Flaky or unimplemented tests left running** -- See below

#### Skip Flaky Tests, Don't Run and Hope

If a test is flaky, unimplemented, or might hang -- **skip it entirely**. Do not run it and hope.

Every test framework has two mechanisms: **skip** and **expected failure**. They are not interchangeable.

- **Skip** means the test is NOT executed at all. The runner sees the skip marker and moves on immediately. Use skip for tests that might hang, test unimplemented features, or depend on unavailable resources.
- **Expected failure** (xfail, .fails, etc.) means the test IS executed, but failure is tolerated. If the test hangs, expected failure does nothing to save you. Use ONLY for tests that fail fast and reliably -- a known bug you haven't fixed yet.

### 4. Guiding Philosophy

**We want our tests to break when our code is broken, not when our code has changed; we want bug detection, not change detection.**

---

# 2. Test Layers & Definitions

We strictly define three layers of testing. Do not blur the lines between them.

### 1. Unit Tests

- **Definition:** Deterministic, in-process tests
- **Scope:** Single function, class, or component in isolation
- **Faking:** All external dependencies must be faked
- **Goal:** Verify logic correctness and edge cases

### 2. Integration Tests

- **Definition:** Nondeterministic (potentially), on-host tests
- **Scope:** Two or more real components working together
- **Faking:** Do NOT fake the communication layer between components. They must actually talk to each other.
- **Goal:** Verify the wiring and contracts between components

### 3. End-to-End (E2E) Tests

- **Definition:** Nondeterministic, on-network tests
- **Scope:** The full system stack, including real external services
- **Faking:** Zero fakes. Real APIs, real I/O.
- **Goal:** Verify the system actually works in the real world

---

# 3. Test Doubles: Fakes Over Mocks

### Why Fakes

- Fakes (in-memory implementations of real interfaces) enforce the contract at the type level
- Fakes don't need `.return_value` chains or fragile mock wiring
- Fakes catch interface drift -- if the interface changes, the fake fails to compile/typecheck
- Fakes are reusable across tests without per-test configuration

### When Mocks Are Acceptable

- Verifying that a specific call was made (spy behavior)
- One-off tests where building a full fake would be disproportionate
- Never as the default strategy

### Test Isolation

Every test must start with clean state:

- Fakes created per-test (never shared mutable state between tests)
- Temp directories auto-cleaned by the test framework
- No global state mutation -- if unavoidable, restore in teardown

---

# 4. Test Development Workflow

When creating or overhauling test suites, follow this proven sequence:

### Step 1: Start with Skeleton Tests

Write test cases that call the real (not-yet-implemented) API and assert on expected behavior.
Tests fail because the code does not exist yet -- not because of placeholder assertions like `assert false`.
This gives you a clear roadmap before writing any implementation.

### Step 2: Identify and Setup Fakes First

Before implementing any tests:

- Identify all external dependencies
- Create reusable, resettable fake instances
- Set up framework-appropriate setup/teardown hooks

### Step 3: Implement One Test at a Time

- Start with the **simplest** test case
- Debug the test and its fakes until green
- Only move to the next test when current test passes
- Each green test validates both the behavior and the fake setup

### Step 4: Iterate by Complexity

1. Simple happy paths first
2. Edge cases and error conditions next
3. Complex interactions and multi-step workflows last

**Philosophy:** Never write multiple broken tests at once. Each green test
validates your fakes, creating a solid foundation for more complex tests.
Writing 20 broken tests simultaneously makes debugging exponentially harder.

---

# 5. Debugging Failing Tests

### Systematic Debugging Sequence

#### 1. Isolate Tests Methodically

Run only the failing test file, then the specific test case.
If it passes in isolation but fails in suite, you have shared state.

#### 2. Start with Minimal Test Case

Fix the **simplest** failing test first -- it often reveals patterns for fixing others.

- **Bad:** Trying to fix all failures at once
- **Good:** Fix one test completely, understand the root cause, then apply to others

#### 3. Two-Sided Investigation Pattern

ALWAYS examine both sides:

- **The test**: Is the assertion correct? Are fakes set up properly?
- **The code under test**: Did the behavior actually change?

#### 4. Common Failure Patterns

**Fake/Mock Not Returning Expected Data**

- Check that the fake implements the current interface
- Verify return values match what the code under test expects
- If an interface changed, the fake may be out of date

**Test Pollution (Order-Dependent Failures)**

- Run the failing test in isolation
- If it passes alone but fails in suite, you have shared state
- Check for module-level mutable state or missing cleanup

**Async Timing Issues**

- Never use real sleeps -- use fake clocks, events, or mock the sleep
- Ensure all async fakes resolve immediately
- Check for unbounded waits without timeout

#### 5. When Stuck

If you can't diagnose a failure after 2-3 attempts:

- Add logging/print to fakes to trace calls
- Run with verbose/stdout output enabled
- Check if the test is testing behavior or implementation (it should be behavior)

---

# 6. Test Naming

Tests should read as behavioral specifications:

```
test_<action>_<scenario>_<expected_outcome>
```

Every test should have a description following Given-When-Then:
```
Given <precondition>, When <action>, Then <expected result>.
```

---

# 7. Quick Checklist

- [ ] Test written FIRST (Red-Green-Refactor)
- [ ] Tests describe behavior, not implementation
- [ ] Given-When-Then structure
- [ ] No sleeps in tests
- [ ] Fakes preferred over mocks
- [ ] Each test is hermetic (no shared mutable state)
- [ ] Linter and type checker pass
