# Nuxt testing detail


Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Contents

- Nuxt runtime mocks, mock factory, useState caching (Section 6)
- Cleanup for test isolation (Section 6)
- Test pages: documentation and security (Section 10)
- Playwright config sketch (Section 11)
- E2E authentication pattern (Section 11)
- Testing event chains (Section 8)
- Stryker config sketch (Section 13)
- Direct method invocation (Section 14)

## Nuxt runtime mocks, mock factory, useState caching

### 6.1 Nuxt Runtime Mocks (Mandatory)

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

### 6.2 Mock Factory Pattern (DRY)

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

### 6.3 useState Caching Pattern

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


## Cleanup for test isolation

### 6.5 Cleanup (Test Isolation)

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

## Test pages: documentation and security

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

## Playwright config sketch

### Config sketch (`playwright.config.ts`)
```typescript
import { defineConfig } from '@playwright/test'

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: './tests/e2e',            // matches the tests/ layout in Section 4
  testMatch: '**/*.spec.ts',
  use: {
    baseURL,
    testIdAttribute: 'data-pw',      // getByTestId() targets data-pw, not data-testid
  },
  // This config lives at the app root (apps/<name>/playwright.config.ts), so
  // `npm run dev` runs the app's own dev script -- from the repo root it would
  // be `npm -C apps/<name> run dev`. webServer.url shares baseURL so Playwright
  // waits on the same origin the tests target; reuse a running dev server locally.
  webServer: {
    command: 'npm run dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
})
```

## E2E authentication pattern

### E2E Authentication Pattern

Playwright has no `Cypress.Commands`/`cy.session`. Model the same concerns --
per-test user, login, cleanup -- with **fixtures**. (For cross-spec session
reuse, save `storageState` from a project-level global setup instead; the
per-test user below is ephemeral and must not be shared across specs.)

#### 1. Per-test user + cleanup (fixture)
```typescript
import { test as base, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'

type Fixtures = { testUser: { id: string; email: string } }

export const test = base.extend<Fixtures>({
  testUser: async ({}, use) => {
    // randomUUID() is unique across parallel workers; Date.now() alone can collide.
    const email = `test-${randomUUID()}@example.com`
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email,
      password: 'password',
      email_confirm: true,
      user_metadata: { is_test_user: true },
    })
    // Supabase admin calls return { data, error } -- they do not throw.
    if (error || !data.user) throw error ?? new Error('createUser returned no user')
    await use({ id: data.user.id, email })
    // Cleanup runs after the test, whatever the outcome. deleteUser also returns
    // { error } rather than throwing, so check it -- an ignored failure silently
    // leaks the test user.
    const { error: cleanupError } = await adminSupabase.auth.admin.deleteUser(data.user.id)
    if (cleanupError) console.warn(`Failed to delete test user ${data.user.id}:`, cleanupError)
  },
})
export { expect }
```

#### 2. Login via UI
```typescript
import { expect, type Page } from '@playwright/test'

async function loginViaUI(page: Page, email: string, password: string) {
  await page.goto('/test/fixture-login')
  await page.getByTestId('test-login-email').fill(email)     // -> data-pw
  await page.getByTestId('test-login-password').fill(password)
  await page.getByTestId('test-login-submit').click()
  await expect(page.getByTestId('test-login-success')).toBeVisible({ timeout: 10_000 })
}
```

#### 3. Auth state verification
```typescript
test('authenticated home renders', async ({ page, testUser }) => {
  await loginViaUI(page, testUser.email, 'password')
  await page.goto('/')

  // Assert on an authenticated-only element -- token set =/= auth recognized.
  // Waiting on a post-auth control is a real client signal; #__nuxt is present
  // in SSR HTML and does NOT prove hydration.
  await expect(page.getByTestId('user-menu')).toBeVisible()
  await expect(page).not.toHaveURL(/\/login/)  // no redirect to login
})
```

### Auth Testing Notes
- Setting auth token =/= auth state recognized by Nuxt
- Verify via an authenticated-only element, not `#__nuxt` (present during SSR)
- Watch for race conditions between auth and page load; prefer Playwright's
  web-first `expect` auto-waiting over fixed timeouts
- Configure `supabase.redirectOptions` in `nuxt.config.ts` if needed

## Testing event chains

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

## Stryker config sketch

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

## Direct method invocation

**Temporary Direct Method Invocation (debugging only)**
```typescript
// Isolate logic from DOM event complexity
await wrapper.vm.handleClick();
expect(mockFn).toHaveBeenCalledTimes(1);
```
Production tests should use DOM interactions, but direct method calls help isolate issues.
