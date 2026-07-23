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
> For Nuxt 4 / Vue 3 / Playwright component and SSR testing, see
> the testing-nuxt skill instead. This document is for **non-Nuxt** TS/JS code.
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
| vitest | Default test runner for all TS/JS code in this repo |
| `@vitest/coverage-v8` | Smoke-level coverage measurement only |
| `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` | Mutation testing on critical modules (the JS equivalent of Python's `mutmut`) |
| fast-check | Property-based testing for pure functions and validators |
| vitest snapshots (`toMatchSnapshot` / `toMatchFileSnapshot`) | Snapshot testing for CLI output and rendered text only |
| `@sinonjs/fake-timers` (or `vi.useFakeTimers()`) | Time travel for integration tests only (prefer DI of a Clock) |
| testcontainers (npm) | Real Postgres / Redis / etc. in Docker for integration tests |
| fishery | Test data factories for ORM / constrained model objects |
| `@faker-js/faker` | Randomized fake data for factories (seeded per suite) |
| miniflare / `@cloudflare/vitest-pool-workers` | In-process Workers runtime for Cloudflare Worker tests |
| msw | HTTP boundary fakes for contract-tested external adapters only |

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

`setupFiles` contains:

- Global matchers registration (e.g. `expect.extend(...)`)
- Runtime configuration that must apply to every test file (e.g.
  `process.env.NODE_ENV = "test"`)

`setupFiles` does **not** contain:

- Domain factories -- those live in `tests/_factories.ts` and are
  imported explicitly
- Ambient `beforeEach` hooks that mutate module state across all tests
  (that is the same mistake as a fat `conftest.py`)
- "Helpful" globals on `globalThis`

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

```ts
// ports/clock.ts
export interface Clock { now(): Date }

// tests/_fakes/FakeClock.ts
export class FakeClock implements Clock {
  constructor(private t: Date) {}
  now() { return this.t }
  advance(ms: number) { this.t = new Date(this.t.getTime() + ms) }
}
```

### Mocks are last resort

`vi.fn()` and `vi.spyOn()` are acceptable only:

- At the boundary to third-party SDKs you do not own
- For verifying a specific call was made (spy behavior) where a fake
  cannot capture the assertion cleanly

**`vi.mock("./my-own-module", ...)` against first-party code is banned.**
Mocking your own modules pins tests to implementation. If you find
yourself mocking a function in your own package, the design is wrong:
extract the dependency behind a port (interface) and inject a fake.

`vi.mock` against first-party modules is also brittle in a way that
bites silently: it hoists above imports, it replaces the *module
binding* not the symbol, and it behaves differently under ESM vs CJS.
Tests pass locally, fail in production, or vice versa. Dependency
injection has no such failure mode.

### Dependency injection is mandatory for testability

Every flow function takes its dependencies as parameters (or via an
options object / constructor). No global singletons. No module-level
instantiation of clients. The test constructs the function with fakes;
production constructs it with real adapters.

```ts
// Yes
export function makeHandler(deps: { db: Db; clock: Clock; logger: Logger }) {
  return async (req: Request) => { /* ... */ }
}

// No
import { db } from "./singletons"
export async function handler(req: Request) { /* reaches into singleton */ }
```

### Contract tests pin fakes to real adapters

A fake is only as trustworthy as its agreement with the real adapter.
Drift between the two is the most common way that fully-green unit
tests miss production bugs.

For every port that has both a fake and a real adapter, write the test
suite once and parametrize over both implementations with
`describe.each`:

```ts
describe.each<{ name: string; make: () => Promise<Store> }>([
  { name: "FakeStore",     make: async () => new FakeStore() },
  { name: "PostgresStore", make: async () => await PostgresStore.connect(testcontainerUrl) },
])("Store contract -- $name", ({ make }) => {
  let store: Store
  beforeEach(async () => { store = await make() })

  it("round-trip returns input", async () => { /* ... */ })
  it("missing key raises NotFound", async () => { /* ... */ })
})
```

If the fake passes contract tests but the real adapter does not (or
vice versa), the fake has lied to your unit tests. Contract tests
make that impossible to ship.

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

`stryker.conf.json` at the package root:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": ["src/domain/**/*.ts", "src/ports/**/*.ts"],
  "thresholds": { "high": 90, "low": 80, "break": 80 }
}
```

Stryker is the canonical JS/TS equivalent of Python's `mutmut`. Every
language in this repo uses a mutation-testing tool of the same class:

| Language | Tool |
|----------|------|
| Python   | `mutmut` (primary), `cosmic-ray` (alt) -- see the testing-python skill |
| Node / TS / JS | `@stryker-mutator/core` + `@stryker-mutator/vitest-runner` |
| Nuxt / Vue | Stryker (same as above) -- see the testing-nuxt skill, Section 13 |

---

## 8. Property-Based Testing

Every pure function, parser, and validator gets at least one
`fast-check` test. Property-based tests find edge cases that
example-based tests cannot.

Required properties to consider:

- Round-trip (parse then serialize equals original)
- Idempotence (apply twice equals apply once)
- Invariants (output always satisfies type or range constraint)
- Equivalence (two implementations agree on all inputs)

```ts
import fc from "fast-check"

