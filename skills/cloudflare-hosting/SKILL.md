---
name: cloudflare-hosting
description: "Hosting a product on Cloudflare: Workers (including Nuxt SSR through the Nitro preset), wrangler environments as stages, custom domains versus routes, bindings (KV, R2, D1, Durable Objects, service bindings, cron triggers), worker secrets from the vault, Cloudflare Access gating and service tokens, the wrangler/Terraform ownership split, deploy workflows with a preview-only CD posture, edge egress limits, and API token scopes. Load when a task deploys, configures, or debugs anything served from a Cloudflare account. Skip for the agent framework itself (cloudflare-think) and for Terraform authoring, state, and authority (iac)."
---

# Cloudflare Hosting

> **Purpose:** the shape of a product hosted on Cloudflare and the rules
> that keep two stages independent, a hostname gated, and a deploy
> boring. Everything here is shared logic; the account, zone, hostnames,
> stage names, vault, and workflow filenames are repo policy.

## Where repo facts come from

The consuming repo's agent instruction file (`AGENT.md` / `AGENTS.md` /
`CLAUDE.md`), usually under an `Infrastructure` or `Deploy` heading,
and its ops docs, name: the Cloudflare account and zone, the hostname
per stage, the stage names, the vault and its items, the deploy
workflows and which merge triggers what, and which repo owns the Access
configuration for a hostname. Derive GitHub identity at runtime; never
from memory. -> the release and github-workflow skills

Fleet defaults where the repo is silent: the non-production tier is
`nonprod` (or `preview` where the repo already says so); "staging" is a
verb. A preview hostname is `preview.<production-host>` or
`<service>.nonprod.<zone>`; the tier is its own DNS label either way.

## The shape of a hosted product

One worker package per deployable, under `cloudflare/<name>/`:

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

## wrangler: stages are named environments

- `--env <stage>` is the only thing anyone deploys. The TOP LEVEL is
  what a bare `wrangler deploy` ships, so it carries laptop values and a
  name nobody wants (`<worker>-dev`); the accident then lands on an
  obviously wrong script instead of stealing the production name. The
  deploy workflow refuses to run with an empty env flag.
- **Bindings do not inherit.** `vars`, `durable_objects`,
  `kv_namespaces`, `services`, `r2_buckets`, `triggers`, `workers_dev`
  and `observability` must be repeated in every stage block. `name`,
  `main`, `compatibility_*` and `migrations` inherit. The repetition is
  required, not redundant; a stage that omits its cron never runs and
  nothing logs it.
- `workers_dev = false` in every stage. Access cannot gate a
  `*.workers.dev` hostname, so leaving it on exposes the worker,
  privileged routes included, beside the gated custom domain.
- `observability.enabled = true`. A cron worker has no user watching it;
  the persisted log is the surface, and a failure that only a live
  `wrangler tail` could have caught is a failure nobody reads.
- Pin `compatibility_date`; add `nodejs_compat` when a dependency needs
  it.
- In a public repo the account id is not in the file: `wrangler` reads
  `CLOUDFLARE_ACCOUNT_ID` from the environment (a repository variable).
- A stage var that names the OTHER stage's hostname or database is
  unvalidated at runtime and fails silently. Keep stage vars beside each
  other in the file, with the failure mode in a comment.

## Hostnames: custom domain versus route

| | Custom Domain | Route |
|---|---|---|
| means | this worker OWNS the hostname; wrangler creates the proxied DNS record on first deploy | this worker serves a PATH pattern on a hostname, possibly one another worker owns as a Custom Domain |
| declared in | the worker's `wrangler` config, per stage | Terraform, because it is edge state shared between two workers and nobody's single config may claim it |
| needs | DNS Edit and Workers Routes Edit on the zone, on top of Workers Scripts Edit | Workers Routes Edit; the script must exist BEFORE the route is applied |

Cloudflare runs a matching route before the Custom Domain worker and
treats that worker as the origin behind it, so an agent on
`<host>/agents/*` and the app on `<host>` share one origin: the
WebSocket is same-origin, there is no CORS and no second Access
application. The cost is bring-up order (script first, then Terraform)
and a worker whose root `/health` is unreachable once mounted under a
path; probe a path the route actually covers.

Universal SSL covers one label under the zone. A `preview.app.<zone>`
hostname is a third-level name and needs Advanced Certificate Manager
or an equivalent; check the zone is provisioned for it before the first
preview deploy.

## Bindings

- **Service binding, not public fetch, between workers.** Access gates
  the hostname; a public subrequest carries no Access credential and
  gets a login page. A binding never re-enters the edge, needs no
  service token, and is GET-only if you type it that way. On a laptop,
  run both workers under one `wrangler dev` session (multiple configs)
  and the binding resolves locally, so dev exercises the production
  topology. A loopback fallback is only for a peer that is not a wrangler
  worker at all (a framework dev server), and it must refuse a REMOTE
  peer with no binding rather than fall through to a public fetch.
- **KV** for a value that must be rewritten from inside the isolate (a
  rotating credential). Worker secrets are write-only in-isolate.
- **R2** for bytes too big for a Durable Object SQLite row. Lifecycle
  rules do the expiring.
- **Durable Objects** with `new_sqlite_classes` migrations, tagged, and
  never edited after they ship.
- **Cron** via `triggers.crons`, one secret to the route it pokes, no
  scheduling logic in the worker.
- Ids for namespaces and buckets come from Terraform outputs and are
  pasted into the stage block. Never click one up in the dashboard: an
  id nothing declares is an id a redeploy can lose.
- Every binding is a degradation or a failure, decided on purpose: an
  enrichment binding (a read-only corpus) degrades the turn when absent;
  the binding on the write path fails closed.

## Secrets

