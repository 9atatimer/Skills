// stamp.mjs -- write SOURCE_STAMP, a content digest of this repo's payload
// members (skills/**, agents/** and mcp/manifest.json), which clai's
// currency machine consumes to decide whether a session needs
// re-provisioning.
//
// Unlike the template-tools package this replaces, there is NO COPY STEP:
// there, skills/ and mcp/ lived at the repo root and had to be assembled
// into packages/skills/ before publish. Here the repo root IS the package,
// so the payload is already in place and the build reduces to stamping it.
//
// The digest ALGORITHM is a deliberate duplicate of clai's Python
// implementation (packages/clai/hatch_build.py digest_data_dir and
// adapters/provisioning._digest_members): members sorted by POSIX relpath,
// one sha256 folding "relpath\0 sha256hex(bytes)\0" per file.
// test/stamp.test.mjs locks it to a Python-computed fixture digest.
//
// The MEMBER SET is a superset of clai's: clai digests skills/ and the
// manifest; this also folds in agents/ (the persona tree). That is safe
// because clai reads a shipped SOURCE_STAMP verbatim and never recomputes it
// in production -- the stamp is a change signal, not a checksum clai
// verifies. It only diverges under a CLAI_DATA_DIR dev override, where clai
// digests live and would miss a persona-only edit. agents/ is optional in
// the tree, so a payload without one still digests to clai's exact value.
//
// Runs standalone (node scripts/stamp.mjs) and via prepack, so `npm publish`
// always ships a stamp over the current tree. Zero dependencies.

import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join, dirname, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SKILLS_DIRNAME = "skills";
const AGENTS_DIRNAME = "agents";
const MANIFEST_RELPATH = join("mcp", "manifest.json");
const STAMP_NAME = "SOURCE_STAMP";

/** Recursively collect [posixRelpath, absPath] pairs under dir. */
export function walkFiles(root, dir) {
  const pairs = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name);
    if (entry.isDirectory()) {
      pairs.push(...walkFiles(root, abs));
    } else if (entry.isFile()) {
      pairs.push([relative(root, abs).split(sep).join("/"), abs]);
    }
  }
  return pairs;
}

/** The clai digest algorithm over [posixRelpath, absPath] member pairs. */
export function digestMembers(pairs) {
  const hash = createHash("sha256");
  for (const [rel, abs] of [...pairs].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
    const fileHex = createHash("sha256").update(readFileSync(abs)).digest("hex");
    hash.update(rel, "utf8");
    hash.update("\0");
    hash.update(fileHex, "ascii");
    hash.update("\0");
  }
  return hash.digest("hex");
}

/**
 * Digest the payload members under root and write root/SOURCE_STAMP.
 * Returns the digest. Pure apart from that single write.
 */
export function stamp({ root = REPO_ROOT } = {}) {
  const manifestRel = MANIFEST_RELPATH.split(sep).join("/");
  const agentsDir = join(root, AGENTS_DIRNAME);
  const members = [
    ...walkFiles(root, join(root, SKILLS_DIRNAME)),
    ...(existsSync(agentsDir) ? walkFiles(root, agentsDir) : []),
    [manifestRel, join(root, MANIFEST_RELPATH)],
  ];
  const digest = digestMembers(members);
  writeFileSync(join(root, STAMP_NAME), `${digest}\n`);
  return digest;
}

// Entry point: run when invoked directly (not when imported by tests).
if (process.argv[1] && statSync(process.argv[1]).isFile()
    && fileURLToPath(import.meta.url) === process.argv[1]) {
  const digest = stamp({});
  console.log(`skills payload stamped; SOURCE_STAMP ${digest}`);
}
