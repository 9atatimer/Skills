---
name: testing-node
description: "Writing or reviewing tests for non-Nuxt Node.js/TypeScript code (backend services, Cloudflare Workers, CLIs, libraries), including Stryker mutation testing. Read alongside the universal testing skill."
---

# Node.js / TypeScript Testing Standards

> Framework-specific testing standards for Node.js and TypeScript code in this repo
> (backend services, Cloudflare Workers, CLIs, libraries, shared packages).
>
> Read alongside the universal testing skill (universal principles) and
> the style-typescript skill (style and toolchain).
>
> For Nuxt 4 / Vue 3 testing -- Vitest + @nuxt/test-utils for component and
> SSR, Playwright for E2E -- see the testing-nuxt skill instead. This document
> is for **non-Nuxt** TS/JS code.
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

Toolchain: vitest, `@vitest/coverage-v8` (smoke only), Stryker, fast-check, vitest snapshots, fake timers
(integration only; prefer a DI Clock), testcontainers, fishery + seeded faker, `@cloudflare/vitest-pool-workers`,
msw (contract-tested external adapters only).
Read `references/node-detail.md`, "Toolchain table", when you pick a tool for a purpose not named here.

**Banned:**

- `jest` -- use vitest (this repo is standardized on vitest; mixing runners
  fragments config, coverage, and mutation testing)
- `vi.mock("./my-local-module", ...)` against first-party code (see Section 6)
- `cucumber-js`, `jest-cucumber` (Gherkin overhead with no benefit)
- `sinon` fake timers in new code (use `@sinonjs/fake-timers` directly, or
  `vi.useFakeTimers()` which wraps it)
- `chai`, `should`, `expect.js` -- use vitest's built-in `expect`
- `nock` for first-party HTTP flows (extract a port, inject a fake; see Section 6)
- `ts-jest`, `babel-jest` (we do not use jest)
- Ad-hoc `child_process.spawn` for CLI tests (see Section 11)

---

## 3. Test Layers (Physical Separation)

Three directories. Never blur them.

```
tests/
  unit/         # Deterministic, in-process, all deps faked
  integration/  # Real components in Docker or Miniflare; on-host only
  e2e/          # Full system, real network, real services
```

Physical separation is enforced because vitest `describe` tags and
`test.skipIf` can be ignored. Directory layout cannot.

| Layer | Time budget per test | Faking rule |
|-------|---------------------|-------------|
| unit | < 100ms target, < 1s hard limit | All external deps faked |
| integration | < 5s target, < 30s hard limit | Real components, real wiring |
| e2e | No hard limit | Zero fakes |

Tests over the hard limit fail CI.

Use separate vitest projects (or `vitest.config.ts` `test.projects`) so
each layer can have its own pool, environment, and timeout. Never run
integration tests with the unit-test default timeout.

---

## 4. Fixtures and State

- **Per-test scope by default.** Build fixtures inside `beforeEach` or
  inside each `it` block. Wider scope (`beforeAll`) requires a comment
  explaining the hermeticity tradeoff.
- **No shared mutable state across tests.** Build fakes per-test. If a
  module holds state (singletons, caches, registries), reset it in
  `beforeEach` or -- better -- refactor to remove the global.
- **Tests must survive randomized ordering.** Run vitest with
  `--sequence.shuffle` in CI. If they don't survive, you have shared
  state and that is a bug.
- **Tests must survive parallel execution.** Same reason. Vitest runs
  files in parallel by default; do not disable this to paper over flakiness.

---

## 5. Test-Helper Discipline

There is no `conftest.py` in Vitest. The equivalent is a `tests/_helpers/`
folder and `setupFiles` in `vitest.config.ts`. Keep both thin.

`setupFiles` holds only global matcher registration and runtime configuration every test file needs (e.g.
`process.env.NODE_ENV = "test"`). It never holds domain factories (those live in `tests/_factories.ts`, imported
explicitly), ambient `beforeEach` hooks that mutate module state, or "helpful" globals on `globalThis`.
Read `references/node-detail.md`, "setupFiles contents", for the full list.

Explicit imports beat magic. A reader should be able to follow every
fixture a test uses via `import`, not by knowing which setup files ran.

---

## 6. Test Doubles: Fakes, Mocks, Patches

### Fakes are the default

A fake is an in-memory implementation of a port (TypeScript `interface`
or `type`). It implements the real interface; it fails to typecheck if
the interface drifts; it is reusable across tests; it requires no
per-test wiring.

