# Cloudflare hosting detail

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Contents

- Verification and diagnosis table (Verification and diagnosis)
- API token scope table (API token scopes)
- Certificates by hostname mechanism (Hostnames: custom domain versus route)
- Static assets over a service binding (Bindings)
- WorkerEntrypoint RPC exposure (Bindings)
- Secrets Store detail (Secrets)
- Deploy posture check (Deploy workflows)
- Deploy run order (Deploy workflows)
- Access group, sign-in and bypass detail (Cloudflare Access)
- Access probe and readiness detail (Cloudflare Access)
- Worker package table (The shape of a hosted product)
- Route before Custom Domain (Hostnames: custom domain versus route)
- Service binding in local dev (Bindings)
- AI spend ceiling (Egress limits)
- Optional credential loading (Secrets)
- wrangler account id and stage vars (wrangler: stages are named environments)
- Ownership table and bring-up (Ownership: wrangler versus Terraform)
- Worker egress stamping (Egress limits)
- Access resource placement (Cloudflare Access)
- Access application layout (Cloudflare Access)
- Production Environment note (Deploy workflows)

## Verification and diagnosis table

| Symptom | Fault |
|---|---|
| `404` on a sidecar's path after a green deploy | the route is not applied; deploy succeeded |
| `302` to the team domain on a probe | Access is working; use the service token or the API |
| every tool or callback `302`s at once | a public fetch through Access where a service binding was needed |
| every callback `503` | the shared secret pair disagrees, or one side never received it |
| a worker "never runs" with nothing logged | a stage block that omitted its cron, or its var |
| the deploy shipped localhost values | a bare `wrangler deploy` with no `--env` |
| a probe is green and the feature is dead | the probe never exercised the credential or the upstream; run the real-behaviour smoke |
| `terraform apply` fails on a hostname | the worker with the Custom Domain has not deployed yet |
| TLS name mismatch or handshake failure on a new Custom Domain | the Advanced Certificate is not active yet; read the certificate pack's `status` (the Access playbook, Readiness), a `pending_*` status is provisioning |
| the hostname does not resolve after a green deploy | wrangler never attached the Custom Domain; the stage lacks `custom_domain = true`, or `workers/domains` lists no entry for it |
| `200` on a deep path of a gated hostname | no application binds the hostname, or it binds a path, or a narrower `bypass` application covers the probed path; check the applications before calling the hostname public |
| API error `9106` under Terraform | no Authorization header reached the API: the token variable is empty, terraform ran bare instead of under `op run` |
| API error `10000` on an account endpoint | the token authenticated and lacks that permission: scope, not plumbing |
| `1010` `auth.forbidden` on an account resource | a zone-scoped token; the resource is not zonal (see the iac skill's minting posture) |
| an OIDC client behind Access reports `state` missing | usually Access rejected the request (`invalid_scope` and kin) with an error redirect that carries no `state`; reproduce the hop with `curl`, since a browser discards that redirect |

Verify a suspect token read-only (`GET /user/tokens/verify`) before
blaming the deploy tool.

## API token scope table

| Job | Account permissions | Zone permissions |
|---|---|---|
| deploy a worker with a Custom Domain | Workers Scripts Write | Workers Routes Write, DNS Write, Zone Read |
| deploy a worker that binds KV | plus Workers KV Storage Write | |
| apply routes and namespaces (Terraform) | Workers KV Storage Write | Workers Routes Write |
| apply Access apps and policies (Terraform) | Access: Apps and Policies Write | DNS Write if Terraform owns records |
| mint Access service tokens (Terraform) | Access: Service Tokens Write, account scope (a zone-scoped Access grant cannot; the resource is not zonal) | |
| mint API tokens | the human's Global API Key, laptop only (the iac skill's credential-minting posture) | |
| R2 state backend | an R2 API token scoped to the state bucket; S3-compatible key pair | |

A scoped token that fails `auth.forbidden` on an account-level resource
is scoped to a zone; re-scoping it does not help, the resource is not
zonal.

## Certificates by hostname mechanism

