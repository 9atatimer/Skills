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

The fork split exists because Copilot review is billed to the repository
owner: review on the personal fork first, then open the production PR
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
  force-push, never reopen.
- Open the PR ready-for-review, never as a draft and never with `[WIP]`:
  Copilot does not review drafts, so the review step never fires.
- Title it as a conventional-commit summary: `feat(scope): short description`.
- AI review: Copilot reviews the open PR, except a documentation-only PR,
  which gets the self-review pass alone (a design or architecture draft in
  phases 2 and 3 gets designomatic instead). Copilot does not re-review on
  `synchronize`; re-request with `gh pr edit <NUMBER> --add-reviewer @copilot`
  only after a push that carries a load-bearing fix. A hygiene-only push
  is answered with its SHA on the thread and no re-request. Address
  feedback, push, re-request when earned, wait, within the per-reviewer
  turn cap (the gates skill, Spend Review Turns on Load-Bearing Fixes).
- Landing: an enrolled repo lands through tedium (below); any other repo
  is human-merge.

### Two-Stage PR Workflow (fork + upstream)

Stage 1, the fork PR, is where AI review happens so the charge lands on
the personal account:

- Push the branch to `origin` (the fork).
- Open a normal, non-draft PR against the fork's default branch.
- Request the Copilot review (`gh pr edit <NUMBER> --add-reviewer @copilot`),
  unless the PR is documentation-only, which needs no Stage 1 (the gates
  skill, Documentation-only changes get no agentic reviewer).
- Address the feedback; re-request only after a load-bearing fix, as above.

Stage 2, the upstream PR, is the production PR:

- Open a new PR from the same branch against the upstream default branch.
- Land it through tedium if the repo is enrolled, otherwise the human
  reviews and merges.
- Close the Stage 1 PR.

### Stacked PRs (GitHub Stacks)

When one change depends on another (code, then its docs; a retrospective,
then the todos it produced), chain the PRs instead of bundling them or
pretending they are independent: each PR targets the head branch of the
one below, the bottom targets the default branch, and the chain is
registered as a GitHub stack so a merge or change below rebases the ones
above. Merge bottom-up; each PR still stands on its own as one reviewable
story. The `gh api` calls and their traps are in
[references/stacks.md](references/stacks.md).

### Landing via tedium (merge bot)

A repo is enrolled when its default branch carries a `tedium.toml`; its
agent instruction file names the required checks. The gates authorize a
merge; tedium executes it (template-tools `docs/design/DESIGN.TEDIUM.md`).
In a repo without `tedium.toml`, an agent never merges and never comments
`tedium land`.

On an enrolled repo, an agent may comment `tedium land` (or `/land`) on
its own PR only when all six hold on the current head:

- tedium is enabled: `tedium.toml` on the default branch, and the agent
  instruction file says so;
