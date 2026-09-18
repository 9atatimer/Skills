---
name: infra-credentials
description: "Provisioning and governing the credentials infrastructure needs: the vault boundary (a personal vault mints, headless per-purpose vaults are read by scoped service accounts), one service account per purpose and per tier, minting under human interactive authority only, 1Password item categories and the field names they force, GitHub secrets versus variables and how they are seeded, rotation in place, and the credential registry kept in the infra repo. Load with the iac skill whenever a task mints, wires, renames, rotates or inventories a credential. Skip for how a workflow consumes an op:// reference at run time and diagnoses a red deploy (release) and for session-side secret containment (the repo's secrets-vault design)."
---

# Infrastructure credentials

> **Purpose:** the release skill says how a workflow reads a credential.
> This skill says where credentials come from, who may make one, what
> each may reach, and how the fleet knows which exist. Every rule here
> exists because its absence once cost real time: a fallback that hid
> which token fired, an item category that dropped a field, a deleted
> item that started a scramble.

## The vault boundary

- A **personal vault** (`Private`) is interactive only. It holds the
  operator's admin and Global API credentials -- the ones that MINT
  other credentials -- and nothing a workflow reads. A 1Password
  service account cannot be granted a personal vault, so an
  `op://Private/...` reference is interactive-only by construction and
  can never work in CI. A committed reference into it is a bug in
  waiting.
- Every automated consumer reads a **headless vault** through a
  **read-only service account** scoped to that one vault. One service
  account per purpose. A compromised runner then holds one read-only
  token to one vault.
- **Tiers get their own vaults with IDENTICAL item titles**, and their
  own service accounts; a nonprod SA has no grant on the prod vault.
  The consumer varies only the vault reference, so which tier's
  credential you get is decided by which vault you read.
- Vaults, service accounts and grants are made by a human in the
  1Password UI or `op` CLI. Terraform cannot create them, and `op`
  cannot edit an SA's grants after creation: a wrong grant means a new
  SA, so name the vault and the `read_items` scope on the create line
  and nothing more.

## Minting

- Minting is a human act, interactive, on the laptop: the Global API
  Key or an admin token from the personal vault for the provider, and
  the `op` desktop app for the 1Password terraform provider. Minting
  modules say LAPTOP ONLY in their README and offer no CI path.
- Least privilege per purpose: a deploy token (scripts, routes, KV), a
  terraform token (Access, DNS), a bucket-scoped storage token, a
  service account per workload per tier. Two purposes, two tokens, even
  when one account could hold both.
- The minted value lands in a 1Password item, never directly in a
  GitHub secret, never in a file in any repo, never in a chat or an
  issue. The module writes it there and outputs the `op://` path.
- The minted value also lands in local terraform state, in cleartext.
  That state file is now a credential: laptop only, never a second copy,
  never a plan file left on disk.
- A recreate is a rotation. Access service tokens, OIDC apps and API
  tokens issue their secret once; `prevent_destroy` on the resource, and
  a hand-off that names the consumers a recreate would break.

## Item categories and fields

- The field name follows the item category, and the terraform 1Password
  provider cannot create `API_CREDENTIAL` items:

  | Category | Fields | Use for |
  |---|---|---|
  | `API_CREDENTIAL` | `credential` | tokens minted by hand in the UI |
  | `LOGIN` | `username`, `password` | anything with an id + secret pair (R2 S3 credentials) |
  | `PASSWORD` | `password` | a single value minted by terraform |

  A `PASSWORD` item silently drops a `username` field; every documented
  `.../username` reference then errors. Pick `login` when both halves
  must survive.
- Never guess a field: `op item get <item> --vault <vault> --format
  json` and read `fields[].label` and `fields[].reference`. A reference
  written from convention fails with `does not have a field '<name>'`,
  and only after authentication succeeds, so it hides behind any earlier
  fault.
- Address the vault by UUID with a comment naming it; address the item
  by ID when its title contains `@` or `:` (illegal after `op://`).
  Spaces in a title are legal.
- Title collisions: the provider creates by title and never adopts. A
  same-title sibling makes every `op://` read ambiguous. Pre-flight:
  `op item list --vault <uuid> --format json | jq -r '.[].title'`, then
  import or rename before applying.

## GitHub secrets and variables

- ONE secret per workflow family: the service-account token, named
  `OP_SERVICE_ACCOUNT_TOKEN` or `<PURPOSE>_OP_SA_TOKEN` mapped onto it in
  the workflow's `env:`. Everything else is an `op://` reference
  resolved at run time.
- Tiered deploys put the SA token and the vault UUID on a GitHub
  Environment (`nonprod`, `production`) so the tier is chosen by the
  environment, not by a branch condition in the workflow.
- Non-secret identifiers -- account ids, project refs, AUDs, team
  domains, hostnames, role ARNs -- are repository VARIABLES. They show
  in logs, can be checked, and do not count against a secret budget.
- No `secrets.A || secrets.B` fallbacks. The expression only falls
  through when the left side is completely unset; an org-level secret
  makes it unconditionally non-empty, and the fallback then hides which
  token actually fired.
- Never reuse another workflow family's SA because its secret already
  exists on the repo. It is scoped to a different vault; the failure
  surfaces one step later as an auth error inside the deploy tool and
  points at the wrong layer.
- Personal accounts have no org secret tier. `gh api users/<owner>
  --jq .type` before assuming a secret is shared.
- Seeding is a human act: the GitHub UI, or `gh secret set` from the
  human's shell. The PR that adds a consumer names the secret and the
  item in the registry and never carries a value; an agent never asks
  for the value and never reads one into a transcript.
- Deploy jobs never run on `pull_request_target`; a fork's code with
  the repo's secrets is the whole risk in one trigger.

## Rotation

- Rotate in place: update the item, keep its ID, and every `op://`
  consumer keeps working. Never mint a sibling with a near-identical
  title.
- A secret with more than one holder (a worker, a relay, a cloud secret
  version) is rotated by updating the item and re-seeding every holder
  from it. Grep the item title and ID across every consumer repo before
  declaring the rotation done; a stale holder fails silently at its
  next auth.
- Deleting an item is a rotation you did not plan. Before deleting,
  grep for its ID and title across the fleet.

## The registry

The infra repo (named in this repo's `AGENT.md` under Infrastructure)
keeps `ops/credentials/REGISTRY.md`: every vault and service account,
and every GitHub secret and variable each repo's workflows read, with
the item each resolves to. Names only. A change in any repo that adds,
renames or removes a consumer updates the registry in the same change
set. A consumer absent from the registry is a finding, not a formality.

## What an agent may and may not do

| May | May not |
|---|---|
| read names, UUIDs, IDs, titles, `op://` paths | read a value into the transcript |
| verify a token read-only against the provider's verify endpoint | mint, seed, rotate, or delete |
| write workflow wiring, `.env.op` references, the registry | widen an SA's grant to make a job pass |
| diagnose from the step header (`***` present, blank empty) | approve a deployment or look for a route around a gate |

## Related

- the release skill -- consuming the chain at run time; diagnosing a
  red deploy rung by rung
- the iac skill -- the authority ladder and where the registry lives
- the cloudflare-hosting and gcp-ops skills -- what each provider's token or
  service account must be scoped to
- the gates skill -- the scanners and the terraform artifact check that
  keep values out of git