test("parse then stringify is identity for all valid configs", () => {
  fc.assert(fc.property(configArbitrary, (cfg) => {
    expect(parse(stringify(cfg))).toEqual(cfg)
  }))
})
```

Arbitrary definitions live next to the production code:
`src/foo/arbitraries.ts` exports `fast-check` arbitraries that test
files import.

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

```ts
interface Clock { now(): Date }

class FakeClock implements Clock {
  constructor(private t: Date) {}
  now() { return this.t }
  advance(ms: number) { this.t = new Date(this.t.getTime() + ms) }
}
```

For integration tests where DI is impractical, use Vitest's fake
timers (`vi.useFakeTimers()` + `vi.setSystemTime(...)`), which wraps
`@sinonjs/fake-timers`. Never monkey-patch `Date` by hand.

---

## 11. CLI Tests

Test CLIs through the framework's programmatic entrypoint (e.g.
`commander`'s `program.parseAsync(argv)`, `yargs`'s `.parse(argv)`,
`oclif`'s `Command.run`). Capture stdout/stderr by swapping in a fake
writer passed via DI, **not** by intercepting `process.stdout.write`.

Never test CLIs via `child_process.spawn` / `exec` / `execa` in unit
tests. Subprocess is slow, hides exceptions, breaks coverage, and
causes flakes on CI runners. E2E tests (Section 3) can spawn the real
binary.

For CLI output assertions, capture the fake writer's buffer and match
it with a vitest snapshot (see Section 12).

---

## 12. Snapshot Tests

Vitest's `toMatchSnapshot` / `toMatchFileSnapshot` for snapshots. Use
snapshots for:

- CLI stdout / stderr
- Rendered template output (HTML, Markdown, generated SQL)
- Generated file contents

Do not use snapshots for:

- Object shapes (use explicit `expect(...).toEqual(...)`)
- Anything where a stale snapshot could mask a regression
- Anything containing timestamps, UUIDs, or other nondeterministic
  values (normalize first, then snapshot)

Snapshots get reviewed in PRs like any other code change. A diff-only
"update snapshots" commit with no explanation is a red flag in review.

---

## 13. Log Assertions

Use a structured logger (`pino` is the repo default) and capture logs
via a **test transport**, not by intercepting `console.log`.

Assert on **structured fields**, never on message strings.

```ts
// Yes
const logs = captureLogs(() => handler(req))
expect(logs).toContainEqual(expect.objectContaining({
  event: "user.created",
  userId: 42,
}))

// No
expect(stdout).toContain("User 42 was created")  // typo waiting to happen
```

Capture helper sketch:

```ts
import { pino } from "pino"
import { Writable } from "node:stream"

export function makeTestLogger() {
  const records: Record<string, unknown>[] = []
  const sink = new Writable({
    write(chunk, _enc, cb) { records.push(JSON.parse(String(chunk))); cb() },
  })
  return { logger: pino(sink), records }
}
```

The test logger is injected via DI (Section 6), not imported from a
global.

---

## 14. Test Data

For plain TypeScript types and DTOs, use builder functions in
`tests/_factories.ts`:

```ts
export function makeUser(overrides: Partial<User> = {}): User {
  return { id: "u_1", name: "Alice", age: 30, ...overrides }
}
```

For ORM models (Prisma, Drizzle, TypeORM) or non-trivial constrained
types (branded IDs, regex-validated fields, discriminated unions),
use `fishery` with seeded `@faker-js/faker`:

```ts
import { Factory } from "fishery"
import { faker } from "@faker-js/faker"

export const userFactory = Factory.define<User>(({ sequence }) => ({
  id: `u_${sequence}`,
  name: faker.person.firstName(),
  age: faker.number.int({ min: 18, max: 99 }),
}))
```

Seed `faker` per test file (`faker.seed(1)`) so factory output is
reproducible across runs.

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

```ts
// Skip: flaky on macOS arm64; see issue #142
it.skip("decodes on all platforms", async () => { /* ... */ })

