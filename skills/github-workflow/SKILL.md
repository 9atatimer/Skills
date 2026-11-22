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

To find every repo or file that uses something (a workflow, a pin, a
URL), list the owner's repos (`gh repo list`) and read each file; never
rely on code search, whose index silently drops repos and files.

Pin `gh` to the origin URL: a bare `gh repo view` resolves a remote named
`upstream` ahead of `origin`, so in a fork checkout it reports the parent
and the fork looks like a direct origin (`gh repo view "$(git remote get-url origin)"
--json nameWithOwner,defaultBranchRef,isFork,parent`). `isFork` is the only
source of truth for topology; remote names are not. For a fork, also get
the parent slug and its default branch. `gh repo clone <fork>` adds an
`upstream` remote for the parent by itself; use it rather than adding a
second one. Without `gh`, treat an `upstream` remote as a fork, say that it
is an assumption, and read both defaults. Read
`references/anatomy-and-practices.md`, "Derive repo facts", for the
commands before you derive the topology.

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
  clone's HEAD, which may be any branch and stale. On a laptop, worktrees
  live in `~/workplace/.worktrees/<repo>-<topic>`, never beside the
  clone. Run `clai provision` in the new worktree. Read
  `references/preview-and-identity.md`, "Worktrees", for the commands
  before you create, move or remove a worktree.
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

The fork, not any PR state, controls billing (read
`references/landing-forks-and-tools.md`, "Why the fork split", to explain it).

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
  land it, dispatched as the bot. Never prod; nothing for a
  documentation-only PR. Unprompted, preview only a branch up to date
  with the default branch whose diff leaves the deploy machinery alone. Read `references/preview-and-identity.md`,
  "Preview the ready PR", before you dispatch a preview or tell the owner
  a PR is ready to land.
- Title it as a conventional-commit summary: `feat(scope): short description`.
- AI review: summon OCR on Demand with a `/ocr` PR comment on the ready
  PR when the diff holds a file OCR reads. OCR skips Markdown, so a PR
  whose every changed file is Markdown never posts `/ocr`, whether it is
  documentation or the prose agents follow (a skill, a persona,
  `AGENT.md`): the self-review pass is its agentic rung (a design or architecture
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

**A PR that changes `.github/workflows/` builds twice on `/land` and once
on `/try`.** Stage 1 runs the merged code with the base's workflows
grafted in. A test in the PR that reads or runs a changed workflow file
sees the OLD file there and fails, while `/try` passes (template-tools
Issue#1109). Before `/land`, check whether the PR touches a workflow AND a
test that reads one. If it does, fix the shape first:

- Move the logic that a test runs into a script outside
  `.github/workflows/`, and have the workflow call it. The test runs the
  script, so the test and the fix still land together.
- Write a guard over workflow text so that it holds for the base form and
  the head form. Tighten it in a later PR.
- Prove stage 1 locally. Commit first, and merge `origin/<default>` into
  the branch if the branch is behind it, because stage 1 builds the merge.
  Then run `git restore --source=origin/<default> --staged --worktree --
  .github/workflows`, run the suites that read workflows, and put the
  branch's workflows back with `git restore --source=HEAD --staged
  --worktree -- .github/workflows`. Use `git restore`, not `git checkout
  <ref> -- <dir>`: checkout only overlays, so it keeps a workflow file the
  PR added, which stage 1 removes.

Read `references/landing-forks-and-tools.md`, "Landing via tedium (merge bot)", for the full preconditions and the commands tedium parses, before you comment `/land`.

### PR Template (both workflows)

Look for a template where Claude Code's own PR instructions look, in
this order: `.github/pull_request_template.md`,
`.github/PULL_REQUEST_TEMPLATE.md`, `PULL_REQUEST_TEMPLATE.md`,
`docs/PULL_REQUEST_TEMPLATE.md`. Every agent uses the same lookup; a fleet
repo puts its template at the first path.
A PR opened by API or CLI is not pre-filled: reproduce the template's
headings in the body and fill them in. Skip any section that asks for
credentials, tokens, environment variables or internal hostnames. No
template: use the headings in PR Anatomy below.

### PR Anatomy (proposal vs. feedback)

The body is the whole proposal (problem, evidence, solution) and stands
alone; comments are review feedback and the replies to it. The body's
headings, in order, are Problem, Evidence, Solution, Checks, Not proven:
Problem, Evidence and Solution are never empty. Never paste the commands
that were run, token-handling details or vault ids, and never narrate the
session. A body template handed to other agents carries headings, never
results. Read `references/anatomy-and-practices.md`, "PR Anatomy (proposal
vs. feedback)", before you write a PR's title, body or comment.

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

The body states the defect; fixes, approaches and spikes go in comments.
The body's headings, in order and none empty, are Symptom, Impact,
Evidence, Done when. Title the defect, not the patch; one defect per
issue. Evidence about current code names the commit it was read at. When
you pick an issue up, re-derive the fix from the current design. Read
`references/anatomy-and-practices.md`, "Issue Anatomy (defect vs.
solution)", before you write an issue's title or body.

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
- After a `git mv`, grep for the old path. Read
  `references/anatomy-and-practices.md`, "After a git mv", before you merge a
  branch that moves files.

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
- One exception: creating, forwarding or deleting a repo or org webhook
  (`gh webhook forward`, the `/hooks` API) runs as the owner, because the
  bot has no admin rights. Nothing else rides on it: the webhook's events
  are only read, and every action taken on them goes through `asbot`.
- Never use the inline form `op run --env-file <(claude-as-bot
  --print-env) -- <cmd>`. When the launcher fails, the process
  substitution's exit status is lost, `op run` gets an empty env file,
  and the command runs as the owner.
- When `asbot` refuses, the action does not happen. Never run the same
  command bare, as the owner. Say what refused and stop; the fix is the
  human's.
- Read `references/preview-and-identity.md`, "Bot identity mechanics", for
  the launcher, `asbot` use, the Keychain seed and the cloud case, before you push, open a PR or comment under a session whose identity you
  have not confirmed. Run each `asbot` command in the foreground. Codex
  stays the owner's to summon, on the owner's quota.
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

Each applies only when the repo's agent instruction file enables it. Read
`references/anatomy-and-practices.md`, "Optional Practices", when the file
enables AI session tracking, commit message sanitization or stage-only
mode. In stage-only mode the agent never runs `git commit` or `git push`.

## After a merge: markers before the commit

A merge that reports a conflict in one file usually leaves markers in
others. Before `git add`, grep the whole tree for markers. Read
`references/anatomy-and-practices.md`, "After a merge: markers before the
commit", before you stage a merge result.
