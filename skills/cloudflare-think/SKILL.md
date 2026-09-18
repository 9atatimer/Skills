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
turn). Before building on a feature: `npm pack @cloudflare/think@<pin>`,
read `dist/think.d.ts` and the `docs/` that ship in the tarball. Types
are generated from the code and cannot drift from it.

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
  reachable only un-routed (see the hosting skill for why).

`wrangler.jsonc` essentials, with the hosting skill owning the rest:

```jsonc
{
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "observability": { "enabled": true },
  "durable_objects": { "bindings": [{ "name": "MyAgent", "class_name": "MyAgent" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyAgent"] }],
  "env": {
    "preview":    { "durable_objects": { /* REPEATED */ }, "vars": { /* REPEATED */ } },
    "production": { "durable_objects": { /* REPEATED */ }, "vars": { /* REPEATED */ } }
  }
}
```

`durable_objects`, `vars`, `kv_namespaces`, `services`, `r2_buckets` and
`triggers` do NOT inherit into named environments. Repeat them in every
stage or the stage ships without them, with no error anywhere.

## The Think subclass is a composition root

It composes; it decides nothing. Every decision (which credential, which
tools this stage may see, whether a path is admissible) lives in an
SDK-free module the tests can load (see Testing). The subclass is the
wiring a type error would catch.

| Override | Contract as shipped | The trap |
|---|---|---|
| `getModel()` | SYNCHRONOUS. Called on EVERY turn to assemble the turn context, before `beforeTurn` can override it. Also used for out-of-turn side calls | Anything thrown here kills the turn ahead of the override. It must always answer; it must never quietly answer with a metered credential the stage did not select |
| `beforeTurn(ctx)` | async; returns `TurnConfig` overrides (`model`, `activeTools`, `instructions`, `maxSteps`, `stopWhen`, `headers`, `providerOptions`, ...) | This is where a credential is resolved and a model built per turn, so a token that expired between turns refreshes before the turn rather than dying at step 7 of 12 |
| `getSystemPrompt()` / `configureContext()` | the legacy prompt string, or context blocks (`agents/context`) | `getSystemPrompt()` is ignored once any context block is configured. Only advertise tools the stage actually registered |
| `getTools()` | an AI SDK `ToolSet`; Think merges workspace, context, MCP, and client tools on top | Return the factory's output only. Keep the product's tool surface small for a small model |
| `activeTools` (via `beforeTurn`) | a FILTER over the merged set | A name pinned over a tool that was never assembled is a silent no-op. Compute the list from the bindings that exist, never from a constant |
| `workspaceBash`, `maxSteps` | class fields; bash tool on, ten steps by default | Turn the sandboxed bash off for a narrow assistant; it only distracts the model. Pin `maxSteps` deliberately |
| `fetchTools` | `false`, or a config with `bindings` (allowlist REQUIRED per binding target) and top-level `maxBytes` / `maxModelChars` | Re-read on every turn. A config with neither a public allowlist nor a binding THROWS, so an optional binding wrapped in a config kills every turn on a stage that never bound it: build the union `false | config` from the binding, and as a field initializer, not a getter (the base constructor assigns `this.fetchTools = false`, and an own property shadows an accessor) |
| `initialState` / `setState` | state syncs to every connected client, WHOLESALE, on every inbound state frame | Never put a secret or a capability in state. A server-owned key must be restored in `onStateChanged` after every client frame, and the hook must RETURN its promise (the SDK runs it under `waitUntil`) |
| `workspace` | a `Workspace({ sql, r2, r2Prefix, name, inlineThreshold })` | Override as a field to get R2 spill; `name` is a thunk because `this.name` is unset at field-initializer time; two Workspaces over one storage must be constructed identically or the constructor throws |
| `onRequest(request)` | your HTTP routes | Chain UNDER `super.onRequest`: Think's constructor wraps the method and answers its own routes first; claim only what is yours |
| `onStart(props)` | startup | `await super.onStart(props)` first; the workspace is live after that. Best-effort work goes in a try/catch so a sweep cannot take the session down |
| `runTurn({ mode: "wait", input })` | a blocking programmatic turn that resolves at quiescence | Experimental: pin the mode explicitly so a default change cannot turn a blocking run into fire-and-forget |
| `submitMessages(msgs, { idempotencyKey })` | a durable, idempotent, non-blocking turn | The right primitive for webhooks and schedulers that must return fast |
| hooks | `beforeStep`, `beforeToolCall` (allow / block / substitute), `afterToolCall`, `onStepFinish`, `onChatError`, `onChatRecovery` | Read the shipped `docs/lifecycle-hooks.md`; the context field names have been renamed between minors |

A subclass field initializer runs after `super()` returns, so `this.env`
and `this.ctx` are available there; `this.name` is not.

## Tools: contract, factory, forwarding

- **Factory, not hand-written tools.** One function takes the domain
  contract plus edge configuration (`baseUrl`, the shared secret, the
  actor getter, the navigation effect, an injectable `fetch`) and returns
  AI SDK `tool()`s built with `jsonSchema(...)` from the domain's plain
  schemas. A different engine composes the same contract through its own
  factory.
