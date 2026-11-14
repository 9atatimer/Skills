# Testing -- development workflow and debugging

Procedure moved out of this skill's `SKILL.md`. Each section here is
named there with a summary.

# Test Development Workflow

When creating or overhauling test suites, follow this proven sequence:

### Start with Skeleton Tests

Write test cases that call the real (not-yet-implemented) API and assert on expected behavior.
Tests fail because the code does not exist yet -- not because of placeholder assertions like `assert false`.
This gives you a clear roadmap before writing any implementation.

### Identify and Setup Fakes First

Before implementing any tests:

- Identify all external dependencies
- Create reusable, resettable fake instances
- Set up framework-appropriate setup/teardown hooks

### Implement One Test at a Time

- Start with the **simplest** test case
- Debug the test and its fakes until green
- Only move to the next test when current test passes
- Each green test validates both the behavior and the fake setup

### Iterate by Complexity

- Simple happy paths first
- Edge cases and error conditions next
- Complex interactions and multi-step workflows last

**Philosophy:** Never write multiple broken tests at once. Each green test
validates your fakes, creating a solid foundation for more complex tests.
Writing 20 broken tests simultaneously makes debugging exponentially harder.

---

# Debugging Failing Tests

### Systematic Debugging Sequence

#### Isolate Tests Methodically

Run only the failing test file, then the specific test case.
If it passes in isolation but fails in suite, you have shared state.

#### Start with Minimal Test Case

Fix the **simplest** failing test first -- it often reveals patterns for fixing others.

- **Bad:** Trying to fix all failures at once
- **Good:** Fix one test completely, understand the root cause, then apply to others

#### Two-Sided Investigation Pattern

ALWAYS examine both sides:

- **The test**: Is the assertion correct? Are fakes set up properly?
- **The code under test**: Did the behavior actually change?

#### Common Failure Patterns

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

#### When Stuck

If you can't diagnose a failure after 2-3 attempts:

- Add logging/print to fakes to trace calls
- Run with verbose/stdout output enabled
- Check if the test is testing behavior or implementation (it should be behavior)

---
