---
name: clai
description: "How the fleet runs more than one coding agent (claude, codex, opencode, agy, omp, ...) through clai: every agent launches as `clai <agent>`, and its configuration lives in clai -- provisioned skills and MCP catalog, plus per-agent overlay hooks under clai.d/<agent>/{pre,post}/. Load before adding a coding agent, changing what an agent loads at launch (MCP servers, model providers, credentials, settings), or diagnosing one agent picking up another's config. Skip for the skills' content (the skill in question) and for clai's own code (template-tools packages/clai and its design record)."
---

# clai -- one launcher, many coding agents

clai is how every coding agent on a fleet machine starts and how it is
configured. The design record is template-tools
`packages/clai/docs/CLAI.DESIGN.md`; this skill is the policy an agent
applies when it touches agent configuration.

## The rule

**An agent's configuration is clai's, never a hand edit.** If an agent
needs a provider, a credential reference, an MCP server on or off, or a
setting, the change is a clai hook or a manifest entry, reviewed in a PR.
A file edited by hand in `$HOME` is lost on the next machine and invisible
to every other agent session.

Agents launch as `clai <agent> [args...]` (shell aliases make the bare
name do this). A bare agent binary skips the hooks, the provisioning and
the telemetry; use it only to prove something about the agent itself.

## Two mechanisms, two jobs

- **`clai provision`** places the skill tree into every agent's skills
  directory and emits the MCP catalog in each agent's own config dialect.
  The catalog is `mcp/manifest.json` in the Skills repo; overlays
  `<repo>/clai.d/mcp.json` and `~/clai.d/mcp.json` subscribe to
  profiles, patch fields and disable servers. One emitter per agent
  dialect lives in clai; an agent with no emitter gets no catalog.
- **Overlay hooks** are executables in `clai.d/<agent>/pre/` and
  `clai.d/<agent>/post/`, collected by a walk from `$PWD` up to `$HOME`.
  The global tree is tds-utils `clai.d/` (linked as `~/clai.d`); a
  project adds or overrides hooks in its own `clai.d/`. Same basename:
  the level closest to `$PWD` wins; a zero-byte file there disables it.
  Hooks run in bytewise name order (`05-`, `10-`, `30-`).

Use provision for what every agent shares (skills, catalog servers). Use
a hook for what is specific to one agent's config surface.

## Writing a hook

- **Fail open.** A pre-hook that exits non-zero aborts the launch. Guard
  every step, log to stderr, exit 0.
- **Own keys, not files.** Merge only the keys the hook owns into the
  agent's config (jq for JSON), so the user's and the agent's own writes
  survive. Where the agent's format cannot be merged safely, own the
  whole file only while it carries a marker line, and leave an unmarked
  (hand-managed) file alone.
- **Never symlink a file the agent writes at runtime** out of a
  repository checkout; that dirties the checkout on every launch. Merge
  into a real file in `$HOME` instead.
- **Secrets stay references.** Write an `op://` reference or a command
  the agent runs at launch (for example a key field whose value is
  `!op read 'op://...'`), never a resolved value. A non-secret value that
  names an account may be resolved into the local file, never into a
  public repository.
- **Idempotent.** Running the hook twice changes nothing the second time.

## Each agent spends under its own name

Agents that share a model gateway never share its credential. Each agent
authenticates with a token of its own and tags every request with its
own name in the gateway's metadata (for the Cloudflare AI Gateway,
`cf-aig-metadata: {"tool":"<agent>"}`), so the gateway's logs and spend
limits show what each agent cost and one agent can be revoked or capped
alone.

- The token lives in the vault for agent (non-human) credentials, one
  item per agent, and the agent's hook writes only its reference.
- A shared item (gateway base URL, gateway id) may supply the routing;
  the key is always the agent's own.
- Adding an agent means asking the human for that agent's token, or
  minting one per the infra-credentials skill; never pointing it at
  another agent's.
- The infra repo's credential registry records the item: who made it,
  which agent reads it.

## Agents read each other's config

Several agents import other agents' configuration: omp, for one, loads
Claude Code's MCP servers and its plugins' servers (named
`<plugin>:<server>`). A server meant for one agent then starts under
every agent that imports it. That is harmless for a stateless tool and
breaking for a single-consumer one: a Telegram channel plugin allows one
poller per bot, so a second agent starting it takes the channel away
from the first. Each agent that imports a server it must not run gets a
`clai.d/<agent>/pre/` hook adding that server to the agent's own
disabled list, read from a sibling `.conf` file.

## Adding a coding agent

- Install it through a package manager that verifies what it installs;
  never a fetched install script.
- Add `clai.d/<agent>/pre/05-provision` (copy an existing agent's) so the
  agent provisions like the rest.
- Add the hooks its config surface needs: model provider and its own
  credential reference (Each agent spends under its own name), default
  model, disable list for servers it imports but must
  not run.
- Add `alias <agent>='clai <agent>'` beside the others in tds-utils.
- If it has an MCP config dialect clai does not emit, file an Issue on
  template-tools for the emitter rather than writing the catalog into a
  hook.
