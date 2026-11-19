---
name: cloudflare-hosting
description: "Hosting a product on Cloudflare: Workers (including Nuxt SSR through the Nitro preset), wrangler environments as stages, custom domains versus routes, bindings (KV, R2, D1, Durable Objects, service bindings, cron triggers), worker secrets from the vault, Cloudflare Access gating and service tokens, Access as the app's user identity (verifying the assertion, accounts keyed by email, D1 and R2 instead of Supabase), the wrangler/Terraform ownership split, deploy workflows with a preview-only CD posture, edge egress limits, and API token scopes. Load when a task deploys, configures, or debugs anything served from a Cloudflare account. Skip for the agent framework itself (cloudflare-think) and for Terraform authoring, state, and authority (iac)."
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
`preview`, and "nonprod" names a quality, never a tier (the release
skill, Stages); "staging" is a verb. A preview hostname is
`<service>.preview.<zone>`, or `preview.<production-host>` where the
repo already says so; the tier is its own DNS label either way.

## The shape of a hosted product

One worker package per deployable, under `cloudflare/<name>/`:

Packages: the app worker (Nuxt SSR via `NITRO_PRESET=cloudflare-module`, `custom_domain = true`), a sidecar worker
(a PATH on the app's hostname, no routes in its own config; the route is Terraform's), and a cron worker (`triggers.crons`
per stage, no routes). Runtime config baked at BUILD time selects the stage by which vault env-file the build ran
under, not by a runtime flag; a check script pins each env-file to its stage.
Read `references/cloudflare-detail.md`, "Worker package table", before you add a worker package.

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
- Pin `compatibility_date`; add `nodejs_compat` when a dependency needs it.
- In a public repo the account id is not in the file: `wrangler` reads `CLOUDFLARE_ACCOUNT_ID` from the environment.
- A stage var that names the OTHER stage's hostname or database is unvalidated at runtime and fails silently. Keep
  stage vars beside each other in the file, with the failure mode in a comment.

## Hostnames: custom domain versus route

| | Custom Domain | Route |
|---|---|---|
| means | this worker OWNS the hostname; wrangler creates the proxied DNS record on first deploy | this worker serves a PATH pattern on a hostname, possibly one another worker owns as a Custom Domain |
| declared in | the worker's `wrangler` config, per stage | Terraform, because it is edge state shared between two workers and nobody's single config may claim it |
| needs | DNS Edit and Workers Routes Edit on the zone, on top of Workers Scripts Edit | Workers Routes Edit; the script must exist BEFORE the route is applied |

A matching route runs before the Custom Domain worker (one origin, no CORS); the script must exist before the route.
Certificates follow the hostname mechanism; a name mismatch right after a deploy is provisioning.
Read `references/cloudflare-detail.md`, "Route before Custom Domain" and "Certificates by hostname mechanism", before you pick a hostname depth.

## Bindings

- **Service binding, not public fetch, between workers.** Access gates
  the hostname; a public subrequest carries no Access credential and
  gets a login page. A binding never re-enters the edge and needs no service token. On a laptop run both workers
  under one `wrangler dev` session; a loopback fallback is only for a peer that is not a wrangler worker, and it must
  refuse a REMOTE peer with no binding rather than fall through to a public fetch.
  Read `references/cloudflare-detail.md`, "Service binding in local dev", before you wire a service binding for local dev.
- **Static sites are Workers Static Assets, not Pages.** An assets-only Worker is reachable over a service binding;
  do not add a `main` just to be bindable (`references/cloudflare-detail.md`, "Static assets over a service binding").
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

- **Every method of a `WorkerEntrypoint` is callable over RPC.** TypeScript `private` is erased at compile time, so
  a "private" helper on the class is a public RPC method for any Worker that holds a binding to it. Keep every step
  past an authorization check in a module function, not on the class.
  Read `references/cloudflare-detail.md`, "WorkerEntrypoint RPC exposure", before you add a method to a WorkerEntrypoint class.

## Secrets

- `wrangler secret put <NAME> --env <stage>` from a value read out of
  the vault, piped on stdin; never `--var`, never a `vars` entry. A var
  is plaintext in the dashboard, the diff, and the deploy output.
- Secrets persist across deploys, so the put runs after the deploy (the
  worker must exist first) and needs to succeed once. Guard against
  writing a BLANK over a live value: a wrong vault field label must not
  disarm a running worker.
- Absent is a supported state for an optional credential; blank is not. Load optional references in their own
  `continue-on-error` step (the vault action resolves every reference eagerly).
- One vault item per stage; a shared secret between two workers is one
  field both workflows read. Sharing a secret across stages would make a
  non-prod leak a production capability.
- A value several workers share, or a provider key AI Gateway reads, may live in the Cloudflare Secrets Store (the
  tech-radar skill, Trial); the stage goes in the secret's name, a secret one worker may see stays a `wrangler secret`,
  and the value still comes from the vault, never from Terraform state (`references/cloudflare-detail.md`, "Secrets Store detail").
- Locally: `.dev.vars` (gitignored) for the worker, the app's local env
  for the other half of any pair. If the pair disagrees the write path
  fails closed by design.

## Cloudflare Access

The fleet has one Access shape: `references/access-playbook.md` is the standard, with the readiness ladder and
the hand-off. A new gate copies it. The infra repo's `docs/runbook.cloudflare-access.md` carries the hostnames,
groups and commands.

- **Every Access resource lives in the private infra repo**, under `ops/terraform/<system>-access/`; no exception for
  a demo or a "hermetic" project (owner ruling 2026-11-07). The app repo keeps the Worker and its Custom Domain and
  names the Access root in its `AGENT.md`.
