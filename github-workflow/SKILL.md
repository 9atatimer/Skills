---
name: github-workflow
description: "Pushing code, opening PRs, responding to review comments or CI results, requesting or re-requesting reviews, subscribing to PR activity, or running the review-watch loop. The trigger is the push/review boundary, not just PR creation -- every interaction with a GitHub remote counts. Derive repo identity from git/gh at runtime; read repo conventions from the repo's own agent instruction file (AGENT.md / AGENTS.md / CLAUDE.md). Skip for local-only work with no push/PR/review step yet."
---

# SKILL: GitHub Workflow

This skill contains the procedures for interacting with a GitHub remote:
branch discipline, the PR flow, tool selection, the review-watch loop, and
the automated review-response procedure. The skill body is pure shared
logic -- it contains no repo-specific facts.

## Where repo facts come from

**Identity is derived, never declared.** Ask the repo; do not read a
hand-maintained file that can silently go stale.

**Always pin `gh` to a remote URL.** A bare `gh repo view` resolves the
remote named `upstream` ahead of `origin`, so in a fork checkout it reports
the *canonical* repo -- which makes a fork look like a direct origin and
sends Stage-1 commands at upstream. Verified:

```zsh
# origin=9atatimer/tds-utils, upstream=Nine-At-A-Time-Media/template-tools
$ gh repo view --json nameWithOwner --jq .nameWithOwner
Nine-At-A-Time-Media/template-tools     # <- upstream, NOT origin
```

So derive against an explicit URL (a bare remote *name* is not accepted):

```zsh
origin_url=$(git remote get-url origin)

gh repo view "$origin_url" --json nameWithOwner --jq .nameWithOwner
gh repo view "$origin_url" --json defaultBranchRef --jq .defaultBranchRef.name
gh repo view "$origin_url" --json isFork,parent \
  --jq 'if .isFork then "fork of \(.parent.nameWithOwner)" else "direct origin" end'
```

`isFork` is the **only** source of truth for topology -- never infer it from
remote names. When `isFork` is true, the two-stage flow additionally needs the
parent slug and the parent's default branch:

```zsh
parent=$(gh repo view "$origin_url" --json parent --jq .parent.nameWithOwner)
gh repo view "$parent" --json defaultBranchRef --jq .defaultBranchRef.name
```

**Fallback when `gh` is unavailable.** git alone cannot answer `isFork`, so
topology degrades to a convention: an `upstream` remote is *assumed* to mean
fork mode. Say so rather than asserting it, and get both sides' defaults:

```zsh
git remote get-url origin                      # this repo's slug
git remote get-url upstream 2>/dev/null        # canonical slug; absent => assume direct
git symbolic-ref refs/remotes/origin/HEAD
git symbolic-ref refs/remotes/upstream/HEAD 2>/dev/null
```

`git remote -v` only lists configured remotes; it inspects, it does not
classify.

**Conventions live in the consuming repo's agent instruction file**
(`AGENT.md` / `AGENTS.md` / `CLAUDE.md`). Branch prefixes, review-cadence
limits, required CI check names, extra remotes that are not code upstreams,
and any other local policy are repo policy, and that file is already the
canonical, version-controlled, always-loaded home for it. Read it; do not
expect a data file inside this skill directory.

> Skills are units of distribution: provisioning refreshes and overwrites
> this directory. Nothing repo-owned may live inside it. See "The LOCAL.md
> misstep" in `TODO_PLAN.md`.

## Branch Safety (CRITICAL)

- **NEVER WORK ON THE DEFAULT BRANCH**
- **ALWAYS CHECK CURRENT BRANCH FIRST**: before any git operation, run
  `git branch --show-current`
- **IF YOU ARE ON THE DEFAULT BRANCH**: STOP IMMEDIATELY. Warn the human.
  Do NOT proceed.
- **REQUIRED WORKFLOW**: all changes go on a feature branch, then merge via
  Pull Request

## Branch Naming Convention

All branches MUST use the owner prefixes the repo's agent instruction file
(`AGENT.md` / `AGENTS.md` / `CLAUDE.md`) declares:

- Human-driven branches use the human prefix (e.g. `<user>/feat/description`,
  `<user>/fix/description`).
