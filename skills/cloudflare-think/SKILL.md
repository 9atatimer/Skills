---
name: cloudflare-think
description: "Adding a Think chat assistant (@cloudflare/think on the Cloudflare Agents SDK) to a product: the worker package, the Think subclass as a composition root, the tool factory over a domain-owned contract, the client adapter behind a runtime port, credential resolution per turn, testing without the SDK, and the deploy hand-off. Load when a task adds, changes, or debugs an AI assistant built on Think or the agents SDK. Skip for hosting mechanics with no agent in them (cloudflare-hosting) and for the Terraform side (iac)."
---

# Think Assistants (Phase 5, with a foot in 3)

> **Purpose:** make "add an AI assistant to this product" a turnkey job
> on Cloudflare: what Think gives you, what you must supply, where the
> seams go so the engine stays swappable, and the traps that fail
> silently.
> **Update discipline:** Think is pre-1.0 and its minors break. Every
> API claim below was checked against the shipped types; re-check
> against the version the repo pins before trusting a sentence here over
> a `.d.ts`.

## What Think is, in one screen

`@cloudflare/think` is an opinionated chat-agent base class on the
Cloudflare Agents SDK (`agents`). One Durable Object instance per
conversation; the instance name IS the session id. Think owns the whole
chat lifecycle so you do not write it:

- the WebSocket chat protocol and the `GET .../get-messages` history read
- message persistence in the object's SQLite, stream resumption on
  reconnect, and durable recovery of a turn interrupted by a deploy or an
  eviction
- the agentic loop over the Vercel AI SDK (`streamText`, tool rounds up
  to `maxSteps`)
- a Workspace (virtual filesystem in SQLite, spilling to R2) with file
  tools, client-side tools, MCP tool merging, sub-agents, scheduled
  prompts, messengers, and Agent Skills

You supply a subclass that answers: which model, what context, which
tools, what state syncs to the client, and what happens around each turn
(hooks). Everything else is configuration.

Radar: `agents`, `@cloudflare/think`, `@cloudflare/ai-chat`, `ai` (v7),
`@ai-sdk/openai` are all **Trial**. A `getModel()` string id (`@cf/...`
for Workers AI, `provider/model` through AI Gateway) needs no provider
package at all. -> the tech-radar skill