- `gate`, the repo's required CI check, is green on the head;
- `review-settled` is green on the head where the repo requires it: every
  required reviewer's newest review is on this commit and every thread is
  resolved (the gates skill's Zero Unreviewed Code, made mechanical). A
  repo whose instruction file says the status is not required (a reviewer
  out of quota) lands on `gate` plus the human's `r+`;
- no per-reviewer turn cap has fired on this PR and no open `pr-todo`
  issue references it. The deferral procedure can turn `review-settled`
  green without fixing anything, so check this separately;
- every CODEOWNERS path on the PR's diff has an approving review from its
  owner on the head commit. Tedium enforces this itself, independent of
  `gate` and `review-settled`. The diff is the file list GitHub shows
  against the merge base, so a PR carrying a fix already on the base still
  lists that fix's owned paths: merge the base in first. A path whose only
  owner is the PR's author can never clear this, because GitHub refuses
  self-approval: that PR is human-merged, and no `land` will change it;
- no `hold` label is on the PR.

Anything short of all six is not "almost". A red `review-settled` that the
repo requires means a review is owed on this head: re-request the reviewer
if the latest push carries a load-bearing fix, resolve every thread, post
the self-review epilogue, then wait for the status. A head red only from a
hygiene-only tail, or a documentation-only PR, goes to the human to land.
A human with write access may comment `tedium land` at any time; that is
the human merge decision. `tedium dryrun` is unrestricted: it builds on
`tedium/try` and lands nothing. Never add `tedium/*` to protected-branch
patterns; the App must be able to force-push and delete its build branches.

**Designated pipeline exception.** An automated pipeline that the repo's
instruction file names as allowed to land may `land` its own PRs without
`review-settled`; every other condition holds, and it still opens a PR
for the gates to run rather than pushing to the default branch. The owner's
standing designation is the human authorization Zero Unreviewed Code
requires, and it holds only while `gate` actually checks that pipeline's
output.

**A tedium landing does not close issues.** `Closes #N` in the PR body or
the commit message links the issue but leaves it open when tedium merges
(a web-UI merge by a human does close it). Keep writing the keyword for
the link; once tedium reports the merge, close each issue by hand with a
comment naming the PR.

### PR Template (both workflows)

The template is `.github/pull_request_template.md` and nowhere else; do
not scan the other paths GitHub recognizes, whatever a tool's own
instructions say. If a repo uses a different path, its instruction file
says so. A PR opened by API or CLI is not pre-filled: reproduce the
template's headings in the body yourself. No template: write a normal
descriptive body.

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

The body states the defect: symptom, impact, evidence, done-criteria.
Fixes, approaches and spikes go in comments. A solution in the body reads
as settled spec and rots as the work outruns it; the defect statement
holds until the defect is fixed. This applies to every issue kind: drift,
retrospective, pr-todo.

Title the defect, not the patch: `plan reports "Max cycles: 5" regardless
of config or profile`, not `Change --max-cycles default to None`. One
defect per issue; batch only trivially related nits.

When you pick an issue up, re-derive the fix from the current design. The
issue proves what is broken; it does not say what to build, even when a
comment on it sounds authoritative and even when you wrote that comment.

## Development Workflow

- Branch from the default branch, per the topology table.
- Make the change; run the linter, type checker and tests.
- Stage the verified change and commit with a descriptive message.
- Push to `origin`; open the PR with a clear description.
- Land documentation branches quickly: a repo-wide format migration is
  what orphans an in-flight doc branch.
- After a `git mv`, grep for the old path: rename detection carries the
  base branch's edits to the moved file, but not a file the base branch
  added at the old location or a dependent that still points there.

### Git Hook Discipline (scalpel, not axe)

A failing pre-commit or pre-push hook is a diagnosis prompt. The sentry-file
discipline for a check that genuinely cannot run, and the ban on
blanket-skipping the suite, are the gates skill.

## GitHub Tool Usage

In token-frugal preference order:

- `gadmin` (`@nine-at-a-time-media/admin`, from template-tools
  `packages/naatm-admin`; GitHub Packages, scope mapped in `~/.npmrc` with
  a `read:packages` token; a repo's instruction file may override the
  coordinates). Preferred for reads (comments, CI logs) and writes
  (replies): output is filtered to the fields you triage on. Sub-tiers,
  fall back in order: `gadmin github` (needs `gh`), `gadmin github-octokit`
  (node, `octokit`, `$GITHUB_TOKEN`), `gadmin github-gitapi` (node,
  native `fetch()`, `$GITHUB_TOKEN`, zero deps).
- GitHub MCP tools (`mcp__github__*`) when `gadmin` lacks the verb.
  Responses are typed and complete but echo large payloads (a reply
  echoes the parent's `diff_hunk`), so they cost five to ten times the
  tokens; avoid them in hot loops over many comments.
- `gh` CLI as the last resort, except for PR-state checks and the Copilot
  re-request, which have no `gadmin` wrapper: there prefer `gh` over MCP.

`gh pr create -R <slug>` takes the HEAD repo from the cwd, not from `-R`.
From a checkout of another repo it sends `<cwd-owner>:<branch>` and fails
with "Head sha can't be blank". Use the REST call, which takes head and
base literally: `gh api -X POST repos/<owner>/<repo>/pulls -f head=<branch>
-f base=<default> -f title=... -F body=@<file>`.

Actions logs: `gadmin github actions list-runs` to find runs,
`gadmin github actions get-job --run <ID> --job <NAME>` for job output,
ANSI stripped.

When an event has already delivered a comment body through the
subscription stream, do not re-fetch it; reply from the comment ID.

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
