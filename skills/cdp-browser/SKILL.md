---
name: cdp-browser
description: "Driving a real, already-installed Chromium-based browser (Brave, Chrome) over the Chrome DevTools Protocol, with an isolated non-default --user-data-dir, so an agent can operate a persistent, logged-in browser session for a project. Load when a task needs to view or act on a real site through a real login (not a throwaway/ephemeral test browser). Skip when the task needs an ephemeral, no-login test browser instead -- see chrome-mcp."
---

# SKILL: CDP Browser -- a Real, Logged-In Session Over CDP

> **Purpose:** Give an agent control of a real, persistent, logged-in
> browser profile via the Chrome DevTools Protocol (CDP), isolated from
> the user's everyday browser profile.
> **When to use:** A project needs to automate a real site through a real
> login that must persist across sessions -- filling out a listing
> manager, checking a dashboard, anything where "log in once, stay logged
> in" matters.
> **Skip:** An ephemeral, no-login (or throwaway-login) test browser is
> what you actually want -- see [`chrome-mcp`](../chrome-mcp/SKILL.md),
> which covers Chrome for Testing for exactly that case.
> **Platform scope:** Examples below are macOS. See
> [Platform variants](#platform-variants) for Linux/Windows paths.

## `cdp-browser` vs `chrome-mcp` -- which one do you want?

Both drive a browser via `chrome-devtools-mcp`, over CDP, with an isolated
`--user-data-dir`. They differ in what the browser *is* and what its
profile is *for*:

| | `chrome-mcp` | `cdp-browser` (this skill) |
|---|---|---|
| Browser | Chrome for Testing (CfT) -- Google's automation-branded Chromium, installed per-project | The user's real, already-installed Brave or Chrome |
| Profile lifetime | Persists logins, but the browser itself is disposable tooling | The whole point is a persistent, real login the user cares about |
| Typical use | Extension dev, e2e tests, scraping, UI verification | Driving a real site's dashboard/admin UI on the user's behalf |

If you're not sure which applies: does a human need to recognize this as
"my browser, logged in as me" days later? That's `cdp-browser`. Is it
disposable automation infrastructure? That's `chrome-mcp`.

## The pattern

```
<project-repo>/
+-- .mcp.json           <- project-scoped MCP entry (see Etiquette)
+-- <profile-location>/ <- gitignored, isolated user-data-dir (see below)
```

The ways to connect `chrome-devtools-mcp` to the real browser:

- **MCP-managed launch** -- the MCP server launches and owns the browser
   process itself, via `--executablePath` + `--userDataDir`. Simplest;
   the server's lifecycle is the browser's lifecycle. Use this by default.
- **Attach to an already-running instance** -- via `--browserUrl`,
   pointed at a browser someone launched by hand. Useful for manual
   debugging, or when something outside the MCP server needs to own the
   browser's lifecycle.

### Worked example -- Chrome, MCP-managed launch

`.mcp.json`:

```json
{
  "mcpServers": {
    "chrome-cdp": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--executablePath",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "--userDataDir",
        "/path/to/a/dedicated/profile-dir",
        "--chromeArg",
        "--remote-debugging-port=9222"
      ]
    }
  }
}
```

Manual-launch equivalent (for debugging outside the MCP server, or to
attach via `--browserUrl` instead):

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --remote-debugging-port=9222 \
  --user-data-dir=/path/to/a/dedicated/profile-dir
```

### Worked example -- Brave

Same shape -- Brave is Chromium-based, no special enablement needed:

```json
{
  "mcpServers": {
    "brave-cdp": {
      "command": "npx",
      "args": [
        "chrome-devtools-mcp@latest",
        "--executablePath",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "--userDataDir",
        "/path/to/a/dedicated/profile-dir",
        "--chromeArg",
        "--remote-debugging-port=9333"
      ]
    }
  }
}
```

```bash
"/Applications/Brave Browser.app/Contents/MacOS/Brave Browser" \
  --remote-debugging-port=9333 \
  --user-data-dir=/path/to/a/dedicated/profile-dir
```

**Brave-specific note:** shields/ad-and-tracker blocking are on by
default and can alter page content relative to stock Chrome (different
DOM, missing tracker-loaded elements). Worth knowing if your automation's
selectors depend on exact page structure.

## Verify the connection

Whichever form you used, confirm the debugging endpoint is live:

```bash
curl -s http://localhost:<port>/json/version
```

This returns JSON including `Browser` and `webSocketDebuggerUrl` once the
browser is up with CDP enabled.

## Choosing the profile location

`--user-data-dir` must be a **non-default, dedicated directory** (see
gotchas below) and must be **gitignored**. Where it lives is a real
choice, not a formality:

- **Shared cache** (e.g. `~/.cache/<project>-cft/userdata`) -- one profile
  reused across clones/checkouts of the same project, outside any single
  repo's lifecycle. Good default when the profile is disposable tooling
  state.
- **In-repo** (e.g. `<repo>/.cdp/userdata`, gitignored) -- the profile's
  whole lifecycle (create, use, delete) is tied to that one repo checkout.
  Good when the login itself is part of what makes that checkout
  meaningful, or when you want `rm -rf` on the repo to be a complete,
  total cleanup with nothing left behind elsewhere on disk.

Neither is "more correct" -- pick based on whether the profile should
outlive a single repo checkout.

## Gotchas

- **Default profile refuses remote debugging.** Chromium-based browsers
  block CDP on their default `--user-data-dir` for security. Always point
  at a dedicated directory; this isn't optional.
- **An already-running instance just gets focused, not re-launched.** If
  the browser is already open (even without CDP flags), a new
  exec with different flags won't apply them -- it'll just bring the
  existing window forward. Quit every instance of that browser first, or
  always launch with a `--user-data-dir` distinct from whatever's already
  running.
- **Directory creation isn't guaranteed.** Don't assume
  `--userDataDir` is created automatically if missing -- `mkdir -p` it
  yourself before first launch.
- **A debugging port is owned by one live process, and closing tabs
  doesn't release it.** Closing every open tab/page through the MCP
  server's own tools does NOT quit the underlying browser process -- it
  stays alive holding the profile lock and the port. A later attempt to
  bind that same port/profile again -- whether the MCP server relaunching,
  or a separate manual CLI invocation -- doesn't create a second listener;
  it just hands off to (focuses) the still-running process, same as the
  already-running-instance gotcha above. If something needs to reconnect
  to that existing process instead of launching fresh, that's usually
  fine and happens automatically. If a genuinely fresh process is needed,
  fully quit the browser (not just its tabs) first.
- **OAuth/SSO logins can refuse to complete under CDP.** Confirmed with
  Google's "Continue with Google": it refuses to sign in ("This browser or
  app may not be secure") whenever the browser has an active CDP/remote-
  debugging attachment, regardless of which Chromium browser or who
  attached. Plain email/password logins are unaffected -- only SSO/OAuth
  flows hit this. If a target site's login goes through such a flow: fully
  quit the browser, relaunch the same profile with **no debug flags at
  all**, sign in there, fully quit again, then reconnect over CDP as
  normal -- the resulting session cookies are on disk and carry over
  regardless of debug flags. This is a one-time cost per session expiry,
  not a per-use ritual.
- **A security-hardened browser's own protections can independently break
  OAuth logins, on top of any CDP-detection above.** Confirmed with Brave:
  its Shields/fingerprinting-protection features break Google Workspace
  sign-in on their own (`brave/brave-browser#22112`), with no automation
  or CDP involved at all. These are two separate, stackable causes -- a
  browser swap (e.g. Brave to Chrome or Chrome for Testing) can fix this
  one, but does NOT fix the CDP-detection gotcha above, which is
  browser-agnostic. Don't assume switching browsers alone resolves an
  OAuth failure under CDP; check which cause (or both) applies.

## Etiquette

- **Register the MCP server at project scope, never the agent's
  user/global config.** In Claude Code that means the project's
  `.mcp.json` -- never `~/.claude.json`. Same rule as `chrome-mcp`; a
  global entry leaks into every other project the agent touches.
- **Don't repurpose an existing shared CDP server entry** (e.g. one
  already wired to Chrome for Testing) for this pattern. Add a distinct,
  clearly-named entry -- the browser, profile, and purpose are all
  different from an ephemeral test browser.

## Platform variants

Executable paths for the two browsers covered here, other platforms
(standard install locations; not verified live on this repo's own
machine -- confirm before relying on them):

| Platform | Chrome | Brave |
|---|---|---|
| macOS | `/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` | `/Applications/Brave Browser.app/Contents/MacOS/Brave Browser` |
| Linux | `/usr/bin/google-chrome` | `/usr/bin/brave-browser` |
| Windows | `C:\Program Files\Google\Chrome\Application\chrome.exe` | `C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe` |
