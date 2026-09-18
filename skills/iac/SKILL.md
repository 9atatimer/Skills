---
name: iac
description: "Infrastructure as Code across the fleet: where Terraform lives (the private ops repo versus an app repo), root-module layout with the tier as a directory, the ownership split between Terraform and deploy pipelines, the authority model (laptop-only credential minting, scoped tokens for routine applies, agents plan and never apply), state homes and the secrets they hold, op:// reference discipline, version pins, the README every module carries, and plan/apply/verify discipline. Load when a task creates, changes, plans, or diagnoses Terraform or any other declared infrastructure. Skip for the deploy workflow itself (release) and for Cloudflare product specifics (cloudflare-hosting)."
---

# Infrastructure as Code

> **Purpose:** infrastructure is declared, reviewed, and applied under a
> stated authority, from a stated home, with its state somewhere a
> secret can live. This skill is the umbrella; provider specifics
> (Cloudflare, GCP, AWS) hang under it. The sre persona owns this
> territory; the devops-engineer meets it where a pipeline consumes what
> Terraform created.

## Where repo facts come from

The consuming repo's agent instruction file (`AGENT.md` / `AGENTS.md` /
`CLAUDE.md`) carries an `Infrastructure` (or `Infrastructure as Code`)
heading that says: which modules live in this repo and which live in
the private ops repo; the state posture per module; the authority model
per module (routine, credential-minting, or CI); how to run a plan. The
module's own `README.md` carries the rest. A repo with no such heading
gets one before its Terraform changes.

## Where the code lives

Decide placement in this order; the first rule that applies wins.

- **A public repo holds no module with identifiers.** Account ids, zone
  ids, project ids, vault UUIDs, Access policy emails, team domains, and
  Access application ids are non-public, as inputs or as defaults. A
  public app repo's infrastructure lives in the private ops repo,
  always.
- **A private app repo may keep a module only while it is inseparable
  from that app's deploy**: a route on the app's own hostname, the
  namespaces its own worker binds. This is a tolerated state, not a
  home: the fleet's direction is that it moves to the ops repo when next
  touched and its state can be migrated. While it stays, its
  identifiers are variables with documented defaults, the `.env.op`
  names the vault by UUID, and the app repo's instruction file says the
  module exists, where its state is, and that it is a mover.
- **Everything else lives in the private ops repo**: one place with one
  README per module and one authority model, and where a person with an
  incident looks first.
- **Cross-repo references are by path and by id.** The app repo's ops
  docs name the ops-repo module (`ops/terraform/<name>`) that holds the
  resource it depends on; the worker's config names the resource by its
  id, pasted from that module's outputs. The app repo never duplicates
  the module.
- **Public repos hold no Terraform with identifiers**, and the private
  ops repo's contents are never copied into a public one without
  stripping them.
- Worker code stays with the product; the worker's SURROUNDING
  infrastructure (Access, DNS posture, tokens, buckets) is the ops
  repo's. The design record for that infrastructure lives in the ops
  repo too, since it names what the public repo cannot.

## Root module per concern; the tier is a directory

- One root module per concern (`ops/terraform/<concern>/`), each with
  its own providers, variables, README, and state. Do not grow one root
  into a whole account: blast radius and authority differ per concern,
  and a token loaded for one concern should not be loaded for another.
- **A tier is the directory you run in, not a flag you pass.** For
  anything with its own credentials, identities, or failure metrics per
  tier, lay out `<concern>/modules/<shared>/`, `<concern>/nonprod/`,
  `<concern>/prod/`; each root has its own state, its own gitignored
  `terraform.tfvars`, its own `.terraform/`. There is no `-var stage=`
  and no workspace to select, because both are things you can get wrong
  silently. To touch production you change directory, and that is the
  whole gate. Run with `-chdir` so the scrollback records the tier and a
  later command cannot inherit a directory you forgot.
- The tier-defining values (service name, secret id, metric name) are
  LITERALS in each root's `main.tf`, deliberately not variables. A tier
  you can repoint from a gitignored tfvars is a tier you can repoint by
  accident.
- A single cheap resource per stage inside one root (a route, a
  namespace) may use `count` on a boolean. The boolean is a committed
  DEFAULT, never a `-var` at the command line: with the flag supplied
  ephemerally, the next bare apply sees it false and DESTROYS the
  production resource with nobody having asked.
- Say what the tiers still share (a project, an image digest, an
  upstream) in the README before an incident rather than during one.

## Ownership split

