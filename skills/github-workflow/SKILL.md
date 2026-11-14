---
name: github-workflow
description: "Reaching a GitHub remote at all: branch discipline, remote topology (direct-origin vs fork+upstream), the push/PR flow, issue anatomy, and GitHub tool selection. Spans every SDLC phase rather than belonging to one -- load it whenever you touch a remote. Skip for what happens once the PR exists: scanners, CI, ci.magic, review and the review-watch loop are the gates skill."
---

# SKILL: GitHub Workflow

How to reach a GitHub remote: branches, pushes, PRs, issues, and which
tool to use. Shared logic only; repo-specific facts live in the consuming
repo's agent instruction file. What happens to a PR once it exists is the
gates skill.

## Derive repo facts; never declare them

Ask the repo. A hand-maintained identity file goes stale silently.

Pin `gh` to a remote URL. A bare `gh repo view` resolves a remote named
`upstream` ahead of `origin`, so in a fork checkout it reports the parent
and the fork looks like a direct origin:

```zsh
origin_url=$(git remote get-url origin)

gh repo view "$origin_url" --json nameWithOwner --jq .nameWithOwner
gh repo view "$origin_url" --json defaultBranchRef --jq .defaultBranchRef.name
gh repo view "$origin_url" --json isFork,parent \
  --jq 'if .isFork then "fork of \(.parent.nameWithOwner)" else "direct origin" end'
```

`isFork` is the only source of truth for topology; remote names are not.
For a fork, also get the parent slug and its default branch:

```zsh
parent=$(gh repo view "$origin_url" --json parent --jq .parent.nameWithOwner)
gh repo view "$parent" --json defaultBranchRef --jq .defaultBranchRef.name
```

`gh repo clone <fork>` adds an `upstream` remote for the parent by itself;
check its URL and use it rather than adding a second one.

Without `gh`, git cannot answer `isFork`: treat an `upstream` remote as a
fork, say that it is an assumption, and read both defaults:

```zsh
git remote get-url origin
git remote get-url upstream 2>/dev/null
git symbolic-ref refs/remotes/origin/HEAD
git symbolic-ref refs/remotes/upstream/HEAD 2>/dev/null
```

Branch prefixes, required check names, review cadence and every other
local policy are in the repo's agent instruction file (`AGENT.md` /
`AGENTS.md` / `CLAUDE.md`). Nothing repo-owned lives in this skill
directory: provisioning overwrites it every session.

## Branch Safety (CRITICAL)

- Never work on the default branch.
- Run `git branch --show-current` before any git operation.
- On the default branch: stop, warn the human, do not proceed.
- Every change goes on a feature branch and merges through a pull request.
- Never rewrite or discard history, on any branch, clean tree or not:
  no `reset --hard`, no `checkout -- <path>` over edits that are not
  yours, no amend or rebase of a pushed commit, no force-push. To bring
  a local default branch up to date, `git pull --ff-only origin
  <default>`; if that refuses, the branch has diverged and the human
  decides.

### Worktrees

- Prefer a worktree to checking a branch out in a shared clone. Other
  terminals and agent sessions use the same clone, and a branch switch
  there changes their checkout without telling them.
- Cut it from a fresh fetch of the default branch, never from the
  clone's HEAD, which may be any branch and stale:
  `git -C <clone> fetch origin`, then
  `git -C <clone> worktree add <dir> -b <branch> origin/<default>`. With
  `branch.autoSetupMerge=simple` and `push.autoSetupRemote=true` the new
  branch pushes to its own name; without them it tracks the default
  branch, and a bare push is refused or lands there.
- On a laptop, worktrees live in `~/workplace/.worktrees/<repo>-<topic>`,
  never beside the clone, where they clutter the workspace and break
  tab-completion of the repo's name. Move a stray one with
  `git -C <clone> worktree move <stray> <dir>`, which rewrites both
  gitdir pointers; a plain `mv` breaks it.
- `git worktree remove` deletes ignored files without asking. Run
  `git -C <worktree> clean -ndX` first, read the list, and move out
  anything you cannot regenerate.

## Gates are phase 6

Clear the gate before you move it, and Zero unreviewed code are the gates
skill's laws; reviewer selection, the review-watch loop, review-response
and the CI/ci.magic rungs are the gates skill's procedures. This skill
stops at the remote.

## Branch Naming Convention

Use the owner prefixes the repo's agent instruction file declares:
humans `<user>/feat/description`, `<user>/fix/description`; agents the
prefix their harness assigns. Humans do not push to agent-prefixed
branches.

## Remote Topology

Every step below keys off the derived topology:

