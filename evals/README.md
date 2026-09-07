# evals -- the persona gauntlet

Runs every `agents/<name>.md` persona through the asks it must refuse,
redirect, or do, and grades the answers. The point is pressing: change a
sentence in a persona, rerun, read the matrix. It is a workbench, not a
gate.

## What it uses

- **promptfoo**, run from a built checkout of the 9atatimer/promptfoo fork
  (`PROMPTFOO_BIN`, default `~/workplace/9atatimer/promptfoo/dist/src/entrypoint.js`).
  It is not a dependency of this package and never will be: the package is
  inert data with zero dependencies.
- **Claude Code**, non-interactively. `providers/claude-cli.mjs` runs
  `claude -p --agent <persona>` with read-only tools -- the exact persona file, linked
  into `.claude/agents/`, through the exact harness the fleet uses. A few turns,
  nothing writable, because confinement is visible in the final answer. The rubric
  grader is a bare `claude -p` with a strict system prompt, so no API key
  is needed beyond the Claude Code login already on the machine.

## Run it

```sh
npm run evals                       # everything, sonnet
PERSONA_EVAL_MODEL=opus npm run evals
npm run evals -- --filter-description designer   # one persona
```

Results: `evals/output/latest.json` (gitignored). Optional web view:
`node "$PROMPTFOO_BIN" view`.

## Adding a test

Every assertion must point at a sentence in the persona file. If you
cannot name which confinement claim it checks, it is not a test (see the
testing skill, section 1.1). Prefer deterministic assertions
(`javascript`, `icontains`) where the claim allows; use `llm-rubric` only
where a human judgment is being approximated, and write the rubric as the
pass condition, not a vibe.

## Why this is not a husky hook

Outputs are nondeterministic, rubric grades drift, each run costs real
model calls, and a gate that flakes gets ignored. It becomes a gate when a
specific regression has happened and we know the assertion that would have
caught it -- same rule as any test. Until then: run it when you press a
persona, and before you merge a persona change.

## What it does not test

Trajectories. Whether the SRE actually runs the rollback before the deploy,
or the Security Engineer actually writes the RED test before the fix, is
multi-turn tool-using behavior. That needs a different harness (Inspect AI
or a hand-rolled one); do not stretch promptfoo there.