Certificates follow the hostname mechanism. A Workers Custom Domain
creates the DNS record and issues an Advanced Certificate for that exact
hostname at any depth (`preview.app.<zone>` included), with no Advanced
Certificate Manager subscription; it is active minutes after the deploy,
and until then the edge presents the zone's Universal certificate, so a
client sees a name mismatch. A hostname served through a DNS record and
a route is covered by Universal SSL, which names the apex and one label
only; a deeper name on a route needs Advanced Certificate Manager. The
certificate rung of the Access playbook (`references/access-playbook.md`)
reads the pack's status instead of guessing.

## Static assets over a service binding

- **Static sites are Workers Static Assets, not Pages.** An assets-only
  Worker (an `[assets]` block, no `main`) is reachable over a service
  binding -- proved by experiment. The `env.ASSETS.fetch()` docs
  constrain RPC methods only; do not read them as "bindings cannot reach
  assets". Adding a `main` just to be bindable buys a Worker invocation
  on every non-asset request.

## WorkerEntrypoint RPC exposure

- **Every method of a `WorkerEntrypoint` is callable over RPC.**
  TypeScript `private` is erased at compile time, so a "private" helper
  on the class is a public RPC method for any Worker that holds a binding
  to it. Keep every step past an authorization check in a module
  function, not on the class. A test calls that function by name through
  the stub and expects `does not implement`. In g1n1 a `private issue()`
  let any bound Worker mint an Identity for a Component it named itself.

## Secrets Store detail

- A value several workers or containers share, or a provider key AI
  Gateway reads, may live in the Cloudflare Secrets Store instead (the
  tech-radar skill, Trial). A secret's scopes name services, not
  scripts: any worker or container in the account can bind it, so the
  stage goes in the secret's name and a secret only one worker may see
  stays a `wrangler secret`. The value still comes from the vault,
  never from Terraform state.

## Deploy posture check

- **Declare the posture in the repo and check it in CI**: a file
  listing each deploy workflow, the furthest stage it can reach, its
  production confirmation, and the Environment that supplies its tiered
  credentials. A script fails the PR when a workflow reaches production
  without the confirmation or credential boundary, or an automatic trigger
  can pass a production target. A protection nobody asserts is a protection
  nobody notices the removal of.

## Deploy run order

- Order inside the run: gates (typecheck, tests) for a package the root
  CI does not cover, then deploy, then secrets, then an advisory probe,
  then an advisory real-behaviour smoke through the gate. A smoke that
  exits non-zero must PROPAGATE its status under `continue-on-error`,
  so it renders red at a glance instead of green with a warning.

## Access group, sign-in and bypass detail

- **A group has one owning root.** Another root attaches it by id
  (`table_group_ids`); it never re-lists the emails. Same people, attach
  the group; one address different, a new group. Dropping an id
  detaches it on the next apply.
- Sign-in is the built-in One-Time PIN; no identity provider. An OIDC
  SaaS app is added only when a downstream service must receive a
  token. A Worker that verifies the Access JWT itself needs none.
- Requires a custom domain on a Cloudflare-managed zone. Access cannot
  exclude paths within one application. Punch a hole with a SECOND,
  narrower application over exactly the public paths (a webhook, a
  health check) carrying a `bypass` policy; most-specific application
  wins. The bypassed handler authenticates itself (an HMAC on every
  request, constant-time compare).

## Access probe and readiness detail

- A `302` to the team domain on an unauthenticated probe is the gate
  WORKING, not a deploy failure. Behind Access every external probe
  looks the same whether or not the route exists; verify wiring through
  the API, or through the gate with the service token.
- **"Not reachable" is not a diagnosis.** Run the playbook's readiness
  ladder (DNS, TLS, certificate pack, gate) and report the rung with the
  raw response. A pending certificate pack is provisioning: wait. A
  timed-out pack will not finish by itself.

## Worker package table

| Package | Serves | Typical config |
|---|---|---|
| the app worker | the product's hostname; Nuxt SSR built with `NITRO_PRESET=cloudflare-module`, `main` pointing at `.output/server/index.mjs`, `[assets]` at `.output/public` | `custom_domain = true` on the hostname |
| a sidecar worker (an agent, an API) | a PATH on the app's hostname | no routes in its own config; the route is Terraform's |
| a cron worker | nothing; the cron calls it | `triggers.crons`, repeated per stage; no routes |

