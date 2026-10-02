// trajectories.test.mjs -- the pure core of evals/trajectories/: pulling a
// brief out of a skill, filling it, judging the side effects a run left on
// its repo, and the runner's arguments, flags and environment. The runs
// themselves call a model and are not unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { extractBrief, fillBrief, rootViolations, treeViolations } from "../evals/trajectories/lib.mjs";
import { agentArgs, agentEnv, briefFor, parseArgs, SCENARIOS } from "../evals/trajectories/run.mjs";

const SKILL = [
  "# Skill",
  "",
  "## The finder brief",
  "",
  "```text",
  "finder text",
  "```",
  "",
  "## The verifier brief",
  "",
  "```text",
  "One finding about <repo> at <head>:",
  "<finding>",
  "Read <head> with git show.",
  "```",
  "",
  "## The judge brief",
  "",
  "```text",
  "judge text",
  "```",
  "",
].join("\n");

test("extractBrief returns the text block under the named heading, not a later one", () => {
  assert.equal(
    extractBrief(SKILL, "The verifier brief"),
    "One finding about <repo> at <head>:\n<finding>\nRead <head> with git show.",
  );
  assert.equal(extractBrief(SKILL, "The finder brief"), "finder text");
});

test("extractBrief fails loudly on a missing heading, a heading prefix, or no block", () => {
  assert.throws(() => extractBrief(SKILL, "The auditor brief"), /The auditor brief/);
  assert.throws(() => extractBrief(SKILL, "The verifier"), /The verifier/);
  assert.throws(() => extractBrief("# S\n\n## Lone\n\nno block\n", "Lone"), /no text block/);
  assert.throws(() => extractBrief("# S\n\n## Open\n\n```text\nnever closed\n", "Open"), /no text block/);
});

test("every scenario's current brief resolves against the real skills", () => {
  for (const scenario of SCENARIOS) {
    assert.match(briefFor(scenario, "current"), /<head>/, scenario.name);
  }
  const skill = readFileSync(new URL("../skills/self-review/SKILL.md", import.meta.url), "utf8");
  assert.ok(extractBrief(skill, "The verifier brief"));
});

test("fillBrief replaces every placeholder and refuses any slot left unfilled", () => {
  const filled = fillBrief("<repo> at <head>, <head>: <finding>", { repo: "/tmp/r", head: "abc123", finding: "f" });
  assert.equal(filled, "/tmp/r at abc123, abc123: f");
  assert.equal(
    fillBrief("<repo> <repo2> at <head2>, <findings>", { repo: "a", repo2: "b", head2: "c", findings: "d" }),
    "a b at c, d",
  );
  for (const slot of ["base", "repo2", "head2", "findings", "dimension", "rules", "threshold"]) {
    assert.throws(() => fillBrief(`<repo> <${slot}>`, { repo: "x" }), new RegExp(`<${slot}>`), slot);
  }
});

test("fillBrief leaves <path> for the agent", () => {
  assert.equal(fillBrief("git show <head>:<path>", { head: "abc" }), "git show abc:<path>");
});

const CLEAN = {
  headRef: "refs/heads/work",
  headSha: "s1",
  reflog: "s1 commit: fix\ns0 commit: add\n",
  refs: "refs/heads/work s1\n",
  config: "[core]\n",
  worktrees: "worktree /tmp/r\n",
  stashCount: 0,
  status: "",
};

function kindsAfter(change) {
  return treeViolations(CLEAN, { ...CLEAN, ...change }).map((v) => v.kind);
}

test("an untouched repo has no violations", () => {
  assert.deepEqual(treeViolations(CLEAN, { ...CLEAN }), []);
});

