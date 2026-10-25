---
name: lmde-tunnels
description: "Exposing a laptop service off the laptop through a Cloudflare tunnel (cloudflared) behind Cloudflare Access: when a public endpoint is allowed at all, a remotely managed tunnel whose anchored exact-path ingress allow-list lives in IaC, one Access application over the whole hostname with a non_identity policy and service token per consumer, DNS only after the gate, the connector and caller vaults, credential items that carry their header names, revocation and probe keys, the LMDE proxy layer as the only origin, the edge's time-to-first-byte limit and a retryable deadline answer, hostnames per tier, and live verification. Load when a task adds, changes, debugs or revokes a tunnel, its ingress, its Access gate, or a consumer of an endpoint served from the laptop. Skip for the daemons on the laptop side (lmde-daemons), a product served from Cloudflare Workers (cloudflare-hosting), and Terraform authority and state in general (iac)."
---

# LMDE Tunnels

> **Purpose:** an authorized caller off the laptop reaches exactly the
> paths it needs on a laptop service, and nobody else reaches anything.
> The rules are owner policy (2026-10). The edge's mechanics live in the
> private infra repo's terraform and the laptop's in tds-utils
> `lmde/components/`; this skill names them instead of restating them.

**How to read this skill.** A bullet is policy: an agent follows it and
a reviewer holds a change to it. A line starting `->` is a pointer to
where the mechanics live; read it before writing a new copy. The infra
repo's credential, terraform and infrastructure policy wins wherever it
is more specific than this skill.

## Where the mechanics live

- -> the infra repo's tunnel module (the consuming repo's `AGENT.md`
  names it under Infrastructure): tunnel, ingress, DNS, Access, the
  per-consumer tokens and 1Password items, and offline tests with mock
  providers. Its README carries the run lines, the pre-flight and the
  verify commands. A new tunnel copies that module.
- -> tds-utils `lmde/components/proxy-layer/`: the origin every tunnel
  lands on. `lmde/components/ollama-gateway/route/` is a route with a
  deadline answer and a held upstream; its `healthcheck.sh` is the drift
  check through the tunnel.
- -> tds-utils `docs/design/OLLAMA-GATEWAY.DESIGN.md`: the first
  tunnel's system record. Its edge has its own record in the infra repo.

## Before there is a tunnel

- The LMDE's UIs and query APIs are never routable. A public endpoint
  crosses that non-goal on purpose: it needs its own design record and
  an appended Key Decisions row in tds-utils `docs/design/LMDE.DESIGN.md`
  citing it.
- Expose the narrowest surface the caller needs: name exact paths (two
  completion paths for the gateway, two OTLP write paths for telemetry
  ingest), never a prefix and never "everything but".
- One tunnel per system, with its own credentials. Never reuse a tunnel,
  a run token or a service token that another system or another
  Cloudflare account owns, even when one already runs on the laptop.
- Every Cloudflare resource on the road and every credential on it is
  terraform in the private infra repo; nothing is made in the dashboard.
  The exceptions are what terraform cannot create: vaults and service
  accounts, made once by a human.
- Hostnames: `<service>.<zone>` for production, `<service>.nonprod.<zone>`
  for nonprod; the tier is its own DNS label and never "staging". A
  request naming no tier means nonprod. A production-only root (one
  laptop, one store: a nonprod tier would front the same hardware) is an
  explicit exception, recorded as a Key Decision before it is built.

## The road

```
caller --HTTPS + consumer headers--> <service>.<zone>
  Cloudflare Access   one app, whole host, non_identity per consumer -> 302/403
  tunnel ingress      anchored exact paths; catch-all 404 last       -> 404
  cloudflared         on the laptop, outbound only, http2
  LMDE proxy layer    one loopback listener per route; deadline; header
  the service         loopback only; sandboxed if its input is untrusted
```

The first two layers are the infra repo's terraform; the rest are tds-utils
components. A caller depends on the contract -- hostname, paths, the
header names and values its item carries, the retryable status -- and
never on Cloudflare specifics, so swapping the edge changes the IaC, the
connector and the items, not the callers.

## Tunnel and ingress

- Remotely managed: the ingress rules live in reviewed IaC and Cloudflare
  pushes them to the connector. Never a laptop config file: the path
  allow-list is a security control.
- Anchored regexes (`^/v1/models$`). cloudflared matches `path` as a
  regex, so an unanchored rule admits every path that contains it. The
  catch-all `http_status:404` comes last, with no hostname or path, so
  every refused path looks the same to a prober.
- The origin is `http://127.0.0.1:<route-port>`, a literal in the
  module: loopback is an invariant, not a variable.
- Pin the connector's transport to `http2` wherever QUIC fails on the
  network it runs from (QUIC over IPv6 failed on the first tunnel's
  network).
