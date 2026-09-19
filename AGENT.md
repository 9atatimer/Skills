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
  Copilot's newest review is on the head and every thread is resolved)
  must be green on the PR head only (`pr_status`); the staging commit
  never carries it. The `main` ruleset requires both on the PR head once
  the fleet's GitHub terraform is applied. A PR from a fork runs with a
  read-only token and never gets a `review-settled` status: fork PRs are
  human-merge.
- **`review-settled` cannot report yet -- nothing can land here until this
  clears.** `.github/workflows/review-settled.yml` calls the reusable
  workflow at `9atatimer/tds-utils/.github/workflows/review-settled.yml@master`,
  which is not on tds-utils `main` yet: it ships in
  `9atatimer/tds-utils#293`, still open (confirmed: fetching that path at
  `ref=master` from the GitHub API 404s, and every `review-settled` run on
  this repo's own PRs fails immediately, `gh run list -R 9atatimer/Skills
  --workflow review-settled.yml`). Since `tedium.toml` sets `pr_status =
  ["review-settled"]`, tedium can never batch a PR here until #293 merges
  to tds-utils `main`. Follow-up once it merges: pin this workflow's
  `uses:` (and pass `tools_ref:`) to #293's merge commit rather than
  trusting `@master` to stay green.
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

## Testing

`npm test` runs `test/*.test.mjs` under `node --test` (zero dependencies).
`npm run guard` runs the publicity guard over the full tree; `npm run
evals` runs the skill evals under `evals/`.
