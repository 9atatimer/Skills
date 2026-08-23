---
name: release
description: "Phase 7 of the SDLC: shipping -- deploy, publish, or tag. Covers supply-chain integrity, staged and canary rollout, deploy workflows, the 1Password-backed credential chain (service accounts, op:// references, GitHub secret tiers), pre-merge workflow verification via workflow_dispatch, and behavior-first diagnosis of failed deploys. Load when writing or fixing a deploy/publish workflow, wiring or rotating a deploy credential, or diagnosing a red CD run. Skip for ordinary PR/CI flow with no deploy boundary (github-workflow, gates) and for session-side secret handling (DESIGN.SECRETS-VAULT)."
---

# Releases and Deploys (Phase 7)

> Purpose: how fleet repos ship -- what "shipped" means, how a release
> reaches users in stages rather than all at once, the credential chain
> from GitHub secret to 1Password to the deploy target, how to verify a
> workflow change before it merges, and how to diagnose a red CD run from
> its observed behavior instead of guessing.

## What counts as a release

**Deploy, publish, or tag.** A Worker releases by deploying; a package
monorepo releases by publishing to a registry; a library releases by
tagging. Whichever applies, that is the moment the change becomes part of
the shared system -- and therefore the moment phase 7a fires.

**Releasing obliges you to update the as-built.** `docs/arch/` describes
the deployed system, so a release that does not reach it leaves every
downstream reader coding against a stale map. Run 7a before the
retrospective. -> the architecture skill

A change that ships nowhere elides this phase and 7a together. That is a
correct no-op, not a loophole: work that reaches no shared environment
changes no shared architecture.

## Supply chain

What you ship is only as trustworthy as what you built it from.

- **Never install from a piped script.** `curl ... | bash` executes
  unreviewed, unsigned, unpinned code with your credentials in scope. Use
  a package manager that verifies signatures. This is absolute; there is
  no deadline that justifies it.
- **Pin what you build against, float nothing at the boundary.** A deploy
  that resolves a floating tag at run time is not reproducible, and a
  compromised upstream reaches production without a diff. Pin actions to a
  SHA, pin base images by digest, and commit the lockfile.
- **The artifact you verified must be the artifact you ship.** Build once,
  promote that build through the stages. Rebuilding per stage means the
  thing you tested and the thing users get were produced by two different
  runs.
- **Prove reproducibility where the format allows it.** For npm packages,
  the packed tarball's sha256 should match the published one; a mismatch
  means something entered between build and publish.
- **Publish credentials are deploy credentials.** They follow the same
  1Password chain, the same scoping, and the same rotation discipline as
  any other -- see below.
- **A dependency that reached production without a radar row is a
  finding**, not a formality to backfill quietly. Raise it in the
  retrospective. -> the tech-radar skill

## Staging and canary

A release is a sequence of increasingly expensive bets. Do not skip
straight to the last one.

| Stage | Population | What it proves | Rollback cost |
|---|---|---|---|
| Preview / PR environment | you | it starts and serves | none |
| Staging | the team, synthetic traffic | integration and config are right | none |
| Canary | a small real slice | it survives real traffic and real data | small |
| Full | everyone | -- | large |

- **Staging must differ from production only in scale and data.** A
  staging environment with a different config shape proves nothing about
  production; that is the failure mode where "it worked in staging"
  becomes routine and staging quietly stops being a gate.
- **A canary needs a signal and a bound.** Before starting one, state what
  you will watch (error rate, latency, a specific log line) and how long
  you will watch it. A canary nobody measures is a slow full deploy.
- **Rollback is a first-class path, not an incident response.** Know the
  command before you need it, and prefer a mechanism that does not require
  a rebuild -- promoting the previous artifact, or a Worker version
  rollback. If rolling back requires a green CI run, it is not a rollback.