**A vendor README is not the vendor's behaviour.** Think's README has
shipped with claims the code did not honour, each failing silently
(options ignored in the wrong position, a config shape that killed every
turn). Before building on a feature: `npm pack @cloudflare/think@<pin>`
and read what ships in the tarball. The `.d.ts` settles SHAPES (an
option's position, a config's type, a union's members); for runtime
facts (hook order, what the constructor assigns, whether an option is
honoured) read the shipped `dist/*.js` where the call happens, then
confirm with a test against the pinned version. The README settles
nothing.

## Where it sits in the architecture

The engine is an adapter family. The product's core must not know it
exists, so that a bespoke loop or a non-Cloudflare runtime is a new
adapter family and nothing else (the Swap test, coding skill Section 1).

```
UI (framework components; render domain events, emit plain intents)
  |
composition root (a composable / hook: wires ports to reactive state,
  |                owns session lifecycle and navigation)
  |  AgentRuntimePort            AgentSessionStorePort      <- PORTS
  |  open(ctx, onEvent) ->       listRecent / record /
  |    {send, close}             rename / remove / setPinned
  v                              v
[edge] client adapter            [edge] session registry adapter
  translates cf_agent_* frames   (localStorage, or a server-backed
  <-> domain event vocabulary     sibling; same verbs)
  |
  | ws(s)://<host>/agents/<agent>/<session-id>
  v
[edge] the worker: <Product>Agent extends Think
  composition root for the model, the tools, the state, the hooks
  |
  | POST <app>/api/agent/tools   (service binding + shared secret)
  v
[edge] tool route in the app server: auth gate, then the DOMAIN
  dispatch executes against the app's own store adapters
```

Rules that keep the core stable:

- **The domain owns the vocabulary.** The session event types
  (`user-message`, `assistant-delta`, `assistant-done`, `tool-call`,
  `tool-result`, `navigate`, `session-error`) and the transcript reducer
  are pure modules. Every engine is translated into them at an edge.
- **The domain owns the tool contract.** Tool names, plain JSON Schema
  inputs (no schema library in the domain), semantics, validation, and
  dispatch. Outcomes are values, `{ok:true,output}|{ok:false,error}`: a
  failing or drifted tool feeds an error back to the model and never
  throws through the engine.
- **Vendor wire shapes stop at two files:** the client adapter and the
  worker package. Nothing above the ports knows a `cf_agent_*` frame, a
  Durable Object, or a model id exists. A purity test that walks the
  domain's import closure and fails on any non-relative import or
  side-effect token (`fetch(`, `process.env`, `Date.now(`) makes this a
  CI failure rather than a review comment.
- **Tools execute in the app server, not in the object.** The worker
  forwards tool calls to one route that runs under the app's own
  privileged store client. One write authority, and the Durable Object
  holds no database credential.
- **Engine -> shell effects ride the state channel as domain events.**
  A tool that changes what the user is looking at sets agent state; the
  SDK syncs it; the client adapter turns the change into a `navigate`
  event; the composition root routes. No bespoke channel, and never chat
  content.
- **Model ids, base URLs, keys, and hostnames are edge configuration**
  (wrangler vars and secrets), never domain constants.

## The worker package

- Lives at `cloudflare/<name>/` (or wherever the repo's `AGENT.md` puts
  workers), with `wrangler.jsonc`, `src/`, `test/`, `tsconfig.json`,
  `vitest.config.ts`. It pulls `agents`, `@cloudflare/think`, `ai`, and
  the provider; nothing else in the product needs them.
- **Standalone or workspace member, its `typecheck` and `test` scripts
  must run in CI.** A standalone package that the root install never
  touches is a package whose suite rots in silence; if there is no CI job
  for it yet, the deploy workflow runs both before the upload, so a CD
  run cannot publish a worker that fails checks it already defines.
- `typecheck` is `wrangler types && tsc --noEmit`: `wrangler types` also
  parses `wrangler.jsonc`, so a malformed config fails here rather than
  at deploy time.
- Worker entry: `routeAgentRequest(request, env, { cors })` serves the
  interactive surface; answer any headless entry (a `POST` that drives a
  turn for a dispatched job) before it; `/health` at the worker root is
  reachable only un-routed (see the cloudflare-hosting skill for why).

`wrangler.jsonc` needs `nodejs_compat`, the Durable Object binding and
a `new_sqlite_classes` migration. `durable_objects`, `vars`,
`kv_namespaces`, `services`, `r2_buckets` and `triggers` do NOT inherit
into named environments. Repeat them in every stage or the stage ships
without them, with no error anywhere. Read `references/think-worker.md`,
"wrangler.jsonc essentials", before you write or change a worker's
`wrangler.jsonc`.

## The Think subclass is a composition root

The subclass composes; it decides nothing. Every decision (which
credential, which tools this stage may see, whether a path is
admissible) lives in an SDK-free module the tests can load (see
Testing); the subclass is the wiring a type error would catch.
`getModel()` is synchronous, runs on every turn and must always answer;
it must never quietly answer with a metered credential the stage did not
select. Resolve the credential and build the model per turn in
`beforeTurn`. Never put a secret or a capability in synced state.

Read `references/think-subclass.md`, "The Think subclass is a
composition root", before you write, change or debug any Think subclass
override or hook: it holds the table of every override with its contract
as shipped and its trap.

## Tools: contract, factory, forwarding

- **Factory, not hand-written tools.** One function takes the domain
  contract plus edge configuration and returns AI SDK `tool()`s built
  with `jsonSchema(...)` from the domain's plain schemas.
- **Reachability is the binding; authority is the secret.** A tool call
  reaches an Access-gated app only through a service binding, and the
  shared secret still gates the route. Fail closed: unconfigured `503`,
  mismatch `401`, before any store access.
- **Refuse the misconfiguration at construction.** No binding plus a
  remote base URL is a mistake: throw, naming the missing binding.
- **Attribution crosses the seam, and the client is not its source.**
  The actor a tool route records must come from a verified identity,
  never from a user id the client seeds into synced state.
- **The prompt tells the model what a tool does to the world**, and it
  must say the true thing.

Read `references/think-tools.md`, "Tools: contract, factory,
forwarding", before you write or change the tool factory, the tool
route's auth, the worker's binding or secret wiring, headless-run
capabilities, or the prompt's description of a tool's effect.

## Giving the assistant a corpus

The knowledge-base skill owns the corpus domain and its ports. Retrieval
is a tool over a port; the worker never holds a database handle, an
embedding key or a vector store client. The corpus filter is derived
server-side from the verified actor, never a tool argument the model
supplies. Extraction never runs in the worker. Passage text is data, not
instruction.

Read `references/think-corpus.md`, "Giving the assistant a corpus",
before you add or change retrieval, upload or extraction for an
assistant.

## Credentials and the model

- **A credential port, and the lifecycle DECISION in the domain.**
  `use` / `refresh` / `reauthenticate` is pure logic with the clock and
  skew injected; the worker owns only mechanism: where the value lives,
  the token endpoint, building the model.
- **A rotating credential lives in KV, not in a worker secret.** Secrets
  are write-only from inside an isolate; refresh rotates the value, so
  its home must be writable from the object. The namespace id comes from
  Terraform's outputs (the iac skill), pasted into `wrangler.jsonc`,
  never clicked up.
- **Hard fail, no silent fallback.** A dead or misconfigured credential
  fails the turn, carries a named marker through the engine's error
  channel, and the client classifies it fatal (the launcher shows it is
  down and refuses to open a session; old transcripts stay readable). It
  never falls back to a metered key, which would spend money without
  saying so.
- **Resolve per turn, in `beforeTurn`.** Cache the last resolved token
  beside its companion headers so the synchronous `getModel()` can answer
  with the real credential on the next call and with a self-naming
  sentinel on a cold isolate.
- **Egress is not free.** Every Worker subrequest is stamped with `cf-*`
  headers the code cannot remove, and some origins refuse them outright.
  Reaching such an origin needs a hop outside Cloudflare (the fleet runs
  one; its module lives in the private ops repo). Send the hop's shared
  key by HOSTNAME allowlist, per stage, so a crossed base URL can never
  hand one stage's key to the other's relay or to a third party.
- **Cap the spend where the spend happens.** A Workers AI or AI Gateway
  model id rides the account's gateway; put the ceiling on the gateway
  (a Terraform module), not in the prompt.

## The client

The browser opens a WebSocket to `/agents/<agent-path>/<session-id>`,
reads history from `.../get-messages`, and speaks `cf_agent_*` frames;
the adapter behind `AgentRuntimePort` translates them into the domain
vocabulary. Dev proxies cannot upgrade WebSockets, so in dev the browser
talks to the worker origin directly. The session registry is the
product's, the transcript is the engine's.

Read `references/think-client.md`, "The client", before you write or
change the client adapter, the dev-proxy or same-origin routing, or the
session registry (recents, pin, forget).

## Testing

A module that imports `@cloudflare/think` cannot be collected by a node
vitest runner, so every decision (path admission, credential lifecycle,
base-URL classification, the active tool list, upload policy) lives in a
module with no SDK import, exercised directly, and the subclass only
wires. Never hand-roll miniflare. Evidence of a tool CALL is not
evidence the tool WORKED.

Read `references/think-testing.md`, "Testing", before you write or
review a worker test, set up the vitest config for a package that
imports domain modules across a boundary, or smoke a deployed assistant
(the liveness probe and the real-turn check).

## Turnkey: adding a Think assistant to a product

Do these in the order written; each depends on the one before.

- Design first: the assistant's capabilities are a tool contract and its
  effects on the product are named in a design record with the seams
  above. -> the design and architecture skills
- Domain: events, tool contract, session bookkeeping, credential
  lifecycle; the purity test covers them. RED tests first.
- App server: the tool route (auth gate, domain dispatch, store
  adapters), and the server-only config for the shared secret.
- Ports and the client adapter behind them; the composition root; the
  UI over domain events only.
- The worker package: `wrangler.jsonc` with stages, the subclass, the
  tool factory, SDK-free decision modules with tests, `typecheck` and
  `test` wired into CI.
- Edge state the deploy cannot own (a route on a shared hostname, KV,
  R2): Terraform, ids pasted into the stage blocks. -> the iac skill
- Secrets per stage from the vault; the deploy workflow; the probe and
  the real-turn smoke. -> the cloudflare-hosting and release skills
- Record what the engine owns that the product does not (transcripts),
  and the accepted gaps, in the design record's Key Decisions.

## Worked example

quillmap's wiki agent is the worked example. Read `references/think-worker.md`,
"Worked example", for the file map when you need a shape to copy.

## Related

- the cloudflare-hosting skill: environments, routes versus custom
  domains, bindings, secrets, Access, the deploy workflow
- the iac skill: the Terraform that owns the route and the namespaces
- the coding skill Section 1 and the architecture skill: the seams
- the testing-node skill: worker tests and the vitest pool
- the knowledge-base skill: the corpus domain, the extraction and
  retrieval ports, and the Marker/Docling license call
- the tech-radar skill: the rings these packages sit on
