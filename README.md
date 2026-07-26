# Skills (canonical source)

This tree is the canonical source of agent skills for the fleet, in the open
SKILL.md format: one directory per skill, containing a `SKILL.md` with YAML
frontmatter (`name`, `description`). The format is natively supported by
Claude Code, Codex CLI, Gemini CLI, Copilot, OpenCode, Cursor, and others;
each agent's lazy skill discovery replaces the old hand-rolled
`SKILL.INDEX.md` dispatch.

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
  `git remote -v`) or reads it from the consuming repo's `AGENT.md`/`CLAUDE.md`,
  which is the canonical home for repo policy. **Nothing repo-owned goes inside
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
template-base consumers during the migration. New content lands here; the
retirement decision for naatm-prompts is design Open Question 4.