- Agent-driven branches use the agent prefix. The agent prefix is usually
  set by the harness; humans should not push to agent-prefixed branches.

## Remote Topology

Derive which of two topologies this repo uses (see "Where repo facts come
from" above). Every step below keys off it:

| Step | Direct origin | Fork + upstream |
|------|---------------|-----------------|
| Branch base | the default branch on `origin` | `upstream/<default>` (sync first: `git fetch upstream`) |
| Push target | `origin` (the canonical repo) | `origin` (your fork) -- you cannot push to `upstream` |
| PR head / base | `<branch>` -> `<default>`, same repo | `<fork>:<branch>` -> `upstream:<default>` |
| `--repo` for `gadmin` / `gh` / review-watch | the derived owner/repo slug | Stage-1 (fork PR, Copilot review, review-watch): the derived slug (the fork); Stage-2 (upstream PR): the **parent** slug from `gh repo view "$origin_url" --json parent` |

**Why the fork split exists:** Copilot Pro+ review charges are billed to the
repository owner. Reviewing on a personal fork first keeps AI-review costs on
the personal account; the upstream PR is for human review and merge. It is
the *fork* -- not any PR state -- that controls billing.

## Push & PR Flow

Pick the flow matching the derived topology.

### Single PR Workflow (direct-origin)

All AI review cycles happen within a single PR. Do not create multiple PRs
or close/re-open PRs.

1. **Push** your branch to `origin`.
2. **Open a PR** targeting the default branch. **Do NOT open it as a
   draft** -- Copilot does not review draft PRs, so a draft silently never
   gets reviewed and the review-watch loop polls forever. Open it
   ready-for-review (or run `gh pr ready <NUMBER>` immediately). Do not put
   `[WIP]` in the title.
3. **Title:** use a clean conventional-commit summary
   (e.g. `feat(scope): short description`).
4. **Iterative AI review:** Copilot reviews the open PR. After each
   productive push, re-request with
   `gh pr edit <NUMBER> --add-reviewer @copilot` (Copilot does not
   auto-re-review on `synchronize`). Repeat: address feedback, push,
   re-request, wait.
5. **Human review:** once AI review cycles settle, the human takes over for
   final review and merge. Do NOT create a second "final" PR.

### Two-Stage PR Workflow (fork + upstream)

To avoid charging Copilot review cycles to the organization:

**Stage 1: PR to fork (for AI code review)**

1. Push branch to `origin` (your fork)
2. Create a **normal (non-draft) PR** targeting the fork's default branch
3. Request a Copilot review: `gh pr edit <NUMBER> --add-reviewer @copilot`
4. Copilot reviews happen here -- charged to your personal account
5. Address all Copilot feedback. **Re-request review after each push** --
   Copilot does not auto-re-review on `synchronize`

> **Do not use a Draft PR for Stage 1.** Copilot does not review draft
> PRs -- a draft sits unreviewed indefinitely, so the AI-review step never
> fires and any review-watch loop polls forever. It is the *fork* (not the
> draft state) that keeps billing on the personal account, so a normal PR
> satisfies the cost-control rationale. There is no `[WIP]` title prefix in
> this flow; the separate Stage-2 PR is the production signal.

**Stage 2: Final PR to upstream (for human review and merge)**

1. Once Copilot review is complete, create a new PR from the same branch
2. Target the upstream default branch
3. This is the production PR
4. Human reviews and merges
5. Close the Stage 1 PR

### PR Template (both workflows)

The repo's PR template lives at `.github/pull_request_template.md` -- that
is the ONLY location to check. Do NOT scan the other paths GitHub
recognizes (`.github/PULL_REQUEST_TEMPLATE/`, repo root, `docs/`); this
fleet uses exactly one canonical location, and tool guidance that says to
search all of them (e.g. the GitHub MCP server's own instructions) is
overridden by this rule. If a repo genuinely uses a different path, its
agent instruction file says so.

If the template exists, fill in its sections. The web UI pre-fills it, but
a PR opened via API or CLI does not -- reproduce the template's headings in
the PR body yourself. If no template exists, write a normal descriptive
body; do not go hunting for one.

## Development Workflow

1. **Branch creation:** create a feature branch from the default branch
   (per topology table above)
2. **Implementation:** make changes locally
3. **Validation:** run linter, type checker, tests
4. **Stage and commit:** stage verified changes, commit with a descriptive
   message
5. **Push:** push to `origin`
6. **PR:** create a PR with a clear description

## GitHub Tool Usage

Three families of verbs, in **token-frugal preference order**:

1. **`gadmin`** -- ships as the `@nine-at-a-time-media/admin` npm package
   (source: `Nine-At-A-Time-Media/template-tools`, `packages/naatm-admin`;
   registry: GitHub Packages, `https://npm.pkg.github.com`; install:
   `npm install -g @nine-at-a-time-media/admin`). A repo may override the
   package or registry in its agent instruction file; otherwise these
   coordinates are the fleet default. Reachable on `$PATH` via a global install or
   per-project via `node_modules/.bin/gadmin` / `npx gadmin`. Preferred for
   reads (comments, CI logs) and writes (replies); output is filtered to
   the fields you triage on, so it stays small in context. Three sub-tiers,
   fall back in order:

     - `gadmin github` -- bash, requires `gh` CLI on `$PATH`.
     - `gadmin github-octokit` -- node + `octokit` npm package +
       `$GITHUB_TOKEN`.
     - `gadmin github-gitapi` -- node, native `fetch()` + `$GITHUB_TOKEN`,
       zero deps (the sandbox-friendly tier).

2. **GitHub MCP tools (`mcp__github__*`)** -- use when `gadmin` lacks a
   verb you need. Responses are typed and complete but include large echoed
   payloads (e.g. every reply confirms by echoing the parent comment's
   `diff_hunk`), so they cost ~5--10x more tokens than `gadmin` for the
   same operation. Avoid them for hot loops over many comments.

3. **`gh` CLI** -- last-resort fallback when neither `gadmin` nor MCP cover
   the operation. (Exception: for the two verbs below that have no `gadmin`
   wrapper yet -- PR-state checks and Copilot re-request -- prefer `gh`
   over MCP when it is on `$PATH`; it is cheaper there.)

**GitHub Actions logs:** `gadmin github actions list-runs` to find runs,
`gadmin github actions get-job --run <ID> --job <NAME>` to retrieve job
output. ANSI codes are stripped automatically.

**One-line rule:** when an event has already delivered the comment body via
the subscription stream, **do not re-fetch it.** The webhook payload is the
source of truth for that thread -- reply directly from the comment ID.

## Review-watch loop

A PR review is **iterative, not one-shot**. Start this loop by default
after opening any PR -- do not wait for the human to ask. Push fixes,
nudge re-review, repeat until quiescent. Applies to human-prefixed and
agent-prefixed PRs alike.

### Transport

Three tiers in preference order -- your environment determines which
applies:

1. **Claude Desktop / web UI** -- PR activity (reviews, CI) is delivered
   natively by the interface. No explicit subscription call is needed;
   events arrive automatically. Skip to "On each wake or event" when one
   fires.

2. **Claude Code CLI -- subscription (push)** -- if the GitHub MCP server
   is loaded, call `mcp__github__subscribe_pr_activity` with the PR
   number. Events arrive as `<github-webhook-activity>` blocks.
   Idempotent; auto-removed on merge/close.

3. **Claude Code CLI -- polling (`ScheduleWakeup`)** -- when MCP is not
   available. Default timing (a cadence limit in the repo's
   agent instruction file, or the user's global instructions, wins over
   these -- e.g. a global maximum wake interval):

   - First wake after opening the PR: ~3 min (Copilot needs a beat to
     queue)
   - First wake after a push: ~2 min
   - Subsequent quiet wakes: ~2 min

   Copilot's observed response window is ~4-6 min, so a 2-min cadence
   catches a posted review within 2 min worst case and ~1 min on average.
   Pass the loop's continuation prompt verbatim to `ScheduleWakeup` so the
   next wake re-enters this flow.

### On each wake or event

1. **Switch to the PR's head branch** (`git switch <BRANCH>`) before any
   `gadmin` or `gh` call -- otherwise `gadmin` may abort with a
   branch-mismatch warning and hide real pending comments. The user can be
   on any branch between turns; the loop is responsible for landing on the
   right one first.

2. **Check PR state and Copilot queue** with a single cheap call. There is
   no `gadmin` wrapper for this yet (tracked in the backlog), so the order
   is `gh` (if available) -> MCP:

   ```bash
   gh pr view <NUMBER> --json state,reviewRequests,reviews
   ```

   When `gh` is not on PATH (e.g. Claude Code on the web), fall back to
   MCP:

   ```
   mcp__github__pull_request_read  method=get  -> .state + .requestedReviewers
   ```

   Interpret either result the same way -- base the decision on the Copilot
   bot specifically, not on whether the list is empty (a human reviewer
   request keeps the list non-empty even after Copilot is done):

   - `state` is `MERGED` or `CLOSED` -- stop the loop immediately.
   - the reviewer list contains `copilot-pull-request-reviewer[bot]` --
     Copilot is still in flight; reschedule the next wake and wait.
   - the reviewer list does **not** contain
     `copilot-pull-request-reviewer[bot]` (other reviewers may remain) --
     Copilot has finished or is not queued; proceed to step 3.

   Also note any new **overview-only** reviews (`state=COMMENTED` body
   with no inline comments): `gadmin github pending-comments` only
   surfaces inline comments, so overview-only reviews are invisible to it
   and must be tracked from this step.

3. **Fetch unaddressed inline comments** -- always, even when step 2 looked
   quiet, because standalone inline comments (e.g. human replies outside
   any review) only show up here:

   ```
   gadmin github pending-comments --repo <OWNER/REPO> --pr <NUMBER>
   ```

4. **Triage and act** per Automated Review Response below, applying the
   auto-action threshold:

   - **Small and unambiguous** change -- make it, push, reply with the SHA.
     No need to ask first.
   - **Ambiguous or architecturally significant** -- ask the human before
     acting, inline in the session as plain text (never a question-picker
     widget -- they break on mobile) so the question is in-band.
   - **Disagree** -- reject with a one-line concrete reason. Never just
     "disagree." Do not be a yes-man to Copilot -- reviewer pushback is the
     point of the loop.
   - **No action needed** (echo, informational, noise) -- skip and say so
     briefly.

5. **After a productive push**, nudge Copilot to re-review (Copilot does
   not auto-re-review on `synchronize`). There is no `gadmin` wrapper for
   this yet (tracked in the backlog), so the order is `gh` (if available)
   -> MCP:

   ```bash
   gh pr edit <NUMBER> --add-reviewer @copilot
   ```

   The `gh` CLI special-cases `@copilot` (shipped 2026-03) to trigger the
   Copilot review bot; the plain `requested_reviewers` REST API rejects it
   as "not a collaborator." Works with user PATs (the standard `gh auth`
   flow); reportedly fails with GitHub Actions bot tokens and some org
   custom apps. `gh pr view --json reviewRequests` will often show empty
   right after firing -- Copilot consumes the request near-instantly. When
   `gh` is not on PATH, fall back to the MCP tool, which queues the
   re-review correctly:

   ```
   mcp__github__request_copilot_review
   ```

   Skip this step entirely if nothing was pushed this cycle -- the next
   review would just repeat the prior one.

6. **In polling mode**, also sweep every other open PR you authored before
   scheduling the next wake -- Copilot can leave delayed comments on PRs
   you did not push to.

**Step 7 ("Consider documentation follow-ups") of Automated Review
Response runs once when the loop exits, not every iteration** -- updates
should reflect the settled state, not mid-cycle churn.

### Termination

Stop when any of these fires:

- PR merged or closed.
- `copilot-pull-request-reviewer[bot]` absent from the requested reviewers
  (other reviewers may remain -- use the same Copilot-bot check as step 2,
  not an empty-list check) and no new Copilot review has appeared across
  **3 consecutive wakes** (~6 min quiescent) -- Copilot is done. Stop
  fast -- Copilot rarely returns late once the response window has passed.
- **5 iterations on any single PR** (safety cap) -- report state and
  surface to user.
- A comment is architecturally ambiguous -- ask the human inline in the
  session as plain text (never a question-picker widget -- they break on
  mobile) and stop. Do not guess at design calls.
- **All-rejected pass = stop.** If an iteration's actions for a PR are
  100% rejections (zero `accept`, zero pushes, zero re-requests), mark
  that PR settled and stop polling it immediately -- do not enter the
  quiescent empty-poll count. Once you have said "no" to everything
  Copilot raised, the PR is in a "Copilot said its piece, you declined"
  state, which is a *land* signal, not a *wait* signal; another pass
  produces a guaranteed empty-or-rejection that adds no information. This
  is distinct from the quality-drop rule below: that one fires on
  Copilot's *next* pass re-asserting a nit; this one fires *immediately*
  on the all-rejected pass, no second pass needed.
- **Quality drop (anti-bikeshedding).** When remaining unaddressed
  comments are nitpicks (style trivia, "consider renaming X to Y" with no
  concrete reason, alternative phrasings of working code), push back --
  reject each with a one-line reason. If Copilot re-asserts the same nit
  on the next pass, post one summary reply ("remaining suggestions are
  stylistic; not addressing in this PR") and stop. Do not loop on
  bikeshedding.
- Push fails / network failure / Copilot service unavailable -- report
  and surface to user.
- Human says to stop. Do not argue.

In subscription mode, ignore any subsequent `<github-webhook-activity>`
events after a terminal condition fires (the MCP server auto-removes the
subscription on merge/close, but for the other exit conditions there is no
documented explicit unsubscribe). In polling mode, omit the next
`ScheduleWakeup`.

### Event taxonomy

| Event | Action |
|-------|--------|
| Copilot review overview (with inline comments behind it) | Fetch the full batch once via `gadmin`; triage together, not per event. |
| Single inline comment (human reply, no review overview) | Triage and act on that one thread. |
| `check_run` failure | Get the job log via `gadmin github actions get-job`; classify (flake / config / real bug); fix or report. |
| PR merged or closed | Acknowledge and stop. |
| Echo of your own reply | Skip -- every reply you post comes back as a webhook event within seconds. Discard if author is you and body matches what you just posted. |

### Use `/loop` to drive it

Self-pacing mode is the right primitive:

```
/loop check my open PRs for Copilot feedback, triage and respond per the
github-workflow skill, push fixes, wait for re-review (~2 min), repeat
until settled or capped.
```

Self-pacing (`/loop` with no fixed interval) lets the agent pick the
right wait between iterations rather than burning cache windows on a
clock it did not choose. In Claude Code, the agent uses `ScheduleWakeup`
(harness-provided) to set that wait; in other agents, the equivalent is
whatever delayed-prompt or sleep mechanism that environment offers.

### What to tell the user

- **When entering the loop:** list the PRs you are watching, the wait
  cadence, and the stop conditions you have set.
- **Each iteration:** brief report on per-PR delta (what was new, what
  you did).
- **On exit:** which stop condition fired, the result of Step 7
  (documentation follow-ups from the settled state of all PRs in the
  cycle), and whether the PRs are mergeable from your perspective.

## Automated Review Response

This is the procedure for handling a batch of review feedback -- whether it
arrived via subscription, native UI events, or you fetched it cold with
`gadmin pending-comments`.

**Step 1: Fetch all comments (once).**

- `gadmin github pending-comments --repo <OWNER/REPO> --pr <NUMBER>` for
  unaddressed comments.
- Fallback: `gadmin github pr-comments --repo <OWNER/REPO> --pr <NUMBER>`
  for everything.
- `--repo` is required; use the slug the topology table selects.

**Step 2: Triage ALL comments before making changes.** Read every comment,
classify each as one of:

- **Agree** -- will fix.
- **Disagree** -- will reject with a reason.
- **Ambiguous / architecturally significant** -- ask the human first,
  inline in the session as plain text (never a question-picker widget --
  they break on mobile). Do not guess.

**Step 3: Reject the ones you disagree with** immediately, with reason:
`gadmin github reply --repo <OWNER/REPO> --id <ID> --type reject --msg "Reason for disagreement"`

When your rejections leave the PR with zero open threads, ALSO post ONE
consolidated top-level PR comment restating what you rejected and why
(via `gadmin github issue comment --repo <OWNER/REPO> --number <PR_NUMBER>
--body <TEXT>` -- a PR number is valid because PRs are issues -- or
`gh pr comment`, or the MCP `add_issue_comment` tool with the PR number as
`issue_number`). Resolving a
rejected thread collapses it behind a "Resolved" fold, so without the
mirror comment the human sees a clean PR and never learns feedback was
declined. One comment per review pass, not one per rejection.

**Step 4: Implement the agreed fixes locally, commit, and PUSH.** All
fixes go in one commit (or one per logical group), **never amend a pushed
commit**. Note the resulting SHA. The push is critical -- an unpushed fix
is invisible to the reviewer.

**Step 5: Accept each fixed comment with the SHA:**
`gadmin github reply --repo <OWNER/REPO> --id <ID> --type accept --msg "Agreed, fixed in <sha>"`

**Step 6: Verify nothing is unaddressed:**
`gadmin github pending-comments --repo <OWNER/REPO> --pr <NUMBER>` -- should
return empty.

**Step 7: Consider documentation follow-ups.** Did an accepted fix reveal a
gap worth a new TODO or a Lessons-Learned entry? Did a rejected suggestion
surface a recurring misconception worth recording (tool behavior, design
decision)? If yes, update the relevant doc (e.g. `TODO_PLAN.md`) and
include it in the next commit; if not, skip.

**Reply conventions** (independent of which tool posts them):

- Accept replies say: `Agreed, fixed in <sha> -- <one-line summary of fix>`.
- Reject replies say: `<concrete reason>` -- never just "disagree."
- Replies are posted **sequentially**, one tool call per reply. Do not
  batch.

**Execution notes:**

- If `gadmin github` fails, fall back to `gadmin github-octokit`, then
  `gadmin github-gitapi`, then MCP, then raw `gh` -- in that order.
- If you cannot annotate at all, ask the human for help rather than
  silently dropping comments.

## Commit Messages

Use conventional commits:

```
feat: add new feature
fix: correct bug in component
refactor: extract shared logic
test: add unit tests for composable
docs: update architecture doc
```

## Optional Practices

These sections apply **only when the repo's agent instruction file enables
them**. Each is self-contained; if the repo does not mention it, skip it.

### AI Session Tracking via Issues

For repos that want a paper trail of what AI agents did and when (multiple
concurrent agents, audit/compliance needs):

- **Start of session:** create an issue assigned to `@me`:

  ```
  gh issue create --repo <OWNER/REPO> \
    --title "[AI] Task: <task name>" \
    --assignee "@me" \
    --body "### Session Metadata
  - Agent: <agent name>
  - Branch: <current branch>
  - Local Path: <working directory>

  ### Task Description
  <brief description>"
  ```

- **End of session:** close the issue:
  `gh issue close <NUMBER> --repo <OWNER/REPO> --comment "Session completed."`

- Issue titles must start with the `[AI]` prefix for filtering.

### Commit Message Sanitization (Pre-Push Squash)

For repos with external visibility where public history must stay clean: a
pre-push git hook automatically squashes local commits before pushing,
opening an editor with previous commit messages as comments for reference
so a clean message can be written for the remote. Local development stays
unfiltered; the public history stays clean and linear. When the repo notes
this hook is installed, expect the squash prompt on push and write the
consolidated message accordingly.

### Branch Protection and Required Checks

For repos whose default branch is protected by required status checks
(the repo lists the check names): PRs cannot merge until
all checks pass. If a check fails:

1. Read the job output:
   `gadmin github actions get-job --run <ID> --job <NAME>`
2. Fix the issue locally
3. Push the fix -- checks re-run automatically

### Restricted Agent Permissions (Stage-Only Mode)

For high-trust codebases or regulated environments where the human curates
every commit. When the repo declares stage-only mode:

- The AI agent **MUST NOT** use `git commit` or `git push`
- After implementing and validating changes, the agent stages them with
  `git add` and informs the user
- The user reviews staged changes, commits, pushes, and creates the PR

This overrides the Development Workflow steps 4-6 above.
