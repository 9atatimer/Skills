# GitHub workflow -- landing, the fork flow, and tool choice

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary. A section named here and not found below
("Single PR Workflow", "Remote Topology") is in `SKILL.md`.

Contents:

- Two-Stage PR Workflow (fork + upstream)
- Landing via tedium (merge bot)
- GitHub Tool Usage
- Why the fork split

### Two-Stage PR Workflow (fork + upstream)

Stage 1, the fork PR, is where AI review happens so the charge lands on
the personal account:

- Push the branch to `origin` (the fork).
- Open the PR against the fork's default branch as a draft, and mark it
  ready only after the self-review epilogue is posted (the draft rule in
  Single PR Workflow, above, holds for both stages).
- Once it is ready, say so in the handoff: a fork carries no OCR caller,
  so summon nothing there (the gates skill, Reviewer Selection); Stage 1
  is where a human-summoned Copilot review bills the personal account. A
  documentation-only PR needs no Stage 1 (the gates skill,
  Documentation-only changes get no agentic reviewer).
- Address the feedback; a re-review there is the human's to re-summon.

Stage 2, the upstream PR, is the production PR:

- Open a new PR from the same branch against the upstream default branch,
  as a draft; mark it ready only after the self-review epilogue is posted
  on it. The owner lands a green ready PR on sight.
- Land it through tedium if the repo is enrolled, otherwise the human
  reviews and merges.
- Close the Stage 1 PR.

### Landing via tedium (merge bot)

A repo is enrolled when its default branch carries a `tedium.toml`; its
agent instruction file names the required checks. The gates authorize a
merge; tedium executes it (template-tools `docs/design/DESIGN.TEDIUM.md`).
In a repo without `tedium.toml`, an agent never merges and never comments
`tedium land`.

The commands tedium parses are `/land` (alias `/approve`), `/try`,
`/cancel` and the rest of its registry (`/help` lists them), and the bors
forms behind the trigger: `tedium land`, `tedium r+`, `tedium try`. A bare
`r+` or `R+` with no trigger is prose and does nothing; the bors forms are
case-sensitive. Write `/land`.

On an enrolled repo, an agent may comment `/land` (or `tedium land`) on
its own PR only when all seven hold on the current head:

- tedium is enabled: `tedium.toml` on the default branch, and the agent
  instruction file says so;
