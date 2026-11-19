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

test("a topic links every direct neighbour out and in, with evidence", () => {
  const ts = toTiddlers(graph());
  const w = find(ts, "Workers");
  assert.match(w.text, /!! Links from here\n\* binds to \[\[Workers KV\]\] -- <\$text text="KV binding"\/> <sup>\[\[1\|https:\/\/example\.com\/e1\]\] \[\[2\|https:\/\/example\.com\/e2\]\]<\/sup>\n\* has feature \[\[Cron Triggers\]\]/);
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
  assert.match(find(ts, "Ex ''ample''").text, /^<\$text text='a"""<\$button\/> "c"'\/>/);
  assert.match(find(ts, "Workers").text, /-- <\$text text='ends "q"'\/>/);
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
    [(g) => { g.nodes[2].label = "a b"; }, /contains a line break/],
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
