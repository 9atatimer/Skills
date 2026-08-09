---
name: release
description: "Shipping through CD: deploy workflows, the 1Password-backed credential chain (service accounts, op:// references, GitHub secret tiers), pre-merge workflow verification via workflow_dispatch, and behavior-first diagnosis of failed deploys. Load when writing or fixing a deploy/publish workflow, wiring or rotating a deploy credential, or diagnosing a red CD run. Skip for ordinary PR/CI flow with no deploy boundary (github-workflow) and for session-side secret handling (DESIGN.SECRETS-VAULT)."
---

# Releases and Deploys

> Purpose: how fleet repos ship -- the credential chain from GitHub secret
> to 1Password to the deploy target, how to verify a workflow change
> before it merges, and how to diagnose a red CD run from its observed
> behavior instead of guessing.

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

`gh run watch` blocks until completion and then exits -- it is a real
event wait, not polling on a self-set timer, so it does not violate the
no-self-scheduled-timers law.

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
