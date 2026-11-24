# IaC state -- homes, bootstrap, worktrees, tfvars

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

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
- **Which checkout runs a root follows its state.** A root on a remote
  backend runs from any checkout, a worktree included: the state is in
  the bucket. A root with local state runs only in the checkout that
  holds its state file, on the default branch of the shared clone.
- **Gitignored inputs are referenced, never copied.** The env file, the
  backend config and `terraform.tfvars` live once, in the shared clone.
  A worktree points at them by absolute path (`op run --env-file=...`,
  `init -backend-config=...`) and symlinks `terraform.tfvars` into the
  root module's directory (`ln -s <target> <link>`, both paths given),
  then checks the link resolves before `plan`: a dangling
  `terraform.tfvars` is skipped without a warning and the plan runs on
  defaults. A copy drifts the moment the original is edited.
- **Never pass `terraform.tfvars` as `-var-file`.** Terraform loads an
  implicit `terraform.tfvars` first and `*.auto.tfvars` after it, so a
  committed `*.auto.tfvars` overrides it. An explicit `-var-file` loads
  last and wins. A stale kill-switch list in a local `terraform.tfvars`,
  passed that way, once planned a merge bot's bypass off sixteen
  rulesets. A local `terraform.tfvars` sets no variable a committed
  `*.auto.tfvars` owns.
