// stamp.test.mjs -- behavioral tests for scripts/stamp.mjs, the step that
// writes SOURCE_STAMP over this repo's payload.
//
// Runner deviation (rationale, per the testing-node skill): this package is
// INERT DATA whose entire value is having zero dependencies; vitest would be
// its only devDependency and the publish workflow never runs an install for
// it. node:test is stdlib, keeps the package dependency-free, and these are
// a handful of assertions over a pure script -- revisit if the suite grows.

import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const STAMP = join(HERE, "..", "scripts", "stamp.mjs");

// Cross-language lock: the same fixture digested by clai's Python
// implementation (hatch_build.digest_data_dir / _digest_members -- sorted
// posix relpaths, one sha256 folding "relpath\0 sha256hex(bytes)\0" per
// file). Carried verbatim from template-tools packages/skills/test. If
// stamp.mjs ever drifts from that algorithm this constant breaks, which is
// the point: a stamp clai disagrees with would make every session re-provision
// forever without ever reaching agreement.
const FIXTURE_DIGEST =
  "93c5844650d05186e1ce8259241fccf36194cd35ab6f95bebca19f60e3935fc7";

/** Build a minimal payload tree: skills/a/SKILL.md + mcp/manifest.json. */
function makePayload() {
  const root = mkdtempSync(join(tmpdir(), "skills-root-"));
  mkdirSync(join(root, "skills", "a"), { recursive: true });
  writeFileSync(join(root, "skills", "a", "SKILL.md"), "hello\n");
  mkdirSync(join(root, "mcp"));
  writeFileSync(join(root, "mcp", "manifest.json"), "{}\n");
  return root;
}

async function runStamp(root) {
  const { stamp } = await import(STAMP);
  return stamp({ root });
}

test("it writes a SOURCE_STAMP matching the clai digest algorithm", async () => {
  // Given a payload tree, When stamp runs, Then SOURCE_STAMP equals the
  // Python-computed digest of the same members (byte-for-byte lock).
  const root = makePayload();
  await runStamp(root);
  assert.equal(readFileSync(join(root, "SOURCE_STAMP"), "utf8").trim(), FIXTURE_DIGEST);
});

test("it is idempotent: a second run produces the same stamp", async () => {
  // Given one stamp, When stamp runs again, Then SOURCE_STAMP is unchanged.
  const root = makePayload();
  await runStamp(root);
  const first = readFileSync(join(root, "SOURCE_STAMP"), "utf8");
  await runStamp(root);
  assert.equal(readFileSync(join(root, "SOURCE_STAMP"), "utf8"), first);
});

test("it changes the stamp when a skill's content changes", async () => {
  // Given a stamped payload, When a skill body is edited, Then the stamp
  // differs -- this is the signal clai's currency machine acts on.
  const root = makePayload();
  const before = await runStamp(root);
  writeFileSync(join(root, "skills", "a", "SKILL.md"), "goodbye\n");
  const after = await runStamp(root);
  assert.notEqual(after, before);
});

test("it changes the stamp when a skill is added", async () => {
  // Given a stamped payload, When a new skill appears, Then the stamp
  // differs -- an added member must not digest to the prior tree.
  const root = makePayload();
  const before = await runStamp(root);
  mkdirSync(join(root, "skills", "b"), { recursive: true });
  writeFileSync(join(root, "skills", "b", "SKILL.md"), "hello\n");
  const after = await runStamp(root);
  assert.notEqual(after, before);
});

test("it digests the manifest, not just the skills tree", async () => {
  // Given a stamped payload, When only mcp/manifest.json changes, Then the
  // stamp differs -- the MCP catalog is a payload member in its own right.
  const root = makePayload();
  const before = await runStamp(root);
  writeFileSync(join(root, "mcp", "manifest.json"), '{"profiles":{}}\n');
  const after = await runStamp(root);
  assert.notEqual(after, before);
});
