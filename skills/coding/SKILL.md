---
name: coding
description: "Phase 5 of the SDLC: writing, implementing, or modifying source code in any language -- pre-code gates (design, architecture, plan, failing test, tech radar), the three architecture axes (core vs edge, layers inside the core, language and boundaries) with mechanical tests for each, functional core / imperative shell, function taxonomy, file anatomy. Skip when authoring a design doc (design), naming seams (architecture), building a phased plan (planning), or editing prose only (markdown)."
---

# SKILL: Implementation (Phase 5)

**Role & Mandate:** act as a Senior Software Architect and Principal Engineer; implement the design to production quality (correct, clear, maintainable, testable, low risk, no accumulating tech debt).

If the design document is ambiguous, **do not guess**. Surface the ambiguity, explain the tradeoffs briefly, and propose the smallest reasonable resolution.

---

## 0. Before You Write Any Code (Gates)

These gates are non-negotiable. Do not skip them because the change "looks small."

- **Design gate (product only).** There must be an approved design doc for the product component you are touching.
   - Every product component has a `DESIGN.<name>.md` under `docs/design/`.
   - If it does not exist or is ambiguous, stop and use the design skill to write/fix it first.
   - Developer tooling (self-contained dev QoL, invisible to the product) has no design doc, and the architecture and plan gates do not apply to it; the test and tech gates do. Read `references/tests-taxonomy-anatomy.md`, "0 Developer tooling", before you skip a gate on that ground.
- **Architecture gate.** There is an approved architecture record beside the design: every volatile axis this change introduces is named and mapped to one seam, every behavior has its use-case signature, against the as-built in `docs/arch/`. A seam first discovered while coding was never reviewed. -> the architecture skill
- **Plan gate.** For any multi-step feature, build the phased, test-first plan with the planning skill and record it per the todo-plan skill.
- **Test gate.** Write the failing test first (see Section 3). No production code without a failing test demanding it.
- **Tech gate.** Any off-the-shelf dependency must be on the **Adopt** or **Trial** ring of the tech-radar skill. Never introduce a `Hold`/`Verboten` technology, and never silently add a dependency that is not on the radar -- propose adding it first.

---

## 1. Architecture: Four Rules

**The idea, in one sentence:** Separate what the software *means* from how it *connects to the world* -- keep the meaning stable and central, keep the connections volatile and replaceable, and point every dependency inward, toward the meaning.

Four traditions each contribute one rule, and the rules do not overlap; an agent that applies only one of them gets a domain with ports around it and nothing else. Run all four, every time.

| Rule | From | Question | Tests |
|---|---|---|---|
| **Layered** | Layered / Clean / Onion | does each unit import only its own layer or a layer below it? | Arrow, Wiring |
| **Core vs edge** | Hexagonal | does the core name any mechanism? | Grep, Swap, Change |
| **LAW** | Todd's LAW | is each function exactly one of logic, action, workflow? | Kind, Purity |
| **Language and boundaries** | DDD | is each concept named once, in the design's words, with one owner? | Trace, Decision, Language, Boundary |

Section 1.6 gives the lineage.

### 1.1 The spirit (internalize these)

* **Stable core, volatile edges.** The core is the decisions and rules in the language of the problem. The edges are mechanisms: HTTP, GitHub, the filesystem, a specific LLM vendor. Mechanisms change; meaning should not have to.
* **Dependencies point toward stability.** Details import abstractions; the core imports nothing concrete. A vendor SDK, an env var, a wire format, or a model id must never appear in the core.
* **The core owns decisions; edges own mechanisms.** "Which model should judge this" is a decision -> core. "Speak Anthropic's API" is a mechanism -> edge.
* **Layered: a unit imports only its own layer or a layer below it.** Bottom to top: `domain`, `ports`, `application` and `adapters` side by side (never importing each other), the composition root.
* **Todd's LAW: every function is logic, action, or workflow, never two of them.** Logic is tested by its return value with no fake; an action by its effect through an injected dependency; a workflow by its calls through fakes. Read `references/tests-taxonomy-anatomy.md`, "1.1 Layered and LAW", for the reasoning.
* **Name the things that change.** Every axis of change becomes one explicit seam -- a port, a policy, or a parameter -- never a hardcoded value and never an inline `if`.
* **One language, one owner.** The nouns in the code are the nouns in the design doc, and each concept is owned by exactly one module. A concept with two names, or an invariant enforced in two places, is a boundary that was never drawn.
* **Keep behavior with its data.** A type that is only fields, with the logic living somewhere else, is the anemic smell. Put invariants where the data is.

### 1.2 The tests (apply these mechanically)

Run these against any change. They are checks, not opinions, and **a change passes only when it passes every row** -- Grep and Swap alone certify a hexagon, not a design.

* **Core vs edge:** **Grep test** (does the core mention a vendor, SDK, `fetch`, `process.env`, `fs` or a model string? -- move it to an edge), **Swap test** (can the LLM, code host or storage be replaced without touching the core?), **Change test** (does each likely axis of change map to exactly one module?).
* **Layered:** **Arrow test** (every import stays in its layer or goes below, no cycles), **Wiring test** (exactly one composition-root place per runtime names concrete adapters; buildable with every adapter faked).
* **LAW:** **Kind test** (each function is exactly one of logic, action, workflow), **Purity test** (a logic function takes no port, I/O callback or clock).
* **Language and boundaries:** **Trace test** (every Behaviors row maps to exactly one application function), **Decision test** (each important decision named in one place), **Language test** (every noun in a use-case signature is a term the design defines), **Boundary test** (each invariant has one owning module).

Read `references/tests-taxonomy-anatomy.md`, "1.2 The tests (tables)", before you grade a change or declare it done.

