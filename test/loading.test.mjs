// loading.test.mjs -- the pure core of evals/loading/: reading which skills
// a run loaded from claude's stream-json, and scoring the runs against the
// cases. The runs themselves call a model and are not unit tests.

import { test } from "node:test";
import assert from "node:assert/strict";

import { loadedSkills, score, streamError } from "../evals/loading/lib.mjs";
import { parseArgs } from "../evals/loading/run.mjs";
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

test("loadedSkills counts only the assistant's Skill tool calls", () => {
  const stream = [
    "null",
    "42",
    event({ type: "user", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "gates" } }] } }),
    event({ type: "assistant", message: { content: [{ type: "tool_use", name: "Read", input: { skill: "gates" } }] } }),
    event({ type: "assistant", message: { content: [{ type: "text", name: "Skill", input: { skill: "gates" } }] } }),
    event({ type: "assistant" }),
    event({ type: "assistant", message: { content: [{ type: "tool_use", name: "Skill", input: { skill: "testing" } }] } }),
  ].join("\n");
  assert.deepEqual(loadedSkills(stream), ["testing"]);
});

test("streamError: a successful end or a turn-limit end has a verdict; anything else does not", () => {
  assert.equal(streamError(event({ type: "result", subtype: "success", is_error: false })), null);
  assert.equal(streamError(event({ type: "result", subtype: "error_max_turns", is_error: true })), null);
  assert.match(streamError(""), /no result event/);
  assert.match(streamError(event({ type: "system", subtype: "init" })), /no result event/);
  assert.match(streamError(event({ type: "result", subtype: "success", is_error: true, result: "API Error: 401" })), /401/);
  assert.match(streamError(event({ type: "result", subtype: "error_during_execution", is_error: true })), /error_during_execution/);
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

test("score finds a load anywhere in the list, not only first", () => {
  const s = score([
    { skill: "github-workflow", expect: false, loaded: ["gates", "github-workflow"] },
    { skill: "gates", expect: true, loaded: ["sdlc", "gates"] },
  ]);
  assert.equal(s["github-workflow"].falseLoad, 1);
  assert.equal(s.gates.hit, 1);
});

test("parseArgs takes the documented flags and refuses anything else", () => {
  assert.deepEqual(parseArgs([]), { model: "sonnet", skill: null, jobs: 4 });
  assert.deepEqual(parseArgs(["--model", "opus", "--skill", "gates", "--jobs", "2"]), { model: "opus", skill: "gates", jobs: 2 });
  assert.throws(() => parseArgs(["--skill", "nope"]), /no cases/);
  assert.throws(() => parseArgs(["--jobs", "0"]), /positive integer/);
  assert.throws(() => parseArgs(["--jobs", "x"]), /positive integer/);
  assert.throws(() => parseArgs(["--frob", "1"]), /unknown argument/);
  assert.throws(() => parseArgs(["--model"]), /needs a value/);
});

test("score leaves errored runs out of the counts and reports them", () => {
  const s = score([
    { skill: "gates", expect: true, error: "exit 1" },
    { skill: "gates", expect: false, error: "timed out" },
  ]);
  assert.deepEqual(s.gates, { hit: 0, miss: 0, rejected: 0, falseLoad: 0, errored: 2 });
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
