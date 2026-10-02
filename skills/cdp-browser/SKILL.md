---
name: cdp-browser
description: "Driving a persistent, logged-in Brave or Chrome for Testing browser over the Chrome DevTools Protocol on a local machine, via the tds-utils `cdp` command, with the profile sandboxed in the repo's gitignored .cdp/ directory. Load when a task needs to view or act on a real site through a real login that should persist across sessions. Skip in cloud sandboxes (no desktop browser) and when a throwaway no-login test browser is what you want -- see chrome-mcp."
---

# SKILL: CDP Browser -- a Persistent, Logged-In Browser Over CDP

> **Purpose:** Give an agent control of a real, persistent, logged-in
> browser profile via CDP, isolated per repo, that the human can bring up
> and down at will during a live session.
> **When to use:** Automating a real site through a real login -- a
> dashboard, an admin UI, a listing manager -- where "log in once, stay
> logged in" matters.
> **Skip:** Cloud sandboxes (no desktop; the `cdp` command is laptop
> tooling from tds-utils). Ephemeral test browsers -- see
> [`chrome-mcp`](../chrome-mcp/SKILL.md).

## The pattern

Two independent pieces, joined by a port:

```
cdp up [brave|cft]      <- tds-utils command: owns the browser process
      |
  127.0.0.1:9322        <- CDP debugging port
      |
.mcp.json "cdp" entry   <- chrome-devtools-mcp --browserUrl: attaches only
```

The MCP server never launches the browser. `chrome-devtools-mcp` with
`--browserUrl` connects on the first tool call and reconnects when the
browser has gone away, so the server stays registered all session while
the browser comes and goes underneath it.

## The `cdp` command

```
cdp up     [brave|cft] [--port N]
cdp down   [brave|cft]
cdp status [brave|cft]
```

- **Browser is an argument.** Omitted, it is the browser last used in this
  repo (`.cdp/last-browser`), else `brave`.
- **Profile lives in the repo:** `<repo>/.cdp/<browser>/profile`. Never a
  shared user dir. `up` refuses unless `.cdp/` is gitignored -- the profile
  holds live session cookies.
- **Port** defaults to 9322. `up` refuses a port held by any process other
  than this profile's browser, so two repos cannot attach to each other's
  logins.
- **`up` is idempotent**; `down` sends SIGTERM (SIGKILL after 10s) and
  clears `.cdp/<browser>/browser.pid`. The browser's output is in
  `.cdp/<browser>/browser.log`.

Run it from anywhere inside the repo. Verify independently of MCP with
`curl -s http://127.0.0.1:9322/json/version`.

## Which browser

| | `brave` (default) | `cft` |
|---|---|---|
| App | Brave Browser | Chrome for Testing, newest in `~/.cache/puppeteer` |
| Install | already installed | `npx @puppeteer/browsers install chrome@stable --path ~/.cache/puppeteer` |
| Google sign-in | broken by Shields, independent of CDP | works (subject to the CDP gotcha below) |

Both have their own app bundle, so neither takes over another browser's
Dock slot. Brave's Shields can also alter page content (blocked
tracker-loaded elements) -- worth knowing if selectors depend on exact DOM.

## Wiring the MCP server

Project scope only: the repo's `.mcp.json`, never the agent's user or
global config. A global entry leaks into every other project.

```json
{
  "mcpServers": {
    "cdp": {
      "command": "npx",
      "args": ["-y", "chrome-devtools-mcp@<pinned>", "--browserUrl", "http://127.0.0.1:9322"]
    }
  }
}
```

Add `.cdp/` to the repo's `.gitignore` in the same change.

## Bringing things up and down mid-session

- **The browser:** `cdp up` / `cdp down`. In Claude Code the human can run
  it in-session as `! cdp up`. A tool call while the browser is down fails
  with a connection error -- ask for `cdp up` rather than retrying.
- **MCP servers:** in Claude Code, `/mcp` lists servers with Enable,
  Disable and Reconnect. Toggling there is per-session and needs no
  restart.

## Gotchas

- **Closing every tab does not quit the browser.** The process keeps the
  profile lock and the port. Use `cdp down`.
- **OAuth/SSO logins can refuse to complete under CDP.** Google's
  "Continue with Google" refuses ("This browser or app may not be secure")
  whenever a remote-debugging attachment is active, in any Chromium
  browser. Plain email/password logins are unaffected. Workaround: `cdp
  down`, open the same profile with no debug flags, sign in, quit, `cdp up`
  -- the session cookies are on disk and carry over:
  - Brave: `open -na "Brave Browser" --args --user-data-dir=<repo>/.cdp/brave/profile`
  - cft: run its executable with `--user-data-dir=<repo>/.cdp/cft/profile --use-mock-keychain`
- **Chrome for Testing needs `--use-mock-keychain`.** It is not signed for
  the login Keychain; without the flag it blocks at shutdown and ignores
  SIGTERM. `cdp` passes it. Do not launch the `cft` profile without it, or
  its cookies become unreadable under the key `cdp` uses.
- **A stale Chrome for Testing can hang before opening its port.**
  Symptom: `cdp up cft` times out and the log is empty. Install the current
  stable (command above); `cdp` picks the newest.
- **Chromium refuses remote debugging on a browser's default profile.**
  `cdp` always uses the repo sandbox, so this bites only hand-rolled
  launches.
