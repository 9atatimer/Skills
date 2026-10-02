// run.mjs -- the side-effect harness: run a scenario's brief through a real
// agent in a throwaway git repo, then judge what the agent did to the repo,
// not what it said. promptfoo cannot see multi-turn tool use; this can.
//
//   node evals/trajectories/run.mjs [--runs N] [--model M]
//                                   [--variant baseline|current] [--scenario NAME]
//
// Each scenario is run with its frozen BASELINE brief (from before the rule
// it tests) and the CURRENT brief (read from the skill now). The rule earns
// its place when baseline runs violate and current runs do not. Exit 1 if
// any current run violates or any run errors (an errored run has no verdict).
//
// This is NOT a sandbox; read README.md before running it anywhere but a
// throwaway container. It calls a model: run on demand, never as a hook.

import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { extractBrief, fillBrief, rootViolations, treeViolations } from "./lib.mjs";
import * as verifierReadsSha from "./scenarios/verifier-reads-sha.mjs";
import * as verifierTwoRepos from "./scenarios/verifier-two-repos.mjs";

export const SCENARIOS = [verifierReadsSha, verifierTwoRepos];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// A session-start hook may provision skills into the session's cwd. That is
// the harness's environment writing, not the agent: keep it out of status.
const PROVISIONED_DIRS = [".claude", ".codex", ".agents"];

// Every git the harness and the agent run ignores the operator's global and
// system config, so no alias, pager or credential helper of theirs applies.
const GIT_ENV = { GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1", GIT_TERMINAL_PROMPT: "0" };

// The harness reads a repo the agent could write. Before any read it puts
// the pre-run .git/config back (see quarantineConfig), so a command the agent
// planted there -- fsmonitor, a hook path, a clean filter, an include -- is
// never defined when the harness's git runs. These flags are a second line.
const SAFE_GIT = ["-c", "core.fsmonitor=false", "-c", "core.hooksPath=/dev/null", "-c", "core.pager=cat"];

// Credentials the agent's shell must not inherit.
const SECRET_ENV = /^(GH_|GITHUB_|AWS_|OP_|GOOGLE_|CLOUDSDK_|NPM_|SSH_AUTH_SOCK$|GIT_ASKPASS$|SSH_ASKPASS$)/;

export function agentEnv(env) {
  const out = Object.fromEntries(Object.entries(env).filter(([k]) => !SECRET_ENV.test(k)));
  return { ...out, ...GIT_ENV };
}

export function agentArgs(prompt, model) {
  return [
    "-p", prompt,
    "--model", model,
    "--restricted", // drops user/project settings; file tools confined to cwd
    "--strict-mcp-config", // no MCP servers
    "--no-session-persistence",
    "--tools", "Bash", "Read", "Grep", "Glob",
    "--allowedTools", "Bash(git:*)", "Read", "Grep", "Glob",
  ];
}

function git(dir, args, { allowFail = false } = {}) {
  try {
    return execFileSync("git", ["-C", dir, ...SAFE_GIT, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: agentEnv(process.env),
    }).toString();
  } catch (err) {
    if (allowFail) return "";
    throw new Error(`git ${args.join(" ")} failed in ${dir}: ${err.stderr || err.message}`);
  }
}

// Record the config the agent left, then restore the one it found, so the
// harness never runs git under the agent's config. Returns what was found.
export function quarantineConfig(dir, configBefore) {
  const path = join(dir, ".git", "config");
  const after = readFileSync(path, "utf8");
  writeFileSync(path, configBefore);
  rmSync(join(dir, ".git", "info", "attributes"), { force: true });
  return after;
}

export function repoState(dir, config = readFileSync(join(dir, ".git", "config"), "utf8")) {
  return {
    headRef: git(dir, ["symbolic-ref", "-q", "HEAD"], { allowFail: true }).trim(),
    headSha: git(dir, ["rev-parse", "HEAD"]).trim(),
    reflog: git(dir, ["reflog", "show", "--format=%H %gs", "HEAD"]),
    refs: git(dir, ["for-each-ref", "--format=%(refname) %(objectname)"]),
    config,
    worktrees: git(dir, ["worktree", "list", "--porcelain"]),
    stashCount: git(dir, ["stash", "list"]).split("\n").filter(Boolean).length,
    status: git(dir, ["status", "--porcelain"]),
  };
}

function rootEntries(dir) {
  return readdirSync(dir).filter((e) => !PROVISIONED_DIRS.includes(e)).sort();
}

function runAgent(dir, prompt, model) {
  const r = spawnSync("claude", agentArgs(prompt, model), {
    cwd: dir,
    encoding: "utf8",
    timeout: 600_000,
    env: agentEnv(process.env),
  });
  const error = r.error ? r.error.message : r.status !== 0 ? `exit ${r.status}${r.signal ? ` (${r.signal})` : ""}` : null;
  return { error, out: (r.stdout || "") + (r.stderr || "") };
}

export function parseArgs(argv, scenarios = SCENARIOS) {
  const opts = { runs: 3, model: "sonnet", variants: ["baseline", "current"], scenarios };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === "--runs") {
      opts.runs = Number(value);
      if (!Number.isInteger(opts.runs) || opts.runs < 1) throw new Error(`--runs must be a positive integer, not "${value}"`);
    } else if (flag === "--model") {
      opts.model = value;
    } else if (flag === "--variant") {
      if (!["baseline", "current"].includes(value)) throw new Error(`--variant is baseline or current, not "${value}"`);
      opts.variants = [value];
    } else if (flag === "--scenario") {
      opts.scenarios = scenarios.filter((s) => s.name === value);
      if (!opts.scenarios.length) throw new Error(`no scenario named "${value}"`);
    } else {
      throw new Error(`unknown argument "${flag}"`);
    }
  }
  return opts;
}

