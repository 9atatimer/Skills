# Agents (canonical source)

This tree is the canonical source of agent **personas** for the fleet: one
Markdown file per persona, YAML frontmatter, body is the system prompt.
Skills say *how* a phase of work is done; a persona says *who* is doing it
and what they refuse to think about. A persona confines attention. That
confinement is the whole point -- a Designer who starts writing deploy
workflows has stopped being useful as a Designer.

## Format

`agents/<name>.md`, flat, lowercase-hyphen names. Both Claude Code
(`.claude/agents/<name>.md`) and OpenCode (`.opencode/agents/<name>.md`)
consume exactly this shape -- a file is copied or linked into place with
no rename and no transform. Each tool ignores the frontmatter keys it does
not know, so one file carries both dialects:

| key | read by | meaning |
|---|---|---|
| `name` | Claude Code | the agent identifier (OpenCode uses the filename; keep them equal) |
| `description` | both | when to delegate to this persona; the only key both require |
| `mode` | OpenCode | `primary`, `subagent`, or `all` |
| `skills` | Claude Code | skills preloaded into the persona's context at start |

Deliberately absent, for now:

- `model` -- the two dialects disagree (`fable` vs `anthropic/...`) and
  every persona here works fine on the session's model. Inherit.
- `tools` / `permission` -- scope is carried by the prompt, not by a tool
  allowlist. A Designer with `Edit` denied cannot write a design doc; a
  Designer told what a design doc is and is not will not write code.
- `memory` -- it creates `.claude/agent-memory/<name>/` inside consuming
  repos, which is litter until a persona has something worth remembering.

## The five

| persona | thinks about | phases | hands off to |
|---|---|---|---|
| `designer` | intent, shape, what is NOT on the table | 1 Concept, 2 Design | everyone downstream |
| `security-architect` | perimeters, trust boundaries, attack surface | 2, 3, reads 7a | `security-engineer`, `sre` |
| `security-engineer` | controls as tests and code, gates that keep them | 4, 5, 6 | `security-architect` (when the boundary is wrong) |
| `sre` | the system in production: reliability, deploy, recovery | 7, 7a, NFRs in 2 | `devops-engineer` (path to prod), issues for app defects |
| `devops-engineer` | the inner loop: tooling, local env, chatops, test infra | machinery of 4-6 | `sre` (once it is running in prod) |

Each file names the skills it preloads and the skills it must load on
demand. The phase spine in `../skills/README.md` is the map they share.

## How it is consumed

Not yet. `clai provision` mirrors `skills/` into every agent's skills dir
and knows nothing about `agents/`; teaching it to mirror this tree into
`.claude/agents/` and `.opencode/agents/` is a clai change. Until then the
personas ship in the package (they are stamped and versioned like skills)
and can be linked by hand:

```sh
ln -s "$(pwd)/agents/designer.md" .claude/agents/designer.md
```

## Editing

Edit here, never in a mirror. Personas are prose: the markdown skill's
ASCII rules apply. Keep a persona under ~120 lines -- a persona that needs
more is smuggling a skill, and the content belongs in `../skills/`.
