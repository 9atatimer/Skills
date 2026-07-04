---
name: testing-python
description: "Writing or reviewing tests for Python code: pytest/pytest-asyncio standards, factories, and mutmut mutation testing. Read alongside the universal testing skill."
---

# Python Testing Standards

> Framework-specific testing standards for Python code in this repo.
> Read alongside `TESTING.md` (universal principles) and
> `prompts/STYLE.PYTHON.md` (style and toolchain).
>
> **These rules are non-negotiable.** Deviations require an explicit
> comment with rationale.

---

## 1. Philosophy

**BDD/TDD is the only way.** Every feature, every fix, every refactor
starts with a failing test that describes observable behavior. No
exceptions.

**Test behavior, not implementation.** A passing test is a contract
about what the code does for callers; it must not depend on how the
code does it.

### When a test fails, classify it first

| Case | What happened | What to do |
|------|---------------|------------|
| A | The behavior changed intentionally | Update the test to the new contract, or delete it if the behavior went away |
| B | The behavior did not change, but the test broke during a refactor | The test was pinned to implementation. Rewrite it against observable behavior, or delete it if a better behavior test exists |
| C | A real regression | Fix the code. Never weaken the test |

Behavior tests are sacred. Implementation-pinned tests are deletable
on sight.

---

## 2. Toolchain

| Tool | Purpose |
|------|---------|
| pytest | Test runner. No `unittest` classes anywhere |
| pytest-asyncio | Async test support, strict mode only |
| pytest-randomly | Randomize test order on every run |
| pytest-xdist | Parallel execution, default-on |
| hypothesis | Property-based testing for pure functions and validators |
| syrupy | Snapshot testing for CLI output and rendered text only |
| time-machine | Time travel for integration tests only (prefer DI of a Clock) |
| testcontainers | Real Postgres / Redis / etc. in Docker for integration tests |
| polyfactory | Test data factories for non-trivial Pydantic models only |
| mutmut or cosmic-ray | Mutation testing on critical modules |
| coverage.py | Smoke-level coverage measurement only |

**Banned:**

- `unittest.mock.patch` against first-party code (see Section 6)
- `pytest-bdd`, `behave` (Gherkin overhead with no benefit)
- `freezegun` (use `time-machine` or DI a Clock)
- `factory_boy` for plain dataclasses (use builder functions)

---

## 3. Test Layers (Physical Separation)

Three directories. Never blur them.

```
tests/
  unit/         # Deterministic, in-process, all deps faked
  integration/  # Real components in Docker; on-host only
  e2e/          # Full system, real network, real services
```

Physical separation is enforced because pytest markers can be ignored.
Directory layout cannot.

| Layer | Time budget per test | Faking rule |
|-------|---------------------|-------------|
| unit | < 100ms target, < 1s hard limit | All external deps faked |
| integration | < 5s target, < 30s hard limit | Real components, real wiring |
| e2e | No hard limit | Zero fakes |

Tests over the hard limit fail CI.

---

## 4. Fixtures and State

- **Function scope by default.** Wider scope (`module`, `session`)
  requires a comment explaining the hermeticity tradeoff.
- **No shared mutable state across tests.** Build fakes per-test.
- **Tests must survive randomized ordering.** If they don't, you have
  shared state and that is a bug.
- **Tests must survive parallel execution.** Same reason.

---

## 5. Conftest Discipline

`conftest.py` stays thin. It contains:

- Plugin configuration (event loop scope, marker registration)
- Framework wiring (database URL fixtures pointing at test containers)

It does not contain:

- Domain factories (those live in `tests/_factories.py` and are
  imported explicitly)
- Ambient fixtures that magically appear in tests
- Helpers that are easier to find by import than by inheritance

Explicit imports beat magic.

---

## 6. Test Doubles: Fakes, Mocks, Patches

### Fakes are the default

A fake is an in-memory implementation of a port (Protocol). It
implements the real interface; it fails to typecheck if the interface
drifts; it is reusable across tests; it requires no per-test wiring.

**Every external dependency gets a fake.** Filesystem, HTTP client,
database, message bus, clock, randomness source -- all of them.

### Mocks are last resort

`unittest.mock` is acceptable only:

- At the boundary to standard library or 3rd-party SDKs you do not own
- For verifying a specific call was made (spy behavior) where a fake
  cannot capture the assertion cleanly

