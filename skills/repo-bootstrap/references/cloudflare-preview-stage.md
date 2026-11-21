# A new app's preview stage on Cloudflare

The human acts that stand up an app's first `preview` stage on
Cloudflare, in the order they must run, and the evidence that proves
each one. Each step needs the one before it, so do them in the order
listed. The human runs every apply, mint and seed; the agent plans,
hands each step over as a `!` line, and reads its evidence before
handing over the next (the infra-credentials skill, What an agent may
and may not do).

The worked example is freetraderlue's runbook `docs/ops/preview-deploy.md`,
"One-time bootstrap", with its three infra repo roots
`ops/terraform/freetraderlue-tokens`, `freetraderlue-state/preview` and
`freetraderlue-access`; misvtt and flashcard follow the same pattern.
Copy the shape of the runbook into the app's own runbook. Do not copy
its names, plan counts or app-specific steps.

## Before the first step

- The infra repo change that adds the tokens, state and Access roots,
  the Environment in the GitHub root, and the registry rows has landed,
  or the plan/apply server applies it from its PR (the iac skill,
  Authority model). The app repo's change that adds the deploy workflow
  is open and not merged: merging it is the first deploy.
- The human has counted the Cloudflare user tokens, and the tokens and
  state roots fit under the cap (the cloudflare-hosting skill, API token
  scopes). If they do not fit, the owner chooses what to free before
  any apply.

## Steps

- **Vault.** The human makes the app's headless nonprod vault, with
  service-account access allowed (a setting chosen at creation). Evidence:
  `op vault get <vault> --format json | jq -r .id` prints a UUID, and
  that UUID is in the gitignored `terraform.tfvars` of the tokens root
  and the state root.
- **Service account.** Read-only on that one vault, created piped into
  its item so the token is never displayed (the infra-credentials skill,
  The vault boundary). Evidence: `op item get "Service Account - OP -
  <name>" --vault Development --format json | jq '[.fields[].label]'`
  lists `credential`. If the token was displayed, revoke the account and
  create it again before going on.
- **Tokens root.** Credential minting, laptop only (the iac skill,
  Authority model). Evidence: the root has `.terraform` and its
  `terraform.tfvars`; the apply output matches the plan; `op item get`
  of each item it writes lists the expected field labels; a read-only
  verify of the CI token succeeds.
- **State root.** The tier's state bucket and a token scoped to it,
  written as a LOGIN item into the nonprod vault. Evidence: the item
  lists `username` and `password`; the bucket exists.
- **Access root.** Before the first deploy, because a Custom Domain
  answers as soon as it exists and must be gated from its first request.
  Evidence: the apply output, and `terraform state list` in the root,
  show the group, the policy and the application on the preview
  hostname.
- **GitHub root.** The `preview` Environment and its branch rule, applied
  alone, before the workflow that names the Environment merges (the
  infra-credentials skill, GitHub secrets and variables). Evidence: the
  two `gh api` reads that skill names show the rule and the allowed
  branch.
- **Environment secret.** The human seeds the service account token from
  its item, piped: `op read "op://Development/Service Account - OP -
  <name>/credential" | gh secret set OP_SERVICE_ACCOUNT_TOKEN --env
  preview -R <owner>/<repo>`. Evidence: `gh secret list --env preview -R
  <owner>/<repo>` shows the name.
- **First deploy.** Merge the app's workflow change; GitHub lists a
  workflow for dispatch only once it is on the default branch. Evidence:
  the run is green, its gate probe included.
- **Verify and rehearse the rollback.** Run the readiness ladder and a
  signed-in check (the cloudflare-hosting skill, Verification and
  diagnosis). Then deploy once more so the Worker has a second version,
  promote the first, check that it serves, and promote the second again.
  Record both results, with the run URLs, in the app's PR.

## Finding where a bootstrap stands

When you pick up a bootstrap, read the evidence for every step from the
first, and stop at the first step whose evidence is missing; that step
is the next one to hand over. The evidence that needs no secret:

- each infra repo root: does it have `.terraform` and its
  `terraform.tfvars`, and, where its state is local, does `terraform
  state list` show its resources
- the vault and the service account's item: read-only `op vault get` and
  `op item get`, field labels only
- the Environment: its branch policy through `gh api`, not its existence
- the Environment secret: `gh secret list --env preview`, names only
- the deploy: `gh run list --workflow <deploy workflow>`
