---
name: coding
description: "Phase 5 of the SDLC: writing, implementing, or modifying source code in any language -- pre-code gates (design, architecture, plan, failing test, tech radar), the three architecture axes (core vs edge, layers inside the core, language and boundaries) with mechanical tests for each, functional core / imperative shell, function taxonomy, file anatomy. Skip when authoring a design doc (design), naming seams (architecture), building a phased plan (planning), or editing prose only (markdown)."
---

# SKILL: Implementation (Phase 5)

**Role & Mandate**

Act as a **Senior Software Architect and Principal Engineer** for a high-growth startup. Implement the attached design document to **production quality**, with an emphasis on correctness, clarity, maintainability, and testability, and low risk. This code must be suitable for a fast-moving startup and explicitly avoid accumulating technical debt.

If the design document is ambiguous, **do not guess**. Surface the ambiguity, explain the tradeoffs briefly, and propose the smallest reasonable resolution.

Deliver maintainable, testable, low-risk code for a fast-moving startup -- ship quickly without accumulating tech debt.

---

## 0. Before You Write Any Code (Gates)

These gates are non-negotiable. Do not skip them because the change "looks small."

- **Design gate (product only).** There must be an approved design doc for the product component you are touching.
   - Every product component has a `DESIGN.<name>.md` under `docs/design/`.
   - If it does not exist or is ambiguous, stop and use the design skill to write/fix it first.
   - Developer tooling (self-contained dev QoL, invisible to the product -- the sdlc skill's "Product or tooling" test) has no design doc and needs none. Its gate is an issue framing the change; its record is `docs/ops/<tool>.md`, updated in the same PR. The architecture and plan gates below do not apply to it either. The test and tech gates do.
- **Architecture gate.** There is an approved architecture record beside the design: every volatile axis this change introduces is named and mapped to one seam, every behavior has its use-case signature, against the as-built in `docs/arch/`. A seam first discovered while coding was never reviewed. -> the architecture skill
- **Plan gate.** For any multi-step feature, build the phased, test-first plan with the planning skill and record it per the todo-plan skill.
- **Test gate.** Write the failing test first (see Section 3). No production code without a failing test demanding it.
- **Tech gate.** Any off-the-shelf dependency must be on the **Adopt** or **Trial** ring of the tech-radar skill. Never introduce a `Hold`/`Verboten` technology, and never silently add a dependency that is not on the radar -- propose adding it first.

---

## 1. Architecture: Four Rules

**The idea, in one sentence:** Separate what the software *means* from how it *connects to the world* -- keep the meaning stable and central, keep the connections volatile and replaceable, and point every dependency inward, toward the meaning.

Four traditions each contribute one rule, and the rules do not overlap. Layered Architecture says which way a dependency may point. Hexagonal says what the core may know about. Todd's LAW says what one function may do. Domain-Driven Design says how things are named and who owns each invariant. An agent that applies only one of them, usually Hexagonal, gets a domain with ports around it and nothing else: behaviors with no single home, two names for one concept, functions that decide and act in the same body. Run all four, every time. Each has mechanical tests in Section 1.2.

| Rule | From | Question | Tests |
|---|---|---|---|
| **Layered** | Layered / Clean / Onion | does each unit import only its own layer or a layer below it? | Arrow, Wiring |
| **Core vs edge** | Hexagonal | does the core name any mechanism? | Grep, Swap, Change |
| **LAW** | Todd's LAW | is each function exactly one of logic, action, workflow? | Kind, Purity |
| **Language and boundaries** | DDD | is each concept named once, in the design's words, with one owner? | Trace, Decision, Language, Boundary |

Lead with the tests and the intent behind them. Use the tradition names only where they help. Section 1.6 gives the lineage.

### 1.1 The spirit (internalize these)

* **Stable core, volatile edges.** The core is the decisions and rules in the language of the problem. The edges are mechanisms: HTTP, GitHub, the filesystem, a specific LLM vendor. Mechanisms change; meaning should not have to.
* **Dependencies point toward stability.** Details import abstractions; the core imports nothing concrete. A vendor SDK, an env var, a wire format, or a model id must never appear in the core.
* **The core owns decisions; edges own mechanisms.** "Which model should judge this" is a decision -> core. "Speak Anthropic's API" is a mechanism -> edge.
* **Layered: a unit imports only its own layer or a layer below it.** The order, bottom to top: `domain`, then `ports`, then `application` and `adapters` side by side, then the composition root. `application` and `adapters` never import each other. A layer does not know who calls it. That is what makes a layer reusable: anything can be built on top of code that assumes nothing about its callers.
* **Todd's LAW: every function is logic, action, or workflow, never two of them.** Logic computes a value from its inputs. Action changes something: a write, a call, a mutation. Workflow calls logic and actions in order and does nothing else. The rule exists for testing. Logic is tested by its return value, with no fake. An action is tested by its effect, with its dependencies injected. A workflow is tested by the calls it makes, through fakes. A function that both decides and acts can be tested neither way cleanly.
* **Name the things that change.** Every axis of change becomes one explicit seam -- a port, a policy, or a parameter -- never a hardcoded value and never an inline `if`.
* **One language, one owner.** The nouns in the code are the nouns in the design doc, and each concept is owned by exactly one module. A concept with two names, or an invariant enforced in two places, is a boundary that was never drawn.
* **Keep behavior with its data.** A type that is only fields, with the logic living somewhere else, is the anemic smell. Put invariants where the data is.

### 1.2 The tests (apply these mechanically)

Run these against any change. They are checks, not opinions, and **a change passes only when it passes every row** -- Grep and Swap alone certify a hexagon, not a design.

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

The signal is concrete. If "we now also use Cloudflare" forces an edit to the core, the Swap test failed. If a new behavior forces an edit to an existing use case instead of a new one beside it, the Trace test failed. If a test of a logic function needs a fake, the Purity test failed. If one test needs a fake and also asserts a computed value, the function is two kinds and the Kind test failed.

### 1.3 The smells

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

### 1.4 Do not over-correct (YAGNI)

The opposite sin is just as real, and agents over-rotate here:

* **Abstract at the axes of change, not everywhere.** Introduce a seam when there are (or plausibly will be) *two* implementations, or when it crosses a vendor/process boundary. A port with a single forever-implementation is ceremony -- inline it.
* **Not every struct is an Entity / Value Object / Aggregate.** Use the pattern when the type carries an invariant; otherwise it is a plain value.
* **Layers are not directories.** A small tool keeps domain, application, and wiring as three regions of one file (Section 2's anatomy is exactly that order); a large one gives each its own package. The tests do not care about the layout. Arrow asks which way each import points. Kind and Purity ask what each function does.
* **Vocabulary is a means.** Lead with intent, the tests, and the smells. The named patterns are lineage, not a checklist.

### 1.5 Worked example (ci-magic)

> Model selection is a *decision*, so it lives in the core as a named policy whose inputs (the assertion's properties, its past performance, cost and availability) are core concepts. The model id is *volatile*, so it is a parameter supplied at the edge, never a constant in the domain. "Talk to Anthropic / Cloudflare / Claude CLI" are interchangeable *mechanisms* behind one seam. When Claude is slow, the policy picks another model -- and nothing in the core changed, because the core never knew the model's name.

That paragraph shows the core-vs-edge rule without naming a tradition. The other three rules show in the same tool. `judge_assertion(assertion, *, completion: CompletionPort) -> Verdict` is the application function for the behavior "an assertion is judged": one behavior, one function, ports as keyword arguments, a domain value returned. It is a workflow and nothing else. `select_model(assertion, history) -> ModelChoice` is a domain function it calls: logic only, values in and out, tested with no fake. The adapter that talks to Anthropic is an action, tested by what it sends. The registry that maps vendor names to adapters is the composition root, the one place that knows the vendor set. Adding an endpoint is one adapter file and one `register()` call, with no edit to the use case or the domain. Swap, Change, Arrow, Kind, Trace and Wiring all pass.

### 1.6 What this looks like in practice (the lineage)

The realization of the idea, with the name each tradition gives each part:

```
+-------------------------------------------------------------+
|  cli / entry        composition root (the container): the   |
|    v                ONLY code that names concrete adapters  |
|  application        use cases: one function per behavior;   |
|    v                orchestrates domain + ports; procedural |
|  domain (the core)  decisions + rules, in the problem's     |
|    ^                language; pure; imports nothing concrete|
|    |  ports (seams) = the named axes of change              |
|  adapters (edges)   mechanisms: DB, HTTP, LLM, fs, GitHub   |
+-------------------------------------------------------------+
```

* The **core** is DDD's *domain*; its named decisions are *policies*, its invariant-bearing types are *entities / value objects*, and the set of nouns it uses is the *ubiquitous language* -- the same words the design doc uses.
* The **application** layer is Clean's *use cases* and Layered's *service/workflow* layer. Its functions are the **BDD surface**: each Given/When/Then in the design names one of them. They compose because they take and return domain values, never wire formats or adapter handles -- a use case can call a use case, and a test can drive one without a handler in front of it.
* A **seam** is Hexagonal's *port*; an **edge** is an *adapter*.
* The **composition root** is the *container* (with or without a DI framework): the one place per runtime where concrete adapters meet ports. Entry points call it; nothing below it knows it exists.
* "Dependencies point downward" is Layered Architecture's rule and Clean's *Dependency Rule*: `cli -> application -> ports -> domain` and `adapters -> ports -> domain`. `application` and `adapters` are peers. The domain depends on nothing concrete.
* **Todd's LAW** is about functions, not layers, and it holds in every layer. An adapter has logic (parse the response), an action (send the request) and a workflow (send, retry, parse), and each is its own function.

**Functional core, imperative shell -- both, on purpose.** The domain is functional: pure functions over immutable values, composed by return value, needing no injection and no fake. The application and the adapters are procedural: sequenced steps with injected effects, tested through fakes. That is not a compromise between two schools; it is the assignment of each school to the layer where it is strongest. A domain written procedurally (mutating shared state, reaching for a port) is untestable without fakes; a workflow written as a point-free pipeline hides its sequencing from the reader. Put the pure part where purity is cheap and the steps where steps are honest.

Other constants that hold regardless of vocabulary: composable functional areas over monoliths; side effects isolated to adapters and the composition root; clarity over speculative optimization.

### 1.7 Todd's LAW: the function taxonomy

**Every function is exactly one of three kinds: logic, action, or workflow.** The Kind test in Section 1.2 grades each function against this. The kind belongs to the function, not to the layer it is in. Every layer holds all three kinds; the layer only changes the mix. The domain is almost all logic, adapters hold the actions, the application is mostly workflow. Each kind is tested one way. Logic is tested on its return value, with no fake. An action is tested on its effect, through the dependency injected into it. A workflow is tested on the calls it makes, through fakes. A function of two kinds needs both at once, and that is the smell. The five shapes a function takes:

* **Predicates** (logic) -- pure boolean tests; answer a yes/no question. No side effects, deterministic. Named as a question: `is_*`, `has_*`, `should_*`, `can_*`.
* **Evaluators, or pure helpers** (logic) -- one computation; values in, values out; deterministic. **Never injected into.** If a helper needs a port, it is not logic: either the port is really a value (pass the result in) or the function is really a workflow.
* **Actions, or effectful helpers** (action) -- one act against the world: a query, a write, a call, a mutation. Behind a port when it reaches a vendor or a mechanism. Tested on the effect, through the injected dependency, or by an integration test.
* **Flow (orchestration) functions** (workflow) -- control flow and nothing else: they call predicates, evaluators, actions, other flow functions, and ports. The use cases are the flow functions at the application surface: one per behavior in the design's Behaviors table, carrying the signature the architecture record's use-case surface gives it, domain values in, ports as keyword-only dependencies, a domain value or result out. Tested via fakes. A flow function that computes a value inline, or performs an effect inline, is two kinds in one body.
* **Entry points** (workflow) -- the public surface (CLI handler, HTTP route, action `main`); thin (parse/validate input, call one flow function, shape the result). The composition root lives here (wire adapters to ports). Never contain a rule or an effect of their own.

**Dependency injection starts at the workflow and never goes below it.** A pure helper that "readily accepts DI" is the leak that dissolves the domain: inject one port there and every test of that rule now needs a fake. Logic takes values. Workflows take ports. Entry points build them.

Avoid nested/inner functions due to their inherent testing difficulty.

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

### 1.8 Dependencies

* Consult the tech-radar skill before reaching for anything off-the-shelf.
* Prefer well-maintained, battle-tested OSS libraries when they reduce risk or complexity.
* Do not reinvent common primitives.
* Reject libraries that obscure logic or introduce unnecessary abstraction.

---

## 2. Anatomy of a Code File

Every source file is laid out top-to-bottom in this fixed order. A reader should be able to scroll once and understand the file. (The language `STYLE.*` guide refines the syntax; this is the universal skeleton -- e.g. the style-bash skill's script layout is this same shape for shell.)

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

**Rules:**

* Order within the file is **definitions-before-use** reading top-down: a flow function appears below the helpers it calls.
* When a file has multiple sub-components, repeat the `predicates -> helpers -> flow -> entry` grouping per sub-component rather than scattering all predicates at the top. Keep each sub-component's pieces together.
* If a file grows more than one clear sub-component, that is a signal to split it along domain boundaries.
* Entry points stay thin; push logic down into flow/helper functions so it stays testable.
* The anatomy is the layering in miniature: rows 5-6 are the domain, row 7 is the application, row 8 is the wiring. A tool small enough for one file still keeps the three regions distinct; a tool that outgrows one file splits along those same lines (`domain/`, `application/`, `adapters/`, and an entry that composes them), and the Arrow, Kind, Purity and Wiring tests read the same either way.

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

---

## 3. Testing Philosophy (TDD/BDD Required)

**All work is test-driven and behavior-driven.** See the planning skill for the RED -> GREEN -> COMMIT loop and the language `STYLE.*` guides for framework specifics.

* Write tests **before** implementation (RED first, always).
* Tests define **observable behavior** (the contract), not internal structure (the implementation).
* Tests must fail when behavior breaks, not when code is refactored.
* No placeholder or meaningless assertions; e.g. `assert false` left behind is a sin.
* Test names and scenarios must clearly express intent (Given-When-Then).
* Flow functions should be easily testable using fakes and dependency injection. Prefer in-memory fakes over mocks. The seams from Section 1 are exactly what make this cheap -- if a thing is hard to fake, you are probably missing a seam.
* Domain functions need no fake at all. A domain test that constructs a fake is a Purity test failure, not a testing problem.
* The kept behavior test drives the flow function the design named for it, with fakes behind its ports -- not the HTTP route in front of it and not the pure helper below it. That is the test that survives a rewrite of either.
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

* **Functional in the domain, procedural in the workflow** (Section 1.6). Pure functions over immutable values below the use case; explicit sequenced steps with injected effects at and above it. Neither style is the default everywhere
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

---

## 7. Definition of Done

Work is complete only when:

* The change traces back to an approved design doc (`docs/design/DESIGN.<name>.md`)
* All behavioral tests pass (written test-first)
* Every dependency used is on the Adopt/Trial ring of the tech-radar skill
* The change passes every Section 1.2 test on all three axes: Grep, Swap, Arrow, Change; Trace, Purity, Wiring; Decision, Language, Boundary
* Code follows the file anatomy (Section 2)
* Errors are handled consistently and observably
* Module boundaries and naming clearly reflect domain intent
* No TODOs, stubs, or placeholder logic remain
