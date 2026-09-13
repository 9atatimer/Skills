---
name: cloudflare-ops
description: "Operating the fleet's Cloudflare estate through terraform and read-only verification: Zero Trust Access (applications, policies, groups, service tokens, bypass apps, Access as an OIDC provider), DNS records versus Workers custom domains and routes, the wrangler/terraform ownership split for Workers, R2 buckets and their S3-compatible credentials, and API token scoping with the error codes that reveal a scope fault. Load with the infra skill whenever a task touches a Cloudflare resource. Skip for writing or testing Worker code (coding, testing-node) and for the deploy workflow itself (release)."
---

# Cloudflare operations

> **Purpose:** the Cloudflare account is where most of the fleet's edge
> lives -- Access gates, Workers, R2, DNS -- and it is where a
> well-meaning change most easily becomes an outage or a credential
> rotation. This skill carries what an agent needs to write a correct
> module and to verify without changing anything. The infra skill
> governs who applies.

## Ownership split: wrangler versus terraform

| Resource | Owner | Why |
|---|---|---|
| Worker script, bindings declared in `wrangler.*`, Durable Object migrations, worker secrets (`wrangler secret put`) | the deploy (app repo) | it changes with the code; secrets must never enter terraform state |
| Workers Custom Domain on a hostname | the deploy's `wrangler.*` (`routes = [{ custom_domain = true }]`) | Cloudflare creates the DNS record with it; a terraform `cloudflare_record` on the same name fights it |
| Workers route on a hostname ANOTHER worker owns (`host/path/*`) | terraform (infra repo) | shared edge state between two deploys |
| KV namespaces the route depends on | terraform | outlive the script |
| Access applications, policies, groups, service tokens | terraform | shared perimeter |
| R2 buckets, API tokens, permission scopes | terraform | outlive every deploy; minting is a human act |
| DNS records not owned by a Custom Domain | terraform | -- |

Bring-up order for a worker behind a route: deploy the script first,
apply the route second. The route needs a script to point at.

**A worker behind Access must keep `workers_dev = false`**, top-level and
per `[env.*]`. Access binds to a hostname; the `*.workers.dev` name is a
second front door the gate does not cover. This is enforceable only in
the app repo's `wrangler.*`, so name it in the module README and the
consumer's `AGENT.md`.

## Zero Trust Access

- An Access **application** binds to one hostname (plus optional path).
  Preview and production hostnames need their own apps even when they
  share a policy. Access cannot exclude a path within one app; punch a
  hole with a second, more specific app carrying a `bypass` policy, and
  keep that hole as narrow as the webhook or health path needs.
- A **group** is the allow-list (emails, or an identity-provider claim);
  a **policy** grants a decision (`allow`, `deny`, `bypass`,
  `non_identity`) to a group, with a precedence. Edit membership in the
  group's variable, never inline in the policy.
- A **service token** is a client id/secret pair for machines. The
  policy that admits it uses `non_identity` and names THAT token, never
  `any_valid_service_token`. The secret is issued once at create and
  cannot be re-read; `prevent_destroy` on the resource, and treat a
  recreate as a rotation event that breaks every consumer.
- **Access as an OIDC provider** (a `saas` app with `auth_type = "oidc"`)
  issues a client secret once, on create. Emptying its redirect list
  destroys the app; re-applying mints a new pair and invalidates every
  downstream login. The off switch is not the on switch in reverse; say
  so in the hand-off.
- The team domain (`<team>.cloudflareaccess.com`) and each app's AUD are
  non-secret outputs a consumer validates JWTs against; they belong in
  the consumer's repository variables, not secrets, and the module
  README names which output feeds which variable.
- Verify a gate read-only with a probe: an ungated hostname returns the
  origin's status; a gated one returns `302` to the team domain. A
  deploy smoke test that hits a gated host must expect the `302`, or use
  a service token and expect the origin.

## DNS

- A zone is a shared surface. Before adding a record, list the zone and
  check whether a Workers Custom Domain or another module already owns
  the name; two owners of one record flap on every apply.
