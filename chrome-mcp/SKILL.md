---
name: chrome-mcp
description: "Giving an agent control of Chrome -- standalone Chrome-for-Testing via chrome-devtools-mcp for extension development, e2e testing, scraping, or UI verification -- without touching the user's real browser profile. Skip for server-only projects or anything without a browser surface."
---

# SKILL: Chrome MCP -- Giving an Agent Control of Chrome

> **Purpose:** Set up a standalone Chrome instance an AI coding agent can
> drive without polluting your main browser or enabling remote debugging
> on your real profile.
> **When to use:** Any project where the agent needs to operate a Chrome
> page (extension development, e2e testing, scraping, UI verification).
> **Skip:** Server-only projects, anything without a browser surface.
> **Platform scope:** The scripts below are **macOS arm64 (Apple Silicon)**
> only. See [Platform variants](#platform-variants) at the bottom for the
> directory and executable paths on macOS x64 / Linux / Windows.

## TL;DR

Use **Chrome for Testing (CfT)** -- Google's official "for automation"
Chromium build -- installed per-project into `~/.cache/<project>-cft/`,
launched on demand by [`chrome-devtools-mcp`][cdm] via a tiny wrapper
script registered in the project's `.mcp.json`. Your main Chrome stays
untouched; no `chrome://inspect/#remote-debugging` toggle anywhere.

[cdm]: https://github.com/ChromeDevTools/chrome-devtools-mcp

## Why not your main Chrome

Attaching the MCP to your normal Chrome via `--autoConnect`:

1. Requires `chrome://inspect/#remote-debugging` enabled on your real
   profile -- persistent toggle, sets `navigator.webdriver = true`, ships
   an "automation" banner.
2. Pops a permission dialog on every agent attach.
3. Means every agent session sees your real cookies and bookmarks.

## Why not just let the MCP launch its own Chrome

`chrome-devtools-mcp`'s default is to launch a fresh Chromium with
`--enable-automation`. As of Chrome 142:

1. **`--load-extension` was silently removed** for branded Chrome under
   `--enable-automation`. The "Extension loaded" toast appears; nothing
   loads. See [seleniumbase issue #4053][selb].
2. **All extension installs are blocked** in `--enable-automation`
   Chromes: Web Store, Load unpacked, command line. Nothing works.

[selb]: https://github.com/seleniumbase/SeleniumBase/issues/4053

The exception is **Chrome for Testing, unbranded Chromium, and other
Chromium browsers (e.g. Brave)** -- those still honour
`--load-extension`. We use CfT because it's Google's official "for
automation" build and looks/feels like Chrome.

## The wiring

```
~/.cache/<project>-cft/
+-- browser/                       # CfT binary (~250MB, installed by script)
|   +-- chrome/mac_arm-<version>/...
+-- userdata/                      # CfT profile (logins persist here)

<project-repo>/
+-- scripts/cft/
|   +-- install.sh                 # idempotent CfT install via @puppeteer/browsers
|   +-- path.sh                    # print latest CfT binary path
|   +-- mcp-launch.sh              # exec chrome-devtools-mcp w/ CfT + extension preloaded
+-- .mcp.json                      # project-scoped MCP entry -> mcp-launch.sh
+-- apps/<your-extension>/         # (optional) extension to preload
```

## Setup recipe

### 1. Drop these three scripts into your repo

Replace `<project>` everywhere with your project name. If you have no
extension to preload, delete the `--chrome-arg` line in `mcp-launch.sh`
and the `EXTENSION_DIR` variable.

**`scripts/cft/install.sh`** -- idempotent installer:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Pin both tools for reproducibility. Bump intentionally; see release notes.
PUPPETEER_BROWSERS_VERSION="3.0.3"
CFT_HOME="${CFT_HOME:-$HOME/.cache/<project>-cft}"
CFT_BROWSER_DIR="$CFT_HOME/browser"
mkdir -p "$CFT_BROWSER_DIR"
if find "$CFT_BROWSER_DIR" -type f -name 'Google Chrome for Testing' \
     -path '*/chrome-mac-arm64/*' -print -quit 2>/dev/null | grep -q .; then
  echo "[install-cft] CfT already installed under $CFT_BROWSER_DIR"
  exit 0
fi
echo "[install-cft] Installing chrome@stable to $CFT_BROWSER_DIR ..."
npx -y "@puppeteer/browsers@${PUPPETEER_BROWSERS_VERSION}" install chrome@stable --path="$CFT_BROWSER_DIR"
```

**`scripts/cft/path.sh`** -- resolves the binary path:

```bash
#!/usr/bin/env bash
set -euo pipefail
CFT_HOME="${CFT_HOME:-$HOME/.cache/<project>-cft}"
# Guard the directory check explicitly so we fall through to the friendly
# error below instead of aborting under `set -euo pipefail` when nothing
# is installed yet.
[[ -d "$CFT_HOME/browser/chrome" ]] || \
  { echo "no CfT install; run install.sh" >&2; exit 1; }
# Pick newest install by mtime (portable on BSD/macOS -- `sort -V` is GNU-only).
# In practice @puppeteer/browsers leaves only the most recent version installed,
# so this returns a single dir; the `head -1` is defensive against version stacks.
# Trailing `|| true` keeps the pipeline non-fatal under pipefail if the
# glob matches nothing (the [[ -z "$LATEST" ]] check below then triggers).
LATEST=$(ls -dt "$CFT_HOME"/browser/chrome/mac_arm-* 2>/dev/null | head -1 || true)
[[ -z "$LATEST" ]] && { echo "no CfT install; run install.sh" >&2; exit 1; }
echo "$LATEST/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing"
```

**`scripts/cft/mcp-launch.sh`** -- wrapper the agent's MCP client invokes:

```bash
#!/usr/bin/env bash
set -euo pipefail
# Pin chrome-devtools-mcp for reproducibility. Bump intentionally.
CDM_VERSION="1.0.1"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CFT_HOME="${CFT_HOME:-$HOME/.cache/<project>-cft}"
USER_DATA_DIR="$CFT_HOME/userdata"
EXTENSION_DIR="$REPO_ROOT/apps/<your-extension>"     # delete if no extension
"$SCRIPT_DIR/install.sh" >&2
CFT_BIN="$("$SCRIPT_DIR/path.sh")"
mkdir -p "$USER_DATA_DIR"
exec npx -y "chrome-devtools-mcp@${CDM_VERSION}" \
  --executable-path "$CFT_BIN" \
  --user-data-dir "$USER_DATA_DIR" \
  --category-extensions \
  --chrome-arg="--load-extension=$EXTENSION_DIR"      # delete line if no extension
```

`chmod +x scripts/cft/*.sh`.

### 2. Register the MCP server, project-scoped

The agent-neutral requirements: register the server at **project scope**
(so the entry lives in the repo and other agents/collaborators see it),
**never** in the agent's user/global MCP config (see
[Etiquette](#etiquette)). Longer term, the canonical home for this wiring
is template-tools' MCP manifest (`mcp/manifest.json` + `clai provision`),
which exists precisely to abstract per-agent MCP registration.

In Claude Code, project scope means the project's `.mcp.json` (the
user/global config to avoid is `~/.claude.json`); other agents: their
project-scoped equivalent.

```json
{
  "mcpServers": {
    "chrome-<project>": {
      "type": "stdio",
      "command": "./scripts/cft/mcp-launch.sh",
      "args": [],
      "env": {}
    }
  }
}
```

### 3. Run once to install

```bash
scripts/cft/install.sh
```

### 4. Restart the agent in the project

Restart your coding agent (e.g. Claude Code) so it picks up the new MCP
entry; on first MCP tool call, the wrapper launches
CfT with your extension preloaded. First time, you'll need to log into
whatever site you care about in CfT -- that login persists across sessions
in `$CFT_HOME/userdata`.

## Identifying the CfT window

- macOS dock icon: blue with a beaker/Erlenmeyer flask (distinct from
  regular Chrome's red/yellow/green/blue circle).
- macOS app menu: "Chrome for Testing" (not "Google Chrome").
- About-Chrome: `Executable Path` will be under `~/.cache/<project>-cft/`.

## Etiquette

- **Don't load development extensions into your main Chrome** for an
  agent-driven project. CfT is the development browser.
- **Don't pollute the agent's user/global MCP config** (in Claude Code,
  `~/.claude.json`) with project-specific MCP entries. Use the
  project-scoped config (in Claude Code, `.mcp.json`) so it lives in the
  repo and other agents/collaborators see it.
- **Don't expect the user to manage the CfT window** in normal operation.
  It opens on demand; they only need to log into the target site once.
- **Don't enable `chrome://inspect/#remote-debugging`** on the user's
  main Chrome to work around setup issues. If CfT isn't launching,
  diagnose the wrapper; don't fall back to attaching to main Chrome.

## When things go wrong

- **`Could not find DevToolsActivePort`** -- wrapper didn't launch CfT.
  Run `scripts/cft/mcp-launch.sh` manually to see the real error.
- **Extension not visible at `chrome://extensions`** -- confirm
  `--load-extension=<repo>/apps/<your-extension>` is in the launched
  Chrome's argv (`ps aux | grep 'for Testing'`). If yes but no entry,
  inspect the extension manifest for parse errors.
- **Login lost after session** -- `$CFT_HOME/userdata` got nuked or
  changed. Confirm it exists and is writeable.

## When to promote this pattern to its own package

If three or more projects end up copying these scripts verbatim, promote
to a shipped `@nine-at-a-time-media/dev-chrome` package: scripts become
package bin entries, `.mcp.json` calls the package binary instead of
local scripts, version-bumping cascades cleanly. Until then, the
copy-paste cost is lower than the package-management cost.

## Platform variants

The scripts above are **macOS arm64**. For other platforms, the
`@puppeteer/browsers` install layout and the inner binary path change as
follows; adapt `install.sh`'s `find` predicate, `path.sh`'s glob, and the
binary-path suffix accordingly.

| Platform | Install dir suffix | Inner subdir | Binary |
|---|---|---|---|
| macOS arm64 | `mac_arm-<version>` | `chrome-mac-arm64` | `Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` |
| macOS x64 | `mac-<version>` | `chrome-mac-x64` | `Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing` |
| Linux x64 | `linux-<version>` | `chrome-linux64` | `chrome` |
| Windows x64 | `win64-<version>` | `chrome-win64` | `chrome.exe` |

When this pattern actually needs to run on Linux/Windows in anger, the
right move is to promote to a `@nine-at-a-time-media/dev-chrome` package
that detects platform internally and exposes a single bin script --
rather than maintaining N copies of platform-branching shell.
