---
name: realchrome-cdp
description: "Driving the real, installed Google Chrome app over CDP on a local machine, via the tds-utils `realchrome-cdp` command, with its own profile in the repo's .cdp/realchrome/ sandbox. Load only when the human explicitly wants the real Google Chrome app rather than Brave or Chrome for Testing. Otherwise use cdp-browser."
---

# SKILL: Real Chrome Over CDP

> **Purpose:** The explicit, opt-in case of driving the everyday Google
> Chrome app bundle over CDP.
> **When to use:** Only when the human asks for real Google Chrome.
> **Skip:** Everything else -- [`cdp-browser`](../cdp-browser/SKILL.md)
> (Brave or Chrome for Testing) is the default and covers the shared
> mechanics, MCP wiring and gotchas this skill does not repeat.

## The command

```
realchrome-cdp up     [--port N]
realchrome-cdp down
realchrome-cdp status
```

Same behavior and safety checks as `cdp` (see `cdp-browser`), with a fixed
browser and its own sandbox: `<repo>/.cdp/realchrome/profile`. It never
touches `.cdp/last-browser`, and `cdp` never launches real Chrome.

## Why it is a separate command

- **It takes over the Chrome Dock slot.** macOS groups Dock icons by app
  bundle, not profile. While a CDP-tethered real Chrome runs, clicking the
  Chrome icon focuses it instead of the human's everyday Chrome -- they
  cannot easily open their own Chrome for email. Bring it down when done.
- **It never uses the everyday profile.** Chrome refuses remote debugging
  on its default user-data-dir, and the human's real logins must not be
  exposed to an agent. The sandbox profile starts logged out.

The port is shared with `cdp` (default 9322), so the `.mcp.json` `cdp`
entry attaches to whichever browser is up, and `up` refuses while another
browser holds the port.
