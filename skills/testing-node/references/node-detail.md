# Node testing detail

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Contents

- Toolchain table (Section 2)
- setupFiles contents (Section 5)
- Contract test example (Section 6)
- Dependency injection example (Section 6)
- Fake example (Section 6)
- First-party vi.mock brittleness (Section 6)
- Implicit port rules (Section 6)
- Stryker configuration sketch (Section 7)
- Property-based test example (Section 8)
- FakeClock example (Section 10)
- Snapshot use list (Section 12)
- Log assertion helper (Section 13)
- Test data examples (Section 14)
- Skip and fails examples (Section 15)
- Test naming example (Section 16)
- Performance budget detail (Section 17)
- Local execution notes (Section 18)
- Quick checklist (Section 19)
- Property-based testing, full section (Section 8)
- CLI tests, full section (Section 11)
- Snapshot tests, full section (Section 12)
- Log assertions, full section (Section 13)
- Test data, full section (Section 14)
- Skip lint note (Section 15)

## Toolchain table

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

## setupFiles contents

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

## Contract test example

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

## Dependency injection example

```ts
// Yes
export function makeHandler(deps: { db: Db; clock: Clock; logger: Logger }) {
  return async (req: Request) => { /* ... */ }
}

// No
import { db } from "./singletons"
export async function handler(req: Request) { /* reaches into singleton */ }
```

## Fake example

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

## First-party vi.mock brittleness

`vi.mock` against first-party modules is also brittle in a way that
bites silently: it hoists above imports, it replaces the *module
binding* not the symbol, and it behaves differently under ESM vs CJS.
Tests pass locally, fail in production, or vice versa. Dependency
injection has no such failure mode.

## Implicit port rules

A port leaves some rules implicit: what a collision does, the order
results come back in, how a malformed id fails, who the caller is. Each
adapter then decides them alone, and no suite sees the two disagree.
Before an adapter family is called done, write a contract case for each
implicit rule; unstated rules are where adapters disagree.

## Stryker configuration sketch

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

## Property-based test example

```ts
import fc from "fast-check"

test("parse then stringify is identity for all valid configs", () => {
  fc.assert(fc.property(configArbitrary, (cfg) => {
    expect(parse(stringify(cfg))).toEqual(cfg)
  }))
})
```

## FakeClock example

```ts
interface Clock { now(): Date }

class FakeClock implements Clock {
  constructor(private t: Date) {}
  now() { return this.t }
  advance(ms: number) { this.t = new Date(this.t.getTime() + ms) }
}
```

## Snapshot use list

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

## Log assertion helper

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

## Test data examples

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

## Skip and fails examples

```ts
// Skip: flaky on macOS arm64; see issue #142
it.skip("decodes on all platforms", async () => { /* ... */ })

it.fails("should round-trip NaN -- see issue #203", async () => { /* ... */ })
```

## Test naming example

Prefer `it(...)` to `test(...)` so test names read as specifications ("it returns zero when..."). One of the forms is fine; pick one per package and stick to it. If the test file exports helpers, every exported helper has a one-line JSDoc. Tests themselves do not need JSDoc -- the `it` name **is** the contract.

```ts
describe("publish", () => {
  it("returns zero when the topic has no subscribers", async () => {
    // Given a topic with no subscribers,
    // When publish is called,
    // Then it returns 0.
  })
})
```

## Performance budget detail

- Unit test suite: total wall-clock under 30 seconds (per package)
- Integration suite: total wall-clock under 5 minutes (per package)
- Any individual unit test over 10ms on modern dev hardware (M1 or
  newer) is suspicious -- a true unit test (in-memory, no I/O) should
  finish in single-digit milliseconds. Investigate before accepting
- Any individual unit test over 1 second fails CI (hard limit, kept
  generous so CI runners on slower hardware do not flake)
- Any individual integration test over 30 seconds fails CI

Use `vitest --reporter=verbose --reporter=hanging-process` when
investigating hangs.

## Local execution notes

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

## Quick checklist

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

## Property-based testing, full section

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

## CLI tests, full section

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

## Snapshot tests, full section

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

## Log assertions, full section

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

## Test data, full section

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

## Skip lint note

A skip, todo, or fails without a reason and a tracker link fails
review. Packages that adopt `eslint-plugin-vitest` should enable
`vitest/no-disabled-tests` to surface bare `.skip` / `.todo` usage,
but the reason-and-tracker requirement is enforced in review, not by
the lint rule.
