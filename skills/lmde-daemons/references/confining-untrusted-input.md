# Confining untrusted input (lmde-daemons reference)

Detail moved out of this skill's `SKILL.md`. The section here is named there with a summary; read it when `SKILL.md` points to it.

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
