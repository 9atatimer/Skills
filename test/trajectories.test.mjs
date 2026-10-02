// trajectories.test.mjs -- the pure core of evals/trajectories/: pulling a
// brief out of a skill, filling it, and judging the side effects a run left
// on its repo. The runs themselves call a model and are not unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";

import { extractBrief, fillBrief, treeViolations } from "../evals/trajectories/lib.mjs";

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
].join("\n");

test("extractBrief returns the text block under the named heading", () => {
  assert.equal(
    extractBrief(SKILL, "The verifier brief"),
    "One finding about <repo> at <head>:\n<finding>\nRead <head> with git show.",
  );
});

test("extractBrief fails loudly when the heading or block is missing", () => {
  assert.throws(() => extractBrief(SKILL, "The judge brief"), /The judge brief/);
});

test("fillBrief replaces every placeholder and refuses one left unfilled", () => {
  const filled = fillBrief("<repo> at <head>, <head>: <finding>", {
    repo: "/tmp/r",
    head: "abc123",
    finding: "f",
  });
  assert.equal(filled, "/tmp/r at abc123, abc123: f");
  assert.throws(() => fillBrief("<repo> <base>", { repo: "x" }), /<base>/);
  assert.equal(fillBrief("git show <head>:<path>", { head: "abc" }), "git show abc:<path>");
  assert.equal(fillBrief("<repo> <repo2> at <head2>", { repo: "a", repo2: "b", head2: "c" }), "a b at c");
});

const CLEAN = { headRef: "refs/heads/work", headSha: "s1", reflogCount: 3, stashCount: 0, status: "" };

test("an untouched repo has no violations", () => {
  assert.deepEqual(treeViolations(CLEAN, { ...CLEAN }), []);
});

test("a detached HEAD, a moved HEAD, new reflog entries, a stash and a dirty tree are each violations", () => {
  const after = {
    headRef: "",
    headSha: "s0",
    reflogCount: 4,
    stashCount: 1,
    status: " M calc.js",
  };
  assert.deepEqual(
    treeViolations(CLEAN, after).map((v) => v.kind),
    ["detached-or-switched", "head-moved", "reflog-grew", "stash-created", "tree-dirty"],
  );
});
