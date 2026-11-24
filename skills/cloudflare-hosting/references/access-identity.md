# Cloudflare Access as the user identity

How an app served from a Worker learns who its user is. The app trusts the
Access assertion on the request; it runs no sign-in of its own. The gate
itself (groups, policies, applications, service tokens) is in SKILL.md,
Cloudflare Access; this file is what the Worker does with the request the
gate admits.

Contents: the rules, the verifier, accounts, machine callers, local and
test runs, configuration, data, worked examples.

## The rules

- **Access is the only sign-in, and its assertion is the session.** The
  app sets no cookie, holds no session table, and has no login form, OAuth
  callback or password store. A `/login` page, if one exists, is a
  signed-out notice. Sign-out links to the Access logout URL,
  `https://<team>.cloudflareaccess.com/cdn-cgi/access/logout`.
- **The Worker verifies the assertion on every request.** Access sets
  the `Cf-Access-Jwt-Assertion` header on each request it admits. Read
  identity only from that header, after verification, never from the
  `CF_Authorization` cookie, an `email` header, or a value the browser
  sends. A request that reached the Worker without passing the gate (a
  `*.workers.dev` hostname, a route that is not under the application)
  carries no assertion, and the verifier refuses it.
- **Fail closed.** Any doubt is a refusal: no header, a malformed token, an
  unknown key, a bad signature, a wrong issuer or audience, an expired
  token, no email. The verifier returns a refusal value and never throws.
  The gate answers 401 (JSON under `/api`, plain text elsewhere). Missing
  configuration on Cloudflare answers 503; it never admits.
- **Identity is a port.** One adapter (the verifier) is the only code
  that reads the header. A middleware runs it and puts the verified
  identity on the request context; use cases take that identity as an
  argument and never read headers. Tests drive the port with a fake.
- **Authorization is the app's own domain policy.** Access decides who
  may reach the hostname. What an admitted user may read or write is
  pure functions in the domain, applied by the use cases. This replaces
  row-level security in a hosted database; there is no second wall
  unless the design names one.

## The verifier

The assertion is an RS256 JWS. Verify it with WebCrypto; it needs no
library.

- Fetch the team's keys from `https://<team>.cloudflareaccess.com/cdn-cgi/access/certs`.
  Cache them for about an hour. When a token names an unknown `kid`,
  refetch once, rate-limited to about one fetch a minute, so a key
  rotation is picked up and a flood of bad tokens cannot drive fetches.
- Accept only `alg` RS256, and a `kid` that the key set holds.
- Check the claims: `iss` is the team origin exactly; `aud` contains this
  hostname's Access application AUD tag; `exp` is in the future and
  `nbf`, if present, is not. The audience check stops an assertion
  minted for another application on the same team from being replayed
  here.
- Take the user from the `email` claim. A token with no email is not a
  person (see Machine callers).
- Inject `fetch` and the clock. In a Worker, pass `(url) => fetch(url)`
  rather than the bare global, which can lose its binding.
- Validate the team domain at construction: a bare `https` origin, no
  path, query or fragment. Refuse an empty audience.

## Accounts

- **An account is the normalized email**: trim whitespace, lowercase the
  whole address. Every verifier, seed and fixture calls the same
  normalization function, kept in the domain.
- A derived key (a UUID minted at first sight, a hash of the email for an
  object-key prefix) is a function of, or a row keyed by, the normalized
  email. Never key an account by the assertion's `sub` alone: `sub` is
  per identity provider, so the same person gets two accounts if a
  second provider is ever admitted.
- **First sight provisions.** An admitted email with no profile gets one
  at the default role.
- **Bootstrap admins come from deploy configuration** (a list of emails
  in a repository or Environment variable). A listed email is an admin
  on first sight and stays one; no one can change its role. A store
  never has zero admins.
- **The email is the account, so the sign-in method is the top risk.**
  Every Access application in front of such an app pins `allowed_idps`
  to the One-Time PIN provider, which proves control of the mailbox.
  With `allowed_idps` unset, Access accepts every identity provider on
  the account, and any of them that asserts an email it does not control
  takes over that account. The app cannot check this itself: the
  assertion does not name the provider. The pin is set in the Access
  root, in the infra repo.

## Machine callers

- A service-token assertion carries `common_name` and no email. It never
  resolves to a person.
- A route that serves a machine names that machine explicitly: it either
  maps one known `common_name` to a fixed machine identity, or
  authenticates with its own credential (a scheduler's shared secret).
  Every other route refuses an assertion without an email.
- A sidecar Worker reached over a service binding is outside Access and
  carries no assertion of its own. Its route on the app authenticates
  the caller (a shared secret) and, when it acts for a user, takes the
  user's forwarded assertion and verifies it again. The identity gate
  skips that one path by name, and only that path.
- A WebSocket upgrade on the app's hostname carries the assertion like
  any other request; verify it at the upgrade (the cloudflare-think
  skill).

## Local, test and E2E runs

There is no bypass branch in the verifier: no flag, environment value or
hostname check that skips verification. A local run gets an identity in
one of two ways.

- **A local issuer** (preferred, and required for E2E): the dev server
  generates a key pair per run and serves its JWKS; the test harness
  mints tokens. The verifier runs unchanged, configured with the local
  issuer and audience.
- **A fixed dev identity**, bound only by the local (node) composition
  root. That root refuses to start when Access configuration is present,
  so a misconfigured deploy cannot run as the dev user.

Unit tests use a fake of the identity port.

## Configuration

- Per stage: the Access team domain, the application AUD tag, and the
  bootstrap admin list. None is a secret; keep them as Environment or
  repository variables and pass them to the build or the Worker as
  vars. Name the stage in each variable or keep it in the stage's
  Environment.
- The AUD tag is an output of the Access root, one per application, so
  production and preview differ. A Worker given the other stage's AUD
  refuses every request, which is the safe failure.
- `workers_dev = false` on every stage (SKILL.md, wrangler): the
  `workers.dev` hostname is not gated.

## Data

- Relational data is D1, one database per stage; files and other bytes
  are R2, one bucket per purpose per stage. Terraform in the infra repo
  creates both (SKILL.md, Ownership); wrangler binds them.
- Local runs use `node:sqlite` behind the same statement API for D1, and
  the filesystem or an in-memory fake for R2.
- Supabase is not used for new work (the tech-radar skill, Hold). An app
  that leaves it removes its auth client, its login and callback routes,
  and its row-level security, and moves each policy into domain
  functions with tests.

## Worked examples

- quillmap: `IdentityPort` with the `access` adapter, first-sight
  provisioning and bootstrap admins over D1 and R2
  (`docs/arch/persistence-identity/ARCHITECTURE.md`).
- misvtt: `AccessIdentityVerifier` in
  `packages/adapters-cloudflare/src/access-identity-verifier.ts`, the
  gate middleware in `apps/web/server/middleware/identity.ts`.
- iae: `identityOf(request)` over the Access JWT, with an R2 key prefix
  derived from the normalized email (`docs/design/ARCHITECTURE.WEB.md`).
