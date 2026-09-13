---
name: infra
description: "Working on infrastructure from any repo: where the fleet's infrastructure-as-code lives (the infra repo named in this repo's AGENT.md), what belongs to a deploy versus to terraform, the authority ladder (agents write config and plan; humans apply), the no-ripple rule, pre-flight before any plan, and the hand-off to the human. Load the moment a task touches a .tf file, a DNS record, an Access application, a Workers route or custom domain, a bucket, an API token, a cloud service account, or a GitHub secret, then load the provider skill for the surface in play (cloudflare-ops, gcp-ops, aws-ops) and infra-credentials for anything that mints or wires a credential. Skip for a deploy workflow that ships code and seeds runtime secrets without changing a resource (release)."
---

# Infrastructure -- the map, the boundary, and the authority ladder

> **Purpose:** an agent in any repo should know, before it edits
> anything, that infrastructure lives somewhere specific, that most of
> what it may do is write config and hand over a plan, and that a change
> which ripples into a live resource before a human applies it is a
> failure whatever the diff looks like.

## Where infrastructure lives

The fleet keeps its infrastructure-as-code in ONE private repo, the
infra repo. Every other repo is a consumer of it. This skill is public
and therefore never names that repo; find it in the consuming repo's
agent instruction file (`AGENT.md` / `AGENTS.md` / `CLAUDE.md`) under a
heading called **Infrastructure**. That section names the infra repo,
the terraform modules this repo's deploys depend on, and the GitHub
secrets and variables its workflows read (names only). If the section is
missing, that is the first finding: write it before touching anything
else, from the infra repo's module index.

Inside the infra repo:

| Path | Holds |
|---|---|
| `ops/terraform/<system>-<concern>/` | one root module per system per concern |
| `ops/terraform/README.md` | the module index: what each manages, its state and credential posture, its consumers, and the modules that live elsewhere by exception |
| `docs/policy/INFRASTRUCTURE.md`, `TERRAFORM.md`, `CREDENTIALS.md` | the rules in force; they win over any consumer repo's file |
| `ops/credentials/REGISTRY.md` | every GitHub secret and variable each repo's workflows consume, names only |
| `docs/design/` | design records for infra changes that add a seam |

Read the policy files before editing a module. They are short and they
are the authority; this skill is the map to them.

## What is infrastructure, and what is a deploy

Infrastructure is a resource that outlives any one deploy and that more
than one deploy, or more than one repo, depends on: DNS, Access
applications and policies, Workers routes and custom domains, buckets,
API tokens, cloud projects, service accounts, IAM, secret containers,
managed services, monitoring. It lives in the infra repo, as terraform.

A deploy is the script, image or build, plus the runtime secrets it seeds
and the workflow that ships it. It lives in the app repo, next to the
code, and the `release` skill governs it.

The boundary test when a thing could go either way:

- **Could two different deploy pipelines both need it?** Then it is
  infrastructure. A Workers route on a hostname another worker owns is
  shared edge state; the script bound to it is a deploy.
- **Does losing it mean re-importing rather than re-deploying?** Then it
  is infrastructure. An API token is imported; a worker secret is
  re-seeded.
- **Does it hold a value terraform would have to write into state?**
  Then keep it OUT of terraform even if it is infrastructure-shaped:
  worker secrets are seeded by the deploy from a 1Password item, and
  cloud secret VERSIONS are seeded out of band while terraform reads
  the secret as a data source.

## The authority ladder

| Action | Who | From where |
|---|---|---|
| Read state, read resources, verify a token, probe a hostname | agent or human | anywhere the credential reaches |
| Write terraform config, open the PR | agent or human | a feature branch |
| `terraform plan` | human; an agent only against nonprod with a read-scoped token, reporting the plan verbatim | the machine holding the state |
| `apply`, `import`, `state mv`, `destroy` | human only | the laptop holding the state |
| Mint a credential | human only, interactive | the laptop |
| Seed a GitHub secret or variable, approve a deployment | human | GitHub |

