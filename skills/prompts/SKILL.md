---
name: prompts
description: "How to format every response to the owner in a working session: succinct and specific, explanation only on request, at most one ! command, typed PR and issue links, open questions as one line, an Actions-for-you block, and a closing status line of indicators (retro, uncommitted work, unfiled todos, archive). Load at session start and apply to every response. Skip for text written into files, commits, PRs and issues (technical-writing, github-workflow)."
---

# Prompts: how a response to the owner is formatted

The owner reads every response, often on a phone, and acts on its end.
These rules hold for every response in a session, from the first.

## Every response

- Give the answer and stop. Explain, give background or show reasoning
  only when the owner asks ("why", "explain", "ELI5").
- Be specific: name the file, the PR, the command, the value.
- Hand over at most one `!` command per response. When more are needed,
  give the next one after the owner has run the first.
- Name every PR or issue as a link whose text carries owner, repo, kind
  and number: `[<owner>/<repo> PR#34](<url>)`, `Issue#` for an issue (the
  github-workflow skill, Naming issues and PRs).
- Name issues that wait on the owner's decision in one line, `Open Qs:`
  followed by the links. Do not describe them until the owner asks.
- Say each thing once. The end of the response does not repeat its body.

## When the owner asks to walk through open questions

Take the questions one at a time. For each, ELI5:

- the decision, in one sentence;
- each option and what follows from it;
- your recommendation, in one line.

## The end of every response

First, an **Actions for you** block. Include only the sections that have
an entry, and drop the block when none has:

- **Needs your review**: PRs waiting for the owner's review.
- **Needs /land**: PRs ready for the owner to land.
- **Run**: the one `!` command, if any.
- **Open Qs**: the one line of issue links.

Then the status line, always last and always exactly this shape:

`[retro: ok|DUE] [uncommitted: 0|N wt] [unfiled todos: 0|N] [archive: OK|NO]`

- `retro`: `DUE` when an implementation this session landed and no
  retrospective (the retrospective skill) has run since; else `ok`.
- `uncommitted`: the number of this session's worktrees with uncommitted
  changes or unpushed commits.
- `unfiled todos`: follow-ups this session named that have no Issue or
  `tasks/` file yet.
- `archive`: `OK` only when the other three are `ok` or `0`; else `NO`.

Report each value from what you know of the session, and check the
worktrees (`git status`, `git log @{u}..`) before reporting `uncommitted:
0` or `archive: OK`.
