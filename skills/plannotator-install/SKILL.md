---
name: plannotator-install
description: "Install, update, build, or release the Plannotator CLI from a published upstream release through the local fork. Load when the binary is missing or broken, or when building, updating, installing, or releasing it; use the plannotator skill for review commands."
---

# Installing plannotator

> **Purpose:** install or update the CLI through the tds-utils pinned
> release process, and verify what is running.

Plannotator is a local, browser-based review layer -- plans, diffs, and
documents open in an annotation UI, the human marks them up, and structured
feedback comes back on stdout. What it ships is a single `plannotator`
binary plus per-agent hooks. This skill is only about getting that binary
onto the machine; what to do with it once it is there is the plannotator
skill.

## Check the installed binary

The tds-utils release owns this binary. Its released `bin/plannotator-build`
reads the fork URL, release tag and commit from
`~/.tds/release/lmde/components/plannotator/PIN`. Read the runbook at
`~/.tds/release/lmde/components/plannotator/README.md` for the current
release and rollback procedure. Do not build fork or upstream `main`.

Run the read-only check:

```bash
~/.tds/release/bin/plannotator-build --check
```

`current` means `~/.local/bin/plannotator` is a symlink to an executable at
the pinned commit's build path. It does not prove that PATH selects that link,
the binary's contents, or that plan review works. Check `command -v plannotator`
and `plannotator --version`, then use the installed binary to
open a sample plan and submit a review when verifying a release. Report
failed or skipped verification.

If the builder is missing, check the released tds-utils worktree and its
runbook. Do not substitute a hand build or run a fetched installer.

## Install or update

When `tds-release` advances the public release, the released
`tds-post-release` runs `plannotator-build`. For a fresh build, the builder checks that the fork's tag resolves to the
pinned commit; it reuses an existing executable at the pinned path without
rebuilding or checking its contents. It then links the binary. It keeps
older builds for rollback. A `current` check does not itself rebuild or
release anything.

To change the release point, follow the tds-utils runbook: select a
published upstream release at least a week old, ensure the fork has the
matching tag and commit, and propose the `PIN` change in tds-utils. The
owner directs the release; do not run a deploy or publish on your own.
After the release, check the link and exercise plan review as above.

If the owner asks to repair a missing or stale installation at the existing
pin, run `~/.tds/release/bin/plannotator-build` in the foreground and
verify the result. It builds and changes the live link; `--check` only reads. If the
builder refuses or fails, diagnose the reported cause instead of replacing
the live binary by hand. Follow the runbook for rollback.

Do not run upstream's fetched installer or a `curl | sh` pipeline. Do not
modify agent hooks or configuration unless the owner asks; they are a
separate install.

## The binary and the hooks are two installs

Getting `plannotator` on PATH does not wire it into anything. The
automatic plan review -- the UI that opens when you leave plan mode --
comes from per-agent hooks, which are separate:

- **Claude Code:** a plugin providing `PreToolUse`/`EnterPlanMode` ->
  `plannotator improve-context` and `PermissionRequest`/`ExitPlanMode` ->
  `plannotator`. It ships hooks only, no skills. The human installs it
  from the fork, not upstream:
  `/plugin marketplace add 9atatimer/plannotator`, then
  `/plugin install plannotator@plannotator`, then restart. The marketplace
  clones the fork's default branch, which may differ from the binary's release commit.
  Compare `gitCommitSha` in `~/.claude/plugins/installed_plugins.json`
  with the running binary's source commit and report a mismatch.
- **Unattended sessions:** the `ExitPlanMode` hook's timeout is 345600
  seconds, four days. A plan exit in a headless or channel-driven session
  (Telegram, SSH with no forwarded port) blocks until someone opens the
  browser UI. Keep plan mode out of sessions nobody is watching.
- **Other agents:** hooks, commands, and configuration are separate from
  the binary. Inspect their existing setup before changing it; do not run
  a fetched installer or change agent configuration without instruction.

So a machine can be in a legitimate half-state: the binary works when
called directly, and plan review never fires on its own. If the human
expected the automatic behaviour, the hooks are what is missing, not the
binary.

## Updating

Use the tds-utils runbook's pin-change and release process above. The
fork's default branch and a plugin installed from it may differ from the
pinned binary. Compare the plugin's recorded `gitCommitSha` with the
binary's pinned commit and report any mismatch; version strings alone do
not establish that they match.

## When it breaks later

An older installation may link the live command to the checkout's `dist/`
directory. Moving or cleaning that checkout can make the command fail inside
a hook, where the error is easy to misread as the agent misbehaving.

If Plannotator is missing or fails, inspect the managed link directly;
the shell may skip a dangling link and find another binary on PATH:

```bash
ls -l ~/.local/bin/plannotator
```

A dangling target is a broken link. Check the released pin and use the
repair path above when the owner has asked for repair.

## Do not

- Do not run a fetched installer script, in any form, for any reason.
- Do not modify PATH, shell rc files, or any agent's config directory
  without the owner's instruction.
- Do not install to make a single command work if the human has not asked
  for plannotator. Report that the binary is missing and point here.
- Do not assume a version. Read `plannotator --version`; the vendored
  plannotator skills are written against a pinned release and say so.