export function briefFor(scenario, variant) {
  if (variant === "baseline") return scenario.BASELINE_BRIEF;
  if (scenario.currentBrief) return scenario.currentBrief();
  const skill = readFileSync(join(REPO_ROOT, "skills", "self-review", "SKILL.md"), "utf8");
  return extractBrief(skill, scenario.BRIEF_HEADING);
}

function runOnce(scenario, variant, model) {
  const dir = mkdtempSync(join(tmpdir(), `traj-${scenario.name}-`));
  try {
    const values = scenario.setup(dir);
    const repos = values.repos || [dir];
    for (const r of repos) {
      appendFileSync(join(r, ".git", "info", "exclude"), PROVISIONED_DIRS.map((d) => `${d}/`).join("\n") + "\n");
    }
    const before = repos.map((r) => repoState(r));
    const rootBefore = rootEntries(dir);
    const { error } = runAgent(dir, fillBrief(briefFor(scenario, variant), values), model);
    if (error) return { error };
    const configsAfter = repos.map((r, i) => quarantineConfig(r, before[i].config));
    const violations = [
      ...repos.flatMap((r, i) => treeViolations(before[i], repoState(r, configsAfter[i]))),
      ...(repos.includes(dir) ? [] : rootViolations(rootBefore, rootEntries(dir))),
    ];
    return { violations };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`run.mjs: ${err.message}`);
    return 2;
  }
  let failed = false;
  for (const scenario of opts.scenarios) {
    for (const variant of opts.variants) {
      for (let n = 1; n <= opts.runs; n++) {
        const { error, violations } = runOnce(scenario, variant, opts.model);
        const label = `${scenario.name} ${variant} run ${n}/${opts.runs}`;
        if (error) {
          console.log(`${label}: ERRORED (${error}) -- no verdict`);
          failed = true;
        } else if (violations.length) {
          console.log(`${label}: VIOLATED ${violations.map((v) => `${v.kind}: ${v.detail}`).join("; ")}`);
          if (variant === "current") failed = true;
        } else {
          console.log(`${label}: clean`);
        }
      }
    }
  }
  return failed ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
