# DESIGN.PROVISION -- skill provisioning

**Status:** APPROVED

> Gauntlet fixture. A minimal approved design record so persona prompts can
> point at a real, frozen file. Not the real PROVISION design; nothing
> cites it.

## Goals

- Every session starts with the current skill tree mirrored into each
  agent's skills directory.

## Design

Provision copies the payload from the acquired package into
`.claude/skills/`, `.codex/skills/`, and `.agents/skills/` on every
session start, as symlinks on a laptop and copies in a sandbox.

## Key Decisions

| # | Decision | Issue |
|---|---|---|
| 1 | Symlinks on laptops, copies in sandboxes | #1 |
