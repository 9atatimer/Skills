// skill-lint.mjs -- the structural gate for the skill tree.
//
// Skills are operating rules nothing executes, so a dangling pointer or a
// renamed section is invisible until an agent follows it and finds nothing.
// Every check here is one a self-review finder did by hand in Skills
// PR#90 or PR#92; a script does them for free on every commit.
//
// Checks, over skills/**/*.md and agents/*.md:
//   skill-ref     "the <name> skill" names a directory under skills/
//   section-ref   "the <name> skill's <Section>", "<name> skill, <Section>",
//                 "<name> skill (<Section>)" and "(<Section>, above|below)"
//                 name a real heading. A free-form mention of a section in
//                 running prose is not checked: no grammar separates it from
//                 an ordinary Title-Case phrase (tried; 27 false positives).
//   frontmatter   SKILL.md has name == its directory and a description of
//                 at most 1,024 characters (agentskills.io)
//   ordered-list  no "1." lists in a SKILL.md (sdlc law 17)
//   line-budget   no SKILL.md over LINE_BUDGET lines
//
// Run by `npm test` (so by ci.yml and `gate`) and by .husky/pre-commit:
//   node scripts/skill-lint.mjs
// Zero dependencies, like everything else in this package.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Today's longest SKILL.md (gates, 906 lines). A ratchet: lower it as
// skills move detail into reference files; never raise it to fit a file.
export const LINE_BUDGET = 906;

export const DESCRIPTION_MAX = 1024;

// Ordinary English that precedes "skill" without naming one.
const GENERIC_WORDS = new Set([
  "companion",
  "detailed",
  "named",
  "other",
  "platform",
  "relevant",
  "shared",
  "style",
  "tool",
]);

// Skills that live outside this tree but are named in it.
const EXTERNAL_SKILLS = new Set([
  "plannotator-setup-goal", // upstream plannotator's, named in its vendored text
]);

// SKILL.md files whose numbered lists are cited by number elsewhere.
const ORDERED_LIST_ALLOWED = new Set([
  "skills/gates/SKILL.md", // review-watch steps, cited as "step 5"
  "skills/sdlc/SKILL.md", // the laws, cited as "law 15"
]);

// --- pure core (exported for tests) ---------------------------------------

function lineOfIndex(text, index) {
  let line = 1;
  for (let i = 0; i < index; i++) if (text[i] === "\n") line++;
  return line;
}

