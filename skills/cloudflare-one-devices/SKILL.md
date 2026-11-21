---
name: cloudflare-one-devices
description: "Running devices on Cloudflare One (the WARP client, now named the Cloudflare One client) in a Zero Trust organization: enrolling a device or moving it between organizations, which device profile it receives (a custom profile overrides the default), the split-tunnel Exclude list and Local Domain Fallback, private hostname routes to a cloudflared tunnel and the initial resolved IP range they use, and running Tailscale on the same device (the exclusions Tailscale needs, its DERP relays, MagicDNS). Load when a task enrolls, moves or debugs a WARP device, edits a device profile, split tunnel or fallback domain, or when WARP and Tailscale break each other. Skip for exposing a laptop service through a tunnel behind Access (lmde-tunnels), Access applications in front of a hosted app (cloudflare-hosting), and Terraform authority, state and apply order in general (iac)."
---

# Cloudflare One devices

A device enrolled in a Zero Trust organization runs the WARP client
(Cloudflare renamed it the Cloudflare One client; the daemon and
`warp-cli` are the same). The organization pushes it a device profile:
which traffic enters the tunnel (the split tunnel), which DNS suffixes
bypass Gateway (Local Domain Fallback), and client behaviour. Nothing on
the device overrides a profile setting marked "network policy".

## Standing rules

- **Find out which profile a device received before changing one.**
  `warp-cli settings` prints `Profile ID`: `default` is the default
  profile, anything else is a custom profile. Editing the default
  profile does nothing for a device on a custom profile.
- **A custom profile overrides the default for every device it
  matches.** It has a match expression (an email, an OS, a device
  posture) and a precedence; the first enabled match wins, and the
  default applies only when none matches. The dashboard's onboarding
  wizard creates one that matches the enrolling email and carries
  Cloudflare's stock Exclude list, so the owner's devices never see the
  managed default profile. Keep custom profiles declared in the
  organization's Terraform, or keep none, and make the plan fail while
  an undeclared one is enabled (Declaring it in Terraform, below).
- **Reversible first, then destructive, then only after checking.** To
  take a profile out of play, disable it (`enabled: false`); delete it
  only after every enrolled device has been checked on the profile that
  replaces it. A deleted profile and its match cannot be restored by
  re-enabling.
- **Change one thing, then verify on a device.** After a profile change,
  reconnect the client (`warp-cli disconnect && warp-cli connect`) and
  read `warp-cli settings`; the device does not pick up a new list until
  it refreshes.
- **The default profile and its fallback list are account singletons.**
  Terraform adopts them by `import`, holds them with `prevent_destroy`,
  and overwrites them; a destroy does not restore Cloudflare's default.
  Change the fallback list and the profile in separate applies: one
  apply that changes both fails the profile's post-apply check (its
  computed `fallback_domains` comes back reordered). When the profile
  `depends_on` the list, `-target` on the list applies the list alone.

## Enrolling and moving a device

- `warp-cli registration new <team>` only selects the team. Enrollment
  finishes in the browser: sign in (One-Time PIN or the organization's
  identity provider), then follow the success page's link back to the
  client. Until then `warp-cli registration show` reports a missing
  registration, or `Account type: Free` when the client fell back to the
  consumer service, which is not the organization.
- Moving to another organization: `warp-cli registration delete`, then
  enroll in the new team. The old registration is deleted on the old
  organization's side, so a file restored from a backup cannot bring it
  back. Check first for an MDM file
  (`/Library/Managed Preferences/com.cloudflare.warp.plist`, or
  `mdm.xml` under `/Library/Application Support/Cloudflare/`); it pins
  the organization and must change first.
- Confirm with `warp-cli registration show`: `Account type: Team`, the
  expected `Organization`, then `warp-cli status` connected.
- Install and upgrade the client through a package manager that checks
  signatures (on macOS the `cloudflare-warp` cask). The installer needs
  `sudo`, so the human runs it in a terminal.

## Private hostname routes

A hostname route sends a private name to a cloudflared tunnel. Gateway
answers the name on an enrolled device with an address from the initial
resolved IP range, `172.64.128.0/20`, and that address must stay inside
the tunnel. Read the range a device really gets (`dig <name>` on an
enrolled device) before writing it into any split-tunnel rule, and never
carve the CGNAT range `100.64.0.0/10` for it: that range belongs to
Tailscale and to WARP's own interface.

## Tailscale on a WARP device

WARP captures traffic that Tailscale must send outside the tunnel. The
device profile's Exclude list needs all of these, and the fallback list
needs the MagicDNS entry:

| Exclude | Why |
|---|---|
| `100.64.0.0/10` (whole) | every tailnet IP, and WARP's interface range `100.96.0.0/12` |
| `fd7a:115c:a1e0::/48` (or a covering `fd00::/8`) | tailnet IPv6 |
| `192.200.0.0/24`, `2606:b740:49::/48` | Tailscale control plane |
| `199.165.136.0/24`, `2606:b740:1::/48` | Tailscale logging |
| hosts `controlplane.tailscale.com`, `login.tailscale.com`, `log.tailscale.com`, `api.tailscale.com` | coordination, login, telemetry, API |
| every DERP relay address, IPv4 /32 and IPv6 /128 | relays and STUN |

| Fallback domain | DNS server | Why |
|---|---|---|
| `ts.net` | `100.100.100.100` | MagicDNS names resolve through Tailscale, not Gateway |

- The DERP relay addresses come from the DERP map,
  `https://controlplane.tailscale.com/derpmap/default`. Commit them as a
  generated snapshot so a plan is deterministic, refresh it with a
  script, and review the diff like any other change. Tailscale adds
  regions; a stale list fails only for the new relays.
- Excluded traffic bypasses Gateway's filtering and logging. That is the
  point for Tailscale's own infrastructure; do not widen an exclusion to
  cover other destinations.
- Cloudflare limits a profile's Exclude list to about 1,000 entries;
  guard the generated list's length in the plan.

What each symptom means:

| Symptom on the device | Missing |
|---|---|
| Tailscale logged out, "fetch control key ... no route to host", or stuck at "starting" | control-plane ranges and hosts |
| `tailscale netcheck`: `UDP: false`, no DERP latency | DERP relays (or the device is on a profile without them) |
| a MagicDNS name does not resolve | the `ts.net` fallback entry |
| only some tailnet peers unreachable | a carve-out inside `100.64.0.0/10` |

Verify on each device after a change: `warp-cli settings` lists the
entries and `Profile ID` is the expected one; `tailscale status` is
connected; `tailscale netcheck` reports UDP and a nearest DERP;
`tailscale ping <peer>` answers; a MagicDNS name resolves; any private
hostname route still answers.

## Declaring it in Terraform

The organization's infra repo holds the profile, the fallback list, the
tunnel and its routes as one root (the iac skill: authority, state,
laptop-only applies). In provider v5:

- `cloudflare_zero_trust_device_default_profile` (`exclude`, a list of
  `{ address | host, description }`) and
  `cloudflare_zero_trust_device_default_profile_local_domain_fallback`
  (`domains`, each `{ suffix, dns_server?, description? }`).
- Guard against an overriding custom profile with the data source
  `cloudflare_zero_trust_device_custom_profiles` and a precondition on
  the default profile that no enabled entry exists with `default` not
  `true`: the data source's result includes the default profile itself.
- Read the live state before the first plan of an adopted singleton, and
  expect the plan to show only the intended entries; anything else is
  read and explained before the apply.
