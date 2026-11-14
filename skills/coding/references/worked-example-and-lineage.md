# Coding -- worked example and lineage

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary. The rules and tests named below are in
`SKILL.md`, Section 1.

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
