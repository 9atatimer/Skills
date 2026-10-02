// lib.mjs -- the pure core of the side-effect harness: find a brief in a
// skill, fill its placeholders, and compare a repo's state before and after
// a run. No I/O here; run.mjs does that.

export function extractBrief(skillText, heading) {
  const at = skillText.indexOf(`\n## ${heading}\n`);
  if (at < 0) throw new Error(`no "## ${heading}" section in the skill`);
  const open = skillText.indexOf("```text\n", at);
  const close = open < 0 ? -1 : skillText.indexOf("\n```", open + 8);
  if (open < 0 || close < 0) throw new Error(`no text block under "## ${heading}"`);
  return skillText.slice(open + 8, close);
}

// <path> is not a slot: in "git show <head>:<path>" it is the agent's to fill.
export function fillBrief(brief, values) {
  const filled = brief.replace(/<([a-z]+[0-9]?)>/g, (whole, key) => (key in values ? values[key] : whole));
  const left = filled.match(/<(repo2?|base|head2?|finding|findings|dimension|rules|threshold)>/);
  if (left) throw new Error(`placeholder ${left[0]} left unfilled`);
  return filled;
}

// before/after: { headRef, headSha, reflogCount, stashCount, status }.
// A reviewer may read; anything that moves HEAD, writes a ref or touches
// the tree is a violation.
export function treeViolations(before, after) {
  const out = [];
  if (after.headRef !== before.headRef) {
    out.push({ kind: "detached-or-switched", detail: `HEAD ${before.headRef} -> ${after.headRef || "(detached)"}` });
  }
  if (after.headSha !== before.headSha) out.push({ kind: "head-moved", detail: `${before.headSha} -> ${after.headSha}` });
  if (after.reflogCount > before.reflogCount) {
    out.push({ kind: "reflog-grew", detail: `${after.reflogCount - before.reflogCount} new HEAD reflog entries` });
  }
  if (after.stashCount > before.stashCount) out.push({ kind: "stash-created", detail: `${after.stashCount} stash entries` });
  if (after.status !== before.status) out.push({ kind: "tree-dirty", detail: after.status.trim() });
  return out;
}
