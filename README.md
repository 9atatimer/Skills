# Skills

An agent-agnostic skill tree for coding agents.

**HEAD of this repository is the skill set.** There is no tag and no manual
version bump -- a merge to `main` publishes, and that publish is the rollout.

## Layout

```
skills/<name>/SKILL.md    the skills themselves
skills/<name>/...         a skill's supporting files, if it has any
agents/<name>.md          agent personas (see agents/README.md)
mcp/manifest.json         the MCP server catalog provisioned alongside them
SOURCE_STAMP              content digest of the payload (generated at pack time)
```

All four are payload members:

| member | purpose | read by clai |
|--------|---------|--------------|
| `skills/` | materialized into each agent's skills dir | yes |
| `agents/` | personas, one file each, for `.claude/agents/` and `.opencode/agents/` | not yet |
| `mcp/manifest.json` | the MCP server catalog | yes |
| `SOURCE_STAMP` | currency check; regenerated at pack time, never committed | yes |

**This repository carries agent-facing prompt content and nothing else** --
skills (how a phase is done) and personas (who is doing it). Version pins
for the fleet executables (clai, ast-mcp, gadmin) are ENVIRONMENT, not
prompt content; they live beside the acquire engine in the tooling repos
-- tds-utils `lmde/lib/pins.env` and template-tools
`packages/naatm-sandbox/lib/pins.env`. They briefly shipped in this
payload, which meant moving skills here dragged clai's version policy
along with them.

## Consuming it

The supported path is `lmde acquire`, which installs the published package
and leaves the payload at the boundary path `clai provision` reads:

```
~/.local/lib/node_modules/@nine-at-a-time-media/skills
```

Nothing downstream knows or cares that this repository is where the payload
came from. That is deliberate: lmde owns acquisition, clai owns
configuration, and the transport is lmde's business alone.

For local development on the skills themselves, `CLAI_DATA_DIR` points clai
at a working tree instead:

```sh
CLAI_DATA_DIR=$(pwd) clai provision --report
```

That override is a development and test affordance. It is not how any
machine is provisioned, and it is not a substitute for acquire.

Skills are copied or symlinked into each agent's own directory
(`.claude/skills/`, `.codex/skills/`, `.agents/skills/`). Those are
generated mirrors -- edit skills here, never there.

## Publishing

`.github/workflows/publish.yml` publishes `@nine-at-a-time-media/skills` to
GitHub Packages on every push to `main`.

The version is `0.2.<commit count over the payload and packaging paths>`
(the list is `VERSION_PATHS` in `scripts/version.mjs`) -- deterministic,
monotonic, and needing no human bump. **The 0.2 series is
load-bearing.** template-tools published this same package name up through
`0.1.85`; a `0.1.<count>` scheme here would land on versions that already
exist, the publish step would skip them as already-published, and the fleet
would keep receiving the stale payload with CI green and nothing failing.

Publishing is cross-org -- this repository is in `9atatimer`, the package
scope is `@nine-at-a-time-media` -- so the built-in `GITHUB_TOKEN` cannot do
it. The workflow uses the `GH_PAT_NAATM_PACKAGES_RW` repository secret, a
classic PAT with `write:packages` and `repo`.

## Provenance

`skills/` was imported from `Nine-At-A-Time-Media/template-tools` at
`skills/`, with its history, via `git subtree`. Blame and `git log --follow`
reach back through the import.

This repository is now the sole publisher of the package. template-tools'
own skills publish stanza is removed in the same change that added the
workflow here -- two repositories publishing one package name would flip the
payload between two diverging trees on whichever merged last.
