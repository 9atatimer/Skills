// run.mjs -- loading tests: does an agent load the right skill for a prompt,
// and leave it alone for a near-miss? skill-creator's method, run against
// this tree's own SKILL.md descriptions.
//
//   node evals/loading/run.mjs [--model M] [--skill NAME] [--jobs N]
//
// Each case runs `claude -p` in a temp dir whose .claude/skills is a copy of
// this repo's skills/, with Skill as the only tool and only project settings
// loaded, then reads which skills it loaded from the stream. It prints a
// table per skill and every wrong case. It calls a model once per case:
// run it on demand, after editing a description, never as a hook.

import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { CASES } from "./cases.mjs";
import { loadedSkills, score } from "./lib.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

export function parseArgs(argv) {
  const opts = { model: "sonnet", skill: null, jobs: 4 };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[++i];
    if (value === undefined) throw new Error(`${flag} needs a value`);
    if (flag === "--model") opts.model = value;
    else if (flag === "--skill") {
      if (!CASES.some((c) => c.skill === value)) throw new Error(`no cases for skill "${value}"`);
      opts.skill = value;
    } else if (flag === "--jobs") {
      opts.jobs = Number(value);
      if (!Number.isInteger(opts.jobs) || opts.jobs < 1) throw new Error(`--jobs must be a positive integer, not "${value}"`);
    } else throw new Error(`unknown argument "${flag}"`);
  }
  return opts;
}

function runCase(c, model) {
  const dir = mkdtempSync(join(tmpdir(), "loading-"));
  cpSync(join(REPO_ROOT, "skills"), join(dir, ".claude", "skills"), { recursive: true });
  const args = [
    "-p", c.prompt,
    "--model", model,
    "--setting-sources", "project",
    "--strict-mcp-config",
    "--no-session-persistence",
    "--tools", "Skill",
    "--max-turns", "3",
    "--output-format", "stream-json",
    "--verbose",
  ];
  return new Promise((resolve) => {
    const child = spawn("claude", args, { cwd: dir, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    const timer = setTimeout(() => child.kill("SIGTERM"), 300_000);
    const finish = (error) => {
      clearTimeout(timer);
      rmSync(dir, { recursive: true, force: true });
      resolve(error ? { ...c, error } : { ...c, loaded: loadedSkills(out) });
    };
    child.on("error", (err) => finish(err.message));
    // --max-turns can end a run with a nonzero exit after the Skill call;
    // the stream still says what loaded, so only a run with no stream errors.
    child.on("close", (code, signal) => finish(out.trim() ? null : `exit ${code}${signal ? ` (${signal})` : ""}, no output`));
  });
}

async function pool(items, jobs, fn) {
  const out = [];
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: jobs }, worker));
  return out;
}

async function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(`run.mjs: ${err.message}`);
    return 2;
  }
  const cases = CASES.filter((c) => !opts.skill || c.skill === opts.skill);
  const results = await pool(cases, opts.jobs, (c) => runCase(c, opts.model));
  for (const r of results) {
    if (r.error) console.log(`ERRORED ${r.skill}: "${r.prompt}" (${r.error})`);
    else if (r.loaded.includes(r.skill) !== r.expect) {
      const what = r.expect ? "MISSED" : "FALSE LOAD";
      console.log(`${what} ${r.skill}: "${r.prompt}" loaded [${r.loaded.join(", ")}]`);
    }
  }
  console.log("\nskill            hit/should  rejected/near-miss  errored");
  for (const [skill, s] of Object.entries(score(results))) {
    const should = s.hit + s.miss;
    const near = s.rejected + s.falseLoad;
    console.log(`${skill.padEnd(16)} ${`${s.hit}/${should}`.padEnd(11)} ${`${s.rejected}/${near}`.padEnd(19)} ${s.errored || 0}`);
  }
  return results.some((r) => r.error) ? 1 : 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(await main());
}
