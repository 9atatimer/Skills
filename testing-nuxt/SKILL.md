---
name: testing-nuxt
description: "Writing or reviewing tests for Nuxt 4 / Vue 3 code: Vitest + @vue/test-utils + Playwright standards, plus Stryker mutation testing scope and thresholds for composables/stores/utils/server. Read alongside the universal testing skill."
---

# Testing Standards -- Nuxt 4 / Vue 3

> Companion to the universal [testing skill](../testing/SKILL.md) (generic principles).
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

## 6.1 Nuxt Runtime Mocks (Mandatory)

### Mock `#app`
```ts
vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $supabase: {},
    $posthog: {},
  }),
  useRuntimeConfig: () => ({
    public: {},
    private: {}
  })
}))
```

### Robust vs Weak Mocking
```typescript
// WEAK mocking (breaks when component changes):
vi.mock("#imports", () => ({
  useSupabaseClient: () => ({ auth: { getUser: vi.fn() } }),
}));

// ROBUST mocking (handles all component needs):
vi.mock("#imports", () => ({
  useSupabaseClient: () => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id" } },
        error: null,
      }),
    },
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({
          data: { path: "test/path.jpg" },
          error: null
        }),
      }),
    },
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockResolvedValue({
          data: [{ id: "test-image-id" }],
          error: null
        }),
      }),
    }),
  }),
  useSupabaseUser: () => ({ value: { id: "test-user-id" } }),
}));
```

## 6.2 Mock Factory Pattern (DRY)

```typescript
const createMockSupabaseClient = () => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({
      data: { user: null },
      error: null,
    }),
    getSession: vi.fn().mockResolvedValue({
      data: { session: null },
      error: null,
    }),
    signInWithOAuth: vi.fn(),
    signOut: vi.fn(),
  },
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
});

vi.mock('#app', () => ({
  useNuxtApp: () => ({
    $supabase: { client: createMockSupabaseClient() },
  }),
}));
```

## 6.3 useState Caching Pattern

Nuxt's `useState` caches values by key. Mock this behavior to match production:

```typescript
import { ref } from 'vue';

const stateCache = new Map<string, any>();

vi.mock('#app', () => ({
  useState: (key: string, init?: Function) => {
    if (!stateCache.has(key)) {
      stateCache.set(key, ref(init ? init() : undefined));
    }
    return stateCache.get(key);
  },
}));

beforeEach(() => {
  stateCache.clear();
});
```

Without caching, each `useState('key')` call creates a new ref, breaking state sharing between components.

## 6.4 Centralized Mock Directory

All reusable mocks live in `tests/mocks/`: `supabase.ts`, `usePosthog.ts`, `nuxt-app.ts`, `nuxt-imports.ts`.

Components using auto-imports can add explicit imports for test compatibility:
`import { usePosthog } from "#imports"` -- works in production (Nuxt ignores duplicates) and tests (resolves via vitest aliases).

## 6.5 Cleanup (Test Isolation)

```ts
import { beforeEach, afterEach, vi } from 'vitest'
import { config } from '@vue/test-utils'
import { createPinia } from 'pinia'

const stateCache = new Map<string, any>();

beforeEach(() => {
  vi.clearAllMocks()           // Clear mock call history
  stateCache.clear()           // Clear useState cache
  config.global.plugins = [createPinia()]  // Fresh store instances
})

afterEach(() => {
  vi.restoreAllMocks()         // Restore original implementations
})
```

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

#### 1. Document the Chain
```typescript
// Event Chain:
// 1. User clicks menu button -> SearchHeader emits menu-click
// 2. Parent sets isMenuOpen=true -> HamburgerMenu becomes visible
// 3. User clicks backdrop -> HamburgerMenu emits close
// 4. Parent sets isMenuOpen=false -> HamburgerMenu becomes hidden
```

#### 2. Test Each Link Separately
```typescript
// SearchHeader in isolation
it('emits menu-click event', async () => {
  const wrapper = mount(SearchHeader)
  await wrapper.find('[data-testid="menu-button"]').trigger('click')
  expect(wrapper.emitted('menu-click')).toBeTruthy()
})

// HamburgerMenu in isolation
it('responds to isOpen prop', async () => {
  const wrapper = mount(HamburgerMenu, { props: { isOpen: false } })
  expect(wrapper.find('.menu').isVisible()).toBe(false)
  await wrapper.setProps({ isOpen: true })
  expect(wrapper.find('.menu').isVisible()).toBe(true)
})
```

#### 3. Integration Test for Full Chain
```typescript
it('shows menu when header button clicked', async () => {
  const wrapper = mount(IndexPage)
  await wrapper.find('[data-testid="menu-button"]').trigger('click')
  const menu = document.body.querySelector('[data-testid="menu"]')
  expect(menu).toBeVisible()
})
```

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

### One test attribute everywhere: `data-testid=""`

Playwright and `@vue/test-utils` share a single selector attribute. There is
**no** `data-cy` -- unit/component tests and E2E specs both key off
`data-testid`, so a component carries exactly one test attribute.