| Step | Direct origin | Fork + upstream |
|------|---------------|-----------------|
| Branch base | the default branch on `origin` | `upstream/<default>` (sync first: `git fetch upstream`) |
| Push target | `origin` (the canonical repo) | `origin` (your fork); you cannot push to `upstream` |
| PR head / base | `<branch>` -> `<default>`, same repo | `<fork>:<branch>` -> `upstream:<default>` |
| `--repo` for `gadmin` / `gh` / review-watch | the derived slug | Stage 1 (fork PR, AI review): the fork's slug; Stage 2 (upstream PR): the parent slug |

The fork split exists because a Copilot review, when the human summons
one, is billed to the repository owner (OCR on Demand runs only in the
owners' own repos, never on a personal fork): review on the personal fork first, then open the production PR
upstream. The fork, not any PR state, is what controls billing.

## Push & PR Flow

### Single PR Workflow (direct-origin)

One PR carries every review cycle. Never open a second "final" PR and
never close and reopen one.

- Push the branch to `origin`.
- Before every follow-up push, confirm the PR is still open:
  `gh pr view <NUMBER> --json state`. A push to the branch of a merged PR
  succeeds and the commits reach no PR and no default branch. If `MERGED`,
  cut a new branch from the default branch and open a new PR; never
  force-push, never reopen. "Landed" means the PR reads `MERGED`, never
  that the push succeeded: a squash or rebase gives the commits new SHAs,
  so ancestry of your own SHA proves nothing.
- Open the PR as a draft (`gh pr create --draft`), and mark it ready
  (`gh pr ready <NUMBER>`) only after the self-review epilogue is posted
  on it. The owner lands a green PR that is ready for review on sight,
  so a ready PR is a claim that the self-review is done. The agentic
  reviewer is summoned only once the PR is ready. Never use a
  `[WIP]` title in place of draft status.
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
- Title it as a conventional-commit summary: `feat(scope): short description`.
- AI review: summon OCR on Demand with a `/ocr` PR comment on the ready
  PR when the diff holds a file OCR reads. OCR skips Markdown, so a PR
  whose every changed file is Markdown never posts `/ocr`, whether it is
  documentation-only or operating rules (a skill, a persona, `AGENT.md`):
  the self-review pass is its agentic rung (a design or architecture
  draft in phases 2 and 3 gets designomatic instead). Copilot and Codex review only when the human
  summons them (the gates skill, Reviewer Selection). Re-summon OCR with
  a fresh `/ocr` only after a push that carries a load-bearing fix. A
  hygiene-only push is answered with its SHA on the thread and no
  re-summon. Address feedback, push, re-summon when earned, wait, within
  the per-reviewer turn cap (the gates skill, Spend Review Turns on
  Load-Bearing Fixes).
- Landing: an enrolled repo lands through tedium (below); any other repo
  is human-merge.

### Two-Stage PR Workflow (fork + upstream)

In a fork, Stage 1 is a PR against the fork's default branch, where
agentic review runs; Stage 2 opens the production PR upstream from the
same branch, and Stage 1 closes.

Read `references/landing-forks-and-tools.md`, "Two-Stage PR Workflow (fork + upstream)", when the derived topology is a fork.

### One open PR per repo per session

A session has at most one open PR in each repo it touches. Everything
the session does in that repo goes onto that PR's branch, however
unrelated the tasks: code, Key Decisions rows, review fixes and docs,
each kind in its own commit so a reviewer can read it alone. Never stack
PRs, and never split off a docs-only or design-record companion: a stack
lands only in order, a split leaves each PR citing text another has not
landed, and every extra PR is another approval and another `gate` run.
Once the session's PR has merged or closed, later work in that repo (the
retrospective) is one new PR, from a fresh branch off the default
branch. The fork flow above is one PR too: its Stage 1 PR closes when
Stage 2 opens.

### Landing via tedium (merge bot)

A repo is enrolled when its default branch carries a `tedium.toml`.
On an enrolled repo an agent comments `/land` on its own PR only when
every precondition holds on the current head: `gate` green, the review
settled by a reviewer that is not your own self-review, no turn cap
fired and no open `pr-todo` issue, every CODEOWNERS path approved, no
`hold` label, and no design or architecture record added or changed by
the PR (a human lands those). Anything short of all of them goes to the
human. A
tedium landing does not close issues; close them by hand. On a repo
without `tedium.toml`, an agent never merges and never comments
`/land`.

Read `references/landing-forks-and-tools.md`, "Landing via tedium (merge bot)", for the full preconditions and the commands tedium parses, before you comment `/land`.

### PR Template (both workflows)