**`unittest.mock.patch` against first-party code is banned.** Patching
your own modules pins tests to implementation. If you find yourself
patching a function in your own package, the design is wrong: extract
the dependency behind a port and inject a fake.

`patch` is also brittle in a way that bites silently: `patch("mod.func")`
only intercepts callers that did `import mod` and reach via `mod.func`.
Callers that did `from mod import func` hold their own reference and
ignore the patch. Tests pass locally, fail in production, or vice versa.
Dependency injection has no such failure mode.

### Dependency injection is mandatory for testability

Every flow function takes its dependencies as parameters. No global
singletons. No module-level instantiation of clients. The test
constructs the function with fakes; production constructs it with real
adapters.

### Contract tests pin fakes to real adapters

A fake is only as trustworthy as its agreement with the real adapter.
Drift between the two is the most common way that fully-green unit
tests miss production bugs.

For every port that has both a fake and a real adapter, write the test
suite once against an abstract base class and parametrize over both
implementations:

```python
class PortContractTests:
    """Subclasses set self.adapter; tests assert behavior."""
    def test_round_trip_returns_input(self) -> None: ...
    def test_missing_key_raises_not_found(self) -> None: ...

class TestFakeStore(PortContractTests):
    adapter = FakeStore()

class TestPostgresStore(PortContractTests):
    adapter = PostgresStore(...)  # testcontainers fixture
```

If the fake passes contract tests but the real adapter does not (or
vice versa), the fake has lied to your unit tests. Contract tests
make that impossible to ship.

---

## 7. Coverage and Mutation

- **Line coverage is a smoke threshold, not a quality bar.** Minimum
  70% repo-wide. Enforced in CI.
- **Mutation score is the quality bar** for `domain/` and `ports/`.
  Minimum 80% on those directories. Run `mutmut` or `cosmic-ray`
  weekly or on PR-touch of those modules.
- High line coverage with low mutation score means tests run the code
  but do not assert on it. That is worse than no test.

---

## 8. Property-Based Testing

Every pure function, parser, and validator gets at least one
`hypothesis` test. Property-based tests find edge cases that
example-based tests cannot.

Required properties to consider:

- Round-trip (parse then serialize equals original)
- Idempotence (apply twice equals apply once)
- Invariants (output always satisfies type or range constraint)
- Equivalence (two implementations agree on all inputs)

Strategy modules live next to the production code: `src/foo/strategies.py`
exports `hypothesis` strategies that test files import.

---

## 9. Async Tests

- `pytest-asyncio` in strict mode. No implicit async fixtures; mark
  every async test explicitly.
- Pick one async backend per repo. Do not mix `asyncio.sleep` and
  `trio.sleep`.
- Never use real `asyncio.sleep`. Inject a `Clock` port; advance it.
- Use `asyncio.timeout` on every test that awaits external coordination.

---

## 10. Time

**Inject a Clock.** Production wires a real clock; tests wire a fake
one with `advance(seconds)`. This eliminates an entire class of flaky
tests.

For integration tests where DI is impractical, use `time-machine`.
Never `freezegun`.

---

## 11. CLI Tests

Test CLIs through the framework's runner (Click `CliRunner`, Typer
equivalent). Never via `subprocess`. Subprocess is slow, hides
exceptions, and breaks coverage measurement.

For CLI output assertions, capture `result.output` from the runner and
match it with `syrupy` (see Section 12).

---

## 12. Snapshot Tests

`syrupy` for snapshots. Use snapshots for:

- CLI stdout / stderr
- Rendered template output (HTML, Markdown, LaTeX)
- Generated file contents (resume.tex, cover.md)

Do not use snapshots for:

- Object shapes (use explicit assertions)
- Anything where a stale snapshot could mask a regression

Snapshots get reviewed in PRs like any other code change.

---

## 13. Log Assertions

Use `caplog`. Assert on **structured fields**, never on message
strings.

```python
# Yes
assert any(
    rec.event == "user.created" and rec.user_id == 42
    for rec in caplog.records
)

# No
assert "User 42 was created" in caplog.text  # typo waiting to happen
```

Pairs with `structlog` (mandated by `prompts/STYLE.PYTHON.md`).

**Prerequisite:** the `structlog` configuration must include a
processor that attaches the event dict to the stdlib `LogRecord` (e.g.
`structlog.stdlib.ProcessorFormatter` with `foreign_pre_chain` wired
to forward fields). Without it, `caplog.records` capture only the
rendered message string and `rec.event` will not exist. The structlog
setup module owns this; tests should not have to know about it.