### Prefer user-facing locators in E2E
In Playwright, reach for role/label/text locators first (`getByRole`,
`getByLabel`, `getByText`); they assert accessibility as a side effect. Fall
back to `getByTestId()` (which resolves `data-testid`) only when no stable
user-facing handle exists.

### Naming Convention
```
component-name-element-role
```
Examples:
```
data-testid="hamburger-menu-button-toggle"
data-testid="login-form-submit"
```

### Components Carry One Attribute
```vue
<button
  data-testid="submit-button"
  @click="handleClick"
>Submit</button>
```

```typescript
// Unit/component test (@vue/test-utils)
wrapper.find('[data-testid="submit-button"]').trigger('click')

// E2E spec (Playwright) -- prefer getByRole; getByTestId is the fallback
await page.getByRole('button', { name: 'Submit' }).click()
await page.getByTestId('submit-button').click()
```

---

# 10. Test Pages Convention

Development-only pages for testing complex components without production constraints.

### Location: `pages/test/[feature]-[variant].vue`

### Required Documentation
```typescript
/**
 * TEST-ONLY PAGE
 * Purpose: [Brief description]
 * Differences from production:
 * - [e.g., "No teleport used"]
 * - [e.g., "Simplified state management"]
 * - [e.g., "Additional debug buttons"]
 */
```

### Security (Multi-Layer Protection)
```typescript
// nuxt.config.ts -- Build exclusion
ignore: [
  !['local', 'dev'].includes(process.env.STAGE || '') ? "pages/test/**" : undefined
]

// nuxt.config.ts -- Route rules
routeRules: {
  "/test/**": ['local', 'dev'].includes(process.env.STAGE || '')
    ? { cors: true }
    : { redirect: '/404' }
}

// middleware/block-test-pages.ts
export default defineNuxtRouteMiddleware((to) => {
  const stage = process.env.STAGE || ''
  if (!['local', 'dev'].includes(stage) && to.path.startsWith('/test')) {
    return navigateTo('/404')
  }
})
```

---

# 11. Playwright E2E Testing

### Selector Usage
- Prefer `getByRole` / `getByLabel` / `getByText`; use `getByTestId`
  (`data-testid`) as the fallback.
- There is no `data-cy` -- E2E and unit tests share `data-testid`.

### Config sketch (`playwright.config.ts`)
```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.spec.ts',
  use: { baseURL: process.env.BASE_URL ?? 'http://localhost:3000' },
  // Boot the app for the suite; reuse a running dev server locally.
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

### E2E Authentication Pattern

Playwright has no `Cypress.Commands`/`cy.session`. Model the same three
concerns -- per-test user, cached login, cleanup -- with **fixtures** and a
saved `storageState`.

#### 1. Per-test user + cached login (fixture)
```typescript
import { test as base, expect } from '@playwright/test'

type Fixtures = { testUser: { id: string; email: string } }

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    const email = `test-${Date.now()}@example.com`
    const { data } = await adminSupabase.auth.admin.createUser({
      email,
      password: 'password',
      email_confirm: true,
      user_metadata: { is_test_user: true },
    })
    await use({ id: data.user.id, email })
    // Cleanup runs after the test, whatever the outcome.
    await adminSupabase.auth.admin.deleteUser(data.user.id)
  },
})
export { expect }
```

#### 2. Login via UI, persist session with `storageState`
```typescript
async function loginViaUI(page, email: string, password: string) {
  await page.goto('/test/fixture-login')
  await page.getByTestId('test-login-email').fill(email)
  await page.getByTestId('test-login-password').fill(password)
  await page.getByTestId('test-login-submit').click()
  await expect(page.getByTestId('test-login-success')).toBeVisible({ timeout: 10_000 })
  // Reuse across specs by saving storage state (cookies + localStorage).
  await page.context().storageState({ path: '.auth/user.json' })
}
```

#### 3. Auth state verification
```typescript
test('authenticated home renders', async ({ page, testUser }) => {
  await loginViaUI(page, testUser.email, 'password')
  await page.goto('/')

  // Verify Nuxt hydrated and recognized auth -- token set =/= auth recognized.
  await expect(page.locator('#__nuxt')).toBeVisible()  // hydration marker
  await expect(page).not.toHaveURL(/\/login/)           // no redirect
})
```

### Auth Testing Notes
- Setting auth token =/= auth state recognized by Nuxt
- Must verify Nuxt has hydrated and recognized auth
- Watch for race conditions between auth and page load; prefer Playwright's
  web-first `expect` auto-waiting over fixed timeouts
- Configure `supabase.redirectOptions` in `nuxt.config.ts` if needed

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

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": [
    "composables/**/*.ts",
    "stores/**/*.ts",
    "utils/**/*.ts",
    "server/**/*.ts",
    "!**/*.test.ts",
    "!**/*.nuxt.test.ts"
  ],
  "thresholds": { "high": 90, "low": 80, "break": 80 }
}
```

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
```typescript
// Isolate logic from DOM event complexity
await wrapper.vm.handleClick();
expect(mockFn).toHaveBeenCalledTimes(1);
```
Production tests should use DOM interactions, but direct method calls help isolate issues.
