# Skills

An agent-agnostic skill tree for coding agents.

**HEAD of this repository is the skill set.** There is no release, no tag,
and no package to bump -- a merge to `main` is the rollout.

## Layout

```
skills/<name>/SKILL.md    the skills themselves
skills/<name>/...         a skill's supporting files, if it has any
mcp/manifest.json         the MCP server catalog provisioned alongside them
```

Both members are required. A consumer that reads this tree checks for
`skills/` AND `mcp/manifest.json`; a checkout carrying only one reads as
absent, not as partial.

## Consuming it

Point a provisioning tool at a checkout of this repository's root. For
`clai provision`, that is `CLAI_DATA_DIR`:

```sh
git clone --depth 1 https://github.com/9atatimer/Skills.git ~/.local/share/skills
CLAI_DATA_DIR=~/.local/share/skills clai provision
```

The repository is public, so the clone needs no credentials.

Skills are copied or symlinked into each agent's own directory
(`.claude/skills/`, `.codex/skills/`, `.agents/skills/`). Those are
generated mirrors -- edit skills here, never there.

## Provenance

`skills/` was imported from `Nine-At-A-Time-Media/template-tools` at
`skills/`, with its history, via `git subtree`. Blame and `git log --follow`
reach back through the import.

While the fleet's provisioning still installs the
`@nine-at-a-time-media/skills` npm package built from template-tools, that
tree and this one are both live and can drift. This repository is the
intended source of truth; the package is the one being retired.
