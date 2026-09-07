// publicity-guard.mjs -- the pre-remote leak gate for this PUBLIC repo.
//
// Everything committed here ships to the world, so two checks run before
// content can move: an ALLOWLIST (a skill directory under skills/ must be
// named in PUBLIC_SKILLS.txt -- listing it is the conscious decision to
// publish) and a DENYLIST (obscenity via the LDNOOBW community list in
// scripts/publicity-guard-words.txt, plus work/IP markers below). Paths are
// scanned as well as contents, so a leaky filename is caught too.
//
// Invoked by the husky hooks (.husky/pre-commit, .husky/pre-push) and
// runnable standalone:
//   node scripts/publicity-guard.mjs --staged   # index contents (pre-commit)
//   node scripts/publicity-guard.mjs --push     # outgoing commits, ranges on stdin
//   node scripts/publicity-guard.mjs --all      # every tracked file (CI / audit)
//
// Zero dependencies, like everything else in this package. False positive?
// Rename or reword if you can; only a repo owner widens ALLOW_TERMS.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_NAME = "PUBLIC_SKILLS.txt";
const WORDS_RELPATH = "scripts/publicity-guard-words.txt";

// Work/IP markers: content carrying these has no business in a public tree.
const WORK_TERMS = [
  "confidential",
  "proprietary",
  "trade secret",
  "internal use only",
  "internal only",
  "do not distribute",
  "not for public release",
  "tds-internal",
];

// Terms from either denylist that are deliberately tolerated (owner-widened
// only). Empty today; add sparingly, with a trailing comment saying why.
const ALLOW_TERMS = new Set([]);

// Paths never content-scanned: the denylist data and the code and tests
// that carry it would flag themselves.
const EXCLUDE_PATHS = new Set([
  WORDS_RELPATH,
  "scripts/publicity-guard.mjs",
  "test/publicity-guard.test.mjs",
]);

// --- pure core (exported for tests) ---------------------------------------

export function parseTermList(text) {
  return text
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line && !line.startsWith("#"));
}

function termRegex(term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lead = /^\w/.test(term) ? "\\b" : "";
  const tail = /\w$/.test(term) ? "\\b" : "";
  return new RegExp(`${lead}${escaped.replace(/ /g, "[\\s_-]+")}${tail}`, "i");
}

export function scanText(relpath, text, terms, category) {
  const findings = [];
  const regexes = terms
    .filter((t) => !ALLOW_TERMS.has(t))
    .map((t) => [t, termRegex(t)]);
  const lines = text.split("\n");
  for (const [term, re] of regexes) {
    if (re.test(relpath)) {
      findings.push({ path: relpath, line: 0, term, category });
    }
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        findings.push({ path: relpath, line: i + 1, term, category });
      }
    }
  }
  return findings;
}

export function checkSkillPaths(relpaths, manifestText) {
  const allowed = new Set(parseTermList(manifestText));
  const findings = [];
  for (const relpath of relpaths) {
    const m = relpath.match(/^skills\/([^/]+)\//);
    if (m && !allowed.has(m[1].toLowerCase())) {
      findings.push({
        path: relpath,
        line: 0,
        term: m[1],
        category: `skill not listed in ${MANIFEST_NAME}`,
      });
    }
  }
  return findings;
}

// --- git plumbing ----------------------------------------------------------

function git(...args) {
  return execFileSync("git", args, { cwd: REPO_ROOT, encoding: "utf8" });
}

function gitBuffer(...args) {
  return execFileSync("git", args, { cwd: REPO_ROOT });
}

const EMPTY_TREE = "4b825dc642cb6eb9a060e54bf8d69288fbee4904";

function changedPaths(base, tip) {
  return git("diff", "--name-only", "--diff-filter=ACMR", "-z", base, tip)
    .split("\0")
    .filter(Boolean);
}

// Returns [relpath, revSpec] pairs: revSpec locates the content to scan.
function collectTargets(mode, stdinText) {
  if (mode === "--staged") {
    return git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
      .split("\0")
      .filter(Boolean)
      .map((p) => [p, `:${p}`]);
  }
  if (mode === "--push") {
    const targets = [];
    for (const line of stdinText.split("\n").filter(Boolean)) {
      const [, localSha, , remoteSha] = line.split(" ");
      if (!localSha || /^0+$/.test(localSha)) continue; // branch deletion
      const base = !remoteSha || /^0+$/.test(remoteSha) ? EMPTY_TREE : remoteSha;
      for (const p of changedPaths(base, localSha)) {
        targets.push([p, `${localSha}:${p}`]);
      }
    }
    return targets;
  }
  if (mode === "--all") {
    return git("ls-files", "-z")
      .split("\0")
      .filter(Boolean)
      .map((p) => [p, `HEAD:${p}`]);
  }
  throw new Error(`usage: publicity-guard.mjs --staged | --push | --all`);
}

function contentAt(revSpec) {
  const bytes = gitBuffer("show", revSpec);
  if (bytes.includes(0)) return null; // binary: path was still scanned
  return bytes.toString("utf8");
}

function manifestAt(mode, targets) {
  // Read the manifest from the same snapshot being scanned, so adding a
  // skill and listing it in one commit passes, and a commit that forgets
  // the listing fails even if the working tree has it.
  const spec =
    mode === "--staged"
      ? `:${MANIFEST_NAME}`
      : `${(targets[0] ?? [null, "HEAD:"])[1].split(":")[0] || "HEAD"}:${MANIFEST_NAME}`;
  try {
    return git("show", spec);
  } catch {
    return readFileSync(join(REPO_ROOT, MANIFEST_NAME), "utf8");
  }
}

// --- orchestrator ----------------------------------------------------------

function main() {
  const mode = process.argv[2] ?? "--staged";
  const stdinText =
    mode === "--push" ? readFileSync(0, "utf8").toString() : "";
  const targets = collectTargets(mode, stdinText);
  if (targets.length === 0) return 0;

  const obscene = parseTermList(
    readFileSync(join(REPO_ROOT, WORDS_RELPATH), "utf8"),
  );
  const manifest = manifestAt(mode, targets);

  const findings = checkSkillPaths(
    targets.map(([p]) => p),
    manifest,
  );
  for (const [relpath, revSpec] of targets) {
    if (EXCLUDE_PATHS.has(relpath)) continue;
    const text = contentAt(revSpec);
    findings.push(...scanText(relpath, text ?? "", obscene, "obscenity (LDNOOBW)"));
    findings.push(...scanText(relpath, text ?? "", WORK_TERMS, "work/IP marker"));
  }

  if (findings.length === 0) return 0;
  console.error("publicity-guard: BLOCKED -- this repo is public.\n");
  for (const f of findings) {
    const where = f.line ? `${f.path}:${f.line}` : `${f.path} (path)`;
    console.error(`  ${where}: "${f.term}" [${f.category}]`);
  }
  console.error(
    `\nFix the content, or for a new skill add its directory name to` +
      `\n${MANIFEST_NAME} in the same commit. Term false positive? Reword,` +
      `\nor have the repo owner add it to ALLOW_TERMS in ${
        "scripts/publicity-guard.mjs"
      }.`,
  );
  return 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
