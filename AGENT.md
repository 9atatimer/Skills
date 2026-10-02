# AGENT.md -- Skills

Instructions for AI coding agents working in this repository. `CLAUDE.md`
and `AGENTS.md` are symlinks to this file.

## What This Repo Is

The fleet's skill tree: `skills/<name>/SKILL.md`, the agent personas under
`agents/`, and the MCP catalog `mcp/manifest.json`, published as
`@nine-at-a-time-media/skills`. README.md has the layout and how the
payload is consumed; edit skills HERE, never the provisioned mirrors
(`.claude/skills/`, `.codex/skills/`, `.agents/skills/`).

**A merge to `main` is a release.** `publish.yml` stamps a version and
publishes on every push to `main`, and `clai provision` materializes that
payload into every repo's agent directories at session start. A landing
here changes every agent's operating rules on its next session. There is
no staging: the review is the only gate before the fleet.

## Git Rules (CRITICAL)

- NEVER commit or push to `main` directly. Before any git operation:
  `git branch --show-current`; if `main`, STOP and warn the human.
- All changes go through feature branches and Pull Requests. NEVER
  force-push. Humans use `tstumpf/<type>/<desc>`; agents use the
  harness-assigned prefix.
- This repo is PUBLIC. The publicity guard (`scripts/publicity-guard.mjs`,
  run by the husky hooks and by CI) refuses content and paths that match
  its denylists and any skill directory not named in `PUBLIC_SKILLS.txt`.
  Listing a skill there is the conscious decision to publish it.

## Landing via tedium (issue #33)

PRs land through the tedium merge bot; the rules are in `tedium.toml` on
`main` and the gates skill assumes what follows.

- **Required checks.** `gate` (the `ci.yml` job that needs every other
  job) must be green on the PR head AND on the staging commit tedium
  builds on `tedium/merge` (`status` in `tedium.toml`). `review-settled`
  (the commit status from `.github/workflows/review-settled.yml`:
  the gate reviewer's newest review is on the head and every thread is
  resolved) still posts on the PR head, but since 2026-09-26 neither
  `pr_status` nor the `main` ruleset requires it: Copilot has no quota,
  and until the quota fail-open it could never go green. The ruleset requires `gate` and a PR; only
  the tedium App may bypass it. Tedium therefore lands a green PR on a
  reviewer's `r+` with no review at all; restore `review-settled` in
  `pr_status` when Copilot reviews again. A PR from a fork runs with a
  read-only token and is human-merge.
- **Copilot is the gate reviewer; Codex is human-summoned only.**
  `.github/workflows/review-settled.yml` lists `copilot-pull-request-reviewer`
  as the reviewer whose newest review must sit on the head. The reusable
  checker requires every listed login, so it cannot express "Copilot or
  Codex"; when Copilot answers with its quota notice the status fails
  open (`FAIL-OPEN: ... is out of quota`, threads still required; the
  gates skill), and it no longer blocks anything either way. An agent
  never posts `@codex review` (the gates skill, Reviewer Selection);
  Copilot is the only reviewer an agent may summon.
  The checker is pinned by commit (`uses:` and `tools_ref:` carry the
  same tds-utils sha); bump both together.
- **Prose is scanned for ASCII at commit time.** The publicity guard
  refuses any byte over 0x7F in markdown under `skills/`, `agents/`, and
  the repo root. Law 12 says it up front; the guard is what makes it
  mechanical, so no review cycle is spent on it. `.html` diagrams are not
  scanned.
- **`gate` is the only name to add to.** A new CI job goes into `gate`'s
  `needs`; a job outside it cannot block a landing.
- **One PR per batch** (`max_batch_size = 1`): each landing is a publish.
- **`hold` label** keeps a PR out of the queue. `tedium dryrun` builds it
  on `tedium/try` without publishing anything.
- **CODEOWNERS** covers the merge rules themselves (`tedium.toml`,
  `CODEOWNERS`, `.github/workflows/`) and the executable payload every
  agent in the fleet loads and runs (`skills/`, `agents/`, `mcp/`,
  `scripts/publicity-guard.mjs`); a PR touching any of it needs a human
  owner's approval before tedium lands it.
- **`tedium/merge` and `tedium/try` are the bot's build branches**: never
  protect them, never commit to them, never base work on them.
- Second repo in the go-live rollout, after tds-utils.

## Skills Guidance

Guidance comes from the skills in this tree. Load `sdlc` first when unsure
which applies; load a skill's body the moment a task enters its
territory. Writing or editing a skill: the `markdown` skill's ASCII rules
apply (`--` not an em-dash, `->` not arrow glyphs, `...` not an ellipsis,
straight quotes), and bullet lists, never ordered lists, except where a
step number is cited by other text.

**A skill states policy; a vendor tool's mechanics belong in tested
code.** Flags, exit codes, config-file layering and exclusion reasons
written into a skill are surface that review cannot converge on: nothing
executes the prose, so only a reader can catch it drifting from the tool.
In [Skills PR#77](https://github.com/9atatimer/Skills/pull/77) the
`self-review` skill's `ocr` adapter section drew new, valid defects in the
self-review pass and in each of five Copilot rounds; 10 of the 16 fixes
those rounds forced were `ocr` mechanics (rule-file layering, exclusion
and failure classes, missing flags, output fields, minimum version). Keep a skill to what
an agent must decide and type; put translation and routing in a tool with
tests.

## Testing

`npm test` runs `test/*.test.mjs` under `node --test` (zero dependencies).
`npm run guard` runs the publicity guard over the full tree; `npm run
evals` runs the skill evals under `evals/`.
