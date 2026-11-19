// tiddlywiki.test.mjs -- behavioral tests for skills/tiddlywiki/build.mjs,
// the pure graph -> tiddlers mapping. Packing the HTML calls the pinned
// TiddlyWiki CLI through npx and is not exercised here (no network in
// unit tests); the skill's procedure opens the built file to check it.

import { test } from "node:test";
import assert from "node:assert/strict";
import { join, dirname, relative, isAbsolute } from "node:path";
import { fileURLToPath } from "node:url";
import { toTiddlers, validate, defaultOutDir, tagList, quoteAttr } from "../skills/tiddlywiki/build.mjs";

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

test("a topic's text does not repeat its graph as link lists; the counts stay as fields", () => {
  const ts = toTiddlers(graph());
  const w = find(ts, "Workers");
  assert.ok(!/Links from here|Links to here/.test(w.text), w.text);
  assert.equal(find(ts, "Workers KV").links_in, "1");
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
  assert.match(find(ts, "$:/config/topicwiki/command").text, /^codex 'Read the topic wiki at \/data\/example\.tiddlers\.json:/);
  assert.match(find(ts, "$:/config/topicwiki/command-prefix").text, /^codex 'Read .* topic_id is $/);
  assert.match(find(ts, "AI access").text, /<\$codeblock code=\{\{\$:\/config\/topicwiki\/command\}\}\/>/);
  const vt = find(ts, "$:/topicwiki/ViewTemplate/agent");
  assert.equal(vt.tags, "$:/tags/ViewTemplate");
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
    [(g) => { g.nodes[2].label = "Compute"; }, /"Compute" is used twice/],
    [(g) => { g.nodes[2].label = "AI access"; }, /"AI access" is used twice/],
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

// --- hostile input (self-review findings on PR#240) ---

import { execFileSync } from "node:child_process";

/** Run a shell line with `echo` as the agent; return what it printed. */
function runAgentLine(line) {
  return execFileSync("sh", ["-c", line], { encoding: "utf8" });
}

test("the whole-wiki agent line passes the prompt as one literal argument, whatever the title and path", () => {
  const g = graph();
  g.title = `Acme "Pro" $HOME \`id\` it's \\ $(echo pwned)`;
  const store = "/tmp/a b/$(echo pwned)`id`'q\"/x.tiddlers.json";
  const ts = toTiddlers(g, { store, agent: "printf %s" });
  const line = find(ts, "$:/config/topicwiki/command").text;
  const out = runAgentLine(line);
  assert.ok(out.startsWith(`Read the topic wiki at ${store}:`), out);
  assert.ok(out.includes(`titled ${g.title}.`), out);
  assert.ok(!out.includes("pwned\n") && !/uid=/.test(out));
});

test("the per-topic agent line is the same literal argument, with the topic_id", () => {
  const store = "/tmp/$(echo pwned)`id`'q/x.tiddlers.json";
  const ts = toTiddlers(graph(), { store, agent: "printf %s" });
  const prefix = find(ts, "$:/config/topicwiki/command-prefix").text;
  const suffix = find(ts, "$:/config/topicwiki/command-suffix").text;
  const out = runAgentLine(prefix + "workers" + suffix);
  assert.ok(out.startsWith(`Read the topic wiki at ${store}:`), out);
  assert.match(out, /topic_id is workers\./);
  const vt = find(ts, "$:/topicwiki/ViewTemplate/agent").text;
  assert.ok(!vt.includes(store), "the store path must not be spliced into markup");
});

test("source text is shown through a text widget whose delimiter it cannot close", () => {
  const g = graph();
  g.title = "Ex ''ample''";
  g.description = 'a"""<$button/> "c"';
  g.subtitle = "''x'' <$list/>";
  g.edges[0].label = 'ends "q"';
  g.nodes[0].category = "Comp <$list/>";
  const ts = toTiddlers(g);
  assert.match(find(ts, "Ex ''ample''").text, /^<\$topicmap\/>\n\n<\$text text='a"""<\$button\/> "c"'\/>/);
  assert.equal(find(ts, "$:/SiteSubtitle").text, `<$text text="''x'' <$list/>"/>`);
  assert.equal(find(ts, "$:/SiteTitle").text, `<$text text="Ex ''ample''"/>`);
  assert.match(find(ts, "Comp <$list/>").text, /^Every <\$text text="Ex ''ample''"\/> topic in the <\$text text="Comp <\$list\/>"\/> category/);
});

test("quoteAttr picks a delimiter the text does not contain, or none", () => {
  assert.equal(quoteAttr("plain"), '"plain"');
  assert.equal(quoteAttr('say "hi"'), `'say "hi"'`);
  assert.equal(quoteAttr(`it's "x" y`), `"""it's "x" y"""`);
  assert.equal(quoteAttr(`it's "x"`), null);
  assert.equal(quoteAttr(`a"""b'c`), null);
});

test("validate rejects source text no delimiter can quote", () => {
  const g = graph();
  g.edges[0].label = `a"""b'c"`;
  assert.throws(() => validate(g), /edges\[0\]: label cannot be quoted/);
});

test("validate rejects unsafe or colliding category, type, title and source fields", () => {
  const cases = [
    [(g) => { g.nodes[0].category = "$:/SiteTitle"; }, /category "\$:\/SiteTitle"/],
    [(g) => { g.nodes[0].category = "a]]b"; }, /category "a\]\]b"/],
    [(g) => { g.nodes[0].category = "AI access"; }, /"AI access" is used twice/],
    [(g) => { g.nodes[0].category = "Example"; }, /"Example" is used twice/],
    [(g) => { g.nodes[0].category = "Product index"; }, /"Product index" is used twice/],
    [(g) => { g.nodes[0].type = ""; }, /type "" is not a lowercase word/],
    [(g) => { g.nodes[0].type = "<$x/>"; }, /type .* is not a lowercase word/],
    [(g) => { g.edges[0].type = "{{$:/x}} <$list/>"; }, /edges\[0\]: type .* is not snake_case/],
    [(g) => { g.title = "a|b"; }, /title "a\|b" contains/],
    [(g) => { g.title = "!!!"; }, /title has no letters or digits/],
    [(g) => { g.source.url = "data:text/html,x"; }, /source.url is not an http\(s\) URL/],
    [(g) => { g.source.name = "n]]x"; }, /source.name/],
    [(g) => { g.source.fetched = "<$x/>"; }, /source.fetched is not a YYYY-MM-DD date/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
});

test("validate reports malformed input instead of crashing", () => {
  const cases = [
    [(g) => { g.nodes.push(null); }, /nodes\[3\]: not an object/],
    [(g) => { g.nodes[0].label = 7; }, /nodes\[0\]: label missing/],
    [(g) => { g.nodes[0].links = "x"; }, /nodes\[0\]\.links: not a list/],
    [(g) => { g.edges[0].evidence = 3; }, /edges\[0\]\.evidence: not a list/],
    [(g) => { g.edges[0].label = 3; }, /edges\[0\]: label is not a string/],
    [(g) => { delete g.title; }, /title: missing/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), (e) => !(e instanceof TypeError) && re.test(e.message));
  }
});

test("the per-topic agent line uses no substituted attribute, so $(var)$ in the path is never expanded", () => {
  const ts = toTiddlers(graph(), { store: "/tmp/$(currentTiddler)$/x.tiddlers.json" });
  const vt = find(ts, "$:/topicwiki/ViewTemplate/agent").text;
  assert.ok(!vt.includes("code=`"), vt);
  assert.match(vt, /<\$codeblock code=\{\{\{ \[all\[current\]get\[topic_id\]addprefix\{\$:\/config\/topicwiki\/command-prefix\}addsuffix\{\$:\/config\/topicwiki\/command-suffix\}\] \}\}\}\/>/);
});

test("validate rejects titles that a [[link]] would read as another title or a URL", () => {
  const cases = [
    [(g) => { g.nodes[2].label = "Workers]"; }, /ends in "\]"/],
    [(g) => { g.nodes[2].label = "a\rb"; }, /contains a line break/],
    [(g) => { g.nodes[2].label = "a\u2028b"; }, /contains a line break/],
    [(g) => { g.nodes[2].label = " Cron"; }, /starts or ends with a space/],
    [(g) => { g.nodes[2].label = "mailto:x@y"; }, /reads as a URL/],
    [(g) => { g.nodes[2].category = "data:x"; }, /reads as a URL/],
    [(g) => { g.title = `it's "x"`; }, /title cannot be quoted/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
  const ok = graph();
  ok.nodes[2].label = "Note: cron triggers";
  assert.doesNotThrow(() => validate(ok));
});

// --- neighbor graph ---

import { readFileSync } from "node:fs";
import vm from "node:vm";
import { WIDGET_FILE } from "../skills/tiddlywiki/build.mjs";

const neighbors = (t) => JSON.parse(t.neighbors);

test("a topic's neighbors are its links out and in, and its category", () => {
  const ts = toTiddlers(graph());
  assert.deepEqual(neighbors(find(ts, "Workers")), [
    { title: "Workers KV", rel: "binds to", dir: "out" },
    { title: "Cron Triggers", rel: "has feature", dir: "out" },
    { title: "Compute", rel: "in category", dir: "out" },
    { title: "Product index", rel: "of type", dir: "out" },
  ]);
  assert.deepEqual(neighbors(find(ts, "Workers KV")), [
    { title: "Workers", rel: "binds to", dir: "in" },
    { title: "Storage", rel: "in category", dir: "out" },
    { title: "Product index", rel: "of type", dir: "out" },
  ]);
});

test("index tiddlers link the root to its categories and types, and down to members", () => {
  const ts = toTiddlers(graph());
  assert.deepEqual(neighbors(find(ts, "Example")), [
    { title: "Compute", rel: "category", dir: "out" },
    { title: "Storage", rel: "category", dir: "out" },
    { title: "Feature index", rel: "type", dir: "out" },
    { title: "Product index", rel: "type", dir: "out" },
  ]);
  assert.deepEqual(neighbors(find(ts, "Compute")), [
    { title: "Example", rel: "category", dir: "in" },
    { title: "Cron Triggers", rel: "feature", dir: "out" },
    { title: "Workers", rel: "product", dir: "out" },
  ]);
  assert.deepEqual(neighbors(find(ts, "Product index"))[0], { title: "Example", rel: "type", dir: "in" });
});

test("every neighbor names a tiddler in the wiki", () => {
  const ts = toTiddlers(graph());
  const titles = new Set(ts.map((t) => t.title));
  for (const t of ts.filter((x) => x.neighbors)) {
    for (const n of neighbors(t)) assert.ok(titles.has(n.title), `${t.title} -> ${n.title}`);
  }
});

test("the neighbor graph is the last section, after docs, tutorials and the link lists", () => {
  const ts = toTiddlers(graph());
  const text = find(ts, "Workers").text;
  const at = (s) => text.indexOf(s);
  assert.ok(at("!! Docs") < at("!! Tutorials") && at("!! Tutorials") < at("!! Neighbor graph"));
  assert.ok(text.endsWith("!! Neighbor graph\n\n<$topicgraph/>"), text.slice(-80));
  for (const title of ["Compute", "Product index"]) {
    assert.ok(find(ts, title).text.endsWith("!! Neighbor graph\n\n<$topicgraph/>"), title);
  }
});

test("the widget and its stylesheet ship as tiddlers when the builder is given the widget", () => {
  const ts = toTiddlers(graph(), { widget: "exports.topicgraph = 1;" });
  const w = find(ts, "$:/plugins/topicwiki/topicgraph.js");
  assert.equal(w.type, "application/javascript");
  assert.equal(w["module-type"], "widget");
  assert.equal(w.text, "exports.topicgraph = 1;");
  assert.equal(find(ts, "$:/plugins/topicwiki/topicgraph.css").tags, "$:/tags/Stylesheet");
});

/** Load topicgraph.js the way TiddlyWiki does, with a stub widget base. */
function loadWidget() {
  const ctx = vm.createContext({ exports: {}, require: () => ({ widget: function Widget() {} }) });
  vm.runInContext(readFileSync(WIDGET_FILE, "utf8"), ctx);
  return ctx;
}

test("the widget module exports only the topicgraph and topicmap widgets", () => {
  assert.deepEqual(Object.keys(loadWidget().exports), ["topicgraph", "topicmap"]);
});

test("layout puts every neighbor at its own place, one relation per sector", () => {
  const layout = vm.runInContext("layout", loadWidget());
  for (const count of [1, 5, 40, 230]) {
    const input = Array.from({ length: count }, (_, i) => ({ title: `t${i}`, rel: i % 3 ? "uses" : "binds to", dir: i % 2 ? "in" : "out" }));
    const { nodes, radius } = layout(input);
    assert.equal(nodes.length, count);
    assert.equal(new Set(nodes.map((n) => `${n.x},${n.y}`)).size, count, `overlap at ${count}`);
    for (const n of nodes) assert.ok(Math.hypot(n.x, n.y) <= radius + 1);
    const rels = nodes.map((n) => n.rel);
    assert.equal(rels.filter((r, i) => i && r !== rels[i - 1]).length, Math.min(1, new Set(rels).size - 1), "relations interleave");
  }
});

test("a topic with no category or type links the root; a self-edge is not its own neighbor", () => {
  const g = graph();
  delete g.nodes[2].category;
  delete g.nodes[2].type;
  g.edges.push({ source: "kv", target: "kv", type: "uses" });
  const ts = toTiddlers(g);
  assert.deepEqual(neighbors(find(ts, "Cron Triggers")), [
    { title: "Workers", rel: "has feature", dir: "in" },
    { title: "Example", rel: "part of", dir: "out" },
  ]);
  assert.ok(!neighbors(find(ts, "Workers KV")).some((n) => n.title === "Workers KV"));
});

test("a tiddler with no neighbors has no graph section", () => {
  const g = graph();
  for (const n of g.nodes) { delete n.category; delete n.type; }
  const home = find(toTiddlers(g), "Example");
  assert.ok(!home.text.includes("<$topicgraph/>"), home.text.slice(-60));
});

// --- the widget against a fake DOM that refuses innerHTML ---

class FakeEl {
  constructor(doc, tag) {
    Object.assign(this, { doc, tagName: tag, children: [], attrs: {}, style: {}, listeners: {}, parentNode: null, own: "", className: "" });
    doc.created.push(tag);
    this.classList = {
      toggle: (c, on) => { const s = new Set(this.className.split(" ").filter(Boolean)); if (on) s.add(c); else s.delete(c); this.className = [...s].join(" "); },
      contains: (c) => this.className.split(" ").includes(c),
    };
  }
  get textContent() { return this.own + this.children.map((c) => c.textContent).join(""); }
  set textContent(v) { this.own = String(v); this.children = []; }
  set innerHTML(_) { throw new Error("innerHTML used"); }
  setAttribute(k, v) { this.attrs[k] = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  appendChild(c) { c.parentNode = this; this.children.push(c); return c; }
  insertBefore(c, ref) { c.parentNode = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(c); else this.children.splice(i, 0, c); return c; }
  get firstChild() { return this.children[0] || null; }
  addEventListener(t, f) { (this.listeners[t] ||= []).push(f); }
  classes() { return `${this.className} ${this.attrs.class || ""}`.split(" ").filter(Boolean); }
  closest(sel) { for (let e = this; e; e = e.parentNode) if (e.classes().includes(sel.slice(1))) return e; return null; }
  all(cls) { return [...(this.classes().includes(cls) ? [this] : []), ...this.children.flatMap((c) => c.all(cls))]; }
  fire(type, e) { for (const f of this.listeners[type] || []) f({ currentTarget: this, ...e }); }
}

function fakeDocument() {
  const doc = { created: [] };
  doc.createElement = (tag) => new FakeEl(doc, tag);
  doc.createElementNS = (_, tag) => new FakeEl(doc, tag);
  return doc;
}

const MAP = JSON.stringify({
  categories: { Compute: "#f46021" }, relations: { uses: "#1570c8" },
  nodes: [{ t: "T0", x: 0, y: 0, s: 20, c: "Compute", k: "product" }, { t: "T1", x: 50, y: 10, s: 4, c: "Compute", k: "feature" }, { t: "T2", x: -40, y: 30, s: 6 }],
  edges: [[0, 1], [1, 2]],
});

/** Render a widget (topicgraph by default) for a tiddler whose neighbors field is `field`. */
function renderGraph(field, size = { clientWidth: 900, clientHeight: 300 }, widget = "topicgraph", mapText = MAP) {
  const ctx = vm.createContext({ exports: {}, require: () => ({ widget: function Widget() {} }) });
  vm.runInContext(readFileSync(WIDGET_FILE, "utf8"), ctx);
  const TopicGraph = ctx.exports[widget];
  const w = Object.create(TopicGraph.prototype);
  const doc = fakeDocument();
  const events = [];
  Object.assign(w, {
    document: doc, domNodes: [], events,
    wiki: { getTiddler: () => ({ fields: { neighbors: field } }), getTiddlerText: (t, d) => (t === "$:/topicwiki/map" ? mapText : d) },
    computeAttributes: () => ({}), getAttribute: (_, d) => d, getVariable: () => "Centre",
    dispatchEvent: (e) => events.push(e),
  });
  const parent = doc.createElement("div");
  w.render(parent, null);
  const svg = parent.all("tw-tg-svg")[0];
  if (svg) Object.assign(svg, size);
  return { w, doc, parent, svg, events };
}

const many = (n) => JSON.stringify(Array.from({ length: n }, (_, i) => ({ title: `T${i}`, rel: "uses", dir: "out" })));

test("the widget draws every neighbor as text, never as markup", () => {
  const field = JSON.stringify([
    { title: "<img src=x onerror=alert(1)>", rel: "uses", dir: "out" },
    { title: "Plain", rel: "<b>bold</b>", dir: "in" },
  ]);
  const { parent, doc } = renderGraph(field);
  const nodes = parent.all("tw-tg-node");
  assert.deepEqual(nodes.map((n) => n.getAttribute("data-title")).sort(), ["<img src=x onerror=alert(1)>", "Plain"]);
  assert.ok(!doc.created.includes("img") && !doc.created.includes("b"));
  assert.match(parent.textContent, /<b>bold<\/b> \(1\)/);
});

test("a click on a node opens that tiddler; a drag does not", () => {
  const { svg, parent, events } = renderGraph(many(3));
  const circle = parent.all("tw-tg-node")[0].children[0];
  svg.fire("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" });
  svg.fire("click", { target: circle });
  assert.deepEqual(events.map((e) => [e.type, e.navigateTo, e.navigateFromTitle]), [["tm-navigate", "T0", "Centre"]]);
  svg.fire("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" });
  svg.fire("pointermove", { clientX: 40, clientY: 0, buttons: 1 });
  svg.fire("click", { target: circle });
  assert.equal(events.length, 1);
});

test("a drag pans the view as far as the pointer moved, at the drawn scale", () => {
  const { svg, w } = renderGraph(many(3), { clientWidth: 900, clientHeight: 300 });
  const { x, w: width } = w.view;
  svg.fire("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" });
  svg.fire("pointermove", { clientX: 30, clientY: 0, buttons: 1 });
  assert.equal(w.view.x, x - (30 * width) / 300);
});

test("on a touch screen, a crowded graph's first tap shows the name and the second opens it", () => {
  const { svg, parent, events } = renderGraph(many(40));
  const node = parent.all("tw-tg-node")[0];
  const tap = () => { svg.fire("pointerdown", { clientX: 0, clientY: 0, pointerType: "touch" }); svg.fire("click", { target: node.children[0] }); };
  tap();
  assert.equal(events.length, 0);
  assert.ok(node.classes().includes("tw-tg-selected"));
  tap();
  assert.equal(events.length, 1);
});

test("a malformed neighbors field shows a message instead of breaking the tiddler", () => {
  for (const field of ["not json", "{}", JSON.stringify([{ title: "A" }])]) {
    const { parent } = renderGraph(field);
    assert.equal(parent.all("tw-tg-error").length, 1, field);
    assert.equal(parent.all("tw-tg-node").length, 0);
  }
});

// --- the full map, the shared styling, and page-like navigation ---

test("the landing page opens with the full map and has no neighbor graph", () => {
  const home = find(toTiddlers(graph()), "Example");
  assert.ok(home.text.startsWith("<$topicmap/>\n"), home.text.slice(0, 40));
  assert.ok(!home.text.includes("<$topicgraph/>"));
});

test("the map tiddler carries every topic, link and colour; the source layout wins", () => {
  const g = graph();
  g.palette = { categories: { Compute: "#f46021" }, relations: { binds_to: "#123456" } };
  g.nodes.forEach((n, i) => Object.assign(n, { x: i * 10, y: -i * 5, size: 3 + i }));
  const map = JSON.parse(find(toTiddlers(g), "$:/topicwiki/map").text);
  assert.deepEqual(map.nodes[0], { t: "Workers", x: 0, y: 0, s: 3, c: "Compute", k: "product" });
  assert.deepEqual(map.edges, [[0, 1], [0, 2]]);
  assert.equal(map.categories.Compute, "#f46021");
  assert.match(map.categories.Storage, /^#[0-9a-f]{6}$/);
  assert.equal(map.relations["binds to"], "#123456");
});

test("without a source layout the map places every topic apart and sizes it by degree", () => {
  const map = JSON.parse(find(toTiddlers(graph()), "$:/topicwiki/map").text);
  assert.equal(new Set(map.nodes.map((n) => `${n.x},${n.y}`)).size, 3);
  assert.equal(map.nodes[0].s, Math.round((2 + 2 * Math.sqrt(2)) * 100) / 100);
});

test("every tiddler is a page: the address bar names it and the history follows it", () => {
  const ts = toTiddlers(graph());
  assert.equal(find(ts, "$:/config/Navigation/UpdateAddressBar").text, "permalink");
  assert.equal(find(ts, "$:/config/Navigation/UpdateHistory").text, "yes");
  assert.equal(find(ts, "$:/view").text, "page");
});

test("validate rejects a palette colour that is not #rrggbb and a partial layout", () => {
  const cases = [
    [(g) => { g.palette = { categories: { Compute: "red;}body{x" } }; }, /palette.categories.Compute: .* is not #rrggbb/],
    [(g) => { g.palette = []; }, /palette: not an object/],
    [(g) => { g.nodes[0].x = 1; g.nodes[0].y = 2; }, /nodes\[1\]: x and y must be finite numbers/],
    [(g) => { g.nodes[0].size = -1; }, /nodes\[0\]: size is not a positive number/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
});

test("a neighbor is drawn in its map colour and size; a relation in the map's colour", () => {
  const field = JSON.stringify([{ title: "T0", rel: "uses", dir: "out" }, { title: "T1", rel: "uses", dir: "in" }, { title: "Compute", rel: "in category", dir: "out" }]);
  const { parent } = renderGraph(field);
  const dot = (t) => parent.all("tw-tg-node").find((n) => n.getAttribute("data-title") === t).children[0];
  assert.equal(dot("T0").getAttribute("fill"), "#f46021");
  assert.equal(dot("T0").getAttribute("r"), (20 * 0.9).toFixed(1));
  assert.ok(Number(dot("T0").getAttribute("r")) > Number(dot("T1").getAttribute("r")));
  assert.equal(dot("Compute").getAttribute("fill"), "#f46021");
  const uses = parent.all("tw-tg-edge").map((l) => l.getAttribute("stroke"));
  assert.ok(uses.includes("#1570c8"));
});

test("the full map draws every node and link, lights a hovered node's links, and opens it on click", () => {
  const { parent, svg, events, w } = renderGraph(undefined, undefined, "topicmap");
  const nodes = parent.all("tw-tm-node");
  assert.deepEqual(nodes.map((n) => n.getAttribute("data-title")).sort(), ["T0", "T1", "T2"]);
  assert.equal(parent.all("tw-tm-edge").length, 2);
  const t1 = nodes.find((n) => n.getAttribute("data-title") === "T1");
  svg.fire("pointerover", { target: t1.children[0] });
  assert.ok(t1.getAttribute("class").includes("tw-tm-on"));
  assert.equal(parent.all("tw-tm-lit").length, 2);
  svg.fire("pointerleave", {});
  assert.equal(parent.all("tw-tm-lit").length, 0);
  svg.fire("pointerdown", { clientX: 0, clientY: 0, pointerType: "mouse" });
  svg.fire("click", { target: t1.children[0] });
  assert.deepEqual(events.map((e) => [e.type, e.navigateTo]), [["tm-navigate", "T1"]]);
  assert.equal(w.nodeClass, "tw-tm-node");
});

test("a product is always named on the map; other topics on hover", () => {
  const { parent } = renderGraph(undefined, undefined, "topicmap");
  const label = (t) => parent.all("tw-tm-node").find((n) => n.getAttribute("data-title") === t).children[1].getAttribute("class");
  assert.match(label("T0"), /tw-tm-product/);
  assert.match(label("T1"), /tw-tg-hover/);
});

test("an unreadable map tiddler shows a message instead of breaking the page", () => {
  const { parent } = renderGraph(undefined, undefined, "topicmap", "not json");
  assert.equal(parent.all("tw-tg-error").length, 1);
});

// --- review fixes for the map ---

import { LANDING_FILE } from "../skills/tiddlywiki/build.mjs";

test("a topic has the same radius on the map and in a neighbor graph", () => {
  const map = renderGraph(undefined, undefined, "topicmap").parent;
  const graphView = renderGraph(JSON.stringify([{ title: "T0", rel: "uses", dir: "out" }, { title: "T1", rel: "uses", dir: "out" }])).parent;
  const r = (root, cls, t) => root.all(cls).find((n) => n.getAttribute("data-title") === t).children[0].getAttribute("r");
  for (const t of ["T0", "T1"]) assert.equal(r(graphView, "tw-tg-node", t), r(map, "tw-tm-node", t), t);
});

test("a neighbor graph spaces its rings for its largest node", () => {
  const layout = vm.runInContext("layout", loadWidget());
  const { nodes } = layout(Array.from({ length: 12 }, (_, i) => ({ title: `t${i}`, rel: "uses", dir: "out" })), 30);
  const gaps = nodes.map((a, i) => Math.hypot(a.x - nodes[(i + 1) % nodes.length].x, a.y - nodes[(i + 1) % nodes.length].y));
  assert.ok(Math.min(...gaps) >= 2 * 30, Math.min(...gaps));
});

test("a category or relation named like an Object member keeps its colour", () => {
  for (const name of ["constructor", "__proto__", "toString"]) {
    const g = graph();
    g.palette = { categories: {}, relations: {} };
    g.nodes[0].category = name;
    g.edges[0].type = name === "__proto__" ? "proto" : name.toLowerCase();
    const map = JSON.parse(find(toTiddlers(g), "$:/topicwiki/map").text);
    assert.match(map.categories[name], /^#[0-9a-f]{6}$/, name);
    assert.ok(Object.values(map.relations).every((c) => /^#[0-9a-f]{6}$/.test(c)));
  }
});

test("validate bounds the layout and the sizes", () => {
  const cases = [
    [(g) => { g.nodes.forEach((n) => Object.assign(n, { x: 0, y: 0 })); g.nodes[1].x = 1e308; }, /nodes\[1\]: x and y must be finite numbers within/],
    [(g) => { g.nodes[0].size = 1e308; }, /nodes\[0\]: size is not a positive number up to/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
});

test("a map tiddler of the wrong shape shows a message on every widget instead of throwing", () => {
  const bad = [JSON.stringify({ nodes: {} }), JSON.stringify({ nodes: [{ t: "A", x: 0, y: 0, s: 1 }], edges: [[0, 5]] }),
    JSON.stringify({ nodes: [{ t: "A", x: "0", y: 0, s: 1 }], edges: [] })];
  for (const text of bad) {
    assert.equal(renderGraph(undefined, undefined, "topicmap", text).parent.all("tw-tg-error").length, 1, text);
    const field = JSON.stringify([{ title: "A", rel: "uses", dir: "out" }]);
    assert.equal(renderGraph(field, undefined, "topicgraph", text).parent.all("tw-tg-error").length, 1, text);
  }
});

/** Run the landing startup module against a fake browser; return what it did. */
function runLanding(hash, defaults = "[[Example]]") {
  const calls = [];
  const tw = { locationHash: hash || "#", wiki: { getTiddlerText: () => defaults, filterTiddlers: (f) => (f ? [f.replace(/^\[\[|\]\]$/g, "")] : []) } };
  const window = { location: { hash }, history: { state: null, replaceState: (...a) => calls.push(a) } };
  const ctx = vm.createContext({ exports: {}, window, $tw: tw });
  vm.runInContext(readFileSync(LANDING_FILE, "utf8"), ctx);
  ctx.exports.startup();
  return { calls, tw, exports: ctx.exports };
}

test("opening the file with no address names the landing page without a new history entry", () => {
  const { calls, tw, exports } = runLanding("");
  assert.deepEqual(calls.map((c) => c[2]), ["#Example"]);
  assert.equal(tw.locationHash, "#Example");
  assert.deepEqual([[...exports.after], [...exports.before]], [["startup"], ["story"]]);
  assert.equal(runLanding("#Workers").calls.length, 0);
});

// --- the page story view ---

import { PAGEVIEW_FILE } from "../skills/tiddlywiki/build.mjs";

/** A fake browser: history entries with state, and the events the view listens to. */
function fakeBrowser(initialState = null) {
  const handlers = {};
  const win = {
    history: { state: initialState, replaceState(st) { this.state = st; } },
    addEventListener: (type, f) => { (handlers[type] ||= []).push(f); },
    scrollTo: () => {},
  };
  /** The browser moves to an entry (state null for a new one) and fires its events. */
  win.go = (state) => { win.history.state = state; for (const t of ["popstate", "hashchange"]) for (const f of handlers[t] || []) f({}); };
  return win;
}

/** Load pageview.js against a fake browser; return its context. */
function loadPageView(win = fakeBrowser()) {
  const ctx = vm.createContext({ exports: {}, window: win, $tw: { utils: { getAnimationDuration: () => 400 } } });
  vm.runInContext(readFileSync(PAGEVIEW_FILE, "utf8"), ctx);
  return Object.assign(ctx, { win });
}

test("a history step is back only when the browser returns to a lower step number", () => {
  const traverse = vm.runInContext("traverse", loadPageView());
  const plain = (o) => JSON.parse(JSON.stringify(o));
  assert.deepEqual(plain(traverse(undefined, null)), { position: 0, back: false, stamp: true });
  assert.deepEqual(plain(traverse(undefined, 3)), { position: 4, back: false, stamp: true });
  assert.deepEqual(plain(traverse(2, 4)), { position: 2, back: true, stamp: false });
  assert.deepEqual(plain(traverse(5, 4)), { position: 5, back: false, stamp: false });
});

/** A list widget whose items render fake elements; the history top is `top`. */
function fakeList(titles, top) {
  const els = titles.map((t) => {
    const on = {};
    return {
      nodeType: 1, title: t, style: {}, offsetWidth: 1, classList: { add() {} },
      addEventListener: (type, f) => { on[type] = f; }, removeEventListener: (type) => { delete on[type]; },
      /** The browser ends this element's transition (or a child's, with `fromChild`). */
      settle(fromChild) { const f = on.transitionend; if (f) f({ target: fromChild ? {} : this, currentTarget: this }); },
    };
  });
  const children = els.map((el, i) => ({ findFirstDomNode: () => el, parseTreeNode: { itemTitle: titles[i] }, removeChildDomNodes() {} }));
  children.forEach((c, i) => Object.assign(c, { previousSibling: () => children[i - 1], nextSibling: () => children[i + 1] }));
  return {
    els, children,
    widget: { wiki: { getTiddlerDataCached: () => [{ title: top }] }, historyTitle: "$:/HistoryList", children, findListItem: (_, t) => titles.indexOf(t) },
  };
}

/** Navigate and return the transform the incoming page starts from. */
function startOf(view, els, title) {
  const el = els.find((e) => e.title === title);
  let start;
  el.style = new Proxy(el.style, { set(o, k, v) { if (k === "transform" && start === undefined) start = v; o[k] = v; return true; } });
  view.navigateTo({ title });
  return start;
}

const ESE = "translate(-48px, -18px)"; // starts WNW of rest, moves ESE
const WNW = "translate(48px, 18px)"; // starts ESE of rest, moves WNW

test("forward moves ESE and the browser's back moves WNW, even to the page just left", () => {
  const ctx = loadPageView();
  const { els, widget } = fakeList(["Home", "A", "B"], "Home");
  const view = new ctx.exports.page(widget);
  assert.equal(ctx.win.history.state.topicwikiStep, 0);
  assert.equal(startOf(view, els, "A"), ESE);
  ctx.win.go(null);
  assert.equal(startOf(view, els, "B"), ESE);
  ctx.win.go(null);
  assert.equal(startOf(view, els, "A"), ESE, "a link to the page just left is a step forward");
  ctx.win.go(null);
  ctx.win.go({ topicwikiStep: 2 });
  assert.equal(startOf(view, els, "B"), WNW, "the browser's back button");
  ctx.win.go({ topicwikiStep: 3 });
  assert.equal(startOf(view, els, "A"), ESE, "the browser's forward button");
});

test("after a reload the step number on the entry still tells back from forward", () => {
  const ctx = loadPageView(fakeBrowser({ topicwikiStep: 5 }));
  const { els, widget } = fakeList(["Home", "A"], "A");
  const view = new ctx.exports.page(widget);
  ctx.win.go({ topicwikiStep: 4 });
  assert.equal(startOf(view, els, "Home"), WNW);
  ctx.win.go({ topicwikiStep: 5 });
  assert.equal(startOf(view, els, "A"), ESE);
});

test("closing the shown tiddler shows its neighbour instead of a blank page", () => {
  const ctx = loadPageView();
  const { els, children, widget } = fakeList(["Home", "A"], "A");
  const view = new ctx.exports.page(widget);
  view.remove(children[1]);
  assert.equal(els[0].style.display, "block");
  assert.equal(view.current, els[0]);
});

test("a quick second step leaves the page it passed through hidden, not snapped back", () => {
  const ctx = loadPageView();
  const { els, widget } = fakeList(["Home", "A", "B"], "Home");
  const view = new ctx.exports.page(widget);
  view.navigateTo({ title: "A" });
  view.navigateTo({ title: "B" });
  const a = els.find((e) => e.title === "A");
  a.settle(true);
  assert.notEqual(a.style.display, "none", "a child's transition does not finish the page");
  a.settle();
  els.forEach((e) => e.settle());
  assert.equal(a.style.display, "none");
  assert.equal(a.style.opacity, "0");
  assert.equal(a.style.pointerEvents, "none");
});

test("a page that slides away stops taking clicks, and the first page shown is the history top", () => {
  const ctx = loadPageView();
  const { els, widget } = fakeList(["Home", "A"], "Missing");
  const view = new ctx.exports.page(widget);
  assert.equal(view.current, els[0], "a history top not in the story falls back to the first page");
  view.navigateTo({ title: "A" });
  assert.equal(els[0].style.pointerEvents, "none");
  assert.equal(els[1].style.pointerEvents, "");
});

test("a page brought back takes clicks again, and a page left mid-slide is hidden at the next step", () => {
  const ctx = loadPageView();
  const { els, widget } = fakeList(["Home", "A", "B"], "Home");
  const view = new ctx.exports.page(widget);
  view.navigateTo({ title: "A" });
  ctx.win.go(null);
  ctx.win.go({ topicwikiStep: 0 });
  view.navigateTo({ title: "Home" });
  assert.equal(els[0].style.pointerEvents, "", "Home was sent away, and takes clicks once it is back");
  view.navigateTo({ title: "B" });
  assert.equal(els[1].style.display, "none", "A never finished sliding away; it is hidden now");
  assert.notEqual(els[0].style.display, "none", "Home is the page sliding out");
});

// --- a subject tiddler: explanation, comparisons, case studies, docs, tutorials ---

import { withContent } from "../skills/tiddlywiki/build.mjs";

/** The example graph with written content on Workers. */
function written() {
  const g = graph();
  Object.assign(g.nodes[0], {
    explanation: "Workers runs your code near users. It reads data from [[Workers KV]] and runs on a schedule with [[cron jobs|Cron Triggers]].\n\nSecond paragraph, with ''no markup'' and a <$button/>.",
    compare: [{ title: "Workers KV", text: "KV stores data; Workers runs code that reads it from [[Cron Triggers]] too." }],
    cases: [{ title: "Acme moves to the edge", url: "https://example.com/case/acme", summary: "Cut latency by half." }],
  });
  return g;
}

test("a subject tiddler reads: explanation, compared with, case studies, docs, tutorials, then the graph", () => {
  const text = find(toTiddlers(written()), "Workers").text;
  const order = ["Workers runs", "!! Compared with", "!! Case studies", "!! Docs", "!! Tutorials", "!! Neighbor graph"].map((h) => text.indexOf(h));
  assert.ok(order.every((at, i) => at >= 0 && (i === 0 || at > order[i - 1])), `${order}\n${text}`);
});

test("the explanation links topics by title and shows everything else as plain text", () => {
  const text = find(toTiddlers(written()), "Workers").text;
  assert.ok(text.startsWith('<$text text="Workers runs your code near users. It reads data from "/>[[Workers KV]]<$text text=" and runs on a schedule with "/>[[cron jobs|Cron Triggers]]<$text text="."/>'), text.slice(0, 260));
  assert.match(text, /\n\n<\$text text="Second paragraph, with ''no markup'' and a <\$button\/>\."\/>/);
});

test("comparisons link the other topic; case studies link out with a plain summary", () => {
  const text = find(toTiddlers(written()), "Workers").text;
  assert.match(text, /!! Compared with\n\* \[\[Workers KV\]\]: <\$text text="KV stores data; Workers runs code that reads it from "\/>\[\[Cron Triggers\]\]<\$text text=" too\."\/>/);
  assert.match(text, /!! Case studies\n\* \[\[Acme moves to the edge\|https:\/\/example\.com\/case\/acme\]\] -- <\$text text="Cut latency by half\."\/>/);
});

test("a topic with nothing written shows its description and no empty sections", () => {
  const text = find(toTiddlers(graph()), "Workers KV").text;
  assert.ok(text.startsWith('<$view field="description"/>'));
  assert.ok(!text.includes("!! Compared with") && !text.includes("!! Case studies"));
});

test("validate rejects written content that links nowhere or cannot be shown safely", () => {
  const cases = [
    [(g) => { g.nodes[0].explanation = "See [[Nowhere]]."; }, /nodes\[0\]: explanation links "Nowhere", which is not a tiddler/],
    [(g) => { g.nodes[0].explanation = "See [[a|b|Workers KV]]."; }, /nodes\[0\]: explanation has a link it cannot read/],
    [(g) => { g.nodes[0].explanation = `it's "x"`; }, /nodes\[0\]: explanation cannot be quoted/],
    [(g) => { g.nodes[0].compare = [{ title: "Nowhere", text: "x" }]; }, /nodes\[0\]\.compare\[0\]: "Nowhere" is not a topic/],
    [(g) => { g.nodes[0].compare = "x"; }, /nodes\[0\]\.compare: not a list/],
    [(g) => { g.nodes[0].cases = [{ title: "T", url: "ftp://x" }]; }, /nodes\[0\]\.cases\[0\]: url is not an http\(s\) URL/],
    [(g) => { g.nodes[0].cases = [{ title: "a|b", url: "https://x.example" }]; }, /nodes\[0\]\.cases\[0\]: title missing or unsafe/],
  ];
  for (const [mutate, re] of cases) {
    const g = graph();
    mutate(g);
    assert.throws(() => validate(g), re);
  }
});

test("written content is kept in its own file and merged by topic id", () => {
  const merged = withContent(graph(), { workers: { explanation: "Hi.", cases: [] } });
  assert.equal(merged.nodes[0].explanation, "Hi.");
  assert.equal(graph().nodes[0].explanation, undefined, "the graph itself is not changed");
  assert.throws(() => withContent(graph(), { nope: { explanation: "x" } }), /content: "nope" is not a topic id/);
  assert.throws(() => withContent(graph(), { workers: { label: "x" } }), /content\.workers: "label" is not a written field/);
});
