---
name: style-typescript
description: "Writing or modifying TypeScript/Vue/Nuxt: toolchain and style conventions plus TS-specific architecture edges (fetch/process.env/SDKs stay out of domain modules; auto-imports don't bypass the dependency rule). Load alongside the coding skill for any TS work."
---

# TypeScript Style Guide

> Conventions for TypeScript, Vue, and Nuxt code.

## Formatting

- **Prettier**: printWidth 140, singleQuote true, semi true
- **Indentation**: Spaces, not tabs
- **ESLint**: Vue.js Style Guide (Priority A, B, C rules)

## Toolchain

- **Pin `engines.node` to the strictest devDependency's floor** (e.g.
  lint-staged 16 needs `>=20.17`). A looser floor installs cleanly and
  then fails at hook runtime on an older Node.
- **pnpm, where a repo uses it** (its agent file says so):
  - pnpm passes a literal `--` through to the script; npm strips it.
    Write `pnpm run <s> <args>`, never `pnpm run <s> -- <args>`, or the
    tool behind the script sees `--` and ignores what follows.
  - `pnpm --filter <pkg>` exits 0 when nothing matches (`npm -w` exits
    1). A script a workflow or deploy depends on adds
    `--fail-if-no-match`, or a renamed package turns it silently green.
  - The `+sha512` suffix on `packageManager` is not verified by pnpm's
    own version switch (only corepack checks it); the pin is exact by
    version, the download integrity-checked like any dependency.
  - A global pnpm on `PATH` (nvm installs one per Node version) shadows
    the `packageManager` pin, and plain `corepack pnpm` runs that same
    copy; an install then fails with `ERR_PNPM_LOCKFILE_BREAKING_CHANGE`.
    Name the pinned version: `corepack pnpm@<version> install`.
  - Never point `PNPM_HOME` inside a repo: pnpm self-installs the pinned
    version from there, finds the repo's `package.json`, and switches
    again, without bound.
  - `pnpm import` seeds from an existing `node_modules/.pnpm/lock.yaml`.
    Delete `node_modules` first, then diff the `name@version` sets of the
    two lockfiles; a stale seed keeps old resolutions silently.

## Language

- TypeScript everywhere; JavaScript only where TS isn't feasible
- Strict mode enabled

## Vue Components

- Vue 3 Composition API with `<script setup>`
- Structure: Template first, then script, then style
- Naming: PascalCase for components (`AppLayout.vue`)
- Functions/variables: camelCase

## Nuxt and Vue traps

- A dynamic-param page is reused across navigations, so `setup()` does not
  rerun: read the param as a `computed`, pass `{ watch: [param] }` to
  `useAsyncData`, and give it a stable key, not one with the param in it.
- Bind a composable's function in `<script setup>`; a name used only in the
  template is undefined at run time.
- Guard browser-only APIs with `import.meta.client`, and wrap them:
  `localStorage` throws when storage is full, private or disabled.
- Use `||`, not `??`, where a `NOT NULL` text column can hold `''`.
- A caught error is `unknown`: read it through one helper that checks
  `instanceof Error`, and wrap every composable call that can reject.
- A null profile has two causes, signed out and row missing: branch on
  `user` first, and show "profile missing" only for `user && !profile`.
- Under `noUncheckedIndexedAccess`, destructure an index into a local and
  guard it; a `.length` check does not narrow `arr[0]`.
- A file input's `accept` is a hint: validate the extension, reset
  `input.value` after reading, and add `@drop` and `@dragover.prevent`.
- Normalize a lookup key (`trim().toLowerCase()`) before reading a map.
- Truncate, do not round, a compact count (9,999 is not "10.0k"), and pin
  `timeZone: 'UTC'` in a date format whose result must not depend on the
  runner.

## Imports

- Group: external libraries first, then local components/utils
- Nuxt auto-imports: `ref`, `computed`, `useRoute`, etc.
- Don't add explicit imports for auto-imported composables in app code.
  Tests are the exception: they cannot rely on Nuxt auto-imports and must
  import explicitly (see the testing-nuxt skill)

## Error Handling

- try/catch with specific error messages
- Log errors appropriately
- Use "Milestone:" comments for significant code sections

## Architecture

The architecture rules are universal -- see the coding skill, Section 1. The only
TypeScript/Vue-specific points:

- **The edge is `fetch` / `process.env` / SDK clients / model strings.** Keep
  them out of domain modules; in a Nuxt app a composable is a fine seam.
- **Auto-imports do not bypass the dependency rule.** A convenient global is
  still a concrete detail -- do not reach for one inside domain logic.
- **A Nuxt server route or a Worker `fetch` handler is an entry point, not a
  use case.** It parses the request, calls one application function by the
  signature the architecture record's use-case surface gives it, and shapes
  the response. The workflow lives in that function, where a test can call
  it with fakes and no HTTP in front.
