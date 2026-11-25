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
- **Shared, foundational, or security-bearing: the private ops repo,
  always.** Shared means two repos or pipelines could need it;
  foundational means other infrastructure is built on it (zones,
  accounts, the state bucket); security-bearing means Access, API
  tokens, service accounts, IAM, secrets, or anything that mints or
  stores a credential.
- **The ops repo is the default for everything else too.** A private
  app repo MAY keep a module that is non-security and only ever its own
  -- its worker's routes, the namespaces its worker binds, a
  project-only SaaS resource -- for a reason the ops repo's policy lists
  (easier: it changes with the code; smoother automation: the deploy
  pipeline drives it; tool-embedded). It never has to. A Worker Custom
  Domain is wrangler's, never terraform's (the cloudflare-hosting skill).
- **A project module is Tower-ready**, so the fleet's plan/apply server
  could take it over by configuration: state in the shared remote
  backend under its own key, credentials by `op://` reference from a
  headless vault, the fleet's terraform pin, the ops repo's module
  conventions. It is listed in the ops repo's module index, and the app
  repo's instruction file names it. The authority model is unchanged
  wherever a module lives.
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

One root module per concern, each with its own providers, variables,
README and state. A tier is the directory you run in, not a flag you
pass: no `-var stage=` and no workspace; run with `-chdir`. Tier-defining
values are literals in each root's `main.tf`, not variables. A `count`
boolean is a committed default, never a `-var` at the command line.

Read `references/root-layout.md`, "Root module per concern; the tier is
a directory", before you create a root module, add a tier, or add a
per-stage resource to one.

## Ownership split

| Owner | Manages |
|---|---|
| Terraform | durable state whose ids must survive redeploys (namespaces, buckets, routes, Access applications and policies, tokens, DNS posture, a service's deploy parameters, IAM, log metrics, alert policies), and every repository's GitHub policy: rulesets, branch protection, required checks, merge settings, App installation scope (the github-workflow skill) |
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
| credential minting (tokens, service tokens, S3 key pairs written into the vault) | the Global API Key or equivalent root credential, `CLOUDFLARE_EMAIL` + `CLOUDFLARE_API_KEY` from the environment; the vault provider through the local CLI (biometric unlock on a laptop, or a service account that can write the target vaults). Tokens it mints are account-owned unless the product needs a user token (the cloudflare-hosting skill) | where the infra repo's authority table puts it: a laptop by hand, or the infra repo's plan-and-apply server when the owner has ruled it may hold the root credential. Never a deploy workflow's CI path, never a routine apply | remote and locked, or local and gitignored; the minted values are in it, accepted; the root credential is NOT in it, it enters only as env vars for the run |
| CI apply | a scoped token as a vault item read by the workflow's service account | the deploy workflow, on a gated environment for production | remote, locked |

Rules that hold across all three:

- **An agent plans; a human applies.** From an agent session: write the
  module, `init`, `validate`, `plan -out`, read the plan back, and hand
  the human the exact `apply` line. `terraform apply` from an agent
  session is the canonical thing the sre persona refuses, and a cloud
  session has neither the laptop credentials nor the standing to do it.
  The one apply route an agent may have is two plan/apply-server comment
  commands, `atlantis plan` and `atlantis apply -p <project>`, and only where the infra repo's `AGENT.md` grants
  them; no other server command. For every other root, hand the human
  the line.
- **The plan/apply server is the first path.** A root the infra repo's
  authority table marks as served by the server plans on the PR, and the
  human applies by commenting `atlantis apply -p <project>` there.
  Apply before landing: a `/land` before the apply merges configuration
  that is not live.
- A routine-apply root that runs on the laptop only because the server
  cannot serve it yet is a candidate to move: say so in the PR, and
  enable it only by the infra repo's runbook (a server-side workflow and
  its token, not only an `atlantis.yaml` entry). A root that is
  laptop-only by decision (a human's own token, local state, ADC,
  credential minting) stays there. `import`, `state mv`, `destroy` and
  `force-unlock` run only on the laptop, on every root.
