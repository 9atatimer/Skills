# Putting ci.magic on a repository

Read this before adding the `ci.magic` workflow to a repository, seeding
its credential, or trusting a new repository's first green `ci.magic`
row. It is part of the gates skill, moved out of `SKILL.md` to keep that
file inside its word budget; the gates skill's ci.magic section points
here.

**Putting ci.magic on a repo has two halves, and the owner decides
both.** The action reference and the credential are resolved on opposite
sides of the account boundary:

- **The `uses:` reference** is resolved by GitHub at "Set up job", before
  any step and with no secret in scope. A private action reaches only
  repositories under its OWN owner (Actions access `organization` for an
  org, `user` for a personal account); there is no level that crosses
  owners outside an Enterprise. A consumer under another owner references
  a mirror of the action under that owner -- never a token that fetches
  it. Which reference each owner uses, and how a mirror is stood up, is
  the action's own ops playbook (template-tools
  `docs/ops/ci-magic/PLAYBOOK.ACTION-MIRROR.md`).
- **The credential** (`CI_MAGIC_OP_SA_TOKEN`) is an org secret for an
  org-owned consumer and a PER-REPOSITORY secret for one under a personal
  account, which has no org tier. Without it the action resolves and then
  posts "skipped: missing credential" -- a green skip, not a review. Seed
  it as one loop over the repositories that actually carry the workflow,
  value read from the vault and never pasted:

  ```
  for r in $(gh api -X GET search/code -f q='user:<OWNER> path:.github/workflows ci-magic' --jq '.items[].repository.full_name' | sort -u); do op read '<op:// reference to the CI-Magic service-account token>' | gh secret set CI_MAGIC_OP_SA_TOKEN -R "$r" && echo "seeded $r"; done
  ```

  The exact `op://` reference is a fleet fact, not a skill fact: the
  playbook above carries the cut-and-paste form, and the fleet's
  credential registry (the private infra repo's `ops/credentials/`) is
  where it is recorded. Re-run the loop after each new adopter and on
  each rotation.

A new repository seeded from a template inherits the workflow, not the
secret and not necessarily the right reference: check both on its first
PR before reading a green `ci.magic` as a verdict.
