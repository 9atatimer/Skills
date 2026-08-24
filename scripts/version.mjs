// version.mjs -- the published package's version rule, in one testable place.
//
// The version is `<SERIES>.<number of commits touching VERSION_PATHS>`:
// deterministic, monotonic on main, and needing no human bump. CI calls
// `node scripts/version.mjs <count>` with the count from `git rev-list`.
//
// This used to be inline shell inside .github/workflows/publish.yml, where
// the path list could be narrowed by anyone editing YAML and nothing would
// notice. It is here so the rules below can be asserted.

/**
 * The paths whose commit count drives the version.
 *
 * TWO groups, and the second is the one that bit:
 *
 *   * PAYLOAD content -- skills/ and mcp/manifest.json. Obvious: change a
 *     skill, ship a new version.
 *
 *   * PACKAGING -- package.json and scripts/. Less obvious and previously
 *     MISSING. package.json's `files` array decides WHAT SHIPS, so a change
 *     to it changes the artifact without touching any payload file. When
 *     pins.env was removed from the payload (PR #7), the count did not move,
 *     `publish_if_new` reported "already published", CI went green, and the
 *     removal never shipped -- the live payload still contained the file the
 *     merge had deleted. A packaging change that cannot republish itself is
 *     a change that silently does not happen.
 *
 * Do not narrow this list without a reason written down. Anything that
 * changes the bytes of the published tarball belongs in it.
 */
export const VERSION_PATHS = Object.freeze([
  "skills",
  "mcp/manifest.json",
  "package.json",
  "scripts",
]);

/**
 * The version series.
 *
 * 0.2.x is LOAD-BEARING. template-tools published this same package name up
 * through 0.1.85 using its own commit count. This repository's count over the
 * same paths is far lower, so a 0.1.x series here would resolve to versions
 * that already exist: the publish step would skip them as already-published,
 * CI would go green, and the fleet would keep receiving the stale payload
 * with nothing failing anywhere. 0.2.x clears the entire prior series in one
 * step and stays monotonic, because the count only ever grows.
 */
export const SERIES = "0.2";

/** Build the version string from a commit count. */
export function versionFromCount(count) {
  // Deliberately NOT `Number(count)`: it maps "" and null to 0, so a failed
  // `git rev-list` -- which yields an empty string -- would silently stamp
  // 0.2.0 instead of failing the build. Only digits are accepted.
  const raw = typeof count === "number" ? String(count) : count;
  if (typeof raw !== "string" || !/^\d+$/.test(raw)) {
    throw new TypeError(
      `commit count must be a non-negative integer, got ${JSON.stringify(count)}`,
    );
  }
  return `${SERIES}.${Number(raw)}`;
}

// CLI: `node scripts/version.mjs <count>` prints the version.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) {
  const [, , count] = process.argv;
  process.stdout.write(versionFromCount(count) + "\n");
}
