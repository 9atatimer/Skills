---
name: coding
description: "Phase 5 of the SDLC: writing, implementing, or modifying source code in any language -- pre-code gates (design, architecture, plan, failing test, tech radar), stable-core/volatile-edges architecture with mechanical tests, function taxonomy, file anatomy. Skip when authoring a design doc (design), naming seams (architecture), building a phased plan (planning), or editing prose only (markdown)."
---

# SKILL: Implementation (Phase 5)

**Role & Mandate**

Act as a **Senior Software Architect and Principal Engineer** for a high-growth startup. Implement the attached design document to **production quality**, with an emphasis on correctness, clarity, maintainability, and testability, and low risk. This code must be suitable for a fast-moving startup and explicitly avoid accumulating technical debt.

If the design document is ambiguous, **do not guess**. Surface the ambiguity, explain the tradeoffs briefly, and propose the smallest reasonable resolution.

Deliver maintainable, testable, low-risk code for a fast-moving startup -- ship quickly without accumulating tech debt.

---

## 0. Before You Write Any Code (Gates)

These gates are non-negotiable. Do not skip them because the change "looks small."

1. **Design gate.** There must be an approved design doc for the tool you are touching.
   - Every tool/package has a `DESIGN.<name>.md` under `docs/design/`.
   - If it does not exist or is ambiguous, stop and use the design skill to write/fix it first.
2. **Architecture gate.** Every volatile axis this change introduces is named and mapped to one seam, against the as-built in `docs/arch/`. A seam first discovered while coding was never reviewed. -> the architecture skill
3. **Plan gate.** For any multi-step feature, build the phased, test-first plan with the planning skill and record it per the todo-plan skill.
4. **Test gate.** Write the failing test first (see Section 3). No production code without a failing test demanding it.
5. **Tech gate.** Any off-the-shelf dependency must be on the **Adopt** or **Trial** ring of the tech-radar skill. Never introduce a `Hold`/`Verboten` technology, and never silently add a dependency that is not on the radar -- propose adding it first.

---

## 1. Architecture: One Idea, Three Names

**The idea, in one sentence:** Separate what the software *means* from how it *connects to the world* -- keep the meaning stable and central, keep the connections volatile and replaceable, and point every dependency inward, toward the meaning.

Clean Architecture, Hexagonal (Ports & Adapters), and Domain-Driven Design are three angles on this **one** idea, not three vocabularies to satisfy. Internalize the idea; reach for the vocabulary only where it earns its place. (The lineage is footnoted at the end of this section for readers who want to follow it.)

### 1.1 The spirit (internalize these five)

* **Stable core, volatile edges.** The core is the decisions and rules in the language of the problem. The edges are mechanisms: HTTP, GitHub, the filesystem, a specific LLM vendor. Mechanisms change; meaning should not have to.
* **Dependencies point toward stability.** Details import abstractions; the core imports nothing concrete. A vendor SDK, an env var, a wire format, or a model id must never appear in the core.
* **The core owns decisions; edges own mechanisms.** "Which model should judge this" is a decision -> core. "Speak Anthropic's API" is a mechanism -> edge.
* **Name the things that change.** Every axis of change becomes one explicit seam -- a port, a policy, or a parameter -- never a hardcoded value and never an inline `if`.
* **Keep behavior with its data.** A type that is only fields, with the logic living somewhere else, is the anemic smell. Put invariants where the data is.

### 1.2 The tests (apply these mechanically)

Run these against any change. They are checks, not opinions.

| Test | Question | Fail means |
|---|---|---|
| **Grep test** | Does the core mention a vendor, SDK, `fetch`, `process.env`, `fs`, or a model string? | Leak -- move it to an edge |
| **Swap test** | Can I replace the LLM / code host / storage without touching the core? | Missing seam |
| **Decision test** | Is each important decision named, in one place, in the problem's language? | Scattered `||` / `if` logic -- extract a policy |
| **Arrow test** | Does every import cross *inward* (detail -> abstraction -> core)? | Inverted dependency |
| **Change test** | List what is likely to change. Does each axis map to exactly one module? | A hardcoded value, or a tangle |

The signal is concrete: if "we now also use Cloudflare" forces an edit to the core, the architecture failed the test -- that is the result, not a style preference.

### 1.3 The smells

* **Anemic model** -- a type that is all fields and no behavior, with its invariants enforced elsewhere.
* **Vendor in the core** -- an SDK import, `process.env`, a wire format, or a model id inside domain logic.
* **Decision as a `||`-chain** -- an important choice spread across inline conditionals instead of one named policy.
* **Port with one impl that will never have two** -- a seam introduced as ceremony (see the counter-warning).

