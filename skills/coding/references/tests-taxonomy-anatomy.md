# Coding -- tests, taxonomy and anatomy detail

Detail moved out of this skill's `SKILL.md`. Each section here is named
there with a summary; read the section when `SKILL.md` points to it.

Contents:

- 1.3 The smells
- 1.2 The signal is concrete
- 1.7 The five shapes
- 1.7 Adjacent same-typed parameters
- 2 Illustrative skeleton
- 6 Tool state is project-local
- 1.2 The tests (tables)
- 2 Anatomy rules
- 1.1 Layered and LAW
- 2 The layout
- 1.4 Layers are not directories
- 4 Standards and error handling
- 5 Style bullets
- 1.7 The kind belongs to the function
- 1 Why four rules
- 0 Developer tooling
- Role

## 1.3 The smells

* **Anemic model** -- a type that is all fields and no behavior, with its invariants enforced elsewhere.
* **Vendor in the core** -- an SDK import, `process.env`, a wire format, or a model id inside domain logic.
* **Decision as a `||`-chain** -- an important choice spread across inline conditionals instead of one named policy.
* **Port with one impl that will never have two** -- a seam introduced as ceremony (see the counter-warning).
* **Hexagon with no application layer** -- ports and a domain, and the workflow living in the CLI handler or HTTP route that calls them. The Trace test finds it: the behavior has no function.
* **Import that goes up or sideways** -- a use case importing an adapter, a domain module importing a port, two modules importing each other. The Arrow test finds it.
* **Function of two kinds** -- a predicate that also writes, a save that also validates. The Kind test finds it. Split it into one function per kind and a workflow that calls them.
* **Port in a logic function** -- a rule that takes a repository, a clock, or an HTTP client. The Purity test finds it.
* **Use case that builds its own adapters** -- `new AnthropicClient()` inside a workflow. The Wiring test finds it.
* **Two names for one thing** -- `verdict` in the doc, `result` in the code, `outcome` in the test. The Language test finds it.

## 1.2 The signal is concrete

The signal is concrete. If "we now also use Cloudflare" forces an edit to the core, the Swap test failed. If a new behavior forces an edit to an existing use case instead of a new one beside it, the Trace test failed. If a test of a logic function needs a fake, the Purity test failed. If one test needs a fake and also asserts a computed value, the function is two kinds and the Kind test failed.

## 1.7 The five shapes

The five shapes a function takes:

* **Predicates** (logic) -- pure boolean tests; answer a yes/no question. No side effects, deterministic. Named as a question: `is_*`, `has_*`, `should_*`, `can_*`.
* **Evaluators, or pure helpers** (logic) -- one computation; values in, values out; deterministic. **Never injected into.** If a helper needs a port, it is not logic: either the port is really a value (pass the result in) or the function is really a workflow.
* **Actions, or effectful helpers** (action) -- one act against the world: a query, a write, a call, a mutation. Behind a port when it reaches a vendor or a mechanism. Tested on the effect, through the injected dependency, or by an integration test.
* **Flow (orchestration) functions** (workflow) -- control flow and nothing else: they call predicates, evaluators, actions, other flow functions, and ports. The use cases are the flow functions at the application surface: one per behavior in the design's Behaviors table, carrying the signature the architecture record's use-case surface gives it, domain values in, ports as keyword-only dependencies, a domain value or result out. Tested via fakes. A flow function that computes a value inline, or performs an effect inline, is two kinds in one body.
* **Entry points** (workflow) -- the public surface (CLI handler, HTTP route, action `main`); thin (parse/validate input, call one flow function, shape the result). The composition root lives here (wire adapters to ports). Never contain a rule or an effect of their own.

## 1.7 Adjacent same-typed parameters

**Adjacent same-typed parameters get keyword arguments at every call site.**
Two `str` parameters side by side make a swapped call look correct: the types
check, the linter is silent, and a reader sees two strings in a plausible
order. Only someone who remembers the signature can catch it.

This is not hypothetical. designomatic's `evaluate_scope(vision, proposal, ...)`
was called as `evaluate_scope(proposal, vision, ...)` in the proofread path for
the entire life of that path, so the scope gate judged the editor's proposal as
though it were the document's goals. Every human review and every bot review
passed over it; a bot finally caught it on template-tools PR #485, long after
it shipped.

The cost of prevention is one keyword per argument. Apply it whenever two or
more adjacent parameters share a type, and test the *roles* rather than the
call shape -- an assertion that the right value reached the right slot fails on
a re-swap, where an assertion that the call happened does not.