- **Reachability is the binding; authority is the secret.** The deployed
  app sits behind Cloudflare Access, which gates the whole hostname, tool
  route included. A public fetch from the worker carries the secret and
  no Access credential, so every tool receives a login page. A service
  binding is a worker-to-worker call that never re-enters the edge, and
  it is the only shape that reaches the route on a deployed stage. The
  binding does not replace the secret: the secret still gates the route
  against anything else that reaches it.
- **Refuse the misconfiguration at construction.** No binding plus a
  loopback base URL is `wrangler dev` on a laptop (global fetch is
  right). No binding plus a REMOTE base URL is a mistake: throw, naming
  the missing binding, rather than let Access turn every tool into a
  `302`.
- **The secret is one half of a pair.** The worker presents it; the app
  verifies it from server-only config. Both deploy workflows read the
  same vault field, which is what keeps them in agreement. Fail closed:
  unconfigured `503`, mismatch `401`, before any store access.
- **Attribution crosses the seam.** The session carries the initiating
  user's id (seeded by the client at session start, forwarded by the
  worker); a headless run carries a per-run capability instead of the
  standing secret, in a private instance field for the length of one
  turn and never in synced state.
- **The prompt tells the model what a tool does to the world**: a
  "create" that lands as a draft, an "update" that files a proposal and
  changes nothing live. The model repeats what the prompt says, so the
  prompt must say the true thing.

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

- The browser opens a WebSocket to `/agents/<agent-path>/<session-id>`
  (same-origin in production, by route; see the hosting skill), reads
  history from `.../get-messages`, and speaks `cf_agent_use_chat_request`
  / `cf_agent_use_chat_response` / `cf_agent_state` frames.
- React apps get `useAgent` (`agents/react`) and `useAgentChat`
  (`@cloudflare/think/react`), including client tools and the
  `isRecovering` flag. Any other framework writes the adapter behind
  `AgentRuntimePort`: translate frames into the domain vocabulary, replay
  stored `UIMessage` parts as events on history load, derive `navigate`
  from state sync, and make the handle's methods bound properties so
  consumers may destructure them.
- **Dev proxies cannot upgrade WebSockets** (Nitro's `devProxy` returns a
  non-101). In dev the browser talks to the worker origin directly (a
  public runtime config, default `http://localhost:8788`) and the worker
  serves CORS; in production the route makes it same-origin and the
  base is empty.
- **The session registry is the product's, the transcript is the
  engine's.** Recents (id, title, origin page, pinned) live behind the
  store port, client-side first, server-backed when a job can create a
  session no browser opened. Transcripts live in the object's SQLite:
  swapping engines loses them, and that is a recorded acceptance, not a
  surprise.
- Every row in the recents list is the only handle on an engine-held
  transcript: forgetting one is a two-step confirm, and a pin exempts a
  row from the cap.

## Testing

- **A module that imports `@cloudflare/think` cannot be collected by a
  node vitest runner**, so nothing in the composition root executes under
  any unit test. Therefore every decision (path admission, credential
  lifecycle, base-URL classification, the active tool list, upload
  policy) lives in a module with NO SDK import, exercised directly, and
  the subclass only wires. An adapter written in the untestable file is
  where the next defect goes: a mutation that redirected a manifest read
  to the wrong store left a whole suite green.
- Declare the shapes the SDK expects structurally in those modules (they
  are what `Think.fetchTools` or the tool factory accepts, so `tsc` checks
  the assignment at the composition root).
- Domain modules imported across a package boundary trip vite's per-file
  tsconfig discovery on a generated app tsconfig; pin
  `esbuild: { tsconfigRaw: '{}' }` (a STRING) and keep type checking in
  `tsc`.
- Object-level behaviour (state sync, hooks, recovery) is
  `@cloudflare/vitest-pool-workers` territory (radar Trial; the
  testing-node skill). Never hand-roll miniflare.
- **Evidence of a tool CALL is not evidence the tool WORKED.** A frame
  that fires before execution passes during the failure it exists to
  catch; assert on a non-failing result.
- Deployed: the liveness probe is `.../<agent>/<any-name>/get-messages`
  (a plain GET that instantiates one object and needs no model call).
  Then drive ONE real turn with a named case against a page whose content
  is known, through Access with a service token, and read the events. The
  probe stays green while the credential is dead, the model id is wrong,
  or the egress hop refuses you; only the turn proves the assistant
  answers.

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

quillmap's wiki agent: `cloudflare/wiki-agent/` (the subclass, the tool
factory, the SDK-free decision modules and their tests, the smoketest
script), `apps/quillmap/app/domain/agent/` and
`app/domain/ports/agentRuntime.ts` (the core), `app/utils/agentChat.ts`
(the client adapter), `server/api/agent/tools.post.ts` (the tool route),
and `docs/design/DESIGN.WIKI-AGENT.md` (the as-built layer map and
security perimeter). Its `NOTES.md` is the decision log; its
`docs/DEPLOY_WIKI_AGENT.md` is the operator manual.

## Related

- the cloudflare-hosting skill: environments, routes versus custom
  domains, bindings, secrets, Access, the deploy workflow
- the iac skill: the Terraform that owns the route and the namespaces
- the coding skill Section 1 and the architecture skill: the seams
- the testing-node skill: worker tests and the vitest pool
- the tech-radar skill: the rings these packages sit on
