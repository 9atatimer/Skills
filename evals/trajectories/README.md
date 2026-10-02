# trajectories -- side-effect tests for skill rules

promptfoo grades what an agent says. This harness checks what it *does*:
it runs a skill's brief through a real agent (`claude -p`) in a throwaway
git repo, then compares the repo before and after. HEAD moved, a ref
written, a stash, a dirty tree: each is a violation, read from git, not
judged by a model.

## Run it

```sh
node evals/trajectories/run.mjs                        # every scenario, 3 runs, sonnet
node evals/trajectories/run.mjs --model opus --runs 5
node evals/trajectories/run.mjs --scenario verifier-two-repos --variant current
```

Each scenario runs twice per repetition: with its frozen **baseline** brief
(from before the rule it tests) and with the **current** brief (read from
the skill now). This is the superpowers `writing-skills` loop: a rule earns
its place when baseline runs violate and current runs do not. Exit 1 if
any current run violates.

It calls a model: run it on demand, never as a hook (`../README.md`).

## It is not a sandbox

A scenario has to leave the agent able to break the rule under test (here,
`git checkout`), so the agent gets real git. What the harness does limit:

- `--restricted`: the operator's user and project settings are ignored, and
  `Read`/`Grep`/`Glob` are confined to the run's directory.
- `--tools Bash Read Grep Glob` and `--strict-mcp-config`: no other tools,
  no MCP servers.
- `--allowedTools "Bash(git:*)"`: git is the only command pre-approved. It
  is a prefix match, so `git -C <elsewhere>`, `git push` and a `!`-alias
  still pass.
- The agent's environment drops `GH_*`, `GITHUB_*`, `AWS_*`, `OP_*`,
  `GOOGLE_*`, `CLOUDSDK_*`, `NPM_*`, `SSH_AUTH_SOCK` and the askpass hooks,
  and `GIT_CONFIG_GLOBAL=/dev/null` keeps the operator's aliases and
  credential helpers out of its git.
- After the run the harness records the `.git/config` the agent left, puts
  the pre-run copy back and deletes `.git/info/attributes`, and only then
  runs git, with `core.fsmonitor`, `core.hooksPath` and `core.pager` also
  forced off and the same stripped environment. A command the agent planted
  in its repo's config (an fsmonitor, a hook path, a clean filter, an
  include) is therefore never defined when the harness's git runs.

So run it where git reaching outside the temp dir costs nothing: a
throwaway container (a Claude Code cloud session is one) or a VM. Not on a
laptop holding real checkouts and credentials.

A run that errors (no `claude`, no auth, the 600s timeout) has no verdict
and fails the exit code; it is never counted as clean.

## Adding a scenario

One per real incident, never speculative. A scenario module exports
`name`, `BASELINE_BRIEF`, `setup(dir)` (builds the repo and returns the
brief's placeholder values, plus `repos` when there is more than one), and
either `BRIEF_HEADING` (the skill section holding the current brief) or
`currentBrief()`.

## Results

`verifier-reads-sha` and `verifier-two-repos` test the self-review rule
from Skills PR#92 (reviewers read a SHA with `git show`, never check it
out). On 2026-10-02 neither reproduced the incident. The first version of
the harness saw 0 baseline violations in 24 runs; this version, which also
watches refs, config, worktrees and the reflog's content, saw 0 in 12
(sonnet and opus, 3 runs each per scenario), with no errored runs. So the
rule is not yet shown to be load-bearing. The incident itself is real (both
repos' reflogs). What the harness does not copy: the incident's verifier
was a sub-agent spawned inside a live session, with the operator's
settings and unrestricted Bash, among about ten reviewers at once. If a
later run reproduces it, record the scenario that did here.