An agent never runs `terraform apply`, never passes `-auto-approve`,
never approves a pending deployment, and never looks for another route
to the same effect (a curl to the API, a dashboard, a "just this once").
Being able to clear a guard is not being permitted to. The agent's
deliverable is the config and the hand-off; the `infra-handoff` skill
produces the block.

## No ripple

Nothing an agent commits may change a live resource until a human
applies it, and a refactor -- rename, move between directories or repos,
module split, provider upgrade -- must produce an EMPTY plan when the
human runs it. A move that plans a create or a destroy is an outage with
a commit message.

- Keep `.tf` files byte-identical across a move whenever the tooling
  allows; edit only README, scripts and comments for new paths. `diff -r`
  at copy time is the proof, pasted in the PR.
- State files travel with the module, by the human, on the laptop; they
  never enter git. The old location gets a tombstone README.
- A backend block is never edited as a side effect. Changing it is a
  state migration with its own issue, its own PR, and a post-migration
  plan that must be empty.
- A provider major-version bump is the same: a migration, one module per
  PR, proven by an empty plan.

## Pre-flight before any plan

- `git branch --show-current` is a feature branch and the tree is clean.
- The module's state is on THIS machine: `terraform state list` shows
  what the module README says exists. A module that should have resources
  and shows none is a missing state file, and a plan will propose to
  create live resources. Stop.
- The credential resolves before terraform starts (`op run --env-file
  ... -- env | grep -c <VAR>` prints `1`), and its scope is verified
  read-only (the provider skill names the endpoint and the error codes).
- The tier is the one you mean. Read the vault UUID or project id back to
  its name before anything touches production.
- For a module with the 1Password provider: no item in the target vault
  already carries a title the module will create; the provider creates by
  title and never adopts.

## Tiers and naming

- The non-production tier is `nonprod`. Never `staging` or `stage`;
  "staging" is a verb.
- Hostnames put the tier in its own DNS label: `<service>.nonprod.<zone>`
  and bare `<service>.<zone>` for production.
- Vaults are per tier with IDENTICAL item titles; service accounts are per
  tier and hold no grant on the other tier's vault.
- Identities are per workload per tier. A new system never borrows another
  system's token or service account because it is already there.
- Modules are named `<system>-<concern>`; tiers are sibling roots over a
  shared `modules/` tree.

## The change flow

- Start from an issue (in the infra repo, or cross-linked to it).
- A change that adds a seam, a component or a dependency gets a design
  record under `docs/design/` in the infra repo (the design skill). A
  one-line allow-list edit does not.
- Write the config on a feature branch in the infra repo; run
  `terraform fmt` and `terraform validate` where the sandbox has the
  providers; open the PR with the hand-off block.
- The human plans, reads the plan against the hand-off, applies, and
  pastes the apply summary on the PR.
- If a consumer-visible fact changed (a hostname, an AUD, a bucket name,
  a secret name), the consumer repo gets its own PR: workflow, `AGENT.md`
  Infrastructure section, ops docs. The infra repo's registry and module
  index are updated in the same change set. The as-built (`docs/arch/`)
  is updated at release, per the architecture skill.

## When the task is in a consumer repo

You are in an app repo and the task says "add a hostname", "gate this
behind Access", "the worker needs a bucket", "rotate the token":

- Locate the module in the infra repo's index via this repo's
  `AGENT.md`. If the resource has no module, it is either unmanaged (an
  import job, flagged to the human) or new (a design question).
- Make the terraform change in the infra repo on a feature branch there,
  and the consumer change (workflow, wrangler config, `.env.op`) here.
  Two PRs, cross-linked; the infra one carries the hand-off.
- Never create the resource by hand to unblock the deploy. A resource
  made in a dashboard is one nobody owns, and the next apply will fight
  it.

## Related

- the release skill -- the deploy side: workflows, the credential chain a
  workflow consumes, diagnosing a red deploy
- the infra-credentials skill -- provisioning and governing credentials
- the cloudflare-ops, gcp-ops and aws-ops skills -- the provider surfaces
- the infra-handoff skill -- the block that ends an infra change
- the gates skill -- the terraform artifact check and the law that a gate
  is cleared before it is moved
- the sre persona -- who owns this territory
