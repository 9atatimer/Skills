// publicity-guard.test.mjs -- behavioral tests for the pure core of
// scripts/publicity-guard.mjs (parsing, matching, allowlist enforcement).
// Same runner deviation as stamp.test.mjs: node:test keeps the package
// dependency-free. The git-plumbing modes are exercised by running the
// hooks, not here -- no repo fixtures, no subprocess I/O.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseTermList,
  scanText,
  checkSkillPaths,
  isAsciiProsePath,
  scanAscii,
} from "../scripts/publicity-guard.mjs";

test("parseTermList drops comments, blanks, and case", () => {
  const terms = parseTermList("# header\n\nAlpha\n  beta  \n# tail\n");
  assert.deepEqual(terms, ["alpha", "beta"]);
});

test("scanText finds a term with its line number and category", () => {
  const findings = scanText("skills/x/SKILL.md", "ok line\na badword here\n", [
    "badword",
  ], "test");
  assert.deepEqual(findings, [
    { path: "skills/x/SKILL.md", line: 2, term: "badword", category: "test" },
  ]);
});

test("scanText respects word boundaries", () => {
  const hits = scanText("f", "sussex is a county; class dismissed", [
    "sex",
    "ass",
  ], "test");
  assert.deepEqual(hits, []);
});

test("scanText matches case-insensitively and inside phrases", () => {
  const hits = scanText("f", "This is BadWord territory", ["badword"], "test");
  assert.equal(hits.length, 1);
});

test("scanText matches multi-word terms across space, dash, underscore", () => {
  for (const text of ["trade secret", "trade-secret", "trade_secret"]) {
    assert.equal(scanText("f", text, ["trade secret"], "t").length, 1, text);
  }
});

test("scanText flags a term appearing in the path itself", () => {
  const hits = scanText("skills/badword/SKILL.md", "clean", ["badword"], "t");
  assert.deepEqual(hits, [
    { path: "skills/badword/SKILL.md", line: 0, term: "badword", category: "t" },
  ]);
});

test("checkSkillPaths blocks a skill directory missing from the manifest", () => {
  const manifest = "# comment\nlisted\n";
  const findings = checkSkillPaths(
    ["skills/listed/SKILL.md", "skills/rogue/SKILL.md", "README.md"],
    manifest,
  );
  assert.equal(findings.length, 1);
  assert.equal(findings[0].path, "skills/rogue/SKILL.md");
  assert.equal(findings[0].term, "rogue");
});

test("checkSkillPaths ignores top-level files under skills/", () => {
  assert.deepEqual(checkSkillPaths(["skills/README.md"], "anything"), []);
});


test("isAsciiProsePath covers payload markdown and root docs only", () => {
  assert.equal(isAsciiProsePath("skills/x/SKILL.md"), true);
  assert.equal(isAsciiProsePath("agents/sre.md"), true);
  assert.equal(isAsciiProsePath("README.md"), true);
  assert.equal(isAsciiProsePath("docs/arch/topo.html"), false);
  assert.equal(isAsciiProsePath("evals/README.md"), false);
  assert.equal(isAsciiProsePath("scripts/x.mjs"), false);
});

test("scanAscii names the first offending code point per line", () => {
  const hits = scanAscii("skills/x/SKILL.md", "fine\nbad \u2014 dash \u2026\nok\n");
  assert.equal(hits.length, 1);
  assert.equal(hits[0].line, 2);
  assert.match(hits[0].term, /^U\+2014/);
  assert.equal(hits[0].category, "non-ASCII in prose (sdlc law 12)");
});

test("scanAscii passes plain ASCII including -- and ->", () => {
  assert.deepEqual(scanAscii("agents/x.md", "a -- b -> c ... 'd'\n"), []);
});
