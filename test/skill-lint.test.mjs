// skill-lint.test.mjs -- behavioral tests for scripts/skill-lint.mjs.
// Each check has a failing fixture (a tree that breaks one rule) and the
// real tree must pass whole. Same runner deviation as the other tests:
// node:test keeps the package dependency-free.

import { test } from "node:test";
import assert from "node:assert/strict";

import { lintTree, readTree, estimateTokens } from "../scripts/skill-lint.mjs";

function skill(name, body, description = `Does ${name} things.`) {
  return `---\nname: ${name}\ndescription: "${description}"\n---\n\n${body}\n`;
}

function tree(entries) {
  return new Map(Object.entries(entries));
}

function checks(findings) {
  return findings.map((f) => f.check);
}

test("a clean tree has no findings", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill(
      "alpha",
      "# Alpha\n\n## Zero Unreviewed Code (CRITICAL)\n\nSee the beta skill, Sizing.\n",
    ),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n\n## Sizing\n\nBack to the alpha skill's Zero Unreviewed Code.\n"),
  });
  assert.deepEqual(lintTree(files), []);
});

test("a reference to a skill that does not exist is a finding, with its line", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\nok\nsee the hosting skill for why\n"),
  });
  const findings = lintTree(files);
  assert.deepEqual(checks(findings), ["skill-ref"]);
  assert.equal(findings[0].path, "skills/alpha/SKILL.md");
  assert.equal(findings[0].line, 9);
  assert.match(findings[0].message, /hosting/);
});

test("a backticked skill reference wrapped across lines still resolves", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\nload the\n`beta` skill now\n"),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n"),
  });
  assert.deepEqual(lintTree(files), []);
});

test("generic English before 'skill' is not a reference", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\nload the companion skill, or the relevant skill.\n"),
  });
  assert.deepEqual(lintTree(files), []);
});

test("agent personas are checked for skill references too", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n"),
    "agents/sre.md": "# SRE\n\nThe gamma skill is your authority.\n",
  });
  assert.deepEqual(checks(lintTree(files)), ["skill-ref"]);
});

test("a cited section that no heading in the target skill starts is a finding", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\n(the beta skill, Spend Review Turns on Load-Bearing Fixes)\n"),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n\n## Earn the next review\n"),
  });
  const findings = lintTree(files);
  assert.deepEqual(checks(findings), ["section-ref"]);
  assert.match(findings[0].message, /Spend Review Turns/);
});

test("a possessive section reference must resolve", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\nthe beta skill's Reviewer Selection says so.\n"),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n\n## Sizing\n"),
  });
  assert.deepEqual(checks(lintTree(files)), ["section-ref"]);
});

test("a parenthesized section after a skill name must resolve", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill(
      "alpha",
      "# Alpha\n\nper the beta skill (Spend Review Turns), and the beta\nskill's sense (Spend Review Turns).\n",
    ),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n\n## Earn the next review\n"),
  });
  assert.deepEqual(checks(lintTree(files)), ["section-ref", "section-ref"]);
});

test("a local (X, above) reference must name a heading in the same file", () => {
  const ok = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\n## Sizing\n\nas sized (Sizing, above).\n"),
  });
  assert.deepEqual(lintTree(ok), []);
  const bad = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\n## Sizing\n\nas noted (Documentation-only changes, below).\n"),
  });
  assert.deepEqual(checks(lintTree(bad)), ["section-ref"]);
});

test("section references resolve 'Section N', a leading 'The', and a bold term", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill(
      "alpha",
      "# Alpha\n\nthe beta skill, Section 13. The beta skill's ReviewEngine port.\n" +
        "The beta skill's Trace, Purity, and Wiring tests.\n",
    ),
    "skills/beta/SKILL.md": skill(
      "beta",
      "# Beta\n\n# 13. Mutation Testing\n\n## The ReviewEngine port\n\n| **Trace test** | x |\n",
    ),
  });
  assert.deepEqual(lintTree(files), []);
});

test("headings inside a fenced code block do not count", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\nthe beta skill, Imports\n"),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n\n```python\n# Imports\n```\n"),
  });
  assert.deepEqual(checks(lintTree(files)), ["section-ref"]);
});

test("frontmatter: name must match the directory, description present and short", () => {
  const files = tree({
    "skills/alpha/SKILL.md": skill("alfa", "# Alpha\n"),
    "skills/beta/SKILL.md": skill("beta", "# Beta\n", "x".repeat(1025)),
    "skills/gamma/SKILL.md": "# Gamma, no frontmatter\n",
  });
  assert.deepEqual(checks(lintTree(files)).sort(), ["frontmatter", "frontmatter", "frontmatter"]);
});

test("an ordered list is a finding outside the allowlist and inside code fences it is not", () => {
  const bad = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\n1. first\n2. second\n"),
  });
  assert.deepEqual(checks(lintTree(bad)), ["ordered-list"]);
  const fenced = tree({
    "skills/alpha/SKILL.md": skill("alpha", "# Alpha\n\n```\n1. step\n```\n"),
  });
  assert.deepEqual(lintTree(fenced), []);
});

test("a SKILL.md over the token budget is a finding; one exactly at it is not", () => {
  const text = skill("alpha", "# Alpha\n" + "word ".repeat(40));
  const files = tree({ "skills/alpha/SKILL.md": text });
  const tokens = estimateTokens(text);
  assert.deepEqual(checks(lintTree(files, { tokenBudget: tokens - 1 })), ["token-budget"]);
  assert.deepEqual(lintTree(files, { tokenBudget: tokens }), []);
});

test("tokens are estimated from characters, not lines", () => {
  assert.equal(estimateTokens("x".repeat(400)), 100);
  assert.equal(estimateTokens("\n".repeat(400)), 100);
});

test("the real tree passes", () => {
  const findings = lintTree(readTree());
  assert.deepEqual(findings, [], findings.map((f) => `${f.path}:${f.line} ${f.check} ${f.message}`).join("\n"));
});
