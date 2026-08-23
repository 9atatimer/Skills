# Skills (canonical source)

This tree is the canonical source of agent skills for the fleet, in the open
SKILL.md format: one directory per skill, containing a `SKILL.md` with YAML
frontmatter (`name`, `description`). The format is natively supported by
Claude Code, Codex CLI, Gemini CLI, Copilot, OpenCode, Cursor, and others;
each agent's lazy skill discovery replaces the old hand-rolled
`SKILL.INDEX.md` dispatch.

## The phase spine

The skills are organized around the eight-phase SDLC. The `sdlc` skill is
the spine -- the always-in-effect laws and which skill owns which phase --
and is the one to load first when unsure:

| Phase | Skill |
|---|---|
| 1 Concept | `concept` |
| 2 Design | `design` |
| 3 Architecture (intended) | `architecture` |
| 3b Planning | `planning` (+ `todo-plan`) |
| 4 Behaviors | `testing` + `testing-{node,nuxt,python}` |
| 5 Code | `coding` + `style-{bash,python,typescript}` |
| 6 Gates | `gates` |
| 7 Release | `release` |
| 7a Architecture (as-built) | `architecture` |
| 8 Retrospective | `retrospective` |

`github-workflow`, `markdown`, `tech-radar`, `wrapup` (the session
epilogue, typically invoked as `/wrapup`), and the tool skills
(`chrome-mcp`, `lmde-dashboards`) are not phases -- they are loaded
whenever their subject comes up.

## How it is consumed

`clai provision` (see
[PROVISION.DESIGN.md](https://github.com/9atatimer/tds-utils/blob/master/docs/design/PROVISION.DESIGN.md))
syncs this tree into every agent's skill directory at each new session:

- Laptop: symlinks into one clone under `~/.cache/clai/template-tools/`, so
  one pull refreshes every agent.
- Ephemeral sandboxes: copies (the containers are discarded, so symlink
  sources would not survive).

Skills are inert data and float to latest on the default branch -- no pin, no
publish step.

## Pure-shared and machine-overwritten

Provision owns this managed skill set and overwrites it freely on every run.
Do NOT customize a shared skill in place in a consuming repo -- provision
warns loudly on unexpected local edits (straggler detector) and the next run
replaces them. Repo-specific customization goes through two mechanisms, per
PROVISION.DESIGN.md:

- Parametric (repo owner, default branch, merge style, ...): the shared skill
  stays pure logic and either **derives** the fact at runtime (`gh repo view`,
  pinned to the origin URL) or reads it from the consuming repo's agent
  instruction file (`AGENT.md` / `AGENTS.md` / `CLAUDE.md`), which is the
  canonical home for repo policy. **Nothing repo-owned goes inside
  a skill directory** -- provision owns that tree and overwrites it.
- Behavioral (a repo whose flow genuinely diverges): the repo commits its own
  skill of the same name at project scope; native skill precedence (project
  shadows managed) makes closest-win.

An earlier design had the shared skill read a repo-owned `LOCAL.md` sibling
file inside the skill directory. That is retired -- it cannot work when skills
are provisioned as symlinks to one shared tree. See "The LOCAL.md misstep" in
`TODO_PLAN.md`.

## Legacy channel

`packages/naatm-prompts` (the flat `prompts/*.md` files plus
`naatm-prompts sync`) remains available as a legacy channel for existing
template-base consumers during the migration. As of tds-utils#179 the flat
payload is a strict content-subset of this `skills/` tree: every unique
rule was ported up here, new content lands ONLY here, and the flat files
must not be edited independently. The retirement decision for
naatm-prompts is design Open Question 4.
