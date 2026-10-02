// lib.mjs -- the pure core of the loading tests: which skills a run loaded,
// read from `claude -p --output-format stream-json --verbose`, and how the
// runs score against the cases. No I/O here; run.mjs does that.

// Every Skill tool call in the stream, in order. Lines that are not JSON
// (stderr noise) are skipped.
export function loadedSkills(stream) {
  const out = [];
  for (const line of stream.split("\n")) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (e?.type !== "assistant") continue;
    for (const c of e.message?.content || []) {
      if (c.type === "tool_use" && c.name === "Skill" && c.input?.skill) out.push(c.input.skill);
    }
  }
  return out;
}

// results: [{ skill, expect, loaded?, error? }]. Per skill:
//   hit       expected to load and did
//   miss      expected to load and did not
//   rejected  a near-miss that correctly did not load it
//   falseLoad a near-miss that loaded it anyway
// An errored run has no verdict and is counted only as errored.
export function score(results) {
  const out = {};
  for (const r of results) {
    const s = (out[r.skill] ||= { hit: 0, miss: 0, rejected: 0, falseLoad: 0 });
    if (r.error) {
      s.errored = (s.errored || 0) + 1;
      continue;
    }
    const did = r.loaded.includes(r.skill);
    if (r.expect) s[did ? "hit" : "miss"]++;
    else s[did ? "falseLoad" : "rejected"]++;
  }
  return out;
}