- `wrangler secret put <NAME> --env <stage>` from a value read out of
  the vault, piped on stdin; never `--var`, never a `vars` entry. A var
  is plaintext in the dashboard, the diff, and the deploy output.
- Secrets persist across deploys, so the put runs after the deploy (the
  worker must exist first) and needs to succeed once. Guard against
  writing a BLANK over a live value: a wrong vault field label must not
  disarm a running worker.
- Absent is a supported state for an optional credential; blank is not.
  Load optional references in their own `continue-on-error` step,
  because the vault action resolves every reference eagerly and fails
  the run on the first that does not exist.
- One vault item per stage; a shared secret between two workers is one
  field both workflows read. Sharing a secret across stages would make a
  nonprod leak a production capability.
- Locally: `.dev.vars` (gitignored) for the worker, the app's local env
  for the other half of any pair. If the pair disagrees the write path
  fails closed by design.

## Cloudflare Access

- Requires a custom domain on a Cloudflare-managed zone. One
  self-hosted application per hostname, per stage.
- Access cannot exclude paths within one application. Punch a hole with
  a SECOND, narrower application over exactly the public paths (a
  webhook, a health check) carrying a `bypass` policy; most-specific
  application wins. The bypassed handler authenticates itself (an HMAC
  on every request, constant-time compare).
- **Automation uses a service token**, admitted by a `non_identity`
  policy on the application, sent as two headers. A bypass on the paths
  under test would make exactly the paths that must not be public,
  public. Service tokens are an ACCOUNT-level resource; a zone-scoped
  Access token cannot mint one, however it is spelled. Minting is a
  credential-lifecycle module (the iac skill).
- A `302` to the team domain on an unauthenticated probe is the gate
  WORKING, not a deploy failure. Behind Access every external probe
  looks the same whether or not the route exists; verify wiring through
  the API, or through the gate with the service token.
- Access configuration for a hostname often belongs to the zone's owning
  repo, not the app's. The repo file says which.

## Ownership: wrangler versus Terraform

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

## Deploy workflows

- `workflow_dispatch` with a `target` input that DEFAULTS TO PREVIEW; a
  reflexive "Run workflow" must land on the least consequential stage.
  A `workflow_call` form lets CD chain the same file with the same
  guards.
- Production needs three things at once: the run is on the default
  branch, a typed `confirm` equal to a value the operator would only
  type on purpose, and a GitHub Environment that requires a human
  reviewer. **The typed confirm is a fat-finger guard, not authority**:
  its value is in the repo, an agent can read it, and being able to
  clear a guard is not being permitted to. The environment with a
  required reviewer is the gate; every job that ships names it.
- **Declare the posture in the repo and check it in CI**: a file
  listing each deploy workflow, the furthest stage it can reach, and
  the environment that gates it, with a script that fails the PR when a
  workflow reaches production ungated or an automatic trigger can pass
  a production target. A protection nobody asserts is a protection
  nobody notices the removal of.
- Resolve everything stage-derived in ONE step before any credential is
  read; write the env flag to `GITHUB_ENV`; never interpolate the
  `github` context into a `run:` block.
- One vault service-account token is the only GitHub secret; every other
  credential is an `op://` reference. -> the release skill
- Order inside the run: gates (typecheck, tests) for a package the root
  CI does not cover, then deploy, then secrets, then an advisory probe,
  then an advisory real-behaviour smoke through the gate. A smoke that
  exits non-zero must PROPAGATE its status under `continue-on-error`,
  so it renders red at a glance instead of green with a warning.
- `concurrency` per stage, `cancel-in-progress: false`: a
  half-superseded migrate-plus-deploy pair ships code against another
  merge's schema.
- **CD is preview only.** Every push to the default branch may migrate
  and deploy the preview stage in that order; production is a human's
  dispatch, named in the conversation. Do not add a production leg to
  an automatic workflow. A migration that removes something the previous
  worker still names takes the stage down for the length of the gap
  between migrate and deploy: ship it expand-contract.
- Rollback is `wrangler rollback` or a Versions promote of the previous
  deployment, not a rebuild. Know the command before the deploy.
- Actions pinned by SHA; least `permissions:` per job.

## Egress limits

- Every Worker subrequest is stamped with `cf-worker`, `cf-visitor` and
  `cf-ew-via` headers the code cannot blank, and a raw socket cannot
  reach a Cloudflare-fronted host. An origin that refuses those headers
  is unreachable from a Worker DIRECTLY; reaching it needs a hop outside
  Cloudflare, one per stage, with its own shared key sent by hostname
  allowlist. The fleet's relay is a private ops repo module.
- Workers AI and AI Gateway calls spend on the account. Put the ceiling
  on the gateway: authentication required, a cost spend limit per
  window, Workers AI billing set to draw from the credit balance rather
  than postpaid, and auto top-up OFF so the loaded balance is the
  ceiling.

## API token scopes

Scope tokens to the job; a deploy token cannot edit Access and an
Access token cannot deploy. The names below are the API permission
groups (the dashboard shows Write as "Edit").

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

## Verification and diagnosis

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
| API error `9106` under Terraform | no Authorization header reached the API: the token variable is empty, terraform ran bare instead of under `op run` |
| API error `10000` on an account endpoint | the token authenticated and lacks that permission: scope, not plumbing |
| `1010` `auth.forbidden` on an account resource | a zone-scoped token; the resource is not zonal (see the iac skill's minting posture) |

Verify a suspect token read-only (`GET /user/tokens/verify`) before
blaming the deploy tool.

## Related

- the cloudflare-think skill: an agent worker on this platform
- the iac skill: the Terraform half of the ownership split, state,
  authority
- the release skill: the credential chain, workflow verification,
  diagnosing a red run
- the gates skill: the law that governs changing any gate above
