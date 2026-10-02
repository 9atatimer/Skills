# Deploy mechanics (release skill reference)

> The how-to half of the release skill: consuming a credential from a
> workflow, reading a red deploy, proving a workflow change before it
> merges, and one GitHub Releases trap. The skill states the policy; this
> file is loaded when a task is actually wiring or debugging one of these.
> Minting, vaults and rotation are the infra-credentials skill.

## The credential chain (org standard: 1Password master key)

This section covers CONSUMING a credential from a workflow. Where a
credential comes from -- vaults, service accounts, minting, item
categories, seeding, rotation, the fleet registry -- is the
infra-credentials skill.

The fleet standard is ONE GitHub secret per workflow family: a 1Password
**service-account token**. Every other credential is fetched at runtime
from a 1Password vault via `1password/load-secrets-action`:

```yaml
- uses: 1password/load-secrets-action@<commit-sha> # v4, pinned by SHA
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
- **A scheduled run on a laptop is unattended too.** The 1Password CLI's
  desktop-app integration authorizes each new CLI session with an
  on-screen prompt, so `op read` from a scheduled agent's shell blocks on
  a prompt nobody answers (`authorization timeout`, `promptError`) even
  with the app unlocked, and works only while a human has just authorized
  a session by hand. Give that path a store it can read without a prompt
  -- on macOS the login keychain (`security find-generic-password`, ACL
  granted at seeding, the read bounded by a timeout so a locked keychain
  falls through instead of hanging) -- seeded from the 1Password item,
  which stays the source of truth and is re-copied on rotation. Never
  leave such a read unbounded: botocore and most SDKs put no timeout on a
  credential process, so a hung read hangs the run.
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
  Nonprod and preview targets are fair game for verification; never dispatch
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

## GitHub's `/releases/latest/` excludes prereleases

Any manifest or installer that hardcodes a GitHub Releases "latest" URL
(`.../releases/latest/download/<asset>`) will 404 for every consumer until
a non-prerelease release exists on that repo -- "latest" is defined to skip
prereleases entirely, with no fallback. A repo whose only tag so far is a
beta/rc prerelease has no "latest" to resolve to, even though the tag and
its assets are right there. The failure shows up one hop downstream of
where you'd look: the manifest itself may fetch fine (if it's referenced by
tag), while a `download`/asset URL *inside* that manifest that still uses
the `/latest/` alias fails, which reads as a bug in the consumer rather
than a stale URL.

Prefer a tag-specific URL (`.../releases/download/<tag>/<asset>`) in
anything shipped as part of a release artifact -- template the actual tag
in at build time rather than hand-writing `/latest/`. Reserve `/latest/`
for update-check URLs meant to always point at whatever is newest, and only
once you know the repo will always have a non-prerelease release by the
time anyone reads it.


## Tool state and credential items

- When a credential is rotated or re-homed, update the 1Password item in
  place (keep the same item ID) rather than minting a sibling item, so
  every op:// consumer keeps working without a sweep.
- Deploy tools run on project-local state (coding skill, section 6):
  `cfw` for wrangler, the tool's config variable otherwise. A stored
  login in `$HOME` silently governs every project on the machine -- an
  expired `~/.wrangler` login once vetoed a container deploy although
  `CLOUDFLARE_API_TOKEN` was set (template-tools#699). Auth is the token
  from 1Password, per run; never `wrangler login`.
