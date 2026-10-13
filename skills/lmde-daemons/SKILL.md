---
name: lmde-daemons
description: "Running a long-lived service on the macOS laptop as an LMDE component under launchd: the component tree, LaunchAgent supervision and refusal (exit 78, throttled restarts, descriptor limits), install and uninstall that are idempotent and complete, loopback-only ports owned by one env file, the login Keychain as a daemon's runtime copy of a 1Password credential, never raising a Keychain dialog unattended, pinning a vendor daemon to its own HOME and config, leaving the everyday service untouched, and confining a daemon that handles untrusted input under the macOS Seatbelt sandbox, gated by a probe. Load when a task adds, changes, debugs or removes a LaunchAgent, a launcher, a component's setup.sh, a sandbox profile, or a daemon's credential on the laptop. Skip for the tunnel and Access gate in front of a laptop service (lmde-tunnels), Grafana dashboards (lmde-dashboards), and minting or governing the credential itself (infra-credentials)."
---

# LMDE Daemons

> **Purpose:** a laptop service that starts at login, restarts itself,
> needs no human, and cannot be turned against the rest of the machine.
> The rules are owner policy (2026-10). The mechanics live in tested
> code in tds-utils `lmde/components/`; this skill names that code
> instead of restating it.

**How to read this skill.** A bullet is policy: an agent follows it and
a reviewer holds a change to it. A line starting `->` is a pointer to
where the mechanics live; read that code before writing a new copy of
it. A launcher written from this prose instead of from that code
re-learns its incidents one at a time.

## Where the mechanics live

- -> tds-utils `lmde/components/proxy-layer/`: the smallest complete
  component -- `setup.sh`, the LaunchAgent template, a refusing
  launcher, raised descriptor limits.
- -> tds-utils `lmde/components/ollama-gateway/`: the rest -- a
  Keychain-held credential and the script that seeds it, a pinned vendor
  daemon, a sandboxed service with its profile template, renderer, probe
  table and trace tool, the env file that owns the ports, the
  healthcheck. Operating it: tds-utils `docs/ops/ollama-gateway.md`.
- -> tds-utils `lmde/components/networking/`: a host service whose
  control API moved from a TCP port to a 0600 unix socket (`setup.sh`,
  `caddy/Caddyfile.in`, `lib.sh`), with a fake of that API on a socket in
  its tests.
- -> tds-utils `docs/design/LMDE.DESIGN.md` (the platform and its
  component contract) and `docs/design/OLLAMA-GATEWAY.DESIGN.md` (goals
  G4, G7 and G8 and the Key Decisions behind them).
- -> tds-utils `lmde/TECH_RADAR.md`: `sandbox-exec`, HAProxy and
  cloudflared are Adopt there. A new vendor daemon needs its row first.

A new component copies the closest of these and changes what differs.

## Component layout

