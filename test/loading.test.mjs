// loading.test.mjs -- the pure core of evals/loading/: reading which skills
// a run loaded from claude's stream-json, and scoring the runs against the
// cases. The runs themselves call a model and are not unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadedSkills, score } from "../evals/loading/lib.mjs";
import { CASES } from "../evals/loading/cases.mjs";

function event(obj) {
  return JSON.stringify(obj);
}

const STREAM = [
  event({ type: "system", subtype: "init", skills: ["gates", "self-review"] }),
  event({ type: "assistant", message: { content: [{ type: "text", text: "loading" }] } }),
  event({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "gates" } }] } }),
  "not json at all",
  event({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { file_path: "x" } }] } }),
  event({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "self-review", args: "x" } }] } }),
  event({ type: "result", result: "done" }),
].join("\n");

test("loadedSkills lists every Skill tool call, in order, and nothing else", () => {
  assert.deepEqual(loadedSkills(STREAM), ["gates", "self-review"]);
  assert.deepEqual(loadedSkills(""), []);
});

test("score counts hits and misses per skill", () => {
  const results = [
    { skill: "gates", expect: true, loaded: ["gates"] },
    { skill: "gates", expect: true, loaded: [] },
    { skill: "gates", expect: false, loaded: ["github-workflow"] },
    { skill: "gates", expect: false, loaded: ["gates", "github-workflow"] },
    { skill: "self-review", expect: true, loaded: ["self-review"] },
  ];
  assert.deepEqual(score(results), {
    gates: { hit: 1, miss: 1, rejected: 1, falseLoad: 1 },
    "self-review": { hit: 1, miss: 0, rejected: 0, falseLoad: 0 },
  });
});

test("score leaves errored runs out of the counts and reports them", () => {
  const s = score([{ skill: "gates", expect: true, error: "exit 1" }]);
  assert.deepEqual(s.gates, { hit: 0, miss: 0, rejected: 0, falseLoad: 0, errored: 1 });
});

test("every case names a real skill and has ten should-load and ten near-miss prompts", async () => {
  const { readdirSync } = await import("node:fs");
  const skills = new Set(readdirSync(new URL("../skills/", import.meta.url)));
  const bySkill = new Map();
  for (const c of CASES) {
    assert.ok(skills.has(c.skill), c.skill);
    assert.equal(typeof c.prompt, "string");
    const counts = bySkill.get(c.skill) || { yes: 0, no: 0 };
    counts[c.expect ? "yes" : "no"]++;
    bySkill.set(c.skill, counts);
  }
  for (const [skill, counts] of bySkill) assert.deepEqual(counts, { yes: 10, no: 10 }, skill);
  assert.equal(new Set(CASES.map((c) => c.prompt)).size, CASES.length, "prompts are unique");
});