The app's `nuxt.config.ts` reads `nitro.preset` from `NITRO_PRESET` so
local dev stays `node-server` and the deploy sets the preset at build
time. Runtime config baked at BUILD time (a Supabase URL, an API base)
selects the stage by which vault env-file the build ran under, not by a
runtime flag; getting it wrong ships a worker pointed at the other
stage's data with no error. A check script pins each env-file to its
stage.

## Route before Custom Domain

Cloudflare runs a matching route before the Custom Domain worker and
treats that worker as the origin behind it, so an agent on
`<host>/agents/*` and the app on `<host>` share one origin: the
WebSocket is same-origin, there is no CORS and no second Access
application. The cost is bring-up order (script first, then Terraform)
and a worker whose root `/health` is unreachable once mounted under a
path; probe a path the route actually covers.

## Service binding in local dev

  gets a login page. A binding never re-enters the edge, needs no
  service token, and is GET-only if you type it that way. On a laptop,
  run both workers under one `wrangler dev` session (multiple configs)
  and the binding resolves locally, so dev exercises the production
  topology. A loopback fallback is only for a peer that is not a wrangler
  worker at all (a framework dev server), and it must refuse a REMOTE
  peer with no binding rather than fall through to a public fetch.

## AI spend ceiling

- Workers AI and AI Gateway calls spend on the account. Put the ceiling
  on the gateway: authentication required, a cost spend limit per
  window, Workers AI billing set to draw from the credit balance rather
  than postpaid, and auto top-up OFF so the loaded balance is the
  ceiling.

## Optional credential loading

- Absent is a supported state for an optional credential; blank is not.
  Load optional references in their own `continue-on-error` step,
  because the vault action resolves every reference eagerly and fails
  the run on the first that does not exist.

## wrangler account id and stage vars

- In a public repo the account id is not in the file: `wrangler` reads
  `CLOUDFLARE_ACCOUNT_ID` from the environment (a repository variable).
- A stage var that names the OTHER stage's hostname or database is
  unvalidated at runtime and fails silently. Keep stage vars beside each
  other in the file, with the failure mode in a comment.

## Ownership table and bring-up

| Owner | Manages |
|---|---|
| wrangler (the deploy workflow) | the script, its vars, its secrets, Durable Object migrations, the Custom Domain it owns: everything a deploy rebuilds and replaces |
| Terraform (the iac skill) | routes on a hostname another worker owns, KV namespaces and R2 buckets whose ids must survive redeploys, Access applications and policies, API tokens and service tokens, DNS that wrangler does not manage |
| a human, once | what no provider can create: a GitHub App via the manifest flow, a monitoring notification channel, the VALUE of a secret |

Bring-up order on a fresh stage follows the dependencies: the app
worker (it carries the shared secret its sidecar needs), then the
sidecar script, then the Terraform that routes to it. A route cannot
reference a script that does not exist, and pointing a live production
hostname at a missing script replaces "connection lost" with an edge
error.

## Worker egress stamping

- Every Worker subrequest is stamped with `cf-worker`, `cf-visitor` and
  `cf-ew-via` headers the code cannot blank, and a raw socket cannot
  reach a Cloudflare-fronted host. An origin that refuses those headers
  is unreachable from a Worker DIRECTLY; reaching it needs a hop outside
  Cloudflare, one per stage, with its own shared key sent by hostname
  allowlist. The fleet's relay is a private ops repo module.

## Access resource placement

- **Every Access resource lives in the private infra repo**, under
  `ops/terraform/<system>-access/`: applications, policies, groups,
  service tokens, the OIDC SaaS app. Security-bearing, so no exception
  for a demo or a "hermetic" project (owner ruling 2026-11-07). The app
  repo keeps the Worker and its Custom Domain and names the Access root
  in its `AGENT.md`.

## Access application layout

- **Group -> reusable policy -> one application per hostname.** A named
  group of enumerated addresses (never `email_domain`), one allow
  policy that admits the group by id, one `self_hosted` application per
  hostname per stage listing that policy. Production and preview share
  the policy and get two applications; the preview one is `count`-gated
  on its hostname variable.

## Production Environment note

  That Environment selects credentials; it is not an approval gate. A repo
  may add a reviewer gate or branch restriction, but neither is a fleet
  requirement.
