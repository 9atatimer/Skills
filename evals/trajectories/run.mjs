// run.mjs -- the side-effect harness: run a scenario's brief through a real
// agent in a throwaway git repo, then judge what the agent did to the repo,
// not what it said. promptfoo cannot see multi-turn tool use; this can.
//
//   node evals/trajectories/run.mjs [--runs N] [--model M] [--variant baseline|current] [--scenario NAME]
//
// Each scenario is run with its frozen BASELINE brief (from before the rule
// it tests) and the CURRENT brief (read from the skill now). The rule earns
// its place when baseline runs violate and current runs do not. Exit 1 if
// any current run violates.
//
// Bash is limited to git ("Bash(git:*)") plus Read/Grep/Glob, so a run can
// change nothing but its own temp repo. It calls a model: run on demand,
// never as a hook (evals/README.md).

import { execFileSync, spawnSync } from "node:child_process";
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { extractBrief, fillBrief, treeViolations } from "./lib.mjs";
import * as verifierReadsSha from "./scenarios/verifier-reads-sha.mjs";
import * as verifierTwoRepos from "./scenarios/verifier-two-repos.mjs";

const SCENARIOS = [verifierReadsSha, verifierTwoRepos];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

// A session-start hook may provision skills into the session's cwd. That is
// the harness's environment writing, not the agent: keep it out of status.
const PROVISIONED_DIRS = [".claude/", ".codex/", ".agents/"];

function git(dir, ...args) {
  try {
    return execFileSync("git", ["-C", dir, ...args], { stdio: ["ignore", "pipe", "ignore"] }).toString();
  } catch {
    return "";
  }
}

function repoState(dir) {
  return {
    headRef: git(dir, "symbolic-ref", "-q", "HEAD").trim(),
    headSha: git(dir, "rev-parse", "HEAD").trim(),
    reflogCount: git(dir, "reflog", "show", "HEAD").split("\n").filter(Boolean).length,
    stashCount: git(dir, "stash", "list").split("\n").filter(Boolean).length,
    status: git(dir, "status", "--porcelain"),
  };
}

function runAgent(dir, prompt, model) {
  const r = spawnSync(
    "claude",
    ["-p", prompt, "--model", model, "--allowedTools", "Bash(git:*)", "Read", "Grep", "Glob"],
    { cwd: dir, encoding: "utf8", timeout: 600_000 },
  );
  return { code: r.status, out: (r.stdout || "") + (r.stderr || "") };
}

function parseArgs(argv) {
  const opts = { runs: 3, model: "sonnet", variants: ["baseline", "current"] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--runs") opts.runs = Number(argv[++i]);
    else if (argv[i] === "--model") opts.model = argv[++i];
    else if (argv[i] === "--variant") opts.variants = [argv[++i]];
    else if (argv[i] === "--scenario") opts.scenario = argv[++i];
  }
  return opts;
}

function briefFor(scenario, variant) {
  if (variant === "baseline") return scenario.BASELINE_BRIEF;
  if (scenario.currentBrief) return scenario.currentBrief();
  const skill = readFileSync(join(REPO_ROOT, "skills", "self-review", "SKILL.md"), "utf8");
  return extractBrief(skill, scenario.BRIEF_HEADING);
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  let currentViolated = false;
  for (const scenario of SCENARIOS.filter((s) => !opts.scenario || s.name === opts.scenario)) {
    for (const variant of opts.variants) {
      for (let n = 1; n <= opts.runs; n++) {
        const dir = mkdtempSync(join(tmpdir(), `traj-${scenario.name}-`));
        try {
          const values = scenario.setup(dir);
          const repos = values.repos || [dir];
          for (const r of repos) appendFileSync(join(r, ".git", "info", "exclude"), PROVISIONED_DIRS.join("\n") + "\n");
          const before = repos.map(repoState);
          const { code } = runAgent(dir, fillBrief(briefFor(scenario, variant), values), opts.model);
          const violations = repos.flatMap((r, i) => treeViolations(before[i], repoState(r)));
          const verdict = violations.length ? `VIOLATED ${violations.map((v) => v.detail).join("; ")}` : "clean";
          console.log(`${scenario.name} ${variant} run ${n}/${opts.runs} (agent exit ${code}): ${verdict}`);
          if (variant === "current" && violations.length) currentViolated = true;
        } finally {
          rmSync(dir, { recursive: true, force: true });
        }
      }
    }
  }
  return currentViolated ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
