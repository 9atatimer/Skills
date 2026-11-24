# IaC secrets, references and pins

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Secrets and references

- `op run --env-file=<name>.env -- terraform <cmd>`. The env-file holds
  only `op://` references (vault by UUID with a comment naming it; item
  by id when the title contains `@` or `:`; field by the item's
  category). Whether the env-file is committed is the repo's rule: an
  app repo may commit `.env.op` because it is references only; the
  private ops repo gitignores `*.env` so a new module cannot fall
  outside a literal list.
- **A reference that was never resolved is a to-do, not
  configuration.** Resolve every `op://` reference against the live
  vault (`op read`, or `op run -- env | grep`) before committing it. A
  module whose backend credential item never existed sat unrunnable for
  months, and every Access change in that period was a dashboard change
  Terraform did not know about.
- The provider reads its credential from the environment; there is no
  token variable and no default. A literal in a file is a leak with a
  commit hash.
- `terraform.tfvars` is gitignored when it carries identifiers, and
  there is deliberately no committed example when every value in it is
  an account, application, or vault identifier; `variables.tf` documents
  what each one is instead.
- When a module writes a credential into the vault, the item category
  decides which fields the provider emits: a LOGIN item carries
  `username` plus `password`; a PASSWORD item drops the username on the
  floor; the semantically right API_CREDENTIAL category is one the
  provider cannot create. `password` is the canonical token field
  everywhere, and consumers reference the item, never the state.
- Seeding a secret value into a runtime store pipes it: `op read ... |
  tr -d '\n' | <tool> --data-file=-`. Never an argument, never a file.
  The newline strip is load-bearing: a stored value one byte longer than
  what every caller holds fails a length check on EVERY request and logs
  nothing more useful than "bad key".

## Pins

- tfenv reads `.terraform-version` from the current directory, not from
  `-chdir`. A `terraform -chdir=<root>` run from anywhere else gets
  tfenv's default and fails `required_version` (1.5.6 against `>= 1.10`,
  seen in the private ops repo). Set `TFENV_TERRAFORM_VERSION` to the
  pin for every `-chdir` invocation, the `!` line handed to the human included.
- Terraform version pinned by a `.terraform-version` file (tfenv) and
  `required_version`; provider versions pinned per module with `~>`,
  and major versions never mixed within a module family (a v4 and a v5
  Cloudflare provider disagree on resource names and argument shapes; a
  resource that exists only in v5 gets its own root module with its own
  pin). The Cloudflare v5 provider rewrote the API-token resource:
  `policies` is an attribute list, `resources` is `jsonencode(...)`, and
  permission groups come from the
  `cloudflare_api_token_permission_groups_list` data source. v4-style
  examples plan against nothing; `terraform validate` against the real
  provider is the check.
- Container images referenced by DIGEST, not tag; only a digest makes a
  rollback deterministic.
- Deploy parameters that are decisions (instance caps, concurrency,
  timeouts, ingress) are literals with a stated reason, not tfvars;
  changing one is a design change.