- Proxied (`proxied = true`) is the default for anything behind
  Cloudflare features; DNS-only records exist for mail, verification and
  third-party hosts.
- Hostname naming follows the tier rule: `<service>.nonprod.<zone>` and
  bare `<service>.<zone>`. The tier is a label, never a suffix.

## R2

- A bucket is terraform's. Retention and lifecycle rules are set on the
  bucket, and a warehouse bucket has none (perpetual, append-only).
- Access is by an API token scoped to `Workers R2 Storage: Edit` on THAT
  bucket, or by a native Worker binding (no credential at all -- prefer
  it for the writer; keep a token only for read-back).
- The S3-compatible credential is derived from the token: Access Key ID
  is the token ID, Secret Access Key is the SHA-256 of the token value.
  The endpoint is `https://<account-id>.r2.cloudflarestorage.com`,
  region `auto`. Consumers use the AWS SDK or CLI against it; the aws-ops
  skill covers that side.
- A terraform backend on R2 uses the `s3` backend with
  `skip_credentials_validation`, `skip_region_validation`,
  `skip_metadata_api_check` and path-style addressing. Under Terraform
  1.5 use the singular `endpoint` argument; the `endpoints {}` block is
  1.6+ and fails to parse on the older pin. One bucket, one key per
  module (`<module>/terraform.tfstate`).

## API tokens and scope

- Least privilege per purpose: a deploy token holds `Workers Scripts:
  Edit` (plus `Workers Routes: Edit`, `Workers KV Storage: Edit` if the
  deploy touches them); a terraform token for Access holds
  `Access: Apps and Policies: Edit` and `Access: Organizations, Identity
  Providers, and Groups: Edit` at ACCOUNT level; DNS work adds
  `Zone: DNS: Edit` on the zone. A zone-scoped token cannot create an
  account-level object (service tokens, groups).
- Minting a token needs the Global API Key or a token with `User API
  Tokens: Edit`; that is a human, interactive, laptop-only act
  (infra-credentials skill). The minted value lands in a 1Password item;
  the module writes it there and outputs the `op://` path.
- Verify a token read-only before anything else:
  `GET https://api.cloudflare.com/client/v4/user/tokens/verify` with the
  bearer -- `status: active` proves it is live; it does NOT prove scope.
  Probe scope with a GET on the resource type you need (for example
  `/accounts/<id>/access/groups`).
- Read the error code before touching the reference:

  | Code | Meaning | Fault |
  |---|---|---|
  | `9106` | no Authorization header reached the API | the variable is empty -- terraform ran bare, not under `op run` |
  | `10000` on an account endpoint | authenticated, but no permission for this resource | token scope |
  | `1010` `auth.forbidden` | a zone-scoped token hit an account resource | wrong token kind |
  | `9109` | invalid access token | dead or mistyped value |

- Provider majors differ in resource names: v4 uses
  `cloudflare_access_*` with block-style `include {}`; v5 uses
  `cloudflare_zero_trust_access_*` with attribute-style
  `include = [...]`, and permission groups come from the
  `cloudflare_api_token_permission_groups_list` data source. Write to the
  major the module's lock file pins; an upgrade is a migration with an
  empty-plan proof.

## Verification without change

- `wrangler whoami`, `wrangler deployments list`, `wrangler kv namespace
  list` -- read-only, safe from an agent session with a deploy-scoped
  token.
- `terraform state list`, `terraform show` -- read the state, never
  refresh it against production from a sandbox.
- A `curl -sI https://<host>/` probe distinguishes ungated (`200`),
  gated (`302` to the team domain), and no route (`404` from the zone).
- `GET /zones/<id>/dns_records?name=<host>` lists who owns a name.

## Related

- the infra skill -- where the modules live and who applies
- the infra-credentials skill -- minting tokens, vaults, item categories
- the release skill -- the deploy workflow that consumes the token, and
  the `op://` reference discipline
- the aws-ops skill -- using R2 through the S3 API
