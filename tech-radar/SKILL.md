---
name: tech-radar
description: "Choosing a library, framework, runtime, or any off-the-shelf tool; consult before adding any dependency. Adopt/Trial may be used; Hold/Verboten may not; un-radared tech must be proposed, never silently added. Skip when the task reuses only existing dependencies."
---

## Localization

The ring tables below are fleet defaults. A repo with a divergent stack may
shadow this skill with its own project-scope tech-radar skill carrying its
concrete radar (closest-wins); the tds-utils LMDE radar is the worked example.

# Tech Radar

> **Purpose:** The fleet's preferred (and forbidden) off-the-shelf technologies.
> Consult before adding any dependency. This is the single source of truth that
> keeps tooling consistent across every tool in the fleet.

## How to Use the Radar

* **Adopt** -- the default. Use it without asking.
* **Trial** -- approved; fine for new work, expect to standardize on it.
* **Hold** -- do not start new usage. Migrate away when you touch it. Not
  forbidden, but justify any new use in the design doc.
* **Verboten** -- never. If you think you need it, you are solving the wrong
  problem; raise it in the design doc instead.

**A radar entry is a mechanism, so it belongs at an edge.** Everything on this
radar (an SDK, a vendor, an endpoint, a model) is a *volatile mechanism* in the
sense of the coding skill, Section 1. Depend on it from an adapter behind a seam,
never from the core; keep its volatile specifics (model ids, base URLs, keys) as
parameters supplied at the edge, not constants in the domain. Choosing tech from
the radar and keeping it out of the core are the same discipline.

**Rules:**

1. Before reaching for an off-the-shelf solution, check this file.
2. Only **Adopt** or **Trial** technologies may be introduced in new code.
3. If what you need is **not on the radar at all**, do not silently add it.
   Propose it in the design doc / PR, and add it here (with a one-line
   rationale) as part of the same change.
4. This file is project-owned. Derivatives of the template edit it to reflect
   their stack; `naatm-prompts sync` will not clobber local edits.

---

## Adopt

| Category | Technology | Notes |
|---|---|---|
| Python: packaging | **uv** | Package + environment management. Python 3.11+. |
| Python: lint/format | **Ruff** | Linting and formatting. Config in `pyproject.toml`. |
| Python: types | **mypy (strict)** | Static type checking. Annotate everything; no `Any`. |
| Python: tests | **pytest** | Test runner. Given-When-Then naming. |
| Python: test data | **factory_boy** | Test data factories for ORM models only; plain dataclasses use builder functions (see the testing-python skill). |
| Python: property tests | **hypothesis** | Property-based testing. |
| Python: validation | **Pydantic** | Validation at external/input boundaries. |
| Python: data classes | **dataclasses** | `@dataclass(frozen=True, slots=True)` for internal data. |
| Python: CLI | **Click** | CLI entry points. |
| Logging | **structlog** | The only logging system. Never hand-roll logging. |
| TS/JS: language | **TypeScript (strict)** | Default for all JS work; JS only where TS is infeasible. |
| TS/JS: format | **Prettier** | printWidth 140, singleQuote, semi. |
| TS/JS: lint | **ESLint** | Vue.js Style Guide (Priority A/B/C). |
| Web framework | **Vue 3 + Nuxt** | Composition API, `<script setup>`. |
| TS/JS: tests | **Vitest** | Unit (happy-dom) vs integration (node). Jest is Hold -- the testing-node skill standardizes on Vitest. |
| Shell | **Bash 5.2+** | `set -euo pipefail`; see the style-bash skill. |
| Browser automation | **Chrome for Testing + chrome-devtools-mcp** | See the chrome-mcp skill. |
| Secrets | **1Password** (service-account / `load-secrets-action`) | Inject at runtime; do not paste secrets into GitHub. |
| CI / review | **GitHub Actions + ci.magic** | See `packages/naatm-ci-magic`. |

## Trial

| Category | Technology | Notes |
|---|---|---|
| LLM access | **OpenAI-compatible endpoints** (Cloudflare Workers AI / AI Gateway, Groq, Z.ai/GLM, Ollama) | Via the `openai-compat` adapter; one adapter covers the family by config. |
| LLM access | **claude-cli provider** | Drives Claude Code on a Pro/Max plan instead of a metered key. |

## Hold

| Category | Technology | Notes |
|---|---|---|
| Python typing | **`typing.Optional` / `typing.List` (legacy)** | Use PEP 585/604 (`X | None`, `list[X]`). |
| Python deps | **Pinned `==` or fully unpinned deps** | Use `>=` with a minimum version. |
| Inheritance for reuse | **Deep class inheritance** | Prefer composition + dependency injection. |

## Verboten

| Technology / Pattern | Why |
|---|---|
| **`Any` in Python type hints** | Defeats static analysis. Use `TypeVar`/`Generic` if truly polymorphic. |
| **Bare `except Exception` / swallowed errors** | Errors must be observable and diagnosable. |
| **Hand-rolled logging frameworks** | Use structlog. |
| **`sleep()` / wall-clock waits in tests** | Use fake clocks/timers and event coordination. |
| **Star/wildcard imports** | Obscure provenance; break static analysis. |
| **Reassigning global `IFS` in Bash** | Fragile, surprising; see the style-bash skill. |
| **Secrets committed to the repo or pasted into GitHub UI** | Manage in 1Password, inject at runtime. |
| **Speculative abstractions / frameworks beyond the design** | Build only what the design specifies. |

---

## Adding to the Radar

When a task needs something not listed:

1. State the need and the candidate in the design doc (and PR description).
2. Name the ring you are placing it in and why (one line).
3. Add the row here in the same change. The radar must never drift behind the code.
