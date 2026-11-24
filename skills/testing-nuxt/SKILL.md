---
name: testing-nuxt
description: "Writing or reviewing tests for Nuxt 4 / Vue 3 code: Vitest + @vue/test-utils + Playwright standards, plus Stryker mutation testing scope and thresholds for composables/stores/utils/server. Read alongside the universal testing skill."
---

# Testing Standards -- Nuxt 4 / Vue 3

> Companion to the universal testing skill (generic principles).
> This document covers **Nuxt 4-specific** testing practices.

---

# 1. SSR Compatibility (Non-Negotiable)

Nuxt 4 has strict SSR constraints. Tests **must fail** if browser-only APIs are accessed during SSR.

### Key Rules
- Use explicit imports -- never rely on auto-imports in tests:
  ```ts
  import { useNuxtApp, useRuntimeConfig } from '#app'
  import { useSupabaseClient, useSupabaseUser } from '#imports'
  ```
- Any browser access (`window`, `document`, `localStorage`, `navigator`) must be inside `process.client` guards
- Use `.nuxt.test.ts` suffix for SSR compatibility tests

### Common SSR Fixes
```typescript
// Bad: Direct window access
const config = window.$nuxt.$config

// Good: Using Nuxt composable
import { useRuntimeConfig } from '#imports'
const config = useRuntimeConfig()
```

### SSR Test Pattern
```ts
import { describe, it, expect } from 'vitest'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import Component from '~/components/...'

describe('SSR', () => {
  it('renders without client APIs', async () => {
    expect(async () => await mountSuspended(Component)).not.toThrow()
  })
})
```

Failures indicate: browser-only API use, missing `process.client` guards, missing explicit imports, or bad mock usage.

---

# 2. Test Types and Required Tools

| Layer | Purpose | Tools |
|------|---------|-------|
| **Unit Tests** | Logic, composables, stores, event emission | Vitest + happy-dom |
| **Component Tests** | Component behavior, SSR compatibility | Vitest + @vue/test-utils + @nuxt/test-utils |
| **Integration Tests** | Page-level behavior without network | @nuxt/test-utils/browser |
| **E2E Tests** | Full app behavior incl. login | Playwright |

Nuxt 4 requires **happy-dom** for component tests unless jsdom is explicitly needed.

### Component Testing Library Standard

**Standard: Use `@vue/test-utils` (via `mountSuspended` from `@nuxt/test-utils`)**