- `prevent_destroy` on the tunnel: a recreate rotates its run token, and
  the connector stays down until a human re-seeds it.

## Access

- One self-hosted application covers the whole hostname, with no bypass
  application. Nothing on a laptop endpoint is public; a health check
  presents a credential like any caller.
- One `non_identity` policy per consumer, including exactly that
  consumer's service token. Never `any_valid_service_token`: it admits
  every service token in the account and cannot revoke one consumer.
- The DNS record `depends_on` the Access application, so on a fresh
  apply the hostname never resolves before the gate stands over it.
- Consumers are a committed `for_each` map. Revocation is dropping a
  key, and its plan is exactly: that consumer's token, policy and item
  destroyed, the application's policy list updated in place, nothing
  else.

## Credentials on the road

- **The tunnel's run token lands in a CONNECTOR vault with zero
  service-account grants.** Terraform cannot see grants, so a human
  verifies the zero before every apply and records it on the PR. A
  caller that can read the run token can impersonate the laptop.
- **Consumer credentials land in a CALLER vault**, read by a read-only
  service account scoped to that vault. Service accounts are granted
  whole vaults, so the vault is the isolation boundary: the CALLER vault
  holds nothing but consumer items.
- Each consumer item carries the header NAMES beside the values. A
  caller sends whatever headers its item names and never hardcodes the
  edge vendor's.
- One consumer key per caller, and a separate key for each automated
  probe or drift check, so Access logs can tell them apart. A key shared
  between a caller and a probe is debt with an issue in the infra repo,
  not a design.
- The module that mints the tunnel and the service tokens is a
  credential-minting root: applied by a human, laptop only (the iac
  skill's Authority model).
- On the laptop the run token's runtime copy is in the login Keychain,
  seeded by a human from its 1Password item -> the lmde-daemons skill.

## Origin: the LMDE proxy layer

- Every tunnel terminates on the LMDE proxy layer (HAProxy), on a route
  of its own with one loopback listener, never directly on a service.
  Throttles, payload caps and deadlines live on the route, never in the
  service or the connector.
- The route stamps a header naming itself (`X-LMDE-Route: <tenant>`) on
  every response. The drift check sends a credentialed, allow-listed
  request through the tunnel and requires that header. An answer without
  it means the edge's origin port reaches some other listener, around the
  proxy and around any sandbox behind it.
- The route's port is owned by the component's env file and mirrored by
  hand into the module (the lmde-daemons skill, Ports and binds).
- Neither the connector nor the route logs request or response bodies.

## The edge's time-to-first-byte limit

Cloudflare gives up on an origin that sends no first byte within about
100 seconds and answers the caller with a 524 of its own.

- A route in front of a slow origin answers before that limit, with a
  distinct, retryable status outside Cloudflare's 52x range, so a caller
  tells "warming" from "down" by the status alone. The gateway answers
  507 with a `retry-after` at a 90 second deadline; it is the only
  response that gateway marks retryable.
- The route holds the upstream request open past the deadline, so work
  in progress (a model load) finishes and the retry finds it done. An
  origin that aborts on disconnect would otherwise restart the work on
  every retry and never finish.
- Long responses stream. A buffered response whose generation outlasts
  the deadline gets the deadline answer on every retry.

## Verify after apply

All four, with the date, on the PR. The consumer credential goes to
`curl` on stdin, never in argv.

| Request | Must see |
|---|---|
| uncredentialed, any path | 302 to the team login, or 403; never a body from the origin |
| credentialed, an allow-listed path | the origin's answer |
| credentialed, a path off the list | 404 from the catch-all |
| credentialed, an allow-listed path plus a suffix | 404: the regex is anchored |

Then `terraform plan` reports no changes, the laptop's healthcheck
reports the drift check OK, and the sandboxed service's probe passes in
probe-only mode on the live laptop (the lmde-daemons skill, Confining
untrusted input), so the edge is verified over a service that is
confined, not only reachable.

## What an agent may and may not do

| May | May not |
|---|---|
| write the module; run `terraform fmt`, `validate` and offline `test`; post an Atlantis command where the infra repo's `AGENT.md` allows it | run `apply`, `import` or `destroy` from a terminal |
| write the plan hand-off: pre-flight, expected summary, the zero-grant check the human runs | perform the zero-grant check, mint a token, or seed a vault item or the Keychain |
| read vault names, item titles and `op://` paths | read a token's value into the transcript |
| run the verify table or the healthcheck when the human asks | widen a policy, or add a bypass, to make a probe pass |

## Related

- the iac skill -- authority, state, pins and the plan hand-off; the
  infra-handoff skill writes the block
- the cloudflare-hosting skill -- Access, service tokens and API token
  scopes on the platform
- the infra-credentials skill -- vaults, service accounts and the
  credential registry
- the lmde-daemons skill -- the connector, the proxy layer and the
  service on the laptop
