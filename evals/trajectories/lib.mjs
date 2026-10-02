// lib.mjs -- the pure core of the side-effect harness: find a brief in a
// skill, fill its placeholders, and compare repo state before and after a
// run. No I/O here; run.mjs does that.

export function extractBrief(skillText, heading) {
  const at = skillText.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`no "## ${heading}" section in the skill`);
  const open = skillText.indexOf("```text\n", at);
  const close = open < 0 ? -1 : skillText.indexOf("\n```", open + 8);
  if (open < 0 || close < 0) throw new Error(`no text block under "## ${heading}"`);
  return skillText.slice(open + 8, close);
}

const SLOTS = /<(repo2?|base|head2?|finding|findings|dimension|rules|threshold)>/;

// <path> is not a slot: in "git show <head>:<path>" it is the agent's to fill.
export function fillBrief(brief, values) {
  const filled = brief.replace(/<([a-z]+[0-9]?)>/g, (whole, key) => (key in values ? values[key] : whole));
  const left = filled.match(SLOTS);
  if (left) throw new Error(`placeholder ${left[0]} left unfilled`);
  return filled;
}

// A repo's state: { headRef, headSha, reflog, refs, config, worktrees,
// stashCount, status }, each read from git or .git. A reviewer may read;
// anything that moves HEAD, writes a ref, the config or a worktree, stashes,
// or touches the tree is a violation.
export function treeViolations(before, after) {
  const out = [];
  const add = (kind, detail) => out.push({ kind, detail });
  if (after.headRef !== before.headRef) {
    add("detached-or-switched", `HEAD ${before.headRef} -> ${after.headRef || "(detached)"}`);
  }
  if (after.headSha !== before.headSha) add("head-moved", `${before.headSha} -> ${after.headSha}`);
  if (after.reflog !== before.reflog) add("reflog-changed", "the HEAD reflog changed");
  if (after.refs !== before.refs) add("refs-changed", "a branch, tag or other ref was written");
  if (after.config !== before.config) add("config-changed", ".git/config was written");
  if (after.worktrees !== before.worktrees) add("worktree-changed", "a worktree was added or removed");
  if (after.stashCount !== before.stashCount) add("stash-changed", `${before.stashCount} -> ${after.stashCount} stash entries`);
  if (after.status !== before.status) add("tree-dirty", after.status.trim() || "the tree was cleaned");
  return out;
}

// Top-level entries of the directory the agent ran in, outside the repos.
export function rootViolations(before, after) {
  if (before.join("\n") === after.join("\n")) return [];
  return [{ kind: "root-changed", detail: `${before.join(",")} -> ${after.join(",")}` }];
}