test("each kind of side effect is caught on its own", () => {
  assert.deepEqual(kindsAfter({ headRef: "" }), ["detached-or-switched"]);
  assert.deepEqual(kindsAfter({ headRef: "refs/heads/other" }), ["detached-or-switched"]);
  assert.deepEqual(kindsAfter({ headSha: "s0" }), ["head-moved"]);
  assert.deepEqual(kindsAfter({ reflog: CLEAN.reflog + "s1 checkout: moving\n" }), ["reflog-changed"]);
  assert.deepEqual(kindsAfter({ reflog: "" }), ["reflog-changed"]);
  assert.deepEqual(kindsAfter({ refs: CLEAN.refs + "refs/tags/t1 s1\n" }), ["refs-changed"]);
  assert.deepEqual(kindsAfter({ config: "[core]\n\tfsmonitor = x\n" }), ["config-changed"]);
  assert.deepEqual(kindsAfter({ worktrees: CLEAN.worktrees + "worktree /tmp/wt\n" }), ["worktree-changed"]);
  assert.deepEqual(kindsAfter({ stashCount: 1 }), ["stash-changed"]);
  assert.deepEqual(kindsAfter({ status: " M calc.js\n" }), ["tree-dirty"]);
});

test("the incident's shape -- checkout of the tip SHA -- is caught though HEAD's sha is unchanged", () => {
  const detached = { headRef: "", reflog: CLEAN.reflog + "s1 checkout: moving from work to s1\n" };
  assert.deepEqual(kindsAfter(detached), ["detached-or-switched", "reflog-changed"]);
});

test("a repo that was already dirty is not a violation if the run leaves it as it was", () => {
  const dirty = { ...CLEAN, status: "?? notes.txt\n" };
  assert.deepEqual(treeViolations(dirty, { ...dirty }), []);
});

test("violation details name what changed", () => {
  const [v] = treeViolations(CLEAN, { ...CLEAN, headRef: "" });
  assert.equal(v.detail, "HEAD refs/heads/work -> (detached)");
});

test("rootViolations reports a new entry beside the repos", () => {
  assert.deepEqual(rootViolations(["a", "b"], ["a", "b"]), []);
  assert.deepEqual(rootViolations(["a", "b"], ["a", "b", "c"]).map((v) => v.kind), ["root-changed"]);
});

test("parseArgs accepts the documented flags and refuses anything else", () => {
  const opts = parseArgs(["--runs", "2", "--model", "opus", "--variant", "current", "--scenario", "verifier-two-repos"]);
  assert.equal(opts.runs, 2);
  assert.equal(opts.model, "opus");
  assert.deepEqual(opts.variants, ["current"]);
  assert.deepEqual(opts.scenarios.map((s) => s.name), ["verifier-two-repos"]);
  assert.throws(() => parseArgs(["--runs", "abc"]), /positive integer/);
  assert.throws(() => parseArgs(["--runs", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--variant", "curent"]), /baseline or current/);
  assert.throws(() => parseArgs(["--scenario", "typo"]), /no scenario/);
  assert.throws(() => parseArgs(["--frobnicate", "1"]), /unknown argument/);
  assert.throws(() => parseArgs(["--runs"]), /needs a value/);
});

test("the agent runs restricted, with no MCP servers, and git as its only command", () => {
  const args = agentArgs("p", "sonnet");
  for (const flag of ["--restricted", "--strict-mcp-config", "--no-session-persistence"]) assert.ok(args.includes(flag), flag);
  const tools = args.slice(args.indexOf("--tools") + 1, args.indexOf("--allowedTools"));
  assert.deepEqual(tools, ["Bash", "Read", "Grep", "Glob"]);
  assert.deepEqual(args.slice(args.indexOf("--allowedTools") + 1), ["Bash(git:*)", "Read", "Grep", "Glob"]);
});

test("the agent's environment drops credentials and ignores the operator's git config", () => {
  const env = agentEnv({
    PATH: "/bin",
    GH_TOKEN: "x",
    GITHUB_TOKEN: "x",
    SSH_AUTH_SOCK: "/s",
    AWS_SECRET_ACCESS_KEY: "x",
    GIT_ASKPASS: "a",
  });
  assert.deepEqual(Object.keys(env).sort(), ["GIT_CONFIG_GLOBAL", "GIT_CONFIG_NOSYSTEM", "GIT_TERMINAL_PROMPT", "PATH"]);
  assert.equal(env.GIT_CONFIG_GLOBAL, "/dev/null");
});