- On the laptop path, run `plan -out=tfplan`, read it, and hand the
  human the `op run ... terraform apply tfplan` line to run where its
  output lands in the conversation. In a harness where the human runs a
  command inside the session (Claude Code's `!` prefix), that command
  has no terminal for a `yes`, and the human expects a block, not one
  line per step. For a minting root the human plans too. Hand two
  blocks: one that inits and runs `plan -input=false -out=tfplan` for
  every root in the change, and, after the plans are read against the
  expected diff, one that runs `apply -input=false tfplan` per root in
  dependency order, stops at the first failure, and then runs the
  follow-ups (re-seeding a secret, pointing a consumer at a new item).
  Applying a saved plan applies only what was read.
- Production naming follows the repo's deploy authority: "apply it"
  never means production; a request that does not name the tier is a
  request for preview.
- Separate root modules keep the high-authority credential loaded only
  for token lifecycle; the routine module runs under the scoped token
  the minting module created.
- A scoped token that fails `auth.forbidden` on an account-level
  resource is scoped to a zone; the resource is not zonal and the
  answer is the minting posture, not a wider zone scope.

## State

- **State contains secrets and identifiers.** It is never committed;
  `*.tfstate`, `*.tfstate.*`, `tfplan` and `*.tfplan` are gitignored in
  every repo that holds a module. The lock file
  (`.terraform.lock.hcl`) IS committed; `.terraform/` is not.
- **The state home is per module and stated in its README.** Local
  state means one machine applies, ever, and no lock; do not apply a
  local-state module from more than one machine.
- **Which checkout runs a root follows its state.** A remote-backend
  root runs from any checkout; a local-state root runs only in the
  checkout that holds its state file.
- **Gitignored inputs are referenced, never copied.** A worktree points
  at the shared clone's env file, backend config and `terraform.tfvars`.
- **Never pass `terraform.tfvars` as `-var-file`.**

Read `references/state.md`, "State", before you choose or change a
module's state home, bootstrap a backend, run a root from a worktree, or
write a `terraform.tfvars`.

## Secrets and references

Run Terraform as `op run --env-file=<name>.env -- terraform <cmd>`; the
env-file holds only `op://` references. A reference never resolved is a
to-do, not configuration: resolve every one against the live vault
before committing it. The provider reads its credential from the
environment; a literal secret in a file is a leak with a commit hash.
Seed a secret value into a runtime store by piping it, with the newline
stripped: never an argument, never a file.

Read `references/secrets-and-pins.md`, "Secrets and references", before
you write an env-file, have a module write a credential into the vault,
or seed a secret value into a runtime store.

## Pins

Pin Terraform by `.terraform-version` and `required_version`, and
provider versions per module with `~>`; never mix major provider
versions within a module family. Set `TFENV_TERRAFORM_VERSION` to the
pin for every `-chdir` invocation, the `!` line handed to the human
included. Reference container images by digest, not tag.

Read `references/secrets-and-pins.md`, "Pins", before you add or change
a version pin, write an API-token resource, or run `-chdir` from outside
the root's directory.

## The README every module carries

Every module's README carries: a resource table, the ownership split,
the authority posture with the exact `op run` and `terraform -chdir`
lines (tier set first), the state home and its owning issue,
prerequisites a human does once, verify-after-apply, and rollback.

Read `references/module-readme-and-moves.md`, "The README every module
carries", before you write or change a module's README.

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
  every reference the module wrote. A plan document that says what is
  live, written an hour BEFORE the apply, reads as current for days;
  record the verification and its date, never a status line.
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

A rename, a move between directories or repos, a module split, or a
provider upgrade must produce an EMPTY plan when the human runs it; a
move that plans a create or a destroy is an outage with a commit
message. State files travel with the module, by the human, before the
app repo pulls the deletion. A backend block is never edited as a side
effect of a move.

Read `references/module-readme-and-moves.md`, "Moves and refactors",
before you rename, move or split a module, or upgrade a provider.

## Related

- the gcp-ops, aws-ops and infra-credentials skills: the surfaces and
  the credential lifecycle under this umbrella; the infra-handoff skill
  produces the block that ends a change
- the cloudflare-hosting skill: what wrangler owns and what Terraform
  owns on that platform, token scopes, Access
- the lmde-tunnels skill: the edge in front of a laptop service (tunnel,
  ingress allow-list, Access, connector and caller vaults)
- the release skill: the vault credential chain and deploy workflows
  that consume what these modules create
- the as-built skill: the as-built that records what is deployed
- the gates skill: the law governing any change to a gate, including a
  protected environment or a plan check