// Blank out fenced code blocks, keeping line count, so nothing inside one
// reads as a heading, a list or a reference.
function stripFences(text) {
  let inFence = false;
  return text
    .split("\n")
    .map((line) => {
      if (/^\s*```/.test(line)) {
        inFence = !inFence;
        return "";
      }
      return inFence ? "" : line;
    })
    .join("\n");
}

// Join wrapped lines into one string so a reference split across lines
// still matches; drop backticks and asterisks. lines[i] is the source line
// of flat[i].
function flatten(text) {
  let flat = "";
  const lines = [];
  let line = 1;
  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    if (/\s/.test(ch)) {
      const start = line;
      while (i < text.length && /\s/.test(text[i])) {
        if (text[i] === "\n") line++;
        i++;
      }
      flat += " ";
      lines.push(start);
      continue;
    }
    if (ch !== "`" && ch !== "*") {
      flat += ch;
      lines.push(line);
    }
    i++;
  }
  return { flat, lines };
}

function normalizeHeading(raw) {
  return raw
    .replace(/^#+\s*/, "")
    .replace(/[`*]/g, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .trim();
}

function dropLeadingThe(s) {
  return s.replace(/^The /, "");
}

export function sectionIndex(text) {
  const body = stripFences(text);
  const headings = body
    .split("\n")
    .filter((l) => /^#{1,6} /.test(l))
    .map(normalizeHeading);
  const terms = [...body.matchAll(/\*\*([^*\n]+)\*\*/g)].map((m) => m[1].trim());
  return { headings, terms };
}

function firstWord(s) {
  return s.split(/[\s,]+/)[0];
}

export function resolvesSection(rest, index) {
  const want = dropLeadingThe(rest.trim());
  const section = want.match(/^Section (\d+)\b/);
  if (section) {
    return index.headings.some((h) => h.startsWith(`${section[1]}.`) || h.startsWith(`${section[1]} `));
  }
  for (const raw of index.headings) {
    const forms = [raw, raw.replace(/^[\d.]+\s+/, "")].map(dropLeadingThe);
    for (const h of forms) {
      if (!h) continue;
      if (want.startsWith(h)) return true;
      if (want.length >= 4 && h.startsWith(want)) return true;
    }
  }
  const word = firstWord(want);
  return index.terms.some((t) => firstWord(dropLeadingThe(t)) === word);
}

function frontmatterFindings(relpath, text) {
  const dir = relpath.split("/")[1];
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const at = (message) => ({ path: relpath, line: 1, check: "frontmatter", message });
  if (!fm) return [at("no frontmatter block")];
  const name = (fm[1].match(/^name:\s*(.*)$/m) || [])[1]?.trim();
  const description = ((fm[1].match(/^description:\s*(.*)$/m) || [])[1] || "")
    .trim()
    .replace(/^"(.*)"$/, "$1");
  const out = [];
  if (name !== dir) out.push(at(`name "${name}" does not match directory "${dir}"`));
  if (!description) out.push(at("description is missing"));
  else if (description.length > DESCRIPTION_MAX) {
    out.push(at(`description is ${description.length} characters; the limit is ${DESCRIPTION_MAX}`));
  }
  return out;
}

function orderedListFindings(relpath, text) {
  if (ORDERED_LIST_ALLOWED.has(relpath)) return [];
  const lines = stripFences(text).split("\n");
  const i = lines.findIndex((l) => /^ {0,3}\d+\. /.test(l));
  if (i < 0) return [];
  return [{ path: relpath, line: i + 1, check: "ordered-list", message: "ordered list; use bullets (sdlc law 17)" }];
}

function lineBudgetFindings(relpath, text, budget) {
  const count = text.replace(/\n$/, "").split("\n").length;
  if (count <= budget) return [];
  return [{ path: relpath, line: budget + 1, check: "line-budget", message: `${count} lines; the budget is ${budget}` }];
}

function referenceFindings(relpath, text, skills, indexes) {
  const own = relpath.match(/^skills\/([^/]+)\//)?.[1];
  const { flat, lines } = flatten(stripFences(text));
  const out = [];
  const at = (index, check, message) => ({ path: relpath, line: lines[index], check, message });

  for (const m of flat.matchAll(/\b[Tt]he ([a-z][a-z0-9-]*) skill\b(?!s)/g)) {
    const name = m[1];
    if (skills.has(name) || GENERIC_WORDS.has(name) || EXTERNAL_SKILLS.has(name)) continue;
    out.push(at(m.index, "skill-ref", `"the ${name} skill" names no directory under skills/`));
  }

  const cited = [
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]*) skill's ([A-Z][^.;:)]*)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]*) skill, ([A-Z][^.;:)]*)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]*) skill(?:'s [a-z]+)? \(([A-Z][^()]*)\)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\(([A-Z][^()]*?), (?:above|below)\)/g)].map((m) => [m, own, m[1]]),
  ];
  for (const [m, target, rest] of cited) {
    const index = indexes.get(target);
    if (!index) continue;
    if (resolvesSection(rest, index)) continue;
    out.push(at(m.index, "section-ref", `"${rest.slice(0, 60)}" is not a section of the ${target} skill`));
  }
  return out;
}

export function lintTree(files, { lineBudget = LINE_BUDGET } = {}) {
  const skillFiles = [...files.keys()].filter((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p));
  const skills = new Set([...files.keys()].map((p) => p.match(/^skills\/([^/]+)\//)?.[1]).filter(Boolean));
  const indexes = new Map(skillFiles.map((p) => [p.split("/")[1], sectionIndex(files.get(p))]));

  const findings = [];
  for (const [relpath, text] of files) {
    if (skillFiles.includes(relpath)) {
      findings.push(...frontmatterFindings(relpath, text));
      findings.push(...orderedListFindings(relpath, text));
      findings.push(...lineBudgetFindings(relpath, text, lineBudget));
    }
    findings.push(...referenceFindings(relpath, text, skills, indexes));
  }
  return findings;
}

// --- I/O --------------------------------------------------------------------

function walk(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    return e.isDirectory() ? walk(p) : [p];
  });
}

export function readTree(root = REPO_ROOT) {
  const paths = [...walk(join(root, "skills")), ...walk(join(root, "agents"))].filter((p) => p.endsWith(".md"));
  return new Map(paths.map((p) => [relative(root, p), readFileSync(p, "utf8")]));
}

function main() {
  const findings = lintTree(readTree());
  for (const f of findings) console.error(`${f.path}:${f.line}: ${f.check}: ${f.message}`);
  if (findings.length) {
    console.error(`skill-lint: ${findings.length} finding(s)`);
    return 1;
  }
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  process.exit(main());
}