## 2 Illustrative skeleton

**Illustrative skeleton:**

```python
"""orders/pricing.py -- price an order. Domain rules plus the one use case.

The use case takes a TaxPort (injected at the entry point); the rules
below it take values only.
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

# 7. Flow (the use case: behavior "an order is priced")
def price_order(order: Order, *, tax: TaxPort) -> PricedOrder: ...

# 8. Entry point (CLI/HTTP handler; the composition root supplies `tax`)
def main(argv: list[str]) -> int: ...
```

## 6 Tool state is project-local

* **Tool state is project-local -- each project is its own silo.** A
  CLI's mutable state (auth session, config, logs, cached credentials)
  lives under the project, never in `$HOME` or the keychain. Point the
  tool's own config variable at a project path -- `<project>/.state/<tool>`
  for `DOCKER_CONFIG`, `CLOUDSDK_CONFIG`, `AWS_CONFIG_FILE`;
  `<project>/.venv` for `UV_PROJECT_ENVIRONMENT` -- and keep `.state/` out of
  git and build contexts. A tool with none runs through a per-process
  runner (wrangler -> `cfw`,
  `@nine-at-a-time-media/deploy`). Never `wrangler login`, a keychain
  `credsStore`, or a project-wide `HOME` / `XDG_CONFIG_HOME` export (it
  moves gh, git and op too). Immutable toolchain installs (`~/.nvm`, the
  npm cache) may be shared. Detail: template-tools
  `docs/design/DESIGN.HERMETIC-TOOL-STATE.md`.

## 1.2 The tests (tables)

**Core vs edge (Hexagonal):**

| Test | Question | Fail means |
|---|---|---|
| **Grep test** | Does the core mention a vendor, SDK, `fetch`, `process.env`, `fs`, or a model string? | Leak -- move it to an edge |
| **Swap test** | Can I replace the LLM / code host / storage without touching the core? | Missing seam |
| **Change test** | List what is likely to change. Does each axis map to exactly one module? | A hardcoded value, or a tangle |

**Layered:**

| Test | Question | Fail means |
|---|---|---|
| **Arrow test** | Does every import stay in its own layer or go to a layer below it, and is the import graph free of cycles? | An import that goes up or sideways: `application` importing an adapter, `domain` importing a port, two modules importing each other |
| **Wiring test** | Is there exactly one place per runtime (CLI, worker, server) that names concrete adapters, is it in the composition-root layer, and can it be built with every adapter faked? | Wiring scattered into use cases or handlers; or a use case that constructs its own dependencies |

**LAW:**

| Test | Question | Fail means |
|---|---|---|
| **Kind test** | Does the function compute a value (logic), change something (action), or call other functions in order (workflow)? It must be exactly one | A function of two kinds: a predicate that also writes, a step that also decides. Split it into one function per kind and a workflow that calls them |
| **Purity test** | Does a logic function take a port, a callback that does I/O, or a clock? | The function is a workflow in disguise. Move the call out to a workflow and pass the result in as a value |

**Language and boundaries (DDD):**

| Test | Question | Fail means |
|---|---|---|
| **Trace test** | Does every row in the design's Behaviors table map, through the architecture record's use-case surface, to exactly one application function, with the signature that surface gives it? Several rows may share one function -- a happy path and its error paths are scenarios of the same use case | A row with no home (logic in a handler or a helper), or one row's behavior split across two functions |
| **Decision test** | Is each important decision named, in one place, in the problem's language? | Scattered `||` / `if` logic -- extract a policy |
| **Language test** | Is every noun in a use-case signature a term the design doc defines, spelled the same way? | A concept the design never named, or one concept under two names |
| **Boundary test** | Does each invariant have exactly one owning module, and does every write that could break it go through that module? | An invariant enforced twice, or bypassable |

## 2 Anatomy rules

**Rules:**

* Order within the file is **definitions-before-use** reading top-down: a flow function appears below the helpers it calls.
* When a file has multiple sub-components, repeat the `predicates -> helpers -> flow -> entry` grouping per sub-component rather than scattering all predicates at the top. Keep each sub-component's pieces together.
* If a file grows more than one clear sub-component, that is a signal to split it along domain boundaries.
* Entry points stay thin; push logic down into flow/helper functions so it stays testable.
* The anatomy is the layering in miniature: rows 5-6 are the domain, row 7 is the application, row 8 is the wiring. A tool small enough for one file still keeps the three regions distinct; a tool that outgrows one file splits along those same lines (`domain/`, `application/`, `adapters/`, and an entry that composes them), and the Arrow, Kind, Purity and Wiring tests read the same either way.