| Owner | Manages |
|---|---|
| Terraform | durable state whose ids must survive redeploys (namespaces, buckets, routes, Access applications and policies, tokens, DNS posture, a service's deploy parameters, IAM, log metrics, alert policies) |
| the deploy pipeline (wrangler, gcloud run deploy, a publish step) | everything a deploy rebuilds and replaces: the script or image, its vars, its runtime secrets, its migrations |
| a human, once, per the module README | what no provider can create or must never hold: a GitHub App via the manifest flow, a monitoring notification channel (needs a verification round-trip), the VALUE of every secret |
| the running process | validating its own configuration at startup; a bad value exits rather than serving |

**Runtime secrets are never in Terraform state.** Terraform references
a secret (a Secret Manager secret id, a vault item name) and never
creates, reads, or prints its value; no secret-version data source,
because that pulls plaintext into state. The value exists in exactly two
places, the vault and the runtime's secret store, and the pipeline moves
it between them.

The one accepted exception is a credential-MINTING module (below),
whose output token necessarily lands in its state.

## Authority model

Three postures. Every module's README says which it is.

| Posture | Credential | Where it runs | State |
|---|---|---|---|
| routine apply | a scoped API token, loaded for the run through `op run --env-file=<name>.env` where the file holds only `op://` references | a laptop today; CI once the token is a vault item a service account can read | remote where a home exists, local until then (below) |
| credential minting (tokens, service tokens, S3 key pairs written into the vault) | the human's Global API Key or equivalent root credential, `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` from the environment; the vault provider through the local CLI with biometric unlock | a laptop, by hand, for credential lifecycle only, never a routine apply. No service account, no CI path, no Connect server: neither works headless and neither should | local, gitignored; the minted values are in it, accepted; the root credential is NOT in it, it enters only as env vars for the run |
| CI apply | a scoped token as a vault item read by the workflow's service account | the deploy workflow, on a gated environment for production | remote, locked |

Rules that hold across all three:

- **An agent plans; a human applies.** From an agent session: write the
  module, `init`, `validate`, `plan -out`, read the plan back, and hand
  the human the exact `apply` line. `terraform apply` from an agent
  session is the canonical thing the sre persona refuses, and a cloud
  session has neither the laptop credentials nor the standing to do it.
- Production naming follows the repo's deploy authority: "apply it"
  never means production; a request that does not name the tier is a
  request for nonprod.
- Separate root modules keep the high-authority credential loaded only
  for token lifecycle; the routine module runs under the scoped token
  the minting module created.
- A scoped token that fails `auth.forbidden` on an account-level
  resource is scoped to a zone; the resource is not zonal and the
  answer is the minting posture, not a wider zone scope.

## State

- **State contains secrets and identifiers.** Access application ids,
  policy emails, minted token values, project numbers. It is never
  committed; `*.tfstate`, `*.tfstate.*`, `tfplan` and `*.tfplan` (a plan
  file embeds the prior state snapshot) are gitignored in every repo
  that holds a module.
- **The state home is per module and stated in its README.** Local
  state means one machine applies, ever, and no lock; say so. A remote
  backend (an R2 bucket over the S3 backend, a GCS bucket) means a
  credential for the backend that is separate from the provider token,
  injected the same way.
- The fleet-wide state home is an open question tracked in the private
  ops repo; a module does not settle it alone. Until it is settled, do
  not apply a local-state module from more than one machine.
- A module that has NEVER been applied against its remote backend may
  bootstrap with a gitignored `backend_override.tf` declaring
  `backend "local" {}`; Terraform's `_override.tf` merge takes it.
  Delete the override and run `init -migrate-state` once the credential
  exists; the issue that owns minting it is named in the README. A
  module whose remote state already holds resources gets no such
  escape: an empty local state has no snapshot of them, and the plan it
  produces recreates what exists. Restore backend access first, and if
  the remote state is unreachable, that module is blocked, not local.
- A backend's argument set depends on the Terraform version: the plural
  `endpoints {}` block needs a newer Terraform than the singular
  `endpoint`, and a repo pinned below it fails to parse outright. The
  config must parse under the pinned toolchain, not the newest one.
- The lock file (`.terraform.lock.hcl`) IS committed; it pins provider
  hashes. `.terraform/` is not.

## Secrets and references

- `op run --env-file=<name>.env -- terraform <cmd>`. The env-file holds
  only `op://` references (vault by UUID with a comment naming it; item
  by id when the title contains `@` or `:`; field by the item's
  category). Whether the env-file is committed is the repo's rule: an
  app repo may commit `.env.op` because it is references only; the
  private ops repo gitignores `*.env` so a new module cannot fall
  outside a literal list.
- **A reference that was never resolved is a to-do, not
  configuration.** Resolve every `op://` reference against the live
  vault (`op read`, or `op run -- env | grep`) before committing it. A
  module whose backend credential item never existed sat unrunnable for
  months, and every Access change in that period was a dashboard change
  Terraform did not know about.
- The provider reads its credential from the environment; there is no
  token variable and no default. A literal in a file is a leak with a
  commit hash.
- `terraform.tfvars` is gitignored when it carries identifiers, and
  there is deliberately no committed example when every value in it is
  an account, application, or vault identifier; `variables.tf` documents
  what each one is instead.
- When a module writes a credential into the vault, the item category
  decides which fields the provider emits: a LOGIN item carries
  `username` plus `password`; a PASSWORD item drops the username on the
  floor; the semantically right API_CREDENTIAL category is one the
  provider cannot create. `password` is the canonical token field
  everywhere, and consumers reference the item, never the state.
- Seeding a secret value into a runtime store pipes it: `op read ... |
  tr -d '\n' | <tool> --data-file=-`. Never an argument, never a file.
  The newline strip is load-bearing: a stored value one byte longer than
  what every caller holds fails a length check on EVERY request and logs
  nothing more useful than "bad key".

## Pins

- Terraform version pinned by a `.terraform-version` file (tfenv) and
  `required_version`; provider versions pinned per module with `~>`,
  and major versions never mixed within a module family (a v4 and a v5
  Cloudflare provider disagree on resource names and argument shapes; a
  resource that exists only in v5 gets its own root module with its own
  pin).
- Container images referenced by DIGEST, not tag; only a digest makes a
  rollback deterministic.
- Deploy parameters that are decisions (instance caps, concurrency,
  timeouts, ingress) are literals with a stated reason, not tfvars;
  changing one is a design change.

## The README every module carries

- A resource table: resource address, what it is, one note.
- The ownership split for this concern: Terraform, the pipeline, the
  human.
- The authority model (which of the three postures) and the exact
  `op run` and `terraform -chdir` lines, tier set first.
- The state home, and the issue that owns changing it.
- Prerequisites a human does once (seed the secret, create the channel)
  and the loud failure that proves they were not done (a data source
  that fails the plan).
- Verify-after-apply: the read-only command that proves the resource is
  live, and what its output must contain.
- Rollback: the command, and what it does not roll back.

## Plan, apply, verify

- `plan -out=tfplan`, then read the plan for EXACTLY the expected
  resources. A token replacement rotates a credential; a replaced vault
  item is destroy-then-create and a failure between the two leaves it
  missing until re-apply. Say what the diff must be before you run it.
- Deletion protection on anything whose loss is an outage; a `count`
  boolean with a committed default on anything a bare apply could
  otherwise destroy.
- Order across tools is a dependency, not a convention: a route cannot
  reference a script that does not exist, an Access application cannot
  gate a hostname that is not on the zone yet, a plan cannot read a
  secret nobody seeded. The README says the order; the bring-up follows
  it.
- **Verify against the live system, not against the state.** An
  unauthenticated probe that returns the gate's own refusal, a
  `terraform plan` that reports no unexplained drift, an `op read` of
  every reference the module wrote. A status line in a plan document
  written an hour BEFORE the apply reads as current for days; record the
  verification and its date.
- **Scaffolding is not intent.** A commented-out backend block, an
  example file, a sibling module inherited from a template and never
  applied are not evidence of a decision. When scaffolding and the
  actual config disagree, the config wins; when in doubt, ask rather
  than infer.
- Drift: a module nobody can run is decorative; the resources it
  declares are being changed in a dashboard. A module that cannot
  `init` on the pinned toolchain is a defect with an issue, not a
  known quirk.

## Moves and refactors

- A rename, a move between directories or repos, a module split, or a
  provider upgrade must produce an EMPTY plan when the human runs it. A
  move that plans a create or a destroy is an outage with a commit
  message.
- Keep `.tf` files and the lock file byte-identical across a move
  wherever the tooling allows; edit only README, scripts and comments
  for the new paths, and paste the `diff -r` proof in the PR.
- State files travel with the module, by the human, on the laptop, and
  BEFORE the app repo pulls the deletion: they were never committed, so
  `git show` recovers config only, and a `git clean` after the merge is
  the loss path. Copy out first, `init` in the new home, confirm `No
  changes.`, then delete the old copy.
- A backend block is never edited as a side effect of a move; changing
  it is a state migration with its own issue and its own empty-plan
  proof. The old location gets a tombstone README naming the new home.

## Related

- the gcp-ops, aws-ops and infra-credentials skills: the surfaces and
  the credential lifecycle under this umbrella; the infra-handoff skill
  produces the block that ends a change
- the cloudflare-hosting skill: what wrangler owns and what Terraform
  owns on that platform, token scopes, Access
- the release skill: the vault credential chain and deploy workflows
  that consume what these modules create
- the architecture skill: the as-built that records what is deployed
- the gates skill: the law governing any change to a gate, including a
  protected environment or a plan check
