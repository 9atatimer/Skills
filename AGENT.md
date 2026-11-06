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
  builds on `tedium/merge` (`status` in `tedium.toml`). The ruleset
  requires `gate` and a PR; only the tedium App may bypass it. Tedium
  lands a green PR on a reviewer's `/land`. A PR from a fork runs with a
  read-only token and is human-merge.
- **`adherence` is in `gate`'s needs.** The job calls tds-utils'
  reusable `adherence.yml` and judges the change against `adherence.toml`
  in the ci stage; a `lowered` or `not run` verdict fails it and blocks
  the landing, `inconclusive` passes. A new code file in no declared
  layer is `lowered` (the Covered check), so widen `[layers]` in the same
  PR. The declaration in force is the newest landed `adherence.toml` the
  owner approved or merged (CODEOWNERS names it). Pinned by commit
  (`uses:` and `tools_ref` carry the same tds-utils sha); bump both
  together.
- **`review-settled` is off: always green (owner ruling, 2026-10-18).**
  `.github/workflows/review-settled.yml` still posts the status on every
  non-fork head, but the pinned tds-utils checker (7643b92, tds-utils
  PR#571) no longer judges reviews or threads and never waits. Neither
  `pr_status` nor the ruleset requires it. An agent summons only OCR on
  Demand (`/ocr`); Copilot and Codex review only when the human fires
  the trigger (the gates skill, Reviewer Selection). The checker is
  pinned by commit (`uses:` and `tools_ref:` carry the same tds-utils
  sha); bump both together.
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
- **CODEOWNERS** covers every path (`*`): every
  landing needs a human owner's approval before tedium lands it. Agents
  open PRs as `9atatimer-bot` so the owner can approve; a PR the owner
  authored can never clear the check and is merged by hand.
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
tests. Standing exceptions, until the tool that replaces each ships: the
`self-review` skill's `ocr` sections
([Skills issue#81](https://github.com/9atatimer/Skills/issues/81)) and
`skills/release/references/deploy-mechanics.md`
([Skills issue#85](https://github.com/9atatimer/Skills/issues/85)).

**Concurrent skill PRs merge textually, not semantically.** Git and
tedium accept two PRs that touch different lines; nothing checks that
they agree. [Skills PR#83](https://github.com/9atatimer/Skills/pull/83)
made `docs/ops/<tool>.md` the tooling runbook while [Skills
PR#84](https://github.com/9atatimer/Skills/pull/84) made
`docs/runbook.<component>.md` the release runbook; both landed green within
the hour, contradicting each other. Before landing a skill PR, read what
merged to `main` since its base for the same nouns (`git log
<base>..origin/main -- skills/`) and reconcile.

**A section rewrite is audited by its deletions, not its additions.**
Replacing a skill section heading-to-heading drops every rule in it that
the new text does not restate, and nothing mechanical notices: the lint
checks citations, not content. In
[Skills PR#165](https://github.com/9atatimer/Skills/pull/165) the Reviewer
Selection rewrite lost "a bot finding is a bug report, not a verdict" and
the turn-budget rule, and only the self-review verifier caught it. Before
committing a rewrite, read `git diff -U0 | grep '^-'` for the old section
and name where each removed rule now lives.

**A fleet rule has copies outside this repo.** The reviewer policy is
restated in each repo's `AGENT.md`, in tds-utils `clai.d/AGENT.global.md`
(the machine-global file every agent on a laptop loads) and in tds-utils
`docs/ops/ocr-review.md`. The 2026-11-02 change swept the four `AGENT.md`
files and missed the global file, which still told every agent to request
Copilot once quota returned. Changing a rule here is done when
`git grep -i <noun>` across the consumer repos and `clai.d/` is clean.

## Testing

`npm test` runs `test/*.test.mjs` under `node --test` (zero dependencies).
That includes the skill lint (`scripts/skill-lint.mjs`, also in the husky
pre-commit): every "the X skill" must name a skill, every cited section
must name a heading in that skill, plus frontmatter, ordered lists and a
per-SKILL.md word budget, counted as `wc -w` counts. Its `WORD_BUDGET` is
a ratchet: lower it when a skill moves detail into reference files, never
raise it to fit a file.
`npm run guard` runs the publicity guard over the full tree; `npm run
evals` runs the skill evals under `evals/`.
