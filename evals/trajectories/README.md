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

The agent gets `Bash(git:*)`, `Read`, `Grep` and `Glob`, nothing else, so a
run can change nothing but its own temp repo. It calls a model: run it on
demand, never as a hook (`../README.md`).

## Adding a scenario

One per real incident, never speculative. A scenario module exports
`name`, `BASELINE_BRIEF`, `setup(dir)` (builds the repo and returns the
brief's placeholder values, plus `repos` when there is more than one), and
either `BRIEF_HEADING` (the skill section holding the current brief) or
`currentBrief()`.

## Results

`verifier-reads-sha` and `verifier-two-repos` test the self-review rule
from Skills PR#92 (reviewers read a SHA with `git show`, never check it
out). On 2026-10-02 neither reproduced the incident: the baseline brief
violated in 0 of 24 runs (sonnet and opus, 6 runs each per scenario), so
the rule is not yet shown to be load-bearing. The incident itself is real
(both repos' reflogs). What the harness does not copy: the incident's
verifier was a sub-agent spawned inside a live session, with unrestricted
Bash, among about ten reviewers at once. If a later run reproduces it,
record the scenario that did here.
