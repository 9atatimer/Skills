# GitHub workflow -- PR and issue anatomy, repo-fact commands, merges

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when `SKILL.md` points to it.

Contents:

- PR Anatomy (proposal vs. feedback)
- Issue Anatomy (defect vs. solution)
- Optional Practices
- Derive repo facts
- After a merge: markers before the commit
- After a git mv

## PR Anatomy (proposal vs. feedback)

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

## Derive repo facts

The commands behind "Derive repo facts; never declare them". Pin `gh` to a remote URL. A bare `gh repo view` resolves a remote named `upstream` ahead of `origin`, so in a fork checkout it reports the parent and the fork looks like a direct origin:

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

## After a merge: markers before the commit

A merge that reports a conflict in one file usually leaves markers in
others. Before `git add`, grep the whole tree:
`git grep -n '^<<<<<<< \|^>>>>>>> ' -- . ':!node_modules'` (or
`git diff --check`). `git checkout --ours <file>` acts only on a file git
marked conflicted; on an auto-merged file it prints "Updated 0 paths" and
leaves both sides' additions in place, so read the merged file for a
duplicated section before assuming yours won.

## After a git mv

- After a `git mv`, grep for the old path: rename detection carries the
  base branch's edits to the moved file, but not a file the base branch
  added at the old location or a dependent that still points there.
  While a move is in flight, a parallel branch that adds files under the
  old path merges without conflict and its files land where no tooling
  reads them: before merging either side, re-run the listing the tooling
  depends on.
