---
name: style-bash
description: "Writing or modifying Bash/shell scripts: function-based file organization (header, helpers, main orchestrator, execution guard), set -euo pipefail discipline and its pipeline-exit gotchas. Load alongside the coding skill for any shell work."
---

# Bash Style Guide for Coding Agents

Follow these instructions whenever you create or edit Bash scripts in this repository.

## General Expectations
- Assume Bash 5.2+ (Homebrew build) and use the shebang `#!/usr/bin/env bash`
- Enable strict mode at the top of each script: `set -euo pipefail`

## Required Script Layout
Structure every script in five clear sections:
1. **Header** -- Shebang and a comment block describing purpose, usage, prerequisites, and side effects
2. **Shared Libraries** -- `source` statements for shared helpers (if any)
3. **Helper Functions** -- One function per logical operation, short and single-purpose
4. **Main Orchestrator** -- A `main()` function that sequences the helpers
5. **Execution Guard** -- `main "$@"` at the end of the file

> **Where Bash sits in the architecture.** A shell script is usually an *edge*
> (a mechanism: it shells out to git, curl, the filesystem). That is fine -- but
> the one idea in the coding skill, Section 1 still buys you the Decision test:
> keep each real decision in one named helper function (a policy), not smeared
> across inline `if`/`||` chains, and isolate each external-command call in its
> own helper so the script reads as intent, not plumbing.

## Helper Function Guidelines
- Declare function-local variables with `local`
- Quote all parameter expansions (`"${variable}"`)
- Prefer early returns over deeply nested conditionals
- **Avoid IFS**: Never reassign global IFS
- Use `readarray -t ARR < <(command)` for multi-line array assignment
- Prefer `< <(command)` over `|` (pipe) to prevent subshell variable loss
- Favor descriptive logging inside helpers so the script reads like a narrative when run

## Error Handling and Messaging
- Use structured error messages that tell a human what went wrong and what to check next
- Let `main` exit on the first failure by propagating non-zero statuses (`set -e`)
- Provide actionable error messages
- **Under `set -euo pipefail`, redirecting stderr does NOT prevent the
  exit code from propagating.** A pipeline like
  `find /nonexistent ... 2>/dev/null | sort | tail -1` aborts the script
  when `/nonexistent` is missing, before any guard like
  `[[ -z "$RESULT" ]]` below can run. The `2>/dev/null` silences the
  error message but not the non-zero exit, and `pipefail` propagates it.
  Fix one of these ways:
  - Guard the predicate explicitly first: `[[ -d "$DIR" ]] || { echo ...; exit 1; }`
  - Append `|| true` to the whole pipeline:
    `RESULT=$(ls "$DIR"/* 2>/dev/null | head -1 || true)`
  - Use a glob with `shopt -s nullglob` and iterate an array instead of piping.
  Pick the first one when you want a specific friendly error; pick the
  second when "empty result" is a normal path that the caller already
  handles.

## Testing and Verification
- Document in commit messages whether scripts were executed or only statically inspected
- When possible, add lightweight validation helpers (e.g., verifying required commands exist via `command -v`)
