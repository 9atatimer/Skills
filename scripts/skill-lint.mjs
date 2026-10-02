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
//   word-budget   no SKILL.md over WORD_BUDGET words, counted as `wc -w` does
//
// Run by `npm test` (so by ci.yml and `gate`) and by .husky/pre-commit:
//   node scripts/skill-lint.mjs
// Zero dependencies, like everything else in this package.

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Size is what a SKILL.md costs in context, and lines do not measure it: a
// table line holds ten lines of prose. Words are counted exactly as `wc -w`
// counts them, so anyone can check a number with the shell. A true token
// count needs Claude's tokenizer, which only the API exposes; an estimate
// is not a measure. Today's largest SKILL.md is gates, at 7,624 words. A
// ratchet: lower it as skills move detail into reference files; never raise
// it to fit a file.
export const WORD_BUDGET = 7624;

export function countWords(text) {
  return text.split(/\s+/).filter(Boolean).length;
}

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

export function resolvesSection(rest, index) {
  const want = dropLeadingThe(rest.trim());
  const section = want.match(/^Section (\d+)\b/);
  if (section) {
    return index.headings.some((h) => h.startsWith(`${section[1]}.`) || h.startsWith(`${section[1]} `));
  }
  for (const raw of index.headings) {
    const forms = [raw, raw.replace(/^[\d.]+\s+/, "")].map(dropLeadingThe);
    for (const h of forms) {
      if (h && (isWordPrefix(h, want) || isWordPrefix(want, h))) return true;
    }
  }
  // A bold term names a defined thing ("**Trace test**"); a citation of a
  // list of them ("Trace, Purity, and Wiring tests") resolves on its first item.
  const item = want.split(",")[0].trim();
  return index.terms.some((t) => isWordPrefix(item, dropLeadingThe(t)));
}

// prefix is a whole-word prefix of s: "Sizing" of "Sizing rule", never
// "Test" of "Testing".
function isWordPrefix(prefix, s) {
  return s.startsWith(prefix) && (s.length === prefix.length || /[\s,]/.test(s[prefix.length]));
}

// A frontmatter scalar, including a folded or literal block (`key: >` or
// `key: |`) whose text sits on the indented lines below it.
function frontmatterValue(block, key) {
  const lines = block.split("\n");
  const i = lines.findIndex((l) => l.startsWith(`${key}:`));
  if (i < 0) return "";
  const head = lines[i].slice(key.length + 1).trim();
  if (!/^[>|][+-]?$/.test(head)) return head.replace(/^"(.*)"$/, "$1");
  const body = [];
  for (const l of lines.slice(i + 1)) {
    if (!/^\s/.test(l) && l.trim()) break;
    body.push(l.trim());
  }
  return body.join(" ").trim();
}

function frontmatterFindings(relpath, text) {
  const dir = relpath.split("/")[1];
  const fm = text.match(/^---\n([\s\S]*?)\n---/);
  const at = (message) => ({ path: relpath, line: 1, check: "frontmatter", message });
  if (!fm) return [at("no frontmatter block")];
  const name = (fm[1].match(/^name:\s*(.*)$/m) || [])[1]?.trim();
  const description = frontmatterValue(fm[1], "description");
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

function wordBudgetFindings(relpath, text, budget) {
  const words = countWords(text);
  if (words <= budget) return [];
  return [{ path: relpath, line: 1, check: "word-budget", message: `${words} words (wc -w); the budget is ${budget}` }];
}

function referenceFindings(relpath, text, skills, indexes) {
  const { flat, lines } = flatten(stripFences(text));
  const out = [];
  const at = (index, check, message) => ({ path: relpath, line: lines[index], check, message });

  for (const m of flat.matchAll(/\b[Tt]he ([a-z][a-z0-9-]{0,63}) skill\b(?!s)/g)) {
    const name = m[1];
    if (skills.has(name) || GENERIC_WORDS.has(name) || EXTERNAL_SKILLS.has(name)) continue;
    out.push(at(m.index, "skill-ref", `"the ${name} skill" names no directory under skills/`));
  }

  const cited = [
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]{0,63}) skill's ([A-Z][^.;:)]*)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]{0,63}) skill, ([A-Z][^.;:)]*)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\b([a-z][a-z0-9-]{0,63}) skill(?:'s [a-z]+)? \(([A-Z][^()]*)\)/g)].map((m) => [m, m[1], m[2]]),
    ...[...flat.matchAll(/\(([A-Z][^()]*?), (?:above|below)\)/g)].map((m) => [m, null, m[1]]),
  ];
  const self = sectionIndex(text);
  for (const [m, target, rest] of cited) {
    const index = target === null ? self : indexes.get(target);
    if (!index) continue;
    if (resolvesSection(rest, index)) continue;
    const where = target === null ? "this file" : `the ${target} skill`;
    out.push(at(m.index, "section-ref", `"${rest.slice(0, 60)}" is not a section of ${where}`));
  }
  return out;
}

export function lintTree(files, { wordBudget = WORD_BUDGET } = {}) {
  const skillFiles = [...files.keys()].filter((p) => /^skills\/[^/]+\/SKILL\.md$/.test(p));
  const skills = new Set([...files.keys()].map((p) => p.match(/^skills\/([^/]+)\//)?.[1]).filter(Boolean));
  const indexes = new Map(skillFiles.map((p) => [p.split("/")[1], sectionIndex(files.get(p))]));

  const findings = [];
  for (const [relpath, text] of files) {
    if (skillFiles.includes(relpath)) {
      findings.push(...frontmatterFindings(relpath, text));
      findings.push(...orderedListFindings(relpath, text));
      findings.push(...wordBudgetFindings(relpath, text, wordBudget));
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
