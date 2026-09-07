// version.test.mjs -- guards the two properties of the version rule that,
// when broken, fail SILENTLY: CI goes green and nothing ships.

import { test } from "node:test";
import assert from "node:assert/strict";

import { SERIES, VERSION_PATHS, versionFromCount } from "../scripts/version.mjs";

test("the counted paths include the payload content", () => {
  // Given the version rule, When its paths are read, Then a skill or manifest
  // edit is covered -- the obvious half.
  assert.ok(VERSION_PATHS.includes("skills"));
  assert.ok(VERSION_PATHS.includes("mcp/manifest.json"));
});

test("the counted paths include packaging, not just payload content", () => {
  // Given the version rule, When its paths are read, Then package.json and
  // scripts/ are covered too.
  //
  // This is the regression that shipped: package.json's `files` array decides
  // WHAT the tarball contains, so removing pins.env from it changed the
  // artifact without touching any payload file. The count did not move,
  // publish_if_new said "already published", and the removal never shipped.
  // Narrowing this list back to payload-only would silently reintroduce that.
  assert.ok(
    VERSION_PATHS.includes("package.json"),
    "package.json decides what ships; excluding it means packaging changes cannot republish",
  );
  assert.ok(
    VERSION_PATHS.includes("scripts"),
    "scripts/ builds SOURCE_STAMP into the tarball; excluding it means build changes cannot republish",
  );
});

test("the series is 0.2 -- 0.1 collides with versions template-tools published", () => {
  // Given the version rule, When the series is read, Then it is 0.2.
  //
  // template-tools published this package name up through 0.1.85. A 0.1.x
  // series here resolves to versions that already exist, so every publish
  // would skip and the fleet would sit on a stale payload with CI green.
  assert.equal(SERIES, "0.2");
});

test("it builds a version from a commit count", () => {
  assert.equal(versionFromCount(7), "0.2.7");
  assert.equal(versionFromCount("7"), "0.2.7");
});

test("it refuses a count that is not a non-negative integer", () => {
  // Given a bad count, When a version is built, Then it throws rather than
  // producing something like "0.2.NaN" -- which npm would reject at publish
  // time, but only after the workflow had already reported a version.
  for (const bad of ["", "abc", "-1", "1.5", undefined, null]) {
    assert.throws(() => versionFromCount(bad), TypeError);
  }
});

test("the counted paths include agents/, the persona tree", () => {
  // Given the version rule, When its paths are read, Then a persona edit is
  // covered. agents/ ships in the tarball (package.json `files`); a payload
  // member that cannot move the version is a change that never publishes.
  assert.ok(
    VERSION_PATHS.includes("agents"),
    "agents/ ships in the payload; excluding it means a persona edit cannot republish",
  );
});