---

## 14. Test Data

For plain dataclasses and Pydantic models, use builder functions in
`tests/_factories.py`:

```python
def make_user(*, name: str = "Alice", age: int = 30, **overrides) -> User:
    return User(name=name, age=age, **overrides)
```

For SQLAlchemy / Django ORM models, use `factory_boy`. Plain
dataclasses do not need it.

For non-trivial Pydantic models with constraints (regex fields,
bounded numeric ranges, discriminated unions), use `polyfactory`.
Hand-built builders for constrained Pydantic models become a
maintenance burden quickly. Plain Pydantic models without constraints
still get a builder function -- polyfactory is for the constrained
case only.

---

## 15. Skips and xfails

Both require:

- `reason="..."` argument
- A comment with a tracking issue link

```python
@pytest.mark.skip(reason="Flaky on macOS arm64; see issue #142")
def test_something() -> None:
    ...
```

A skip without a reason fails lint. A reason without a tracker link
fails review.

**Skip and xfail are not interchangeable.** Skip means the test does
not run. Xfail means it runs and is allowed to fail. If a test might
hang, skip it -- xfail does not save you from a hang.

---

## 16. Naming and Docstrings

Test names follow:

```
test_<action>_<scenario>_<expected>
```

Every test has a one-line Given-When-Then docstring describing the
behavior under test:

```python
def test_publish_with_no_subscribers_returns_zero() -> None:
    """Given a topic with no subscribers, When publish is called, Then it returns 0."""
    ...
```

The docstring is the contract. The function body is the verification.
A reader should understand what the test asserts from the docstring
alone.

---

## 17. Performance Budgets

- Unit test suite: total wall-clock under 30 seconds
- Integration suite: total wall-clock under 5 minutes
- Any individual unit test over 10ms on modern dev hardware (M1 or
  newer) is suspicious -- a true unit test (in-memory, no I/O) should
  finish in single-digit milliseconds. Investigate before accepting
- Any individual unit test over 1 second fails CI (hard limit, kept
  generous so CI runners on slower hardware do not flake)
- Any individual integration test over 30 seconds fails CI

Performance regressions in the test suite are bugs, not annoyances.

---

## 18. Local Execution Notes (macOS / zsh)

The local development environment is an Apple Silicon Mac running
zsh. A few practical gotchas:

- **`pytest -n auto` can saturate file descriptors** on large suites.
  If you hit `OSError: [Errno 24] Too many open files`, either raise
  the limit (`ulimit -n 8192`) or pin a worker count
  (`pytest -n 4`). Default to `-n auto` until proven painful.
- **Quote glob patterns when invoking pytest** to dodge zsh's "no
  matches found" error: `pytest 'tests/unit/**/test_*.py'` works;
  unquoted breaks if zsh expansion finds zero matches.
- **Docker Desktop is required for integration tests** that use
  `testcontainers`. CI runs in Linux containers natively; local runs
  go through Docker Desktop's VM. Expect 2-3x slower container startup
  locally vs. CI -- this is normal, not a bug.

---

## 19. Quick Checklist

Before merging:

- [ ] Test written FIRST (Red-Green-Refactor cycle)
- [ ] Test asserts on observable behavior, not internal calls
- [ ] Test name follows `test_<action>_<scenario>_<expected>`
- [ ] One-line Given-When-Then docstring present
- [ ] Test function and all fixtures fully type-hinted (return types included)
- [ ] No `time.sleep` or `asyncio.sleep` anywhere
- [ ] No `unittest.mock.patch` against first-party code
- [ ] Function-scoped fixtures unless wider scope is justified
- [ ] Test survives `pytest --randomly-seed=last` and `pytest -n auto`
- [ ] Pure functions have at least one `hypothesis` test
- [ ] Every port has a contract-test ABC covering both fake and real adapter
- [ ] Skips and xfails have reason + tracker link
- [ ] Coverage above 70% repo-wide; mutation above 80% on `domain/` and `ports/`
- [ ] Suite total wall-clock budgets respected

---

## 20. The One-Sentence Test

> A test that breaks because the code was refactored, but the behavior
> did not change, is a bad test. A test that breaks because the
> behavior changed is doing its job. A test that does not break when
> the behavior breaks is the worst kind.

Write the second kind. Delete the first kind on sight. Hunt for the
third kind with mutation testing.