- `gate`, the repo's required CI check, is green on the head;
- `review-settled` is green on the head where the repo requires it: every
  required reviewer's newest review is on this commit and every thread is
  resolved (the gates skill's Zero Unreviewed Code, made mechanical). A
  repo whose instruction file says the status is not required (a reviewer
  out of quota) does not waive the review: the head still needs a review
  that is not your own self-review, resolved on this head (the repo's
  named reviewer, or a human), before you `/land`. A documentation-only
  PR is the gates skill's recorded exception: its self-review is the
  whole review. Agents open PRs as the bot identity, not the owner;
  even so, your own `/land` is never the review;
- no per-reviewer turn cap has fired on this PR and no open `pr-todo`
  issue references it. The deferral procedure can turn `review-settled`
  green without fixing anything, so check this separately;
- every CODEOWNERS path on the PR's diff has an approving review from its
  owner that a later push has not dismissed. Tedium enforces this itself,
  independent of `gate` and `review-settled`; it counts only reviews
  that are not dismissed and does not bind them to a commit, so the
  approval covers the head only where the Landing ruleset dismisses
  stale approvals on push. The diff is the file list GitHub shows
  against the merge base, so a PR carrying a fix already on the base still
  lists that fix's owned paths: merge the base in first. A path whose only
  owner is the PR's author can never clear this, because GitHub refuses
  self-approval: that PR is human-merged, and no `land` will change it;
- no `hold` label is on the PR;
- the PR adds or changes no design or architecture record
  (`docs/design/DESIGN.*.md`, `docs/design/ARCHITECTURE.*.md`). Merging
  one is its approval (the design skill, Lifecycle is metadata), so a human
  lands it.

Anything short of all seven is not "almost". A red `review-settled` that the
repo requires means a review is owed on this head: re-request the reviewer
if the latest push carries a load-bearing fix, resolve every thread, post
the self-review epilogue, then wait for the status. A head red only from a
hygiene-only tail, or a documentation-only PR, goes to the human to land.
A human with write access may comment `tedium land` at any time; that is
the human merge decision. `tedium dryrun` is unrestricted: it builds on
`tedium/try` and lands nothing. Never add `tedium/*` to protected-branch
patterns; the App must be able to force-push and delete its build branches.

**Designated pipeline exception.** An automated pipeline that a
CODEOWNERS-protected file names as allowed to land may `land` its own PRs
without `review-settled`; a designation in a file the PR itself can edit
is no designation. Every other condition holds, and it still opens a PR
for the gates to run rather than pushing to the default branch. The owner's
standing designation is the human authorization Zero Unreviewed Code
requires, and it holds only while `gate` actually checks that pipeline's
output.

**A workflow change builds in two stages.** When the merge changes
`.github/workflows/`, tedium first builds the merged code with the base's
workflows grafted in (stage 1), and builds the PR's own workflows only
once that passes (stage 2). `/try` (`tedium dryrun`) builds the same two
stages as `/land`, against the current base, and its failure comment
names the stage that failed.

`/land` refuses a PR that changes a workflow and a file that mentions
`.github/workflows` until a `/try` on its current head has passed. A PR
that changes only workflow files is not gated. A push after the `/try`
needs a new `/try`.

A test that asserts the new workflow -- a scan of the workflow file, or a
CI-only check that the new step took effect -- fails stage 1 by design,
because it sees the base's workflow there. Fix the PR in one of these
ways, in order of preference:

- Move the logic the test runs into a script outside
  `.github/workflows/`, and have the workflow call it. The test runs the
  script, so the fix and its test still land in one commit.
- Write a guard over workflow text that holds for the base form and the
  head form, and tighten it in a later PR.
- Land the workflow change, then open the guard test in a new PR after
  the first merges. Never open the two PRs at the same time.

To check stage 1 before you push, commit first. If the branch is behind
the default branch, merge `origin/<default>` into it. Then swap the
base's workflows in:

```bash
git restore --source=origin/<default> --staged --worktree -- .github/workflows
```

Run the suites that read workflows, then put the branch's workflows back:

```bash
git restore --source=HEAD --staged --worktree -- .github/workflows
```

Use `git restore`, not `git checkout <ref> -- <dir>`: checkout only
overlays files, so it keeps a workflow file the PR added, which stage 1
removes.

**A tedium landing does not close issues.** `Closes #N` in the PR body or
the commit message links the issue but leaves it open when tedium merges
(a web-UI merge by a human does close it). Keep writing the keyword for
the link; once tedium reports the merge, close each issue by hand with a
comment naming the PR.

**A tedium refusal is a failing check, not a reaction.** When the batch
cannot build, the PR's `tedium` check goes red with the reason ("Merge
conflict") and a link to the batch, and the PR stays open with no other
signal. A conflict usually means the default branch moved after the
branch was cut. Merge the default branch into the PR branch (never
rebase or force-push), push, and comment `/land` again: the push cancels
the old batch ("Canceled.") and the new `/land` queues a fresh one.
Review approvals survive a merge commit where the Landing ruleset keeps
them (9atatimer/tds-utils PR#808, 2026-11-15).

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
- `gh` CLI as the last resort, except for PR-state checks, which have
  no `gadmin` wrapper: there prefer `gh` over MCP.

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

Creating issues in bulk through the MCP tools:

- A tool timeout is not a failure. The create can land after the
  timeout, and a blind retry files a duplicate. List the newest issues
  before retrying.
- Issue numbers interleave with other sessions' issues and PRs, so a
  batch is not sequential. Record the number each call returns; never
  predict it.
- A create that sets a parent fails with "failed to resolve label" when
  a label does not exist yet. A create without a parent makes the label.
  File the first issue of a new label without a parent, then attach it.
- A parent in another owner was refused: the sub-issue tool would not
  attach
  [template-tools Issue#1023](https://github.com/Nine-At-A-Time-Media/template-tools/issues/1023)
  under [tds-utils Issue#588](https://github.com/9atatimer/tds-utils/issues/588)
  (2026-10-24). Link a cross-owner child by a comment on each side and
  list it in the epic's body.

## Why the fork split

The fork split exists because a Copilot review, when the human summons
one, is billed to the repository owner (OCR on Demand runs only in the
owners' own repos, never on a personal fork): review on the personal fork first, then open the production PR
upstream. The fork, not any PR state, is what controls billing.
