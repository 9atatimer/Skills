---
name: plannotator-install
description: "Install, update, build, or release the Plannotator CLI from a published upstream release through the local fork. Load when the binary is missing or broken, or when building, updating, installing, or releasing it; use the plannotator skill for review commands."
---

# Installing plannotator

> **Purpose:** install or update the CLI from a published release without
> replacing a working binary until the candidate has been verified.

Plannotator is a local, browser-based review layer -- plans, diffs, and
documents open in an annotation UI, the human marks them up, and structured
feedback comes back on stdout. What it ships is a single `plannotator`
binary plus per-agent hooks. This skill is only about getting that binary
onto the machine; what to do with it once it is there is the plannotator
skill.

## Check before you do anything

```bash
command -v plannotator && plannotator --version
```

If the request is only to fix a missing binary and that prints a version,
the binary is installed. For an update or release, continue with the
requested version. Two failures look similar and are not:

| Symptom | Meaning |
|---|---|
| `command not found` | No binary. Install it (below). |
| Resolves, but a hook still fails | The binary moved or its build was deleted. See "When it breaks later". |

## The one thing you must not do

Upstream's documented install is:

```
curl -fsSL https://plannotator.ai/install.sh | bash
```

**Do not run that, and do not run any fetched installer script.** Never
`curl ... | sh`, never download-then-execute. Software gets installed
through package managers that verify signed code, or it gets built from a
checkout you can read.

There is no package-manager path here: plannotator's root `package.json` is
`private: true`, and the published `@plannotator/*` packages are libraries
with no `bin`. So the route is a checkout.

## Clone the fork, not upstream

The fleet builds from its own fork, `9atatimer/plannotator`, so the code
cannot change underneath the machine between a read and a build. Upstream
is a second remote, used only to pull forward. Clone into the third-party
area, so it sits with other upstream code rather than beside the human's
own repos:

```bash
git clone https://github.com/9atatimer/plannotator.git \
    ~/workplace/third-party/plannotator
git -C ~/workplace/third-party/plannotator remote add upstream \
    https://github.com/backnotprop/plannotator.git
```

(Not `gh repo clone`: for a fork, it auto-adds `upstream` itself, so the
`remote add` above would fail with "remote upstream already exists" --
and plain `git clone` needs no `gh` prerequisite.)

The fork can track upstream `main`, but `main` is not the release point.
Select a published, non-prerelease upstream release. Fetch its exact tag
from upstream into a dedicated non-tag ref, require that fetch to succeed,
and peel that ref to a commit; do not resolve a same-named local tag. Fetch
the fork and verify that commit is reachable from the fork's remote `main`;
merely fetching an upstream tag into the same object store does not prove
this. Build that exact commit in a separate worktree.
A tag identifies a release; it does not authenticate its contents. Never
change the fork's history just to select a build point.

## Build and verify a candidate

Read the selected release's build workflow for its pinned Bun version,
locked dependencies, required generated assets, build order and compile
flags. Build from the release commit into a candidate path outside the
live executable's path. Do not compile through a symlink that points at
the live binary. Run the applicable release CI checks and the candidate's
version command. Use the candidate itself to open a sample plan and submit
a review. Require the applicable checks to pass; report any skipped checks
and their implications. A failed check means the candidate is not verified.

Keep the verified candidate outside the checkout, with its source commit
and checksum. Install only when the owner asks in the session. Resolve the
live command and any symlink to its target; preserve any previous binary
for rollback. If no command exists, install at `~/.local/bin/plannotator`
when that directory is on PATH; otherwise agree on a destination without
changing shell configuration. Copy the candidate to a temporary file beside that target,
then rename it over the target so replacement is atomic. Verify the
installed checksum and version, then open and submit a plan review with
the installed executable. If a check fails, restore the previous binary, or remove the new binary if this was a first install,
and report the failure. Installing hooks or changing agent configuration
requires the owner's instruction as well.

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
  with the binary's source commit and report a mismatch.
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

Fetch the fork and upstream release tags. Select a published release and
confirm its commit is reachable from the fork's remote `main`. Do not build the latest `main`
merely because it is newer than the selected release. If the fork lacks the
release, report that fact; do not merge, push, or reset the fork merely to
install a binary. Build and verify the candidate as above.

A plugin installed from the fork's default branch may not match a binary
built from a release tag. Compare the plugin's recorded `gitCommitSha` with
the binary's source commit and report any mismatch; do not claim the two
are synchronized based on their version strings alone.

## When it breaks later

An older installation may link the live command to the checkout's `dist/`
directory. Moving or cleaning that checkout can make the command fail inside
a hook, where the error is easy to misread as the agent misbehaving.

If `command -v plannotator` resolves but running it fails, check the
symlink's target exists before anything else:

```bash
ls -l "$(command -v plannotator)"
```

A dangling target means rebuild, not reinstall.

## Do not

- Do not run a fetched installer script, in any form, for any reason.
- Do not modify PATH, shell rc files, or any agent's config directory
  without the owner's instruction.
- Do not install to make a single command work if the human has not asked
  for plannotator. Report that the binary is missing and point here.
- Do not assume a version. Read `plannotator --version`; the vendored
  plannotator skills are written against a pinned release and say so.
