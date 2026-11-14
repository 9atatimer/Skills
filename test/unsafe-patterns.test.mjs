// unsafe-patterns.test.mjs -- the skill tree never teaches a command form
// known to act with the wrong identity.
//
// Skills are executed by agents, so a command a skill recommends is a
// command the fleet runs. Each pattern here caused a real failure, named
// in its message. Text is matched with its whitespace collapsed, so a form
// wrapped across lines is still found. Reads the tree from disk; no
// subprocesses, no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SCANNED = ["skills", "agents"];

// Each entry: a form no skill or persona may recommend, why, and the one
// sentence opening that may name it to forbid it.
const UNSAFE = [
  {
    pattern: /op run --env-file <\( ?claude-as-bot --print-env ?\)/g,
    why:
      "fails open: when claude-as-bot fails, op runs the command as the " +
      "owner (tds-utils Issue#717, Skills Issue#224); use tds-utils asbot",
    forbidding: "Never use the inline form `",
  },
];

// findUnsafe(text) -> the reasons for every recommended unsafe form in text.
export function findUnsafe(text) {
  const flat = text.replace(/\s+/g, " ");
  const hits = [];
  for (const { pattern, why, forbidding } of UNSAFE) {
    for (const match of flat.matchAll(pattern)) {
      const before = flat.slice(Math.max(0, match.index - forbidding.length), match.index);
      if (before !== forbidding) {
        hits.push(why);
      }
    }
  }
  return hits;
}

function markdownFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      out.push(...markdownFiles(path));
    } else if (name.endsWith(".md")) {
      out.push(path);
    }
  }
  return out;
}

test("a recommendation of the inline op run form is found, even wrapped", () => {
  const wrapped = "Run each command as `op run --env-file\n  <(claude-as-bot --print-env) -- <cmd>`.";
  assert.equal(findUnsafe(wrapped).length, 1);
});

test("a line that says never elsewhere does not hide a recommendation", () => {
  const sneaky = "Never mind asbot; run `op run --env-file <(claude-as-bot --print-env) -- gh pr create`.";
  assert.equal(findUnsafe(sneaky).length, 1);
});

test("the sentence that forbids the form may name it, wrapped or not", () => {
  const forbidding = "- Never use the inline form `op run --env-file <(claude-as-bot\n  --print-env) -- <cmd>`. When the launcher fails ...";
  assert.deepEqual(findUnsafe(forbidding), []);
});

test("no skill or persona recommends a command form that acts as the wrong identity", () => {
  const hits = [];
  for (const top of SCANNED) {
    for (const file of markdownFiles(join(ROOT, top))) {
      for (const why of findUnsafe(readFileSync(file, "utf8"))) {
        hits.push(`${relative(ROOT, file)}: ${why}`);
      }
    }
  }
  assert.deepEqual(hits, []);
});