Per the [official Vue.js testing guide](https://vuejs.org/guide/scaling-up/testing):
> "We recommend using `@vue/test-utils` for testing components. `@testing-library/vue` has issues with testing asynchronous components with Suspense, so it should be used with caution."

Since Nuxt 4 heavily uses async components and Suspense, standardize on `@vue/test-utils`.

**DO NOT use `@testing-library/vue`** -- it has [known Suspense issues](https://github.com/testing-library/vue-testing-library/issues/230).

---

# 3. Multi-Project Test Architecture

Separate Vitest configs for different test environments:

### Unit Tests (Default)
- **Command**: `npm run test:fast` or `npm run test:unit`
- **Config**: `vitest.config.ts`
- **Environment**: happy-dom (fast, mocked)
- **Files**: `**/*.test.ts` (excluding `*.nuxt.test.ts`)
- **CI/CD**: Use for branch protection

### SSR Tests (Optional)
- **Command**: `npm run test:ssr`
- **Config**: `vitest.config.ssr.ts`
- **Environment**: nuxt (full Nuxt app)
- **Files**: `**/*.nuxt.test.ts`
- **CI/CD**: Optional -- may require service credentials

### CRITICAL: Do Not Use `defineVitestConfig`

**DO NOT** use `defineVitestConfig` from `@nuxt/test-utils/config` -- it causes tests to run in **both** nuxt and happy-dom environments, doubling execution time and creating inconsistent results. Use standard `defineConfig` from `vitest/config` instead.

---

# 4. File Naming and Directory Structure

```
tests/
  unit/             # composables, stores
  components/       # component behavior tests
  ssr/              # SSR compatibility tests
  integration/      # multi-component routing/page tests
  e2e/              # Playwright specs (playwright.config.ts testDir)
```

| Test Type | Filename Suffix |
|-----------|------------------|
| Unit | `*.test.ts` |
| Component | `*.component.test.ts` |
| SSR compatibility | `*.nuxt.test.ts` |
| Integration (browser) | `*.integration.test.ts` |
| Playwright E2E | `*.spec.ts` |

---

# 5. Vitest Configuration

- **happy-dom** is the default DOM environment
- **No auto-imports** in tests -- enforce explicit imports (`globals: false`)
- Nuxt module aliases `#app` and `#imports` mocked via `resolve.alias` in `vitest.config.ts`

### Required Imports Pattern
```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import { useNuxtApp } from '#app'
import MyComponent from '~/components/MyComponent.vue'

// For Nuxt-aware tests (async components, composables, plugins):
import { mountSuspended } from '@nuxt/test-utils/runtime'
```

---

# 6. Mocking Standards

## 6.1 Nuxt Runtime Mocks, 6.2 Mock Factory, 6.3 useState Caching

Mocking `#app` (`useNuxtApp`, `useRuntimeConfig`, `useState`) is mandatory for
components and composables that use Nuxt runtime. Define mocks BEFORE imports.
Prefer robust mocks that cover every call the component makes over weak ones
that break when the component changes. Build mock clients with a factory, not
inline. Mock `useState` with a key-keyed cache (cleared in `beforeEach`), or
each call makes a new ref and state sharing breaks.

Read `references/nuxt-detail.md`, "Nuxt runtime mocks, mock factory, useState caching", before you write or change a `#app` / `#imports` mock.

## 6.4 Centralized Mock Directory

All reusable mocks live in `tests/mocks/`: `supabase.ts`, `usePosthog.ts`, `nuxt-app.ts`, `nuxt-imports.ts`.

Components using auto-imports can add explicit imports for test compatibility:
`import { usePosthog } from "#imports"` -- works in production (Nuxt ignores duplicates) and tests (resolves via vitest aliases).

## 6.5 Cleanup (Test Isolation)

In `beforeEach`: `vi.clearAllMocks()`, clear the `useState` cache, install a fresh
`createPinia()` in `config.global.plugins`. In `afterEach`: `vi.restoreAllMocks()`.
Read `references/nuxt-detail.md`, "Cleanup for test isolation", for the code.

---

# 7. Pinia Store Testing

### Global Setup
```typescript
beforeEach(() => {
  config.global.plugins = [createPinia()];
});
```

Fresh Pinia per test prevents store state pollution.

### Testing Store Actions
```typescript
import { setActivePinia, createPinia } from 'pinia';
import { useUserStore } from '~/stores/user';

beforeEach(() => {
  setActivePinia(createPinia());
});

it('updates user profile', async () => {
  const store = useUserStore();
  await store.updateProfile({ name: 'Test User' });
  expect(store.profile.name).toBe('Test User');
});
```

### Testing Components with Stores
```typescript
it('displays user data from store', async () => {
  const wrapper = mount(ProfileComponent);
  const store = useUserStore();
  store.profile = { name: 'Test User', email: 'test@example.com' };

  await wrapper.vm.$nextTick();
  expect(wrapper.find('[data-testid="profile-name"]').text()).toBe('Test User');
});
```

---

# 8. Component Testing Patterns

### Rendering
```ts
import { mount } from '@vue/test-utils'
const wrapper = mount(Component, { props: { ... } })

// For Nuxt-aware components (async setup, composables, plugins):
import { mountSuspended } from '@nuxt/test-utils/runtime'
const wrapper = await mountSuspended(Component, { props: { ... } })
```

### Teleport Testing
Teleported content renders outside the component wrapper:
```ts
// Won't find teleported content:
const menu = wrapper.find('.menu')

// Will find it:
const menu = document.body.querySelector('[data-testid="menu"]')
```

Important for: modals, nav menus, tooltips, popovers, overlays.

### Async Rendering
Use `await nextTick()` after state changes to wait for DOM updates. In Nuxt 4 (Vue 3.5+),
a single tick is sufficient -- the double-tick workaround from Vue 3.4 is no longer needed:
```ts
await nextTick()
```

### Testing Event Chains

Document the chain as a comment (who emits, who sets state, what becomes visible), test each link
in isolation (emit on click; respond to a prop), then add one integration test of the full chain.
Read `references/nuxt-detail.md`, "Testing event chains", before you test a multi-component event chain.

### Event Handling Best Practices

Use `defineEmits` with typed events. Use named methods, not inline `$emit`:
```typescript
// Bad
<button @click="$emit('menu-click')">

// Good
const emit = defineEmits<{ 'menu-click': [] }>()
const handleMenuClick = () => emit('menu-click')
<button @click="handleMenuClick">
```

---

# 9. Selector Requirements

### Non-E2E tests (unit / component / integration / SSR) use: `data-testid=""`
### Playwright E2E tests use: `data-pw=""`

Two separate selector namespaces. Everything under `tests/` except `tests/e2e`
-- unit, component, integration, and SSR tests, plus any shared helpers --
keys off `data-testid`. All Playwright E2E code (specs and their
fixtures/page-objects) keys off `data-pw`, which `getByTestId()` resolves
because `playwright.config.ts` sets `testIdAttribute: 'data-pw'` (see Section
11). The rule applies to the whole tree, not just spec files.

### Strict Separation Rule
A test must **never** cross-use the other selector type. Violations must be corrected immediately.

### Prefer user-facing locators in E2E
Within E2E, reach for role/label/text locators first (`getByRole`,
`getByLabel`, `getByText`); fall back to `getByTestId()` (-> `data-pw`) only
when no stable user-facing handle exists.

### Naming Convention
```
component-name-element-role
```
Examples:
```
data-testid="hamburger-menu-button-toggle"
data-pw="login-form-submit"
```

### Components Carry Both
```vue
<button
  data-testid="submit-button"
  data-pw="submit-button"
  @click="handleClick"
>Submit</button>
```

```typescript
// Unit test: data-testid ONLY
wrapper.find('[data-testid="submit-button"]').trigger('click')

// E2E spec (Playwright): data-pw ONLY, via getByTestId (testIdAttribute: 'data-pw')
await page.getByTestId('submit-button').click()
```

---

# 10. Test Pages Convention

Development-only pages for testing complex components without production constraints.

### Location: `pages/test/[feature]-[variant].vue`

Each test page carries a header comment: "TEST-ONLY PAGE", its purpose, and how it
differs from production. Test pages are excluded from the build and redirected to
`/404` outside the `local` and `dev` stages, in three layers: `ignore` in
`nuxt.config.ts`, `routeRules`, and a route middleware.
Read `references/nuxt-detail.md`, "Test pages: documentation and security", before you add a test page or change how they are protected.

---

# 11. Playwright E2E Testing

### Selector Usage
- Prefer `getByRole` / `getByLabel` / `getByText`; use `getByTestId` as the
  fallback -- it resolves `data-pw` (see config below).
- E2E specs use `data-pw`; unit/component tests use `data-testid`. Never
  cross-use the two.

### Config sketch (`playwright.config.ts`)

`testIdAttribute: 'data-pw'` makes `getByTestId()` target `data-pw`. `webServer.url`
shares `baseURL`; reuse a running dev server locally, not in CI.
Read `references/nuxt-detail.md`, "Playwright config sketch", before you write or change `playwright.config.ts`.

### E2E Authentication Pattern

Playwright has no `cy.session`: model per-test user, login and cleanup with fixtures.
Create the user with a `randomUUID()` email (never `Date.now()` alone), check the `{ error }` of
admin create and delete calls (they do not throw), log in through the UI, and assert on an
authenticated-only element -- token set =/= auth recognized, and `#__nuxt` is present in SSR HTML.
Prefer web-first `expect` auto-waiting over fixed timeouts.
Read `references/nuxt-detail.md`, "E2E authentication pattern", before you write an authenticated E2E test.

---

# 12. Integration Tests (Nuxt Test Utils)

### SSR Page Testing
```ts
import { setup, $fetch } from '@nuxt/test-utils/e2e'
await setup({ rootDir: '../..' })
const html = await $fetch('/')
```

### Browser-Based Interaction
```ts
import { setup, createPage } from '@nuxt/test-utils/browser'
await setup({ browser: true })
const page = await createPage('/')
await page.getByTestId('...').click()
```

---

# 13. Mutation Testing (Stryker)

Line coverage is a smoke threshold; mutation score is the real quality
bar. For Nuxt/Vue code, use **Stryker Mutator** -- the JS/TS equivalent
of Python's `mutmut`. Every language in this repo uses a
mutation-testing tool of the same class (see the testing-python skill for
Python, the testing-node skill for non-Nuxt Node/TS).

### Packages

- `@stryker-mutator/core`
- `@stryker-mutator/vitest-runner`
- `@stryker-mutator/typescript-checker` (optional, catches type errors
  in mutants before running them)

### Scope

Mutate composables, stores, pure utilities, and domain logic.
**Do not** mutate:

- `.vue` single-file-component templates (Stryker's AST handling on
  templates is unreliable; test component behavior via `@vue/test-utils`
  assertions instead)
- Generated files (`.nuxt/`, `dist/`)
- Test files themselves

### Config sketch (`stryker.conf.json`)

`testRunner: "vitest"`, `coverageAnalysis: "perTest"`, `mutate` over `composables`, `stores`,
`utils`, `server`, excluding `*.test.ts` and `*.nuxt.test.ts`; thresholds `high 90`, `low 80`, `break 80`.
Read `references/nuxt-detail.md`, "Stryker config sketch", before you write `stryker.conf.json`.

### Thresholds

- **Composables, stores, utils, `server/`**: mutation score >= 80%
- **UI-only components**: not mutation-tested (cover with component
  behavior tests + Playwright E2E)

### When to run

- On PRs that touch composables, stores, or `server/` routes
- Weekly on the full mutate set (scheduled CI job)
- Locally before shipping a refactor of business logic

Run with `npx stryker run`. Investigate every surviving mutant -- a
surviving mutant is a statement the test suite proves unnecessary.

---

# 14. Debugging Nuxt-Specific Failures

**SSR Failures (ReferenceError: window is not defined)**
- Missing `process.client` guard
- Browser API used during SSR
- Fix: Wrap in `if (process.client) { ... }`

**Async Timing Issues**
- Add `await nextTick()` after state changes before asserting on DOM
- Use `waitFor()` for async state changes

**Mock Not Working**
- Ensure mock defined BEFORE imports
- Use `vi.clearAllMocks()` in `beforeEach`
- Check mock structure matches actual API shape

**Component-Test Parity Issues**
- ALWAYS examine both the test file and the component file side-by-side
- For selector failures, first check component markup
- For component changes, identify and update ALL affected tests

**Temporary Direct Method Invocation (debugging only)**
Production tests use DOM interactions; call a method directly only to isolate a failure.
Read `references/nuxt-detail.md`, "Direct method invocation", for the snippet.
