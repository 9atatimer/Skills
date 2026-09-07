---
name: plannotator-install
description: "Get the plannotator CLI onto a machine that does not have it, without running a fetched shell script. Load when `plannotator` is not on PATH, when a plannotator-* skill cannot run because the binary is missing, or when a hook fails with `plannotator: command not found`."
---

# Installing plannotator

> **Purpose:** turn "the binary is missing" into a working install, on a
> machine where the documented one-liner is not allowed to be used.
> **Written against:** plannotator 0.27.11.

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

If that prints a version, the binary is installed and this skill is done.
Two failures look similar and are not:

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

If the human decides they want the upstream installer anyway, that is their
call to make and theirs to run -- hand them the line and let them paste it.
Do not run it for them.

## Build from a checkout

Clone into the fleet's third-party area, so it sits with other upstream
code rather than beside the human's own repos:

```bash
git clone https://github.com/backnotprop/plannotator.git \
    ~/workplace/third-party/plannotator
```

Then build. These are the release workflow's own steps, not an
approximation of them -- `bun install`, the two UI builds, then the
single-file compile:

```bash
cd ~/workplace/third-party/plannotator
bun install --frozen-lockfile
bun run build:review
bun run build:hook
bun build apps/hook/server/index.ts --compile --no-compile-autoload-bunfig \
    --define "__CLI_VERSION__=\"$(jq -r .version package.json)\"" \
    --outfile dist/plannotator
```

It needs `bun` (1.3.14 is what upstream builds with) and `jq`. The compile
produces a self-contained binary of about 115MB.

**You may run the build. Stop there.** Putting it on PATH changes the
machine, and any agent integration writes into `~/.claude`, `~/.agents`,
and `~/.config/opencode` -- those are the human's to run:

```bash
ln -s ~/workplace/third-party/plannotator/dist/plannotator ~/.local/bin/plannotator
```

Then verify with the check at the top.

## The binary and the hooks are two installs

Getting `plannotator` on PATH does not wire it into anything. The
automatic plan review -- the UI that opens when you leave plan mode --
comes from per-agent hooks, which are separate:

- **Claude Code:** a plugin providing `PreToolUse`/`EnterPlanMode` ->
  `plannotator improve-context` and `PermissionRequest`/`ExitPlanMode` ->
  `plannotator`. It ships hooks only, no skills.
- **Other agents:** upstream's `scripts/install.sh` writes their hooks,
  commands, and config. It is the human's to run, and `--skip-skills` is
  worth knowing about if this fleet's vendored plannotator skills are
  already provisioned and should not be duplicated.

So a machine can be in a legitimate half-state: the binary works when
called directly, and plan review never fires on its own. If the human
expected the automatic behaviour, the hooks are what is missing, not the
binary.

## When it breaks later

A checkout build is a live dependency on that checkout. `plannotator` will
stop working if the clone is moved or deleted, `dist/` is cleaned, or the
branch is changed without rebuilding -- and it fails inside a hook, where
the error is easy to misread as the agent misbehaving.

If `command -v plannotator` resolves but running it fails, check the
symlink's target exists before anything else:

```bash
ls -l "$(command -v plannotator)"
```

A dangling target means rebuild, not reinstall.

## Do not

- Do not run a fetched installer script, in any form, for any reason.
- Do not modify PATH, shell rc files, or any agent's config directory. The
  human runs those.
- Do not install to make a single command work if the human has not asked
  for plannotator. Report that the binary is missing and point here.
- Do not assume a version. Read `plannotator --version`; the vendored
  plannotator skills are written against a pinned release and say so.
