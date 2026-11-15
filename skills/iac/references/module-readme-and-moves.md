# IaC module README and moves

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

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