Look for a template where Claude Code's own PR instructions look, in
this order: `.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, `PULL_REQUEST_TEMPLATE.md`,
`docs/PULL_REQUEST_TEMPLATE.md`. Every agent uses the same lookup, so one
file serves them all; a fleet repo puts its template at the first path.
A PR opened by API or CLI is not pre-filled: reproduce the template's
headings in the body and fill them in. Skip any section that asks for
credentials, tokens, environment variables or internal hostnames. No
template: use the headings in PR Anatomy below.

### PR Anatomy (proposal vs. feedback)

The body is the whole proposal: the problem, the evidence for it, and
the solution. The comments are review feedback and the replies to it.
The reader is the owner deciding whether to merge, often on a phone, and
the merge commit keeps the body, so the body must stand alone. The
technical-writing skill governs the wording of the title, the body, and
every comment.

**Title.** State the effect a reader sees once the PR lands, not the
edit: `plan reports the configured max cycles`, not `Change --max-cycles
default to None`. Keep it under 70 characters.

**Body.** These headings, in this order. Problem, Evidence and Solution
are never empty; omit the others only when there is nothing to say.

- **Problem.** One or two sentences: what is wrong or missing, who hits
  it, and what it costs them. Link the issue (`Closes #N`) where one
  exists (a design's tracking issue is cited `Refs #N`; only the PR
  carrying its retrospective closes it), and still state the problem:
  the reader must not have to open the issue to learn why the PR exists.
- **Evidence.** What shows the problem is real: a failing run, an
  observed output, a reproduction, the rule it breaks. Evidence about
  code names the commit it was read at (`at origin/main 48ab1cb`).
- **Solution.** The approach in a few sentences, and why it beat the
  alternatives you rejected. Then what changed, grouped by intent rather
  than file by file; name a file only where the reviewer needs it to
  act.
- **Checks.** The checks you ran, their results, and the commit they ran
  on. Say which checks you did not run.
- **Not proven.** What the PR does not yet show to work, and the risk it
  carries.

When review changes the solution, edit the body so it describes the
head commit; a body that describes an earlier approach misleads the
merge decision and the history.

A block another skill adds to the body, such as the infra-handoff skill's
handoff block, goes after Not proven, under its own headings.

**Comments.** Feedback goes in review threads and PR comments, not in
the body. Reply once per thread, in one or two sentences: what changed
and the commit, or why nothing changed.

Everywhere: one fact per bullet; a bullet that needs a semicolon or a
parenthetical to finish is two bullets. Never paste the commands that
were run, token-handling details, or vault ids. Never narrate the
session ("First I read...", "I then ran..."). A body template handed to
other agents carries headings, never results: a pre-written "CI ran on
X" was false in nine PRs whose workflows never ran on a pull request.

## Naming issues and PRs

Say which kind a number is, every time: `Issue#458`, `PR#459`, never a
bare `#458` (the sdlc skill, law 19). GitHub numbers both from one
sequence and renders them alike; "blocked on PR#71" means wait for a
merge, "blocked on Issue#71" means someone must decide.

In chat and rendered markdown, every mention is a link whose text carries
owner, repo, kind and number:

```
[<owner>/<repo> PR#459](https://github.com/<owner>/<repo>/pull/459)
[<owner>/<repo> Issue#458](https://github.com/<owner>/<repo>/issues/458)
```

No naked URL in prose, and no link text that drops the repo. Commit
messages are not rendered: there, write `owner/repo PR#459`. A cross-repo
reference carries repo and kind (`template-base PR#71`); `template-base#71`
is still bare. A reference with no repo means this repo.

Exception: closing keywords take the bare form. GitHub's parser recognizes
only `Closes #N`; `Closes issue #N` is inert and the issue stays open. A
closing keyword can only name an issue, so there is no ambiguity.

## Issue Anatomy (defect vs. solution)

The body states the defect. Fixes, approaches and spikes go in comments.
A solution in the body reads as settled spec and rots as the work
outruns it; the defect statement holds until the defect is fixed. This
applies to every issue kind: drift, retrospective, pr-todo. The
technical-writing skill governs the wording.

The body carries these headings, in this order, none of them empty:

- **Symptom.** What a person or a check observes, in one or two
  sentences, with the exact output where there is one.
- **Impact.** Who hits it and what it costs them.
- **Evidence.** The run, reproduction, or file and line that shows it.
- **Done when.** The observable conditions that show it is fixed.

Title the defect, not the patch: `plan reports "Max cycles: 5" regardless
of config or profile`, not `Change --max-cycles default to None`. One
defect per issue; batch only trivially related nits.

