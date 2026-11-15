# Think subclass -- the override table

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

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