**Every external dependency gets a fake.** Filesystem, HTTP client,
database, message bus, KV / R2 / D1 binding, clock, randomness source --
all of them.

Example: a `Clock` port (`now(): Date`) and a `FakeClock` that implements it with `advance(ms)`.
Read `references/node-detail.md`, "Fake example", for the code.

### Mocks are last resort

`vi.fn()` and `vi.spyOn()` are acceptable only:

- At the boundary to third-party SDKs you do not own
- For verifying a specific call was made (spy behavior) where a fake
  cannot capture the assertion cleanly

**`vi.mock("./my-own-module", ...)` against first-party code is banned.**
Mocking your own modules pins tests to implementation. If you find
yourself mocking a function in your own package, the design is wrong:
extract the dependency behind a port (interface) and inject a fake.

`vi.mock` against first-party modules is also brittle: it hoists above imports, replaces the module binding not the
symbol, and behaves differently under ESM and CJS. Dependency injection has no such failure mode.

### Dependency injection is mandatory for testability

Every flow function takes its dependencies as parameters (or via an
options object / constructor). No global singletons. No module-level
instantiation of clients. The test constructs the function with fakes;
production constructs it with real adapters. Pass deps in
(`makeHandler(deps: { db; clock; logger })`); never import a singleton into a handler.
Read `references/node-detail.md`, "Dependency injection example", for the snippet.

### Contract tests pin fakes to real adapters

A fake is only as trustworthy as its agreement with the real adapter.
Drift between the two is the most common way that fully-green unit
tests miss production bugs.

For every port that has both a fake and a real adapter, write the test
suite once and parametrize over both implementations with
`describe.each`, one `it` per contract rule.
Read `references/node-detail.md`, "Contract test example", before you write a contract suite.

If the fake passes contract tests but the real adapter does not (or
vice versa), the fake has lied to your unit tests. Contract tests
make that impossible to ship.

A port leaves some rules implicit (what a collision does, result order, how a malformed id fails, who the caller
is). Before an adapter family is called done, write a contract case for each implicit rule; unstated rules are
where adapters disagree.

### HTTP boundaries: MSW, not nock

For HTTP adapters to third-party services, use `msw` to drive contract
tests against a recorded wire format. Do **not** use `nock` or
hand-rolled `fetch` stubs for first-party flows -- extract the adapter
behind a port and inject a fake in unit tests, then MSW-contract-test
the real adapter.

---

## 7. Coverage and Mutation

- **Line coverage is a smoke threshold, not a quality bar.** Minimum
  70% repo-wide via `@vitest/coverage-v8`. Enforced in CI.
- **Mutation score is the quality bar** for `domain/` and `ports/`
  directories (or their equivalents in each package). Minimum 80% on
  those directories. Run Stryker weekly or on PR-touch of those modules.
- High line coverage with low mutation score means tests run the code
  but do not assert on it. That is worse than no test.

### Stryker configuration sketch

Stryker is the JS/TS equivalent of Python's `mutmut` (Nuxt/Vue: the testing-nuxt skill, Section 13). Config uses
`testRunner: "vitest"`, `coverageAnalysis: "perTest"`, `mutate` over `src/domain/**` and `src/ports/**`, thresholds
`high 90`, `low 80`, `break 80`.
Read `references/node-detail.md`, "Stryker configuration sketch", before you write `stryker.conf.json`.

---

## 8. Property-Based Testing

Every pure function, parser, and validator gets at least one `fast-check` test. Properties to consider: round-trip, idempotence, invariants, equivalence. Arbitraries live next to production code in `src/foo/arbitraries.ts`.
Read `references/node-detail.md`, "Property-based testing, full section", before you write a property test.
---

## 9. Async Tests

- Vitest treats every `async` function as a real promise; always
  `await` the operation under test. An unawaited promise is a silent
  test bug.
- Never use real `setTimeout`/`setInterval` sleeps in unit tests.
  Inject a `Clock` port and advance it, or use `vi.useFakeTimers()`
  and `vi.advanceTimersByTimeAsync(ms)`.
- Use an explicit per-test timeout (`it("x", { timeout: 5000 }, ...)`)
  for anything that awaits external coordination. Do not rely on the
  suite-wide default.
- For cross-realm work (workers, child processes, `AbortSignal`),
  always race against a timeout so a hang becomes a fast failure.

---

## 10. Time

**Inject a Clock.** Production wires a real clock; tests wire a fake
one with `advance(ms)`. This eliminates an entire class of flaky
tests.