- **Group -> reusable policy -> one application per hostname per stage**; the group is enumerated addresses, never
  `email_domain` (`references/cloudflare-detail.md`, "Access application layout").
- **A group has one owning root.** Another root attaches it by id; it never re-lists the emails. Sign-in is the
  built-in One-Time PIN. Access cannot exclude paths within one application: a public path (a webhook, a health check)
  gets a SECOND, narrower application with a `bypass` policy, and the bypassed handler authenticates itself.
  Read `references/cloudflare-detail.md`, "Access group, sign-in and bypass detail", before you share a group, add an
  OIDC app or punch a public path.
- **Automation uses a service token**, admitted by a `non_identity`
  policy behind the human policy, sent as two headers. A bypass on the
  paths under test would make exactly the paths that must not be
  public, public. Service tokens are an ACCOUNT-level resource; a
  zone-scoped Access token cannot mint one, however it is spelled.
  Minting is a credential-lifecycle module (the iac skill).
- **Access is the app's only sign-in.** The Worker verifies `Cf-Access-Jwt-Assertion` on every request (team keys,
  issuer, this hostname's AUD tag, expiry), fails closed, and takes the account from the normalized email; the app
  has no login, session or Supabase auth. Every application in front of an email-keyed app pins `allowed_idps` to
  One-Time PIN. Read `references/access-identity.md` before you build or change sign-in, accounts, roles or the
  identity gate of an app on Cloudflare.
- A `302` to the team domain on an unauthenticated probe is the gate WORKING.
- **"Not reachable" is not a diagnosis.** Run the playbook's readiness ladder (DNS, TLS, certificate pack, gate) and
  report the rung with the raw response.
  Read `references/cloudflare-detail.md`, "Access probe and readiness detail", before you probe an Access-gated host or declare it ready.

## Ownership: wrangler versus Terraform

Wrangler (the deploy workflow) owns what a deploy rebuilds (script, vars, secrets, Durable Object migrations, its
Custom Domain); Terraform (the iac skill) owns routes on another worker's hostname, KV and R2 whose ids must survive
redeploys, Access, tokens and DNS; a human, once, owns what no provider can create. Bring-up order on a fresh stage:
app worker, sidecar script, then the Terraform that routes to it.
Read `references/cloudflare-detail.md`, "Ownership table and bring-up", before you decide who owns a new resource.

## Deploy workflows

- `workflow_dispatch` with a `target` input that DEFAULTS TO PREVIEW; a
  reflexive "Run workflow" must land on the least consequential stage.
  A `workflow_call` form lets CD chain the same file with the same
  guards.
- Production is `workflow_dispatch` only. Its deploy job requires a text
  input equal to `production` before it reads prod credentials or deploys.
  That explicit confirmation is the sufficient production control. The job
  names the `production` Environment that supplies prod-scoped credentials.
  That Environment selects credentials; it is not an approval gate (`references/cloudflare-detail.md`, "Production Environment note").
- **Declare the posture in the repo and check it in CI**: a script fails the PR when a workflow can reach production
  without the confirmation (`references/cloudflare-detail.md`, "Deploy posture check").
- Resolve everything stage-derived in ONE step before any credential is
  read; write the env flag to `GITHUB_ENV`; never interpolate the
  `github` context into a `run:` block.
- One vault service-account token is the only GitHub secret; every other
  credential is an `op://` reference. -> the release skill
- Order inside the run: gates, deploy, secrets, advisory probe, advisory smoke through the gate; a smoke that exits
  non-zero must PROPAGATE its status under `continue-on-error`.
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

- Every Worker subrequest is stamped with headers the code cannot blank, so an origin that refuses them is
  unreachable from a Worker DIRECTLY; it needs a hop outside Cloudflare, one per stage.
  Read `references/cloudflare-detail.md`, "Worker egress stamping", before a Worker calls another Cloudflare-fronted host.
- Workers AI and AI Gateway calls spend on the account. Put the ceiling on the gateway: authentication required, a
  cost spend limit per window, credit-balance billing, and auto top-up OFF.
  Read `references/cloudflare-detail.md`, "AI spend ceiling", before you enable Workers AI or AI Gateway on an account.

## API token scopes

Scope tokens to the job; a deploy token cannot edit Access and an
Access token cannot deploy. The names below are the API permission
groups (the dashboard shows Write as "Edit").

A scoped token that fails `auth.forbidden` on an account-level resource is scoped to a zone; re-scoping does not
help, the resource is not zonal. Read `references/cloudflare-detail.md`, "API token scope table", before you mint or choose a token for a job.

## Verification and diagnosis

A `302` to the team domain is Access working; a green probe with a dead feature never exercised the
credential or the upstream. Verify a suspect token read-only (`GET /user/tokens/verify`) before blaming the deploy tool.
Read `references/cloudflare-detail.md`, "Verification and diagnosis table", before you diagnose a failed deploy, probe,
Terraform apply, certificate or API error.

## Related

- `references/access-playbook.md`: the fleet's Access shape, the
  readiness ladder, the pre-apply checks and the hand-off
- `references/access-identity.md`: the app's user identity from the
  verified Access assertion, accounts, machine callers, local runs
- the cloudflare-think skill: an agent worker on this platform
- the lmde-tunnels skill: a laptop service reached through a tunnel and
  Access rather than served from a Worker
- the iac skill: the Terraform half of the ownership split, state,
  authority
- the infra-credentials skill: minting the service token a machine
  consumer presents to Access
- the release skill: the credential chain, workflow verification,
  diagnosing a red run
- the gates skill: the law that governs changing any gate above
