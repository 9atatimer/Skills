# Cloudflare Access playbook

The one shape every Access gate in the fleet takes. It is the shape
`gammago-access` and `quillmap-access` in the private infra repo have run
since 2026-07; a new gate copies it, it does not improvise. The repo
carries the worked roots and the runbook (`docs/runbook.cloudflare-access.md`)
that names the hostnames, groups and commands; this file is the standard
they implement.

## Where it lives

- Every Access resource (application, policy, group, service token, the
  OIDC SaaS app) is security-bearing and lives in the private infra repo
  under `ops/terraform/<system>-access/`. No exceptions: not for a demo,
  not for a hermetic project, not because the Worker's own Terraform
  sits in the app repo (owner ruling 2026-11-07, which revoked the one
  exception that had been granted).
- The app repo keeps the Worker, its Custom Domain, its bindings and its
  deploy. Its `AGENT.md` names the Access root that gates each hostname.
- The provider is cloudflare v5: `cloudflare_zero_trust_access_group`,
  `cloudflare_zero_trust_access_policy`,
  `cloudflare_zero_trust_access_application`. v4's `cloudflare_access_*`
  names are retired.

## The resources, in dependency order

- **A named group** per audience: enumerated email addresses in
  `include`, from a `list(string)` variable. Never an `email_domain`
  rule: a gmail.com match is a match shared with the internet. The
  group's display name says who it is for (`<Product> - players`,
  `<Product> - GMs`). Cloudflare rejects an empty group at apply time;
  a `validation` block fails it at plan time.
- **One reusable allow policy** per audience: `decision = "allow"`,
  `include` is the group by id, `session_duration` from a variable. A
  policy admits a group, never an inline email; the email list has one
  home and that is the group.
- **One self-hosted application per hostname**, `type = "self_hosted"`,
  `domain` the exact hostname, `policies` listing the policy by id at
  `precedence = 1`. Production and preview are two applications sharing
  one policy, because an application binds one hostname. The preview
  application is `count`-gated on its hostname variable so a root can
  merge before the preview Worker exists.
- **Machine consumers** (a smoke test, CI, an agent session) get a
  service token and a `non_identity` policy each, attached behind the
  human policy at `precedence` 2 onward. Never a `bypass`: a bypass on
  the paths under test publishes exactly those paths. Minting is
  laptop-only (the infra-credentials skill).
- **Sign-in** is Cloudflare's built-in One-Time PIN. No identity
  provider is configured for a plain gate; nobody needs an account.
- **An OIDC SaaS application** is added only when a downstream service
  (Supabase, an app with its own session store) must receive a token.
  A Worker that verifies the Access JWT on its hostname needs no OIDC
  layer. The SaaS app admits its own `members` group, listed by
  address, and `allowed_idps` pins it to the OTP provider.

## Group ownership

- A group has one owning root. Another root that admits the same people
  takes the group ID as an input (`table_group_ids` in
  `quillmap-access`) and attaches it; it never re-creates the list. Two
  roots holding the same emails drift the first time one is edited.
- The decision rule for a new gate: if the people are the same set as
  an existing group, attach that group by ID; if they differ by one
  address, they are a different audience and get their own group. A
  group's membership is an access decision, not a convenience.
- Dropping a group ID from an attaching root DETACHES it on the next
  apply and locks those people out. The README of each attaching root
  says so above the variable.

## Readiness: certainty, not suspicion

A new hostname behind Access goes through four states that look alike
from a browser. Classify it with the probes below before you
diagnose anything; each probe is read-only.

| Rung | Probe | Result | Meaning |
|---|---|---|---|
| DNS | `dig +short <host> A <host> AAAA` | addresses | the Custom Domain created its record |
| | | nothing | wrangler never attached the hostname; check `custom_domain = true` on the stage and the deploy log |
| TLS | `curl -sSI --max-time 10 https://<host>/` | a response with `server: cloudflare` and `cf-ray` | the certificate is active |
| | | a handshake error or a certificate-name mismatch | the certificate is not active yet; go to the certificate rung |
| Certificate | `GET /zones/<zone_id>/ssl/certificate_packs` with a token holding `SSL and Certificates Read`; find the pack whose `hosts` holds `<host>` | `status` is `active` | issued; a TLS failure now is a client or cache problem |
| | | `pending_validation`, `pending_issuance`, `pending_deployment`, `initializing` | provisioning; wait, do not change anything |
| | | a `*_timed_out` status, or `validation_errors` set | it will not complete by itself; delete the Custom Domain and deploy again, which re-creates it and the pack |
| | | no pack names the host | no Custom Domain exists for it; `GET /accounts/<account_id>/workers/domains` lists what wrangler created, each with its `cert_id` |
| Gate | `curl -sSI https://<host>/` and the same on a deep path | `302` to `<team>.cloudflareaccess.com/cdn-cgi/access/login/<host>` with `www-authenticate: Cloudflare-Access` on both | the application covers the whole hostname |
| | | `200` or origin content on either | no application binds this hostname, or it binds a path; the hostname is public |
| | | `302` on `/` only | the application is path-scoped; it must be on the hostname |

Facts the ladder rests on:

- A Workers Custom Domain creates the DNS record and issues an Advanced
  Certificate for that exact hostname, at any depth. No Advanced
  Certificate Manager subscription is needed and Universal SSL plays no
  part. The Universal SSL limit (apex and one label) applies only to a
  hostname served through a DNS record and a route, not a Custom Domain.
- Until that certificate is active the edge presents the zone's
  Universal certificate, which does not name a third-level hostname, so
  the client reports a name mismatch. That is provisioning, not a fault,
  unless the pack says otherwise.
- Access decides at the hostname before the request reaches the origin,
  so a nonexistent deep path is gated identically to a real one; the
  deep-path probe needs no knowledge of the site.

The infra repo's `ops/terraform/access-smoketest.sh` runs the DNS, TLS
and gate rungs against any list of hostnames and prints the rung a host
stopped at; with a token it runs the certificate rung too. Run it after
every apply and whenever a host "is not reachable".

## Tokens

- Applying a `<system>-access` root needs account-level `Access: Apps
  and Policies Write` and, if it owns a group, `Access: Organizations,
  Identity Providers, and Groups Write`. Nothing zone-level: the root
  touches no DNS.
- Error `9106` means no token reached the API (terraform ran bare, not
  under `op run`); `10000` means the token lacks Access permission.
  `/user/tokens/verify` reports a `10000` token valid, so verify scope
  before an apply that mints a one-time `client_secret`.

## Pre-apply, every time

- `terraform state list` shows every live object the root describes;
  a missing one is imported first, or the apply duplicates the group and
  policy and then fails on the second application for the domain.
- `terraform plan` shows only the additions this change makes: zero
  changes to any existing application, policy or group. A plan that
  renames a hand-made object means a variable does not match the live
  value.
- A human applies, from the laptop or through the Tower, with the plan
  line the agent handed over (the iac skill).

## Hand-off to the human

State the rung each hostname is on, from the probes, with the raw
response that put it there. "Not reachable" is not a state. "TLS fails
with a name mismatch; the certificate pack is `pending_deployment`,
created twelve minutes ago" is one, and it tells the human to wait.
