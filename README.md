# Skills

An agent-agnostic skill tree for coding agents.

**HEAD of this repository is the skill set.** There is no tag and no manual
version bump -- a merge to `main` publishes, and that publish is the rollout.

## Layout

```
skills/<name>/SKILL.md    the skills themselves
skills/<name>/...         a skill's supporting files, if it has any
mcp/manifest.json         the MCP server catalog provisioned alongside them
pins.env                  the fleet pins for the executable packages
SOURCE_STAMP              content digest of the payload (generated at pack time)
```

All four are payload members and they have two distinct readers, which is
why a partial tree is worse than an absent one:

| member | read by | purpose |
|--------|---------|---------|
| `skills/` | clai | materialized into each agent's skills dir |
| `mcp/manifest.json` | clai | the MCP server catalog |
| `pins.env` | lmde | which version of clai / ast-mcp / gadmin to install |
| `SOURCE_STAMP` | clai | currency check; regenerated, never committed |

A consumer that finds `skills/` and `mcp/manifest.json` but no `pins.env`
does not degrade gracefully -- it floats every executable to registry
latest, silently ungating the half of the fleet those pins exist to gate.

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
machine is provisioned, and it is not a substitute for acquire -- notably it
carries no `pins.env` handling, because pins are lmde's concern and clai
never reads them.

Skills are copied or symlinked into each agent's own directory
(`.claude/skills/`, `.codex/skills/`, `.agents/skills/`). Those are
generated mirrors -- edit skills here, never there.

## Publishing

`.github/workflows/publish.yml` publishes `@nine-at-a-time-media/skills` to
GitHub Packages on every push to `main`.

The version is `0.2.<commit count over skills/ and mcp/manifest.json>` --
deterministic, monotonic, and needing no human bump. **The 0.2 series is
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