- **Never dispatch a production workflow to test it.** Staging and preview
  targets are what verification is for (see "Verifying a workflow fix
  before merge").
- **Stage progression is a gate**, so it is governed by the first law of
  the gates skill: you may tighten it whenever you like; loosening it --
  skipping the canary, widening the slice, shortening the watch -- is a
  change that must clear the bar as it stands today.

## Where repo facts come from

This skill is pure shared logic. Deploy targets, stage names, npm publish
targets, vault names, workflow filenames, and "which merge triggers what"
are repo policy and live in the consuming repo's agent instruction file
(`AGENT.md` / `AGENTS.md` / `CLAUDE.md`) or its ops docs. Derive GitHub
identity at runtime (`gh repo view "$(git remote get-url origin)"`), never
from memory -- the same rule as the github-workflow skill.

Two standing repo-policy patterns to expect (the repo's own file wins):

- Production deploys run in CI, never from a laptop. A repo may mark a
  directory (e.g. `scripts/CD/`) as CI-only; honor it.
- Staging/preview deploys go through the repo's npm targets, not by
  invoking the underlying tool (wrangler, terraform, gcloud) directly.

## The credential chain (org standard: 1Password master key)

The fleet standard is ONE GitHub secret per workflow family: a 1Password
**service-account token**. Every other credential is fetched at runtime
from a 1Password vault via `1password/load-secrets-action`:

```yaml
- uses: 1password/load-secrets-action@v4
  with:
    export-env: true
  env:
    OP_SERVICE_ACCOUNT_TOKEN: ${{ secrets.OP_SERVICE_ACCOUNT_TOKEN }}
    SOME_DEPLOY_TOKEN: op://<vault>/<item>/<field>
```

Rules of the chain:

- **Service accounts are read-only and scoped to one headless vault**
  (an infra vault the repo owns). A 1Password service account *cannot*
  be granted a personal/Private vault, so `op://Private/...` references
  are interactive-only by construction -- they can never work in CI.
- **Secret naming:** either the generic `OP_SERVICE_ACCOUNT_TOKEN` (the
  name the action reads natively) or a purpose-named org secret
  (`<PURPOSE>_OP_SA_TOKEN`) mapped onto it in the workflow's `env:`.
  One service account per purpose; do not reuse another workflow
  family's SA just because its secret is already shared -- it is scoped
  to a different vault.
- **GitHub secret tiers differ by account type.** Organizations have
  org-level secrets (which additionally need the repo added to the
  secret's repository-access list); personal user accounts have NO org
  tier -- repo secrets only. Check before assuming:
  `gh api users/<owner> --jq .type`. A workflow convention copied
  between repos in different accounts breaks exactly here.
- **An undefined `${{ secrets.X }}` resolves to empty string, silently.**
  Nothing fails at reference time; the failure surfaces one step later
  as an auth error inside the consuming action. Where a secret is
  load-bearing, add an explicit guard step that warns when it resolved
  empty, naming the likely cause (secret absent, or org secret not
  shared with this repo).

## op:// reference discipline

- **Vault by UUID**, with a comment mapping UUID to human name, so vault
  renames do not break the reference.
- **Item by ID** when the title contains `@` (op:// rejects it) or when
  rename risk matters; item by title is acceptable for stable titles.
- **Never guess the field name -- it follows the item's category.**
  `API_CREDENTIAL` items store the token under `credential`;
  `LOGIN`/`PASSWORD` items under `password`. Confirm before wiring:

  ```zsh
  op item get <item> --vault <vault> --format json
  ```

  and read `fields[].label` / `fields[].reference`. A reference written
  from convention instead of inspection fails with
  `does not have a field '<name>'` -- and only after auth succeeds, so
  it hides behind any earlier credential fault.
- **All consumers point at the same item and field.** Deploy workflows
  and local `.env.op` files must agree; a local flow that works while
  CI reads a different field masks the CI fault. When you fix one
  consumer, grep for the item title/ID across the repo and fix them all.

## Diagnosing a red deploy: deduce from behavior

Read the run log before touching anything -- each failure names its own
layer. The GitHub Actions step header prints the step's `env:` block:

- Secret shown as `***` -- present (GitHub masks real values).
- Secret shown blank after the colon -- **empty**: not defined at that
  scope, or an org secret not shared with the repo.

That one line separates "secret missing" from "secret wrong."

Then place the error on the chain -- each rung only becomes reachable
after the previous one holds:

| Symptom | Fault |
| ------- | ----- |
| `you must set either OP_SERVICE_ACCOUNT_TOKEN or OP_CONNECT_...` | SA token empty at this scope |
| vault or item not found | SA authenticated but lacks a grant on that vault, or wrong vault ref |
| `does not have a field '<name>'` | item exists; field name wrong (see category rule above) |
| deploy tool's own auth error | chain delivered a value, but the downstream token is dead or under-scoped |

Corroborating history: `gh run list --workflow <wf>` distinguishes a
workflow that has NEVER succeeded (wiring was never right -- suspect a
convention copied from another repo or account type) from a regression
(something was revoked, renamed, or rotated).

Verify a suspect downstream token read-only before blaming the deploy
tool -- most providers have a verify endpoint (e.g. Cloudflare
`GET /user/tokens/verify`). A token proven live and active moves the
fault back into the reference that delivers it.

## Verifying a workflow fix before merge

`workflow_dispatch` runs the workflow file **from the ref you pass**, so
a fix is provable pre-merge:

```zsh
gh workflow run <workflow>.yml --repo <owner/repo> --ref <branch>
gh run watch <run-id> --repo <owner/repo> --exit-status --interval 15
```

- The workflow must declare `workflow_dispatch:` (fleet deploy workflows
  should -- add it when authoring one, precisely so fixes can be proven
  this way). GitHub only lists a workflow for dispatch once a version of
  it exists on the default branch; environment protection rules may
  additionally restrict which refs can deploy.
- **Dispatching a deploy workflow deploys.** Know the target first.
  Staging/preview targets are fair game for verification; never dispatch
  a production workflow to "test" it.
- `gh run rerun <id> --failed` re-runs a failed run against the same
  commit -- right for retrying after an out-of-band fix (a secret added,
  a grant made), useless for testing a workflow-file change (the old
  file re-runs).
- Cite the green run URL in the PR body as verification evidence.

`gh run watch` is a synchronous blocking wait: it polls GitHub
internally at `--interval` and exits when the run completes. That does
not violate the no-self-scheduled-timers law, whose target is deferring
agent work to a future turn on a self-set clock -- a foreground command
that blocks the current turn until a real outcome is not that, whatever
it does internally.

## Deploy hygiene

- Never push to the default branch to exercise CD; branch, dispatch,
  prove, then merge (github-workflow skill governs the PR itself).
- Before merging anything that matches a deploy workflow's `paths:`
  filter, know that the merge will trigger that deploy.
- Prefer scoped, short-lived downstream tokens where the provider
  supports them; a leaked value's blast radius is its scope times its
  lifetime. Session-side containment is a separate problem -- see
  template-tools `docs/design/DESIGN.SECRETS-VAULT.md`.
- When a credential is rotated or re-homed, update the 1Password item in
  place (keep the same item ID) rather than minting a sibling item, so
  every op:// consumer keeps working without a sweep.

## Exit gate

The change is deployed, published, or tagged; the rollout reached its
final stage or was deliberately stopped; `docs/arch/` was updated at 7a to
describe what now runs. Then the retrospective can diff the frozen design
against a true as-built.

## Related

- the architecture skill -- phase 7a, which this phase triggers
- the gates skill -- the pre-merge rungs, and the law governing any change
  to a stage-progression rule
- the retrospective skill -- phase 8, where a dependency that shipped
  without a radar row becomes a filed finding
- the tech-radar skill -- the rings a shipped dependency is audited against