### 1.4 Do not over-correct (YAGNI)

The opposite sin is just as real, and agents over-rotate here:

* **Abstract at the axes of change, not everywhere.** Introduce a seam when there are (or plausibly will be) *two* implementations, or when it crosses a vendor/process boundary. A port with a single forever-implementation is ceremony -- inline it.
* **Not every struct is an Entity / Value Object / Aggregate.** Use the pattern when the type carries an invariant; otherwise it is a plain value.
* **Vocabulary is a means.** Lead with intent, the tests, and the smells. The named patterns are lineage, not a checklist.

### 1.5 Worked example (ci-magic)

> Model selection is a *decision*, so it lives in the core as a named policy whose inputs (the assertion's properties, its past performance, cost and availability) are core concepts. The model id is *volatile*, so it is a parameter supplied at the edge, never a constant in the domain. "Talk to Anthropic / Cloudflare / Claude CLI" are interchangeable *mechanisms* behind one seam. When Claude is slow, the policy picks another model -- and nothing in the core changed, because the core never knew the model's name.

That paragraph teaches all three traditions at once without naming any of them. You can see the shape in `naatm-ci-magic`: `domain/` is pure (verdict, rule, judge, outcome) and names decisions; `adapters/llm/` holds the interchangeable mechanisms; the registry is the single place that knows the vendor set; adding an endpoint is one adapter file plus one `register()` call, with zero edits to the use case or domain. That is the Swap test and the Change test, passing.

### 1.6 What this looks like in practice (the lineage)

The realization of the idea, with the name each tradition gives each part:

```
+-------------------------------------------------------------+
|  cli / entry        composition root: wire adapters         |
|    v                                                        |
|  application        use cases: orchestrate ports only       |
|    v                                                        |
|  domain (the core)  decisions + rules, in the problem's     |
|    ^                language; imports nothing concrete       |
|    |  ports (seams) = the named axes of change              |
|  adapters (edges)   mechanisms: DB, HTTP, LLM, fs, GitHub   |
+-------------------------------------------------------------+
```

* The **core** is DDD's *domain*; its named decisions are *policies*, its invariant-bearing types are *entities / value objects*.
* A **seam** is Hexagonal's *port*; an **edge** is an *adapter*.
* "Dependencies point inward" is Clean's *Dependency Rule*: `cli -> application -> domain`, and `adapters -> ports -> domain`. The domain depends on nothing concrete.

Other constants that hold regardless of vocabulary: composable functional areas over monoliths; side effects isolated to adapters and the composition root; clarity over speculative optimization.

### 1.7 Function taxonomy

Every function is exactly one of these:

* **Predicates** -- pure boolean tests; answer a yes/no question. No side effects, deterministic. Named as a question: `is_*`, `has_*`, `should_*`, `can_*`.
* **Helper functions** -- perform exactly one action; deterministic where possible; easily unit-testable in isolation; readily accept Dependency Injection (D.I.) to enable mocking/faking in tests.
* **Flow (orchestration) functions** -- contain control flow; compose predicates, helpers, or other flow functions; tested via fakes, not real dependencies; readily accept D.I.
* **Entry points** -- the public surface (exported use case, CLI handler, HTTP route, action `main`); thin (parse/validate input, call a flow function, shape the result); the composition root lives here (wire adapters to ports).

Avoid nested/inner functions due to their inherent testing difficulty.

### 1.8 Dependencies

* Consult the tech-radar skill before reaching for anything off-the-shelf.
* Prefer well-maintained, battle-tested OSS libraries when they reduce risk or complexity.
* Do not reinvent common primitives.
* Reject libraries that obscure logic or introduce unnecessary abstraction.

---

## 2. Anatomy of a Code File

Every source file is laid out top-to-bottom in this fixed order. A reader should be able to scroll once and understand the file. (The language `STYLE.*` guide refines the syntax; this is the universal skeleton -- e.g. the style-bash skill's five-section layout is this same shape for shell.)

```
1. Module header        Docstring/comment: what this file is, which ports/deps it owns
2. Imports              Grouped: stdlib -> third-party -> local. Inward-only (no adapter
                        imports inside the domain). No wildcard imports.
3. Constants            Module-level immutable values, lookup tables, regexes
4. Flags / config       Feature flags and env-derived configuration, read once and named

   --- then, grouped per sub-component / responsibility, in this order: ---

5. Predicates           Pure boolean tests for this sub-component
6. Helper functions     Single-action, deterministic, DI-friendly
7. Flow functions       Control flow that composes the predicates + helpers above
8. Entry points         The exported/public surface; composition root if applicable
```

**Rules:**

* Order within the file is **definitions-before-use** reading top-down: a flow function appears below the helpers it calls.
* When a file has multiple sub-components, repeat the `predicates -> helpers -> flow -> entry` grouping per sub-component rather than scattering all predicates at the top. Keep each sub-component's pieces together.
* If a file grows more than one clear sub-component, that is a signal to split it along domain boundaries.
* Entry points stay thin; push logic down into flow/helper functions so it stays testable.

**Illustrative skeleton:**

```python
"""orders/pricing.py -- compute an order total. Pure domain; no I/O.

Depends on a TaxPort for jurisdiction lookups (injected).
"""

# 2. Imports
from decimal import Decimal

from orders.models import Order, LineItem      # local, inward only

# 3. Constants
FREE_SHIPPING_THRESHOLD = Decimal("50.00")

# 4. Flags / config
INCLUDE_DIGITAL_IN_TAX = feature_enabled("tax_on_digital")

# --- sub-component: totals ---

# 5. Predicates
def qualifies_for_free_shipping(order: Order) -> bool: ...

# 6. Helpers
def line_subtotal(item: LineItem) -> Decimal: ...

# 7. Flow
def compute_total(order: Order, *, tax: TaxPort) -> Decimal: ...

# 8. Entry point (use case)
def price_order(order: Order, *, tax: TaxPort) -> PricedOrder: ...
```

---

## 3. Testing Philosophy (TDD/BDD Required)

**All work is test-driven and behavior-driven.** See the planning skill for the RED -> GREEN -> COMMIT loop and the language `STYLE.*` guides for framework specifics.

* Write tests **before** implementation (RED first, always).
* Tests define **observable behavior** (the contract), not internal structure (the implementation).
* Tests must fail when behavior breaks, not when code is refactored.
* No placeholder or meaningless assertions; e.g. `assert false` left behind is a sin.
* Test names and scenarios must clearly express intent (Given-When-Then).
* Flow functions should be easily testable using fakes and dependency injection. Prefer in-memory fakes over mocks. The seams from Section 1 are exactly what make this cheap -- if a thing is hard to fake, you are probably missing a seam.
* Never `sleep()` in tests -- use fake clocks/timers and event coordination.

Tests exist to document and protect *what the system does*, not *how it does it*.

---

## 4. Coding Standards & Error Handling

**Defensive coding:**

* Validate inputs explicitly; be very mindful of security practices
* Handle edge cases deliberately
* Fail fast and fail loud with clear, actionable errors
* Establish consistent structure for error responses across a component

**Error handling:**

* Use a consistent, explicit error-handling strategy
* Errors must be observable and diagnosable
* Do not swallow or silently coerce failures

**Logging:**

* Structured and intentional (structlog -- see the tech-radar skill)
* Use log levels; ensure debug logs are beneficial, not noisy
* Log for diagnostics, tracing, and observability
* Avoid noisy or redundant logs
* Never invent your own logging system; use the radar's choice

---

## 5. Programming Style

* Favor **functional and declarative** patterns where they improve clarity
* Prefer **async / non-blocking** designs for I/O
* Prefer `map`, `filter`, `reduce`, and predicate functions over manual loops when simpler
* Avoid cleverness; explicit and readable clarity beats concise
* Keep side effects explicit and minimal, and confined to adapters/entry points
* Use dependency injection where it improves testability and debugging
* Comment for human readability and editing; e.g. periodic milestone comments
* Establish clear module boundaries reflecting domain concepts

---

## 6. Scope & Constraints

* Implement **only** what the design document specifies
* Do not add speculative features or abstractions (see the YAGNI counter-warning in Section 1.4)
* Follow existing project conventions and patterns where applicable
* Do not refactor unrelated areas unless explicitly required

---

## 7. Definition of Done

Work is complete only when:

* The change traces back to an approved design doc (`docs/design/DESIGN.<name>.md`)
* All behavioral tests pass (written test-first)
* Every dependency used is on the Adopt/Trial ring of the tech-radar skill
* The change passes the Section 1.2 tests (Grep, Swap, Decision, Arrow, Change)
* Code follows the file anatomy (Section 2)
* Errors are handled consistently and observably
* Module boundaries and naming clearly reflect domain intent
* No TODOs, stubs, or placeholder logic remain
