---
name: repo-bootstrap
description: "Wiring a new repository, made from the fleet template, into the fleet's machinery: the landing bot (tedium), the ci.magic reviewer, OCR on Demand, deploy workflows with their stages, and the Cloudflare credentials, Access gate and state they need. Names the order (decide names, infra-repo change, repo change, human acts, verify), which repo each piece lives in, which acts only a human may do, and the template placeholders that look configured and are not. Load when a task creates or adopts a repo, enrolls it in tedium, or turns on its deploy workflows for the first time. Skip for changing one wired piece in a repo that already runs (release, gates, iac) and for the product's own design (design)."
---

# Repo bootstrap

> **Purpose:** a template repo is wired to nothing. Each fleet service
> (merge bot, reviewer, deploy, credentials) is enabled by a change in
> TWO repos and one or more human acts, and the first run only shows what
> was missed. This skill is the order and the proof for each rung. The
> mechanics of every rung live in the skill that owns it; this one says
> which to load and when.

## Decide the facts first

Settle these before any file is written; each is a literal in several
places and renaming later touches all of them.

- Owner and repo name (an organization repo and a user repo differ in
  secret tiers and in the ci.magic action reference).
- The stages and their names. The template may say `nonprod`; the repo
  chooses (`prod` and `preview` is allowed: the tier is a DNS label,
  `preview.<host>`). Rename EVERY occurrence at once -- tier directories,
  workflow files and names, concurrency groups, GitHub Environments,
  vault and item names, posture file, tests, docs -- then grep the old
  word to prove none is left. A half rename deploys to a name the
  credentials do not match.
- Zone and hostname per stage; prove the zone exists with `dig +short NS`
  before writing it, since a mistyped domain looks plausible in a plan.
- Who passes the Access gate (enumerated addresses, never a domain).
- Whether prod is wired now or its gate and workflow stay off.

## Order

- Infra repo change, one PR (the iac skill): enrollment in the landing
  bot, a credential-minting root for the tokens, a minting root for each
  tier's own state bucket and scoped key, the Access root, the registry
  rows, the module index and the authority table.
- Project repo change, one PR: the template filled in, nothing left that
  reads as configuration and is a placeholder.
- Human acts, in dependency order, named in the project's runbook
  (below): vaults and service accounts, minting and Access applies,
  secret seeding, the repository variable that turns deploys on.
- Verify each rung against the live system; an unattended path is live
  only after it has run (the release skill).

## Rungs

| Rung | Declared in | Human act | Proof |
|---|---|---|---|
| Landing bot | the infra repo's GitHub root (repo map, enablement list) and the repo's `tedium.toml` | apply the root | `tedium ping`, then `dryrun`, then `land` on a throwaway PR |
| ci.magic | the repo's workflow and root `ci.magic` | add the repo to the org secret's repository list, or seed the secret per repo for a user account | the PR comment is a verdict, not "skipped: missing credential" |
| OCR on Demand | the repo's caller workflow, pinned to one reusable-workflow commit | add the repo to the org secret and variable lists, or seed them per repo | `/ocr` on a PR posts a review |
| Cloudflare tokens | the infra repo's minting root, one token per tier | laptop apply under the human's root credential | `op read` of each written item, a read-only token verify |
| State | one bucket and scoped key per tier, minted by a root | laptop apply | the deploy's `terraform init` reads and locks it |
| Access gate | the infra repo's Access root | apply it BEFORE the first deploy of the tier | the unauthenticated probe returns the gate's login; the AUD output is pasted into the project's tier literal |
| Deploy | the repo's tier roots and workflows, inert until a repository variable says otherwise | vaults, service accounts, Environment secrets, the enabling variable | a `workflow_dispatch` of preview goes green, then the probe |

- Load the skill that owns the rung before touching it: gates (landing,
  ci.magic, OCR), iac and infra-credentials (roots, tokens, vaults),
  cloudflare-hosting (Access, Workers, token scopes), release (the deploy
  chain).
- Per-repo human acts the rungs above do not name, and that no template
  doc lists: seed the packages read token the repo's install step uses,
  add the bot account as a collaborator, set the runner-pool variable if
  the fleet runs a pool, and check the repo is inside the runner
  installation's scope. Missing any of them surfaces as a red first run.
- Production tedium, ci.magic and OCR need no per-repo infrastructure
  beyond the rows above. Check the runbooks in the infra repo for the
  current containment rule before enrolling a private repo; a template
  runbook written when only a sandbox instance existed will say not to.

## Template traps

- **Placeholders that parse.** A syntactically valid `example.com`, an
  all-zero pin, a `replace-with-...` AUD: nothing fails until the first
  real request. Make a check refuse to deploy while a sentinel remains,
  test first.
- **Pins.** The OCR caller names a reusable workflow and a `tools_ref` by
  commit; both must be the same real commit. Prove it resolves.
- **Tag-pinned actions.** The template's ci.magic workflow pins some
  actions by tag; pin each by SHA and prove it resolves (the release
  skill, Supply chain).
- **An unfilled backend.** A backend config carrying an account-id
  placeholder cannot be derived without Cloudflare access; it stays a
  human fill and `terraform init` fails until it is set.
- **`tedium.toml` check names** are exact strings from the checks UI;
  verify them against the workflow job names, not memory.
- **Stale runbooks.** A copied onboarding runbook states the world as it
  was when the template was cut. Reconcile it with the infra repo's
  current runbook in the same PR.
- **Item titles are identical across tiers** (the infra-credentials
  skill), so the template's per-project CI item names must be rewritten
  to one title per tier vault; the consumer varies only the vault.
- **One token per tier, or a second for CI?** A laptop token copied into
  a headless vault means a CI compromise rotates the laptop's too. State
  the choice and its exposure in the minting root's README; a split
  token is the stricter default when CI scope can be narrower.
- **Access before deploy.** The Access runbook may list the Worker first;
  gate first is right, so each hostname is gated from its first request.
- **The AUD does not exist until the Access root is applied**, and a
  re-created application changes it. The deploy cannot be proven before
  that apply; say so in the runbook's ordering.
- **A token, a bucket, a vault or a service account that exists only
  because you wrote it in a README does not exist.** The human creates
  vaults and service accounts; never invent a UUID, leave it a named
  variable.

## Exit

- Both PRs merged through the landing bot; every human act done and
  dated in the registry (names only).
- The first preview deploy ran unattended and its probe is green.
- Anything the template got wrong is an issue against the template, not
  a local patch that the next bootstrap repeats.
