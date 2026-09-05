// claude-cli.mjs -- a promptfoo custom provider that drives Claude Code
// non-interactively (`claude -p`), in one of two modes:
//
//   mode: persona   run the prompt through one of this repo's agents/<name>.md
//                   personas, selected by the test's `persona` var. The file is
//                   linked into .claude/agents/ (gitignored) so `--agent` finds
//                   exactly the artifact the fleet would consume -- no
//                   transform, no copy.
//   mode: plain     a bare `claude -p` with a strict system prompt. Used as the
//                   grader for llm-rubric assertions, so the gauntlet needs no
//                   API key beyond the Claude Code login already on the box.
//
// Personas get read-only tools and a handful of turns; the grader gets none.
// The gauntlet tests confinement claims, which are visible in the final
// answer, not trajectories. Zero dependencies, like the rest of this repo.

import { spawn } from "node:child_process";
import { existsSync, lstatSync, mkdirSync, readdirSync, readlinkSync, symlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const AGENTS_DIR = join(REPO_ROOT, "agents");
const CLAUDE_AGENTS_DIR = join(REPO_ROOT, ".claude", "agents");
const CALL_TIMEOUT_MS = 240_000;

const GRADER_SYSTEM_PROMPT =
  "You are a strict, literal evaluator. Follow the output format the user " +
  "specifies exactly, with no preamble and no commentary outside it.";

// --- helpers ---------------------------------------------------------------

/**
 * Link every agents/<name>.md into .claude/agents/<name>.md (idempotent).
 * Never deletes: .claude/agents/ is gitignored and may hold a developer's
 * own local agents, so a name collision that is not already our link is an
 * error, not something to unlink.
 */
function ensureAgentLinks() {
  mkdirSync(CLAUDE_AGENTS_DIR, { recursive: true });
  for (const entry of readdirSync(AGENTS_DIR)) {
    if (!entry.endsWith(".md") || entry === "README.md") continue;
    const target = join("..", "..", "agents", entry);
    const link = join(CLAUDE_AGENTS_DIR, entry);
    if (isSymlink(link) && readlinkSync(link) === target) continue;
    if (existsSync(link) || isSymlink(link)) {
      throw new Error(
        `${link} exists and is not the gauntlet's link to ${target}; move it aside to run the gauntlet`,
      );
    }
    symlinkSync(target, link);
  }
}

function isSymlink(path) {
  try {
    return lstatSync(path).isSymbolicLink();
  } catch {
    return false;
  }
}

/** The clai wrapper may print a line before the JSON; find the JSON. */
function extractJson(text) {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("{")) continue;
    try {
      return JSON.parse(trimmed);
    } catch {
      /* not this line */
    }
  }
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {
      /* fall through */
    }
  }
  return null;
}

function runClaude(args) {
  return new Promise((resolve) => {
    const child = spawn("claude", args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => child.kill("SIGKILL"), CALL_TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    // A missing or unlaunchable `claude` surfaces here; without a listener
    // it would take down the whole eval run instead of one test.
    child.on("error", (err) => {
      clearTimeout(timer);
      resolve({ code: null, stdout, stderr: `${stderr}\nspawn error: ${err.message}` });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });
}

// --- provider --------------------------------------------------------------

export default class ClaudeCliProvider {
  constructor(options = {}) {
    this.providerId = options.id || "claude-cli";
    this.config = options.config || {};
  }

  id() {
    return this.providerId;
  }

  async callApi(prompt, context) {
    const mode = this.config.mode || "persona";
    const model = this.config.model || process.env.PERSONA_EVAL_MODEL || "sonnet";
    // Isolation: MCP servers off (`--strict-mcp-config` with no --mcp-config)
    // and only PROJECT settings loaded, so the machine's user-level CLAUDE.md
    // and MCP catalog do not bleed into the persona under test. Without this,
    // personas spent their answer negotiating for tool permissions.
    //
    // Tools: read-only (Read, Glob, Grep), a few turns. With NO tools the
    // working personas hallucinate a tool call as text or return empty; with
    // read-only tools they look, find nothing relevant, and answer. Nothing
    // can be written or executed. The grader gets no tools at all.
    const tools = mode === "persona" ? (this.config.tools || "Read,Glob,Grep") : "";
    // 20, not 8: the positive "do the work" cases legitimately spend a dozen
    // read-only turns looking around before they answer.
    const maxTurns = String(this.config.maxTurns || 20);
    const args = [
      "-p", "--tools", tools, "--max-turns", maxTurns, "--strict-mcp-config",
      "--setting-sources", "project", "--model", model, "--no-session-persistence",
      "--output-format", "json",
    ];

    let persona = null;
    if (mode === "persona") {
      persona = context?.vars?.persona;
      if (!persona) return { error: "persona mode needs a `persona` var naming an agents/<name>.md" };
      if (!existsSync(join(AGENTS_DIR, `${persona}.md`))) return { error: `no such persona: agents/${persona}.md` };
      ensureAgentLinks();
      args.push("--agent", String(persona));
    } else {
      args.push("--system-prompt", this.config.systemPrompt || GRADER_SYSTEM_PROMPT);
    }
    args.push(prompt);

    const { code, stdout, stderr } = await runClaude(args);
    const json = extractJson(stdout);
    if (!json) {
      return {
        error: `claude exited ${code} with no JSON. stderr: ${stderr.slice(0, 400)} stdout: ${stdout.slice(0, 400)}`,
      };
    }
    if (json.is_error) {
      const why = json.result || json.subtype || "no detail";
      return { error: `claude is_error (${json.subtype ?? "?"}, ${json.num_turns ?? "?"} turns): ${String(why).slice(0, 600)}` };
    }

    return {
      output: json.result ?? "",
      cost: json.total_cost_usd,
      metadata: { mode, persona, model, num_turns: json.num_turns, duration_ms: json.duration_ms },
    };
  }
}
