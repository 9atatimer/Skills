---
name: github-workflow
description: "Reaching a GitHub remote at all: branch discipline, remote topology (direct-origin vs fork+upstream), the push/PR flow, issue anatomy, and GitHub tool selection. Spans every SDLC phase rather than belonging to one -- load it whenever you touch a remote. Skip for what happens once the PR exists: scanners, CI, ci.magic, review and the review-watch loop are the gates skill."
---

# SKILL: GitHub Workflow

This skill contains the procedures for interacting with a GitHub remote:
branch discipline, remote topology, the PR flow, issue anatomy, and tool
selection. The skill body is pure shared logic -- it contains no
repo-specific facts.

This skill is **not a phase** -- pushes and PRs happen throughout the
flow. What happens to a PR once it exists (scanners, CI, ci.magic,
review) is phase 6, the gates skill.

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

## Gates are phase 6

Two laws that used to live here are now the gates skill, because they
govern every rung of the gate ladder and not just the PR:

- **Clear the gate before you move it.** You must meet or exceed the
  existing quality gate before you may change that gate. Raising a bar may
  take effect immediately; lowering one takes effect only once the change
  has cleared the old bar and merged. A repo owner may force past this;
  nobody else may, and an agent never may.
- **Zero unreviewed code.** Never land code no one has reviewed, and never
  drop a piece of reviewer feedback -- acting on it is optional, recording
  it is not.

Reviewer selection, the review-watch loop, the automated review-response
procedure, and the CI/ci.magic rungs are all **the gates skill**. What
stays here is how you reach a remote at all: branches, pushes, PRs,
issues, and tool selection.

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
   re-request, wait -- subject to the per-reviewer turn cap in the gates
   skill.
5. **Human review:** once AI review cycles settle, the human takes over for
   final review and merge (directly, or by commanding tedium -- see Landing
   via tedium below). Do NOT create a second "final" PR.

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

### Landing via tedium (merge bot)

Repos with the tedium App installed may land PRs through the merge bot
(see template-tools' `docs/design/DESIGN.TEDIUM.md`). The rule "humans merge, agents do
not" refines to: **humans authorize merges; tedium executes them.** An
explicit `@tedium land` comment from a human with write access IS the
human merge decision. Zero-unreviewed-code is unchanged -- `land` may only
be issued when every pushed commit has been reviewed. Agents never comment
`@tedium land` on their own initiative; `@tedium dryrun` is fine for
agents wanting a green-proof without landing. Never add `tedium/*` to
protected-branch patterns; the bot's staging branches must remain
force-pushable and deletable by the App.

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

## Naming issues and PRs

**Always say which kind a number is: `issue #458`, `PR #459`.** Never a bare
`#458`.

GitHub renders both identically and numbers them from one shared sequence, so
a bare `#N` tells the reader nothing about whether it points at a defect
record or a diff -- and those want opposite reactions. "Blocked on #71" is
unreadable; "blocked on PR #71" says wait for a merge, "blocked on issue #71"
says someone has to decide something.

This holds everywhere a number appears: commit messages, PR bodies, issue
bodies, review replies, `TODO_PLAN.md`, and chat with the human.

**Cross-repo references carry the repo:** `template-base#71`, or the full
`owner/repo#71` when the org is not obvious from context. A bare number is
always read as this repo.

**Exception: closing keywords take the bare form.** GitHub's
auto-close parser recognizes only `Closes #N`; `Closes issue #N` is
inert prose and the issue silently stays open after merge. Write
closing lines bare (a closing keyword can only target an issue, so no
ambiguity); the rule holds everywhere else. Missed one? Close the
issue manually, naming the PR.

## Issue Anatomy (defect vs. solution)

The body states the defect -- symptom, impact, evidence, done-criteria.
Fixes, approaches, and spikes go in comments as initial thinking. A
solution in the body reads as settled spec and rots as the work outruns
it; the defect statement holds until the defect is fixed. Applies to
every issue type -- drift, retrospective, pr-todo.

**Title the defect, not the patch.** `plan reports "Max cycles: 5"
regardless of config or profile` -- not `Change --max-cycles default to
None`. The first is still accurate after the code moves; the second was
already a guess when it was written. One defect per issue; batch only
trivially related nits.

**When you pick an issue up, re-derive the fix from the current design.**
The issue tells you what is broken and proves it. It does not tell you what
to build -- even when a comment on it sounds authoritative, and even when
you are the one who wrote that comment. Findings from using a tool are
*evidence*; they feel like a spec because they are concrete, and that is
exactly the trap.

## Development Workflow

1. **Branch creation:** create a feature branch from the default branch
   (per topology table above)
2. **Implementation:** make changes locally
3. **Validation:** run linter, type checker, tests
4. **Stage and commit:** stage verified changes, commit with a descriptive
   message
5. **Push:** push to `origin`
6. **PR:** create a PR with a clear description

### Git Hook Discipline (scalpel, not axe)

The pre-commit/pre-push hooks are the first rung of the gate ladder. A
failing hook is a diagnosis prompt, not an obstacle, and the sentry-file
discipline for a genuinely impossible check -- plus the ban on
blanket-skipping the suite -- is **the gates skill**.

## GitHub Tool Usage

Three families of verbs, in **token-frugal preference order**:

1. **`gadmin`** -- ships as the `@nine-at-a-time-media/admin` npm package
   (source: `Nine-At-A-Time-Media/template-tools`, `packages/naatm-admin`;
   registry: GitHub Packages, `https://npm.pkg.github.com`; install:
   `npm install -g @nine-at-a-time-media/admin`). A bare global install
   fails with a confusing 404 until `~/.npmrc` maps the scope
   (`@nine-at-a-time-media:registry=https://npm.pkg.github.com`) and
   carries a `read:packages` token -- see the package README for the
   one-time setup. A repo may override the
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

### Restricted Agent Permissions (Stage-Only Mode)

For high-trust codebases or regulated environments where the human curates
every commit. When the repo declares stage-only mode:

- The AI agent **MUST NOT** use `git commit` or `git push`
- After implementing and validating changes, the agent stages them with
  `git add` and informs the user
- The user reviews staged changes, commits, pushes, and creates the PR

This overrides the Development Workflow steps 4-6 above.
