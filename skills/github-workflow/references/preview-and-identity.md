# GitHub workflow -- previewing a ready PR and acting as the bot

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when `SKILL.md` points to it.

Contents:

- Preview the ready PR
- Bot identity mechanics
- Worktrees

## Preview the ready PR

- Preview the ready PR on the preview tier before asking the owner to
  land it (owner, 2026-11-10: there is no point landing a change they
  have not seen). Where the repo's preview deploy workflow takes a
  dispatched ref, dispatch it on the PR branch as the bot, watch the run
  to green, and hand the owner the preview URL, naming the PR it
  carries. Preview holds
  one build at a time. Never prod; nothing for a documentation-only PR.
  The repo's agent instruction file names the workflow.
  Unprompted, preview only a branch up to date with the default branch
  whose diff leaves the deploy machinery alone (workflows, Terraform,
  deploy scripts, Durable Object migrations). When the owner says to
  deploy a branch, any branch in any state, dispatch it and name the risk.

## Bot identity mechanics

- On the laptop the session starts under tds-utils `bin/claude-as-bot`
  (the bot's token from 1Password as `GH_TOKEN`, GitHub over HTTPS only,
  commits under the bot's name). A session already running as the owner
  runs each GitHub command and each `git commit` through tds-utils
  `bin/asbot`: `asbot <cmd> [args]`, or `asbot bash -c '<commands>'` for
  a sequence. `asbot` runs the command only after `gh api user` reports
  `9atatimer-bot`, and runs nothing otherwise.
- When `asbot` refuses, the action does not happen. Never run the same
  command bare, as the owner. Say what refused and stop; the fix is the
  human's: unlock 1Password, or seed the bot token into the login
  Keychain with tds-utils `bin/seed-bot-token` (once per machine and per
  rotation), after which `asbot` asks 1Password nothing.
- Run each `asbot` command in the foreground. A 1Password authorization
  prompt that nobody answers fails the command with `authorization
  timeout`, and in a background job nobody sees the prompt.
- In a cloud session the platform's GitHub App acts as whoever connected
  it; the owner connects it as the bot. If the identity is not
  `9atatimer-bot`, say so and stop.
- Codex runs on the Codex account of whoever posts `@codex review`; the
  bot has none, so its trigger gets a "create a Codex account" reply and
  no review. Codex stays the owner's to summon, on the owner's quota.

## Worktrees

- Cut it from a fresh fetch of the default branch, never from the
  clone's HEAD, which may be any branch and stale:
  `git -C <clone> fetch origin`, then
  `git -C <clone> worktree add <dir> -b <branch> origin/<default>`. With
  `branch.autoSetupMerge=simple` and `push.autoSetupRemote=true` the new
  branch pushes to its own name; without them it tracks the default
  branch, and a bare push is refused or lands there. Then run
  `clai provision` in the new worktree, so the agents started there get
  the current skills (the clai skill, When an agent sees new skills).
- On a laptop, worktrees live in `~/workplace/.worktrees/<repo>-<topic>`,
  never beside the clone, where they clutter the workspace and break
  tab-completion of the repo's name. Move a stray one with
  `git -C <clone> worktree move <stray> <dir>`, which rewrites both
  gitdir pointers; a plain `mv` breaks it.
- `git worktree remove` deletes ignored files without asking. Run
  `git -C <worktree> clean -ndX` first, read the list, and move out
  anything you cannot regenerate.
