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

## Language

- TypeScript everywhere; JavaScript only where TS isn't feasible
- Strict mode enabled

## Vue Components

- Vue 3 Composition API with `<script setup>`
- Structure: Template first, then script, then style
- Naming: PascalCase for components (`AppLayout.vue`)
- Functions/variables: camelCase

## Imports

- Group: external libraries first, then local components/utils
- Nuxt auto-imports: `ref`, `computed`, `useRoute`, etc.
- Don't add explicit imports for auto-imported composables

## Error Handling

- try/catch with specific error messages
- Log errors appropriately
- Use "Milestone:" comments for significant code sections

## Architecture

The architecture rules are universal -- see `SKILL.CODING.md` Section 1. The only
TypeScript/Vue-specific points:

- **The edge is `fetch` / `process.env` / SDK clients / model strings.** Keep
  them out of domain modules; in a Nuxt app a composable is a fine seam.
- **Auto-imports do not bypass the dependency rule.** A convenient global is
  still a concrete detail -- do not reach for one inside domain logic.
