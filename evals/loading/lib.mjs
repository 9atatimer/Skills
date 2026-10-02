// lib.mjs -- the pure core of the loading tests: which skills a run loaded,
// read from `claude -p --output-format stream-json --verbose`, and how the
// runs score against the cases. No I/O here; run.mjs does that.

// Every Skill tool call in the stream, in order. Lines that are not JSON
// (stderr noise) are skipped.
export function loadedSkills(stream) {
  const out = [];
  for (const e of events(stream)) {
    if (e.type !== "assistant") continue;
    for (const c of e.message?.content || []) {
      if (c.type === "tool_use" && c.name === "Skill" && c.input?.skill) out.push(c.input.skill);
    }
  }
  return out;
}

function events(stream) {
  const out = [];
  for (const line of stream.split("\n")) {
    try {
      const e = JSON.parse(line);
      if (e && typeof e === "object") out.push(e);
    } catch {
      // stderr noise
    }
  }
  return out;
}

// Why a run has no verdict, or null when it has one. A run's verdict is
// only as good as its end: no result event, or an error result other than
// running out of turns (--max-turns ends a run after its Skill call), means
// the absence of a Skill call proves nothing.
export function streamError(stream) {
  const result = events(stream).filter((e) => e.type === "result").pop();
  if (!result) return "no result event";
  if (result.subtype === "error_max_turns") return null;
  if (result.is_error || (result.subtype && result.subtype !== "success")) {
    return `result ${result.subtype || "error"}${result.result ? `: ${String(result.result).slice(0, 120)}` : ""}`;
  }
  return null;
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
