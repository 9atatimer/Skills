---
name: plannotator-last
description: Open Plannotator on the latest rendered assistant message and use the returned annotations to revise that message or continue.
disable-model-invocation: true
---

# Plannotator Last

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

Use this skill when the user wants to annotate the latest assistant response in Plannotator.

Do not send a commentary/status message before running the command. The command
targets the latest rendered assistant response, so a preamble can mistakenly become the
thing being annotated.

Run:

```bash
plannotator last
```

Behavior:

1. Launch the command with Bash.
2. Wait for the annotation session to finish.
3. If feedback is returned, incorporate it into the follow-up response.
4. If the session closes without feedback, mention that briefly and continue.
5. An approval may still carry notes — a `"decision": "approved"` result with a
   `"feedback"` field. Read those notes and carry them into subsequent work, but
   do not redo the message over them: they are guidance, not a change request.

Run the command yourself rather than telling the user to invoke shell syntax manually.
