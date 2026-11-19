// tiddlywiki.test.mjs -- behavioral tests for skills/tiddlywiki/build.mjs,
// the pure graph -> tiddlers mapping. Packing the HTML calls the pinned
// TiddlyWiki CLI through npx and is not exercised here (no network in
// unit tests); the skill's procedure opens the built file to check it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { toTiddlers, validate, defaultOutDir, tagList } from "../skills/tiddlywiki/build.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");

const graph = () => ({
  title: "Example",
  description: "A tiny example.",
  source: { name: "the map", url: "https://example.com/map", fetched: "2026-11-18" },
  nodes: [
    { id: "workers", label: "Workers", type: "product", category: "Compute",
      description: "Runs code. With ''quotes'' and //slashes//.",
      docs: "https://example.com/workers/",
      links: [{ title: "Product page", url: "https://example.com/p/workers" }],
      tutorials: [{ title: "Tutorials", url: "https://example.com/workers/tutorials/" }] },
    { id: "kv", label: "Workers KV", type: "product", category: "Storage", docs: "https://example.com/kv/" },
    { id: "cron", label: "Cron Triggers", type: "feature", category: "Compute" },
  ],
  edges: [
    { source: "workers", target: "kv", type: "binds_to", label: "KV binding",
      evidence: ["https://example.com/e1", "https://example.com/e2"] },
    { source: "workers", target: "cron", type: "has_feature" },
  ],
});

const find = (ts, title) => ts.find((t) => t.title === title);

test("each node becomes a tiddler with its docs, tutorials and fields", () => {
  const w = find(toTiddlers(graph()), "Workers");
  assert.equal(w.topic_id, "workers");
  assert.equal(w.docs_url, "https://example.com/workers/");
  assert.equal(w.description, "Runs code. With ''quotes'' and //slashes//.");
  assert.match(w.text, /\* \[\[Documentation\|https:\/\/example\.com\/workers\/\]\]/);
  assert.match(w.text, /\* \[\[Product page\|https:\/\/example\.com\/p\/workers\]\]/);
  assert.match(w.text, /!! Tutorials\n\* \[\[Tutorials\|https:\/\/example\.com\/workers\/tutorials\/\]\]/);
  assert.equal(w.tags, "Compute [[Product index]]");
});

test("the description is shown through a view widget, never parsed as markup", () => {
  const w = find(toTiddlers(graph()), "Workers");
  assert.ok(w.text.startsWith('<$view field="description"/>'));
  assert.ok(!w.text.includes("''quotes''"));
});

test("a topic links every direct neighbour out and in, with evidence", () => {
  const ts = toTiddlers(graph());
  const w = find(ts, "Workers");
  assert.match(w.text, /!! Links from here\n\* binds to \[\[Workers KV\]\] -- <\$text text="""KV binding"""\/> <sup>\[\[1\|https:\/\/example\.com\/e1\]\] \[\[2\|https:\/\/example\.com\/e2\]\]<\/sup>\n\* has feature \[\[Cron Triggers\]\]/);
  assert.match(w.text, /!! Links to here\nNone\./);
  const kv = find(ts, "Workers KV");
  assert.match(kv.text, /!! Links to here\n\* \[\[Workers\]\] binds to this/);
  assert.equal(kv.links_in, "1");
  assert.equal(w.links_out, "2");
});

test("missing docs and tutorials say so instead of leaving an empty section", () => {
  const c = find(toTiddlers(graph()), "Cron Triggers");
  assert.match(c.text, /!! Docs\nNone recorded in the source\./);
  assert.match(c.text, /!! Tutorials\nNone recorded in the source\./);
});

test("category and type index tiddlers list their members", () => {
  const ts = toTiddlers(graph());
  const compute = find(ts, "Compute");
  assert.match(compute.text, /!! Feature index \(1\)\n\* \[\[Cron Triggers\]\]/);
  assert.match(compute.text, /!! Product index \(1\)\n\* \[\[Workers\]\]/);
  assert.match(find(ts, "Product index").text, /\* \[\[Workers\]\]\n\* \[\[Workers KV\]\]/);
});

