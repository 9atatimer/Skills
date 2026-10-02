# loading -- does the right skill load?

A skill's `description` is the only thing an agent sees when it decides
whether to load the skill. These tests check that decision, by Anthropic
`skill-creator`'s method: for each skill, ten prompts that should load it
and ten near-misses (a neighbouring skill's territory) that should not.

## Run it

```sh
node evals/loading/run.mjs                       # every case, sonnet, 4 at a time
node evals/loading/run.mjs --skill gates --model opus
```

Each case runs `claude -p` in a temp dir whose `.claude/skills` is a copy of
this repo's `skills/`, with `Skill` as the only tool and only project
settings loaded (`--setting-sources project`), and reads the `Skill` calls
from the stream. Built-in and managed skills are still offered, so they
compete as they do in a real session. It prints each wrong case and a
table per skill; exit 1 only if a run errored. A run errors, and counts
for nothing, unless its stream ends in a successful result event (or in
`--max-turns` running out after its Skill call): an outage must never read
as ten near-misses correctly rejected. One model call per case: run
it on demand after editing a description, never as a hook.

## Cases

`cases.mjs`. Every near-miss names, in a comment, the skill it belongs to.
`test/loading.test.mjs` holds every case to a real skill and ten of each
kind. Add a skill's cases when its description is in question.

## Baseline (2026-10-02, sonnet, descriptions as of main ba449e1)

Two full runs, the second after the error handling above and with one
mislabeled near-miss replaced (gates' own description claims "review my own
diff"). Neither had an errored run.

| skill | loaded when it should | left alone on near-miss |
|---|---|---|
| gates | 5/10, then 3/10 | 9/10, then 10/10 |
| self-review | 6/10, then 6/10 | 9/10, then 10/10 |
| github-workflow | 5/10, then 4/10 | 7/10, then 9/10 |
| designomatic | 10/10, then 8/10 | 9/10, then 10/10 |

One run moves a skill by up to two cases, so compare a description change
over several runs, not one.

What the misses say:

- `gates` is not loaded for review-turn questions ("I fixed a typo Copilot
  flagged. Do I request another review?"), a hook failing for want of
  docker, or a request to lower a threshold. Its description names
  "agentic and human review" but none of these.
- `self-review` loses three of ten to the built-in `code-review` skill on
  plain "review my diff" prompts.
- `github-workflow` is not loaded for issues, PR links, drafts or a merged
  branch, all of which its body covers; and it rides along on near-misses
  (CI red, a release) as a second load.

Tuning a description is a change to that skill: edit it, rerun its cases,
and put the before/after table in the PR.
