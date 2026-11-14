// unsafe-patterns.test.mjs -- the skill tree never teaches a command form
// known to act with the wrong identity.
//
// Skills are executed by agents, so a command a skill recommends is a
// command the fleet runs. Each pattern here caused a real failure, named
// in its message. Reads the tree from disk; no subprocesses, no network.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const SCANNED = ["skills", "agents"];

// Each entry: a pattern no skill or persona may contain, and why.
const UNSAFE = [
  {
    pattern: /op run\s+--env-file\s+<\(\s*claude-as-bot\s+--print-env\s*\)/,
    why:
      "fails open: when claude-as-bot fails, op runs the command as the " +
      "owner (tds-utils Issue#717, Skills Issue#224); use tds-utils asbot",
  },
];

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

test("no skill or persona recommends a command form that acts as the wrong identity", () => {
  const hits = [];
  for (const top of SCANNED) {
    for (const file of markdownFiles(join(ROOT, top))) {
      const lines = readFileSync(file, "utf8").split("\n");
      lines.forEach((line, i) => {
        for (const { pattern, why } of UNSAFE) {
          // A line that forbids the form ("Never use ...") may name it.
          if (pattern.test(line) && !/\bnever\b/i.test(line)) {
            hits.push(`${relative(ROOT, file)}:${i + 1}: ${why}`);
          }
        }
      });
    }
  }
  assert.deepEqual(hits, []);
});
