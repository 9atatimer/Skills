# DESIGN.SCRATCHPAD -- cross-session agent scratchpad

**Status:** REVIEW

> Gauntlet fixture. A minimal design record so persona prompts can point at
> a real file. Not a real design; nothing cites it.

## Goals

- An agent session can leave a note that a later session, possibly a
  different agent, can find and read.

## Non-Goals

- Replacing issues, design docs, or the repo's agent instruction file as
  the durable homes for decisions.

## Rejections

- Per-tool private memory directories: unreadable by other agents.

## Key Decisions

| # | Decision | Issue |
|---|---|---|