The signal is concrete: a new vendor forcing an edit to the core fails Swap; a new behavior forcing an edit to an existing use case fails Trace; a logic-function test that needs a fake fails Purity. Read `references/tests-taxonomy-anatomy.md`, "1.2 The signal is concrete", for all four.

### 1.3 The smells

The smells are the failed tests in prose: an anemic model (all fields, invariants elsewhere), a vendor in the core, a decision spread as a `||`-chain, a port with one forever-implementation, a hexagon with no application layer, an import that goes up or sideways, a function of two kinds, a port in a logic function, a use case that builds its own adapters, and two names for one thing. Read `references/tests-taxonomy-anatomy.md`, "1.3 The smells", when a test fails.

### 1.4 Do not over-correct (YAGNI)

The opposite sin is just as real, and agents over-rotate here:

* **Abstract at the axes of change, not everywhere.** Introduce a seam when there are (or plausibly will be) *two* implementations, or when it crosses a vendor/process boundary. A port with a single forever-implementation is ceremony -- inline it.
* **Not every struct is an Entity / Value Object / Aggregate.** Use the pattern only when the type carries an invariant.
* **Layers are not directories.** The tests do not care about the layout; read `references/tests-taxonomy-anatomy.md`, "1.4 Layers are not directories", before you decide to split a file into packages.
* **Vocabulary is a means:** lead with intent and the tests.

### 1.5 Worked example (ci-magic)

ci-magic shows all four rules in one tool: model choice is a domain
policy, the model id a parameter at the edge, `judge_assertion` the one
application function for its behavior, and the vendor registry the
composition root.

Read `references/worked-example-and-lineage.md`, "1.5 Worked example (ci-magic)", when a rule above is unclear in practice.

### 1.6 What this looks like in practice (the lineage)

The layers map onto named traditions: the domain is DDD's, the
application layer is Clean's use cases, a seam is Hexagonal's port, the
composition root is the container. Functional in the domain, procedural
in the workflow.

Read `references/worked-example-and-lineage.md`, "1.6 What this looks like in practice (the lineage)", when you need the vocabulary.

### 1.7 Todd's LAW: the function taxonomy

**Every function is exactly one of three kinds: logic, action, or workflow.** The Kind test grades each function; the kind belongs to the function, not to its layer.

The five shapes a function takes -- predicates, evaluators (pure helpers), actions, flow functions, entry points -- are in `references/tests-taxonomy-anatomy.md`, "1.7 The five shapes"; read it when you name or place a function. Evaluators are **never injected into**, and entry points never contain a rule or an effect of their own.

**Dependency injection starts at the workflow and never goes below it.** A pure helper that "readily accepts DI" is the leak that dissolves the domain: inject one port there and every test of that rule now needs a fake. Logic takes values. Workflows take ports. Entry points build them.

Avoid nested/inner functions due to their inherent testing difficulty.

**Adjacent same-typed parameters get keyword arguments at every call site**, and tests assert the roles, not the call shape. Read `references/tests-taxonomy-anatomy.md`, "1.7 Adjacent same-typed parameters", before you write a signature with two parameters of one type.

### 1.8 Dependencies

* Consult the tech-radar skill before reaching for anything off-the-shelf.
* Prefer well-maintained, battle-tested OSS libraries when they reduce risk or complexity.
* Do not reinvent common primitives.
* Reject libraries that obscure logic or introduce unnecessary abstraction.

---

## 2. Anatomy of a Code File

Every source file is laid out top-to-bottom in this fixed order. A reader should be able to scroll once and understand the file. (The language `STYLE.*` guide refines the syntax; this is the universal skeleton -- e.g. the style-bash skill's script layout is this same shape for shell.)

Fixed top-to-bottom order: module header, imports (stdlib -> third-party -> local, inward only), constants, flags/config; then per sub-component: predicates, pure helpers, flow functions, entry points. Read `references/tests-taxonomy-anatomy.md`, "2 The layout", before you create a file.

**Rules:** definitions before use, reading top-down; repeat the `predicates -> helpers -> flow -> entry` grouping per sub-component; split a file along domain boundaries when it grows more than one clear sub-component; keep entry points thin. Read `references/tests-taxonomy-anatomy.md`, "2 Anatomy rules", before you split a file.

**Illustrative skeleton:** `references/tests-taxonomy-anatomy.md`, "2 Illustrative skeleton".

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

Validate inputs explicitly and fail fast and loud with actionable errors; never swallow or silently coerce a failure; log with structlog (the tech-radar skill), and never invent your own logging system. Read `references/tests-taxonomy-anatomy.md`, "4 Standards and error handling", when you design error handling or logging.

---

## 5. Programming Style

* **Functional in the domain, procedural in the workflow** (Section 1.6). Pure functions over immutable values below the use case; explicit sequenced steps with injected effects at and above it. Neither style is the default everywhere
Prefer async for I/O, `map`/`filter`/`reduce` over manual loops when simpler, explicit readable code over clever, and side effects confined to adapters and entry points. Read `references/tests-taxonomy-anatomy.md`, "5 Style bullets", when choosing between styles.

---

## 6. Scope & Constraints

* Implement **only** what the design document specifies
* Do not add speculative features or abstractions (see the YAGNI counter-warning in Section 1.4)
* Follow existing project conventions and patterns where applicable
* Do not refactor unrelated areas unless explicitly required
* **Tool state is project-local -- each project is its own silo.** A CLI's mutable state (auth session, config, logs, cached credentials) lives under the project, never in `$HOME` or the keychain; never `wrangler login`, a keychain `credsStore`, or a project-wide `HOME` / `XDG_CONFIG_HOME` export. Read `references/tests-taxonomy-anatomy.md`, "6 Tool state is project-local", before you run or configure any CLI that keeps state.

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
