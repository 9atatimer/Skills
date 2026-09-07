---
name: plannotator-review
description: Open Plannotator's browser-based code review UI for the current worktree or a pull request URL, then act on the feedback that comes back.
disable-model-invocation: true
---

# Plannotator Review

> **Vendored from [plannotator](https://github.com/backnotprop/plannotator),
> version 0.27.11.** Copyright the Plannotator authors; dual-licensed
> MIT / Apache-2.0. Everything below this block is upstream's text,
> unmodified -- edit it here only to fix a vendoring mistake, never to
> change behaviour, or the next update's diff becomes unreadable.
>
> **Drift check:** this describes plannotator 0.27.11. If
> `plannotator --version` reports anything newer, treat the flags and
> output contracts below as possibly stale and confirm with
> `plannotator <command> --help` before relying on them.
>
> **No binary?** -> the plannotator-install skill.

Use this skill when the user wants to review current code changes in Plannotator instead of reading a diff inline.

Run:

```bash
plannotator review [optional-pr-url]
```

Behavior:

1. Launch the command with Bash.
2. Wait for it to finish.
3. If it returns feedback or annotations, address them in the same conversation.
4. If it returns an approval/LGTM-style message, acknowledge that review passed and continue.

Do not ask the user to copy shell commands into chat. Run the command yourself.