it.fails("should round-trip NaN -- see issue #203", async () => { /* ... */ })
```

A skip, todo, or fails without a reason and a tracker link fails
review. Packages that adopt `eslint-plugin-vitest` should enable
`vitest/no-disabled-tests` to surface bare `.skip` / `.todo` usage,
but the reason-and-tracker requirement is enforced in review, not by
the lint rule.

**Skip and `.fails` are not interchangeable.** Skip means the test
does not run. `.fails` means it runs and is allowed to fail. If a
test might hang, skip it -- `.fails` does not save you from a hang.

---

## 16. Naming and JSDoc

Test names follow the Given-When-Then form inside a `describe` /
`it` pair:

```ts
describe("publish", () => {
  it("returns zero when the topic has no subscribers", async () => {
    // Given a topic with no subscribers,
    // When publish is called,
    // Then it returns 0.
  })
})
```

Prefer `it(...)` to `test(...)` so test names read as
specifications ("it returns zero when..."). One of the forms is fine;
pick one per package and stick to it.

If the test file exports helpers, every exported helper has a
one-line JSDoc. Tests themselves do not need JSDoc -- the `it` name
**is** the contract.

---

## 17. Performance Budgets

- Unit test suite: total wall-clock under 30 seconds (per package)
- Integration suite: total wall-clock under 5 minutes (per package)
- Any individual unit test over 10ms on modern dev hardware (M1 or
  newer) is suspicious -- a true unit test (in-memory, no I/O) should
  finish in single-digit milliseconds. Investigate before accepting
- Any individual unit test over 1 second fails CI (hard limit, kept
  generous so CI runners on slower hardware do not flake)
- Any individual integration test over 30 seconds fails CI

Performance regressions in the test suite are bugs, not annoyances.

Use `vitest --reporter=verbose --reporter=hanging-process` when
investigating hangs.

---

## 18. Local Execution Notes (macOS / zsh)

The local development environment is an Apple Silicon Mac running
zsh. A few practical gotchas:

- **Vitest's default pool is `threads`.** If a test hits the Node
  filesystem in a way that does not like worker threads, switch to
  `pool: "forks"` for that project rather than disabling parallelism
  globally.
- **`process.cwd()` in tests** is the package root, not the repo
  root, because we run `npm -C packages/foo test`. Use
  `import.meta.url` + `fileURLToPath` for deterministic paths.
- **Docker Desktop is required for integration tests** that use
  `testcontainers`. CI runs in Linux containers natively; local runs
  go through Docker Desktop's VM. Expect 2-3x slower container
  startup locally vs. CI -- this is normal, not a bug.
- **Cloudflare Worker tests** use
  `@cloudflare/vitest-pool-workers`, not bare miniflare, so that
  bindings (KV, R2, D1, queues) use the same runtime in tests as in
  production. Do not hand-roll a miniflare instance inside a test
  file.
- **Quote glob patterns** when invoking vitest to dodge zsh's "no
  matches found" error: `vitest 'tests/unit/**/*.test.ts'` works;
  unquoted breaks if zsh expansion finds zero matches.

---

## 19. Quick Checklist

Before merging:

- [ ] Test written FIRST (Red-Green-Refactor cycle)
- [ ] Test asserts on observable behavior, not internal calls
- [ ] Test name reads as a specification (`it("returns X when Y")`)
- [ ] Test function and all helpers fully type-annotated (no `any`)
- [ ] No real `setTimeout`/`setInterval` sleeps anywhere
- [ ] No `vi.mock("./local-module", ...)` against first-party code
- [ ] Per-test fixtures unless wider scope is justified with a comment
- [ ] Test survives `vitest --sequence.shuffle` and default parallelism
- [ ] Pure functions have at least one `fast-check` test
- [ ] Every port has a contract test suite (`describe.each`) covering
      both fake and real adapter
- [ ] `.skip` / `.todo` / `.fails` all have reason + tracker link
- [ ] Coverage above 70% repo-wide; Stryker mutation score above 80%
      on `domain/` and `ports/`
- [ ] Suite total wall-clock budgets respected

---

## 20. The One-Sentence Test

> A test that breaks because the code was refactored, but the behavior
> did not change, is a bad test. A test that breaks because the
> behavior changed is doing its job. A test that does not break when
> the behavior breaks is the worst kind.

Write the second kind. Delete the first kind on sight. Hunt for the
third kind with Stryker.