The `Clock` port is `{ now(): Date }`; the `FakeClock` has `advance(ms)` (same shape as in Section 6).

For integration tests where DI is impractical, use Vitest's fake
timers (`vi.useFakeTimers()` + `vi.setSystemTime(...)`), which wraps
`@sinonjs/fake-timers`. Never monkey-patch `Date` by hand.

---

## 11. CLI Tests

Test CLIs through the framework's programmatic entrypoint (`program.parseAsync(argv)`, `.parse(argv)`, `Command.run`), capturing output with a fake writer passed via DI, not by intercepting `process.stdout.write`. Never test CLIs via `child_process.spawn` / `exec` / `execa` in unit tests; E2E tests (Section 3) can spawn the real binary. Match captured output with a snapshot (Section 12).
Read `references/node-detail.md`, "CLI tests, full section", for the rationale.
---

## 12. Snapshot Tests

Use vitest snapshots only for CLI stdout / stderr, rendered template output and generated file contents. Never use them for object shapes (use `toEqual`), where a stale snapshot could mask a regression, or on nondeterministic values (normalize first). Snapshots get reviewed in PRs like any other code change; a diff-only "update snapshots" commit with no explanation is a red flag in review.
Read `references/node-detail.md`, "Snapshot use list", before you add a snapshot.
---

## 13. Log Assertions

Use a structured logger (`pino` is the repo default) and capture logs via a test transport, not by intercepting `console.log`. Assert on structured fields, never on message strings. The test logger is injected via DI (Section 6), not imported from a global.
Read `references/node-detail.md`, "Log assertions, full section", before you write a log assertion.
---

## 14. Test Data

Builder functions in `tests/_factories.ts` for plain types; `fishery` with seeded `@faker-js/faker` for ORM models and constrained types; seed `faker` per test file.
Read `references/node-detail.md`, "Test data, full section", before you write a factory.
---

## 15. Skips and Expected Failures

Vitest provides `.skip`, `.todo`, and `.fails`. They are not
interchangeable.

- `.skip(reason)` -- test does not run. Use when a test might hang,
  requires unavailable resources, or is blocked on an upstream fix.
- `.todo(reason)` -- test is planned but not written. Shows up in
  reports; requires no body.
- `.fails(reason)` -- test runs and is *expected* to fail. Use only for
  a known bug that fails fast and reliably.

Every skip / todo / fails requires:

- A reason string passed to the modifier
- A comment with a tracking issue link

Pass the reason string and put the tracker link in a comment above the modifier.
Read `references/node-detail.md`, "Skip and fails examples", for the snippet.

A skip, todo, or fails without a reason and a tracker link fails review (enforced in review, not by lint).

**Skip and `.fails` are not interchangeable.** Skip means the test
does not run. `.fails` means it runs and is allowed to fail. If a
test might hang, skip it -- `.fails` does not save you from a hang.

---

## 16. Naming and JSDoc

Name tests `describe("<unit>") / it("<behavior>")` with Given/When/Then comments; every exported test helper has a one-line JSDoc.
Read `references/node-detail.md`, "Test naming example", for the example.
---

## 17. Performance Budgets

Unit suite under 30 s and integration suite under 5 min per package; a unit test over 1 s or an integration test over 30 s fails CI. Performance regressions are bugs.
Read `references/node-detail.md`, "Performance budget detail", when investigating a slow or hanging test.
---

## 18. Local Execution Notes (macOS / zsh)

- **Cloudflare Worker tests** use `@cloudflare/vitest-pool-workers`, not bare miniflare, so that bindings (KV, R2,
  D1, queues) use the same runtime in tests as in production. Do not hand-roll a miniflare instance inside a test
  file.
- **Quote glob patterns** when invoking vitest: `vitest 'tests/unit/**/*.test.ts'`.
- Pool, `process.cwd()` and Docker Desktop notes: read `references/node-detail.md`, "Local execution notes", when a
  test fails only locally.

---

## 19. Quick Checklist

Before merging, check the rules in this skill against the diff. Read `references/node-detail.md`, "Quick checklist", for the checkbox form before you mark a PR ready.
---

## 20. The One-Sentence Test

> A test that breaks because the code was refactored, but the behavior
> did not change, is a bad test. A test that breaks because the
> behavior changed is doing its job. A test that does not break when
> the behavior breaks is the worst kind.

Write the second kind. Delete the first kind on sight. Hunt for the
third kind with Stryker.