Evidence about current code names the commit it was read at (`at
origin/main 448af82`). Other sessions merge while you write: on
2026-10-16 a PR merged midway through cutting 115 UI issues and made
the "today" line of ten of them false. Before handing a batch off,
fetch the default branch again and re-check the claims that its new
commits touched.

When you pick an issue up, re-derive the fix from the current design. The
issue proves what is broken; it does not say what to build, even when a
comment on it sounds authoritative and even when you wrote that comment.

## Development Workflow

- Branch from the default branch, per the topology table.
- Make the change; run the linter, type checker and tests.
- Stage the verified change and commit with a descriptive message.
  Stage it by path (`git add <path>...`), never `git commit -a`: in a
  fresh worktree of a repo that tracks `.husky/`, `npm ci`'s `prepare`
  step rewrites those hooks, and `-a` sweeps them into an unrelated
  commit.
- Push to `origin`; open the PR with a clear description.
- Land documentation branches quickly: a repo-wide format migration is
  what orphans an in-flight doc branch.
- After a `git mv`, grep for the old path: rename detection carries the
  base branch's edits to the moved file, but not a file the base branch
  added at the old location or a dependent that still points there.
  While a move is in flight, a parallel branch that adds files under the
  old path merges without conflict and its files land where no tooling
  reads them: before merging either side, re-run the listing the tooling
  depends on.

### Git Hook Discipline (scalpel, not axe)

A failing pre-commit or pre-push hook is a diagnosis prompt. The sentry-file
discipline for a check that genuinely cannot run, and the ban on
blanket-skipping the suite, are the gates skill.

## Act as the bot identity, never the owner

Every tool below acts as whoever its credential belongs to. On the
owner's repos a `CODEOWNERS` catch-all needs the owner's approval, and
GitHub refuses self-approval, so a PR opened under the owner's login can
never be approved and lands only by the owner overriding the queue. Push,
open PRs, comment and `/land` as the fleet's machine account
(`9atatimer-bot`); the owner's approval is the review.

- Run `gh api user --jq .login` before the first push of a session. If it
  is not `9atatimer-bot`, stop and switch identity; never push "just this
  once".
- On the laptop the session starts under tds-utils `bin/claude-as-bot`
  (the bot's token from 1Password as `GH_TOKEN`, GitHub over HTTPS only,
  commits under the bot's name). A session already running as the owner
  runs each GitHub command and each `git commit` through tds-utils
  `bin/asbot`: `asbot <cmd> [args]`, or `asbot bash -c '<commands>'` for
  a sequence. `asbot` runs the command only after `gh api user` reports
  `9atatimer-bot`, and runs nothing otherwise.
- Never use the inline form `op run --env-file <(claude-as-bot
  --print-env) -- <cmd>`. When the launcher fails, the process
  substitution's exit status is lost, `op run` gets an empty env file,
  and the command runs as the owner.
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
- This section is the canonical statement; the tds-utils global
  instruction file names the rule and points here.

## GitHub Tool Usage

Prefer `gadmin` for reads and replies, then the GitHub MCP tools,
then `gh`; `gh` is first for PR-state checks.

Read `references/landing-forks-and-tools.md`, "GitHub Tool Usage", for the tool tiers, their fallbacks and the `gh pr create -R` trap, before your first GitHub call in a session.

## Commit Messages

Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, with
an optional scope (`feat(scope): ...`).

## Optional Practices

Each applies only when the repo's agent instruction file enables it.

### AI Session Tracking via Issues

At session start, create an issue assigned to `@me`, title prefixed
`[AI] Task: <task name>`, body carrying agent, branch, local path and a
task description; at session end close it with
`gh issue close <NUMBER> --repo <OWNER/REPO> --comment "Session completed."`.

### Commit Message Sanitization (Pre-Push Squash)

A pre-push hook squashes local commits before pushing and opens an editor
seeded with the previous messages as comments. Expect the prompt and write
the consolidated message; local history stays unfiltered, public history
stays clean and linear.

### Restricted Agent Permissions (Stage-Only Mode)

The agent never runs `git commit` or `git push`. It stages verified
changes with `git add` and tells the user; the user commits, pushes and
opens the PR. This overrides the Development Workflow's commit, push and
PR steps.

## After a merge: markers before the commit

A merge that reports a conflict in one file usually leaves markers in
others. Before `git add`, grep the whole tree:
`git grep -n '^<<<<<<< \|^>>>>>>> ' -- . ':!node_modules'` (or
`git diff --check`). `git checkout --ours <file>` acts only on a file git
marked conflicted; on an auto-merged file it prints "Updated 0 paths" and
leaves both sides' additions in place, so read the merged file for a
duplicated section before assuming yours won.