test("the home tiddler is the default and links categories and AI access", () => {
  const ts = toTiddlers(graph());
  assert.equal(find(ts, "$:/DefaultTiddlers").text, "[[Example]]");
  const home = find(ts, "Example");
  assert.match(home.text, /\* \[\[Compute\]\] \(2\)/);
  assert.match(home.text, /\[\[AI access\]\]/);
  assert.match(home.text, /\[\[the map\|https:\/\/example\.com\/map\]\], fetched 2026-11-18/);
});

test("the agent line names the store and the agent command", () => {
  const ts = toTiddlers(graph(), { store: "/data/example.tiddlers.json", agent: "codex" });
  const ai = find(ts, "AI access");
  assert.match(ai.text, /<\$codeblock code="""codex "Read the topic wiki at \/data\/example\.tiddlers\.json/);
  const vt = find(ts, "$:/topicwiki/ViewTemplate/agent");
  assert.equal(vt.tags, "$:/tags/ViewTemplate");
  assert.match(vt.text, /topic_id is \$\{ \[all\[current\]get\[topic_id\]\] \}\$/);
  assert.equal(find(ts, "$:/config/topicwiki/agent-command").text, "codex");
});

test("the agent prompt is one shell word: no double quote inside the quoted prompt", () => {
  const ts = toTiddlers(graph(), { store: "/data/example.tiddlers.json" });
  for (const title of ["AI access", "$:/topicwiki/ViewTemplate/agent"]) {
    const prompt = find(ts, title).text.match(/(?:claude|\}\$) "(.*?)" ?(?:"""|`)/)[1];
    assert.ok(!prompt.includes('"'), `${title}: ${prompt}`);
  }
});

test("every [[link]] in the output names a tiddler that exists", () => {
  const ts = toTiddlers(graph());
  const titles = new Set(ts.map((t) => t.title));
  for (const t of ts) {
    const prose = t.text.replace(/`[^`\n]*`/g, "").replace(/<\$codeblock[\s\S]*?\/>/g, "");
    for (const [, target] of prose.matchAll(/\[\[([^\]|]+)\]\]/g)) {
      assert.ok(titles.has(target), `${t.title} links missing tiddler ${target}`);
    }
  }
});

test("output is sorted by title, so a rebuild diffs cleanly", () => {
  const titles = toTiddlers(graph()).map((t) => t.title);
  assert.deepEqual(titles, [...titles].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)));
});

test("validate rejects what would break links or merge tiddlers", () => {
  const cases = [
    [(g) => { g.nodes[1].id = "workers"; }, /duplicate id workers/],
    [(g) => { g.nodes[1].label = "Workers"; }, /duplicate label Workers/],
    [(g) => { g.nodes[0].label = "A|B"; }, /contains "\|"/],
    [(g) => { g.nodes[0].label = "x]]y"; }, /contains "\]\]"/],
    [(g) => { g.nodes[0].id = "Has Space"; }, /not a lowercase slug/],
    [(g) => { g.edges[0].target = "nope"; }, /unknown target nope/],
    [(g) => { g.nodes[0].docs = "javascript:alert(1)"; }, /docs is not an http\(s\) URL/],
    [(g) => { g.edges[0].evidence = ["ftp://x"]; }, /evidence "ftp:\/\/x"/],
    [(g) => { g.nodes[2].label = "Compute"; }, /index tiddler "Compute" collides/],
    [(g) => { g.nodes[2].label = "AI access"; }, /index tiddler "AI access" collides/],
    [(g) => { g.edges[0].label = 'a"""b'; }, /label contains """/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
});

test("tagList brackets tags that contain spaces", () => {
  assert.equal(tagList(["Zero Trust", "AI"]), "[[Zero Trust]] AI");
});

test("the default output directory is per-user data, never inside this checkout", () => {
  for (const env of [{}, { XDG_DATA_HOME: "/tmp/xdg" }]) {
    const out = defaultOutDir(env);
    const rel = relative(REPO, out);
    assert.ok(rel.startsWith("..") || isAbsolute(rel), `${out} is inside the repo`);
  }
  assert.equal(defaultOutDir({ XDG_DATA_HOME: "/tmp/xdg" }), "/tmp/xdg/topicwiki");
});
