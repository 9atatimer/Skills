---
name: infra-handoff
description: Produce the plan hand-off block that ends an infrastructure change, so the human can plan, compare, and apply from the laptop that holds the state. Run as /infra-handoff after the terraform change is committed on a feature branch.
disable-model-invocation: true
---

# /infra-handoff

> **Purpose:** an agent's infrastructure change is finished when the
> human has everything needed to run the plan, judge it, and apply it
> without re-deriving anything -- and nothing more. This command writes
> that block. The infra skill governs why the apply is not yours.

## What to produce

One fenced block, posted as the PR body's last section (or as a comment
on the PR if the body already exists), with these headings in this
order. Fill every one; write `none` rather than omit.

- **Module** -- path in the infra repo, branch, commit SHA, and the
  consumer repo(s) whose `AGENT.md` names it.
- **Change in one sentence** -- what the human should expect to see and
  why (`the Lattice allow-list gains one email`).
- **Pre-flight** -- as commands the human runs before the plan:
  `git branch --show-current`, `git status --short`,
  `terraform state list` with the resources it must show, the
  `op run --env-file=<file> -- env | grep -c <VAR>` resolution check,
  the read-only scope probe for the token, and for a 1Password-provider
  module the title-collision listing.
- **Plan line** -- the exact invocation, environment file included, on
  one line.
- **Expected plan** -- counts (`0 to add, 1 to change, 0 to destroy`)
  and the resources by address, in words. Name any destroy and what it
  means (a recreate of an Access SaaS app rotates its client secret; a
  destroy-then-create replacement leaves the item missing between the
  two steps).
- **Rollback** -- the config revert (a commit to revert), and whether
  re-applying restores an equivalent resource or mints a new credential
  that consumers must be re-pointed at.
- **After the apply** -- the consumer follow-ups the apply unlocks:
  repository variables to set, workflow inputs, `AGENT.md` sections,
  the registry row, the as-built.
- **Not verified** -- anything the sandbox could not prove (no provider
  registry access for `terraform validate`, no credential for a probe),
  stated plainly.

## Rules

- Derive every fact from the diff, the module README and the state
  posture in the module index. Do not restate the policy; link it.
- Never include a value, a plan file, or state. Item titles, IDs and
  `op://` paths are fine.
- If the change is a move or a refactor, the expected plan is
  `No changes.` and the block says so; a move that expects anything
  else is not a move.
- If the pre-flight cannot be satisfied on any machine (a module whose
  state is missing everywhere), the block's Expected plan says
  `blocked: import job` and names the resources to import.
- End there. The apply and the paste-back of its summary are the
  human's; do not schedule a check-in or poll for it.

## Related

- the iac skill -- the authority ladder this command implements
- the cloudflare-hosting, gcp-ops, aws-ops skills -- the scope probes and
  verify endpoints to cite in Pre-flight