## 1.1 Layered and LAW

* **Layered: a unit imports only its own layer or a layer below it.** The order, bottom to top: `domain`, then `ports`, then `application` and `adapters` side by side, then the composition root. `application` and `adapters` never import each other. A layer does not know who calls it. That is what makes a layer reusable: anything can be built on top of code that assumes nothing about its callers.
* **Todd's LAW: every function is logic, action, or workflow, never two of them.** Logic computes a value from its inputs. Action changes something: a write, a call, a mutation. Workflow calls logic and actions in order and does nothing else. The rule exists for testing. Logic is tested by its return value, with no fake. An action is tested by its effect, with its dependencies injected. A workflow is tested by the calls it makes, through fakes. A function that both decides and acts can be tested neither way cleanly.

## 2 The layout

```
1. Module header        Docstring/comment: what this file is, which ports/deps it owns
2. Imports              Grouped: stdlib -> third-party -> local. Inward-only (no adapter
                        imports inside the domain). No wildcard imports.
3. Constants            Module-level immutable values, lookup tables, regexes
4. Flags / config       Feature flags and env-derived configuration, read once and named

   --- then, grouped per sub-component / responsibility, in this order: ---

5. Predicates           Pure boolean tests for this sub-component        (domain)
6. Pure helpers         Single computation, values in/out, no injection  (domain)
7. Flow functions       The use cases: control flow over the predicates,
                        helpers, and injected ports                      (application)
8. Entry points         The exported/public surface; composition root
                        if applicable                                    (wiring)
```

## 1.4 Layers are not directories

* **Layers are not directories.** A small tool keeps domain, application, and wiring as three regions of one file (Section 2's anatomy is exactly that order); a large one gives each its own package. The tests do not care about the layout. Arrow asks which way each import points. Kind and Purity ask what each function does.
* **Vocabulary is a means.** Lead with intent, the tests, and the smells. The named patterns are lineage, not a checklist.

## 4 Standards and error handling

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

## 5 Style bullets

* Favor **functional and declarative** patterns where they improve clarity
* Prefer **async / non-blocking** designs for I/O
* Prefer `map`, `filter`, `reduce`, and predicate functions over manual loops when simpler
* Avoid cleverness; explicit and readable clarity beats concise
* Keep side effects explicit and minimal, and confined to adapters/entry points
* Use dependency injection where it improves testability and debugging
* Comment for human readability and editing; e.g. periodic milestone comments
* Establish clear module boundaries reflecting domain concepts

## 1.7 The kind belongs to the function

**Every function is exactly one of three kinds: logic, action, or workflow.** The Kind test in Section 1.2 grades each function against this. The kind belongs to the function, not to the layer it is in. Every layer holds all three kinds; the layer only changes the mix. The domain is almost all logic, adapters hold the actions, the application is mostly workflow. Each kind is tested one way. Logic is tested on its return value, with no fake. An action is tested on its effect, through the dependency injected into it. A workflow is tested on the calls it makes, through fakes. A function of two kinds needs both at once, and that is the smell.

## 1 Why four rules

Four traditions each contribute one rule, and the rules do not overlap. Layered Architecture says which way a dependency may point. Hexagonal says what the core may know about. Todd's LAW says what one function may do. Domain-Driven Design says how things are named and who owns each invariant. An agent that applies only one of them, usually Hexagonal, gets a domain with ports around it and nothing else: behaviors with no single home, two names for one concept, functions that decide and act in the same body. Run all four, every time. Each has mechanical tests in Section 1.2.

## 0 Developer tooling

   - Developer tooling (self-contained dev QoL, invisible to the product -- the sdlc skill's "Product or tooling" test) has no design doc and needs none. Its gate is an issue framing the change; its record is `docs/ops/<tool>.md`, updated in the same PR. The architecture and plan gates below do not apply to it either. The test and tech gates do.

## Role

**Role & Mandate**

Act as a **Senior Software Architect and Principal Engineer** for a high-growth startup. Implement the attached design document to **production quality**, with an emphasis on correctness, clarity, maintainability, and testability, and low risk. This code must be suitable for a fast-moving startup and explicitly avoid accumulating technical debt.