- One component, one tree: code, config and each daemon's own `HOME`
  under `~/.local/share/<component>`; logs under
  `~/Library/Logs/<component>`; state that must outlive a reinstall (a
  probe's canaries) under `~/.local/state/<component>-<part>`. Nothing
  else in the home directory except a shared store the component reads
  and never writes, named in its design (the gateway reads the everyday
  `~/.ollama/models`), and nothing read from a repo checkout at run
  time.
- One LaunchAgent per daemon, labelled `com.tds.lmde.<component>` or
  `com.tds.lmde.<component>.<part>`, in the user's `gui/<uid>` domain.
  Never a LaunchDaemon: nothing here runs as root.
- `setup.sh install` is idempotent: run twice, it leaves one copy of
  everything, in a known shape, and restarts what it changed.
- `setup.sh uninstall` is complete: it unloads every agent and removes
  every file, plist, route and Keychain item that install created. A
  credential a human seeded is the human's to delete; uninstall prints
  the command and leaves it.
- `healthcheck.sh` prints one line per daemon (`OK`, `DEGRADED (<why>)`,
  `SKIPPED (<why>)`) and exits non-zero on any DEGRADED, so `lmde status`
  can read it.

## Supervision

- `RunAtLoad`, `KeepAlive` and a `ThrottleInterval`: start at login,
  restart after a crash or a refused start, never faster than the
  throttle. A clean exit (an operator stop) stays down.
- The launcher checks its preconditions -- config present, binary on
  `PATH`, credential present and well formed, port free, probe passed --
  and on any failure prints one line naming what is missing and the fix,
  then exits 78 (`EX_CONFIG`). Once per attempt. It never retries,
  sleeps or loops internally: launchd's throttle is the retry, and each
  relaunch rechecks from scratch.
- The launcher `exec`s the daemon in the foreground with a scrubbed
  environment, so launchd supervises the real process.
- The plist carries paths and `PATH`, nothing else: no credential and no
  secret-bearing variable. launchd expands neither `~` nor variables, so
  `setup.sh` renders absolute paths into a template.
- Raise the descriptor limit (soft and hard `NumberOfFiles`) for
  anything that holds many sockets. Under launchd's default HAProxy
  sized itself to a `maxconn` of 107: a connection cap nobody chose.

## Ports and binds

- Loopback only: every listener binds `127.0.0.1` or a unix socket.
  Off the laptop, a daemon is reachable only through a tunnel and the
  proxy layer -> the lmde-tunnels skill.
- A component owns its ports in one env file, the single source of
  truth that its launchers and its proxy route both source. Where IaC
  must name the same port (a tunnel's origin), mirror it by hand with a
  comment at both ends, and ship a drift check that proves the two
  agree. Cross-repo wiring for one rarely changing value is rejected.
- A launcher refuses to start when its port is already bound, and
  refuses a port another service owns.
- A hop that must never be a tunnel target is a unix socket, not a
  second TCP port.
- An unauthenticated control API (a reverse proxy's admin endpoint, a
  daemon's reconfiguration socket) binds a unix socket owned by this
  account with mode 0600 in a 0700 directory, never a loopback TCP port.
  On loopback every local process is a caller; Caddy's admin API on
  `localhost:2019` let any process make the proxy serve any readable
  file, around every sandbox on the machine (tds-utils Issue#465).

## Secrets on the laptop

- **1Password is the source of truth for every credential.** A human or
  an interactive session reads it there (`op run`, `op read`); CI reads
  it through a service account (the infra-credentials skill).
- **The macOS login Keychain holds only a daemon's runtime copy** of a
  credential the daemon needs to start unattended, because 1Password may
  be locked at login. A human seeds it once from its 1Password item, in
  an interactive session, and re-seeds it on rotation. It is never a
  second source of truth, and nothing is minted there.
- The seeding script refuses to run without a terminal or with a
  service-account or Connect token in its environment, reads with
  `op read`, writes without the value touching argv, and never prints
  it. A human runs it; an agent never does.
- A credential never appears in argv, in a launchd plist or the
  environment it sets, in a file under a repo, or in a log. The
  launcher reads it at start and hands it over a pipe or file descriptor
  (`/dev/fd/N`).
- A blank or malformed credential is a refusal (exit 78), never a start
  with an empty value; Vendor daemons, below, says what an empty value
  once did.

## No dialog when unattended

A dialog raised under launchd is raised again on every relaunch.
tds-utils Issue#441 was a storm of Keychain dialogs from a probe that
read Keychain data from `/usr/bin/python3` on every start.

- Every Keychain lookup by a daemon or a probe runs with user
  interaction disabled and fails closed, naming the fix. A lookup that
  would need a dialog is a refusal.
- `/usr/bin/security` has no switch to disable UI, so a daemon reading
  through it does not meet this rule. tds-utils Issue#442 is that debt
  in the gateway's connector.
- Prove reachability with an attribute-only lookup; never read secret
  data to prove an item exists. An attribute-only lookup needs no
  authorization. A data read does: an item created by the `security` CLI
  is partitioned to Apple's tools, and a data read from any other binary
  fails with `errSecAuthFailed` even with UI off.
- Decide at seeding time which binary reads the item at run time, and
  seed the item so its access list and its partition list both admit
  that reader. The first unattended start is the wrong place to learn it.
- -> tds-utils `lmde/components/ollama-gateway/libexec/keychain-probe.py`:
  the UI-off, attributes-only lookup.

## Vendor daemons

- **Pin a vendor daemon to its own tree.** The launcher forces `HOME`
  and the tool's config flag into the component's tree and refuses a
  blank credential. Incident: cloudflared run with an empty token fell
  back to `~/.cloudflared/config.yml` and briefly started another
  account's tunnel.
- Turn off a vendor binary's self-update. Homebrew is the update path,
  and the installed version is the one the component was tested with.
- A signed vendor binary that parses only its own protocol may run
  unconfined. The confinement boundary is drawn around whatever
  processes untrusted input, not around everything on the road.

## The everyday service stays untouched

When a component runs a second instance of something the user already
runs (a sandboxed ollama beside the everyday one), install, run and
uninstall leave the everyday instance exactly as it was.

- Its own port, its own LaunchAgent, its own `HOME`; shared data is
  read-only.
- Record before and after, on the PR: what answers the everyday
  service's port, its plist's hash, its runtime state (the gateway
  recorded the loaded models), and a hash of any store it manages. A
  difference is a defect.
- The confined instance is denied loopback to the everyday instance's
  port and write access to its store.

## Confining untrusted input

A daemon that handles untrusted input (prompts, models, uploads,
webhooks) runs under the macOS Seatbelt sandbox (`sandbox-exec`).

- **The profile denies by default and names every allow.** An
  allow-list under `$HOME` on top of `(allow default)` is not a sandbox:
  the first gateway profile left launchd, LaunchServices, writes outside
  the home directory, the Homebrew prefix the daemon's own binaries live
  in, and every loopback service reachable, and an unconfined local
  service on loopback then undid the home-directory deny (tds-utils
  Issue#460). Reads are granted on OS-owned trees that hold no user data,
  the daemon's own keg and the trees its design names; writes on its own
  `HOME` only; exec on its keg and the system's binaries, with the ones
  that start processes outside the sandbox (`launchctl`, `open`) and the
  keychain CLI denied by path and their mach services denied by name.
- **The allow-list is derived, never guessed.** A trace tool runs the
  real daemon under a candidate profile on a scratch port with a scratch
  `HOME`, drives its workload, and reads the unified log's sandbox
  denials for the daemon and every subprocess it starts (the engine's
  runner has its own process name). Allow what the workload needed, as a
  literal or the narrowest subpath, with a comment saying which step
  wanted it; leave the rest denied; iterate until the workload passes
  with a trace of only unneeded denials. Re-run it after a vendor or
  macOS upgrade. A trace justifies an allow; it does not authorize one:
  every addition lands through a reviewed PR that quotes the denial, and
  one that widens what the design named needs the owner's ruling. Prior
  art for the shape is Chromium's seatbelt profiles; Apple's bundled
  `system.sb` is a private interface that admits more than a daemon
  needs, so a profile never imports it (ruled 2026-10-13).
- A grant to the daemon's binary covers its own tree (a Homebrew keg),
  never the prefix around it: a shared `bin/` means the launcher refuses
  to start rather than hand the engine a user-writable prefix.
- A Keychain item is not reached by path. Deny `/usr/bin/security` and
  the keychain daemons' mach services, so no binary inside the sandbox
  can retrieve a credential.
- What a value depends on per machine (the kernel's ephemeral port
  range) is rendered into the profile at install from the system, not
  committed. Seatbelt has no port ranges, and a wildcard network allow
  cannot be narrowed by any later deny, so "only these ports" is one
  rule per port, and the compiled profile has a size `sandbox_apply`
  accepts (about 16k rules did; about 33k did not). What cannot be
  expressed is stated as a residual in the profile, the README and the
  PR, with an issue, never silently widened.
- **A probe run under the profile gates every start**, with the same
  profile and parameters the service gets. Confinement is never inferred
  from the profile text.
- **The probe is a table, one row per property**, with an expectation
  per mode: unconfined (the control pass: every row reachable, so the
  confined pass cannot succeed vacuously) and confined (`deny` is a
  sandbox denial, `EPERM`, never a "not found" or "connection refused"
  that would hold with no sandbox; `permit` is anything but a sandbox
  denial; `allow` is success). Adding a property is adding a row; a
  profile change the table does not reflect fails at the next launch.
  Rows that observe a daemon's refusal (the keychain, a mach service)
  run from a binary the profile does not deny by path, and a checker
  that could not run proves nothing in either direction. Canaries hold a
  literal non-secret value; install creates them and uninstall removes
  them.
- A failed probe is a refusal (exit 78): the service stays down,
  DEGRADED, until the probe passes. Never fall back to running
  unconfined, and never widen the profile to get past a failure without
  the owner's ruling. The launcher also runs the probe alone on request,
  so a smoketest re-proves confinement on a live machine without a
  restart.
- Seatbelt is Apple-deprecated, so the probe's assertions are the seam.
  A successor mechanism plugs in by passing the same probe, and a macOS
  update that weakens `sandbox-exec` becomes a refused start, not an
  unconfined one.
- -> tds-utils `lmde/components/ollama-gateway/sandbox/` (the template
  and the table), `libexec/probe.zsh`, `libexec/profile-render.zsh`,
  `libexec/profile-trace.zsh`, and the design record's Key Decisions of
  2026-10-13.

## What an agent may and may not do

| May | May not |
|---|---|
| write a component: launchers, plist templates, profile, probe, tests | run a seeding script, or ask for a credential's value |
| run `setup.sh`, the healthcheck, the probe or the trace tool when the human asks | read a Keychain item's secret data, or print one |
| read a Keychain item's attributes (service, account) | change an everyday service, its plist or its store |
| boot out the component's own agent while debugging it | start a service unconfined, or widen its profile, to clear a probe |

## Related

- the lmde-tunnels skill -- exposing a component off the laptop
- the infra-credentials skill -- the vault boundary the 1Password item
  sits behind
- the release skill -- an unattended path is live only once it has run
  unattended
- the style-bash skill -- launcher anatomy; the components are zsh with
  the same layout
- the tech-radar skill -- a new vendor daemon needs its row before its
  launcher
