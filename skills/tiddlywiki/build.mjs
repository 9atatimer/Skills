#!/usr/bin/env node
// build.mjs -- turn a topic graph (references/topic-graph.md) into a
// single-file TiddlyWiki plus the plain JSON tiddler store an agent reads.
//
//   node build.mjs <graph.json> [--out <file.html>] [--agent <command>]
//
// The pure part (validate, toTiddlers) is exported for test/tiddlywiki.test.mjs;
// main() is the shell: it reads the graph, writes <name>.tiddlers.json, and
// packs the HTML with the pinned TiddlyWiki CLI through npx.

import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const TIDDLYWIKI = "tiddlywiki@5.4.1";

const FORBIDDEN_IN_TITLE = ["[[", "]]", "{{", "}}", "|", "\n"];
const TYPE_INDEX = (type) => `${type[0].toUpperCase()}${type.slice(1)} index`;
const ID_RE = /^[a-z0-9][a-z0-9._-]*$/;
const NODE_TYPE_RE = /^[a-z][a-z0-9_-]*$/;
const EDGE_TYPE_RE = /^[a-z][a-z0-9_]*$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const AI_ACCESS = "AI access";

/** The default output directory: per-user data, never inside a checkout. */
export function defaultOutDir(env = process.env) {
  const base = env.XDG_DATA_HOME || join(homedir(), ".local", "share");
  return join(base, "topicwiki");
}

/** The file-name slug of a graph title ("" when it has no letters or digits). */
export function slugOf(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

/**
 * A TiddlyWiki attribute value that shows s literally: the first of ", '
 * and """ that s does not break. null when none fits.
 */
export function quoteAttr(s) {
  if (!s.includes('"')) return `"${s}"`;
  if (!s.includes("'")) return `'${s}'`;
  if (!s.includes('"""') && !s.endsWith('"')) return `"""${s}"""`;
  return null;
}

/** Wikitext that renders s as plain text, never as markup. */
const txt = (s) => `<$text text=${quoteAttr(s)}/>`;

/** POSIX shell single-quote escaping, without the surrounding quotes. */
const shEsc = (s) => s.replace(/'/g, "'\\''");

const isStr = (x) => typeof x === "string";
const isObj = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
// A title must survive a [[link]] unchanged: TiddlyWiki's link rule stops
// at the first "]]", does not cross a line break, trims spaces, and treats
// a URL-shaped target as an external link.
const URLISH = /^[a-z][a-z0-9+.-]*:\S*$/i;
const badTitle = (t) =>
  (FORBIDDEN_IN_TITLE.find((s) => t.includes(s)) && `contains ${JSON.stringify(FORBIDDEN_IN_TITLE.find((s) => t.includes(s)))}`) ||
  (t.startsWith("$:/") && 'contains "$:/"') ||
  (/[\r\u2028\u2029\u0085]/.test(t) && "contains a line break") ||
  (t.endsWith("]") && 'ends in "]"') ||
  (t !== t.trim() && "starts or ends with a space") ||
  (URLISH.test(t) && "reads as a URL");
const badUrl = (u) => !isStr(u) || !/^https?:\/\/[^\s|\]]+$/.test(u);

/** Throw one Error listing every problem with the graph; return it if valid. */
export function validate(g) {
  if (!isObj(g)) throw new Error("graph: not an object");
  const errs = [];
  const title = (at, t) => {
    if (!isStr(t) || !t) return errs.push(`${at}: missing`), false;
    const bad = badTitle(t);
    if (bad) return errs.push(`${at} ${JSON.stringify(t)} ${bad}`), false;
    return true;
  };
  const quotable = (at, s) => {
    if (s === undefined) return;
    if (!isStr(s)) errs.push(`${at} is not a string`);
    else if (quoteAttr(s) === null) errs.push(`${at} cannot be quoted: it holds ', " and """ (or ends in ")`);
  };
  const list = (at, x) => {
    if (x === undefined) return [];
    if (!Array.isArray(x)) return errs.push(`${at}: not a list`), [];
    return x;
  };

  if (title("title", g.title)) {
    if (!slugOf(g.title)) errs.push("title has no letters or digits");
    if (quoteAttr(g.title) === null) errs.push("title cannot be quoted: it holds ', \" and \"\"\" (or ends in \")");
  }
  quotable("subtitle", g.subtitle);
  quotable("description", g.description);
  if (g.source !== undefined) {
    if (!isObj(g.source)) errs.push("source: not an object");
    else {
      if (g.source.name !== undefined) title("source.name", g.source.name);
      if (g.source.url !== undefined && badUrl(g.source.url)) errs.push("source.url is not an http(s) URL");
      if (g.source.fetched !== undefined && !(isStr(g.source.fetched) && DATE_RE.test(g.source.fetched))) {
        errs.push("source.fetched is not a YYYY-MM-DD date");
      }
    }
  }
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) errs.push("nodes: missing or empty");
  if (!Array.isArray(g.edges)) errs.push("edges: missing");
  if (errs.length) throw new Error(errs.join("\n"));

  const ids = new Set();
  const labels = new Set();
  const cats = new Set();
  const types = new Set();
  for (const [i, n] of g.nodes.entries()) {
    const at = `nodes[${i}]`;
    if (!isObj(n)) { errs.push(`${at}: not an object`); continue; }
    if (!isStr(n.id) || !ID_RE.test(n.id)) errs.push(`${at}: id ${JSON.stringify(n.id)} is not a lowercase slug`);
    else if (ids.has(n.id)) errs.push(`${at}: duplicate id ${n.id}`);
    ids.add(n.id);
    if (!isStr(n.label) || !n.label) errs.push(`${at}: label missing`);
    else if (title(`${at}: label`, n.label)) {
      if (labels.has(n.label)) errs.push(`${at}: duplicate label ${n.label}`);
      labels.add(n.label);
    }
    if (n.type !== undefined) {
      if (!isStr(n.type) || !NODE_TYPE_RE.test(n.type)) errs.push(`${at}: type ${JSON.stringify(n.type)} is not a lowercase word`);
      else types.add(n.type);
    }
    if (n.category !== undefined && title(`${at}: category`, n.category)) {
      if (quoteAttr(n.category) === null) errs.push(`${at}: category cannot be quoted`);
      else cats.add(n.category);
    }
    if (n.description !== undefined && !isStr(n.description)) errs.push(`${at}: description is not a string`);
    if (n.status !== undefined && !isStr(n.status)) errs.push(`${at}: status is not a string`);
    if (n.docs !== undefined && badUrl(n.docs)) errs.push(`${at}: docs is not an http(s) URL`);
    for (const key of ["links", "tutorials"]) {
      for (const [j, l] of list(`${at}.${key}`, n[key]).entries()) {
        if (!isObj(l) || !isStr(l.title) || !l.title || badTitle(l.title)) errs.push(`${at}.${key}[${j}]: title missing or unsafe`);
        if (!isObj(l) || badUrl(l.url)) errs.push(`${at}.${key}[${j}]: url is not an http(s) URL`);
      }
    }
  }
  for (const [i, e] of g.edges.entries()) {
    const at = `edges[${i}]`;
    if (!isObj(e)) { errs.push(`${at}: not an object`); continue; }
    if (!ids.has(e.source)) errs.push(`${at}: unknown source ${e.source}`);
    if (!ids.has(e.target)) errs.push(`${at}: unknown target ${e.target}`);
    if (!isStr(e.type) || !EDGE_TYPE_RE.test(e.type)) errs.push(`${at}: type ${JSON.stringify(e.type)} is not snake_case`);
    if (e.label !== undefined && e.label !== "") quotable(`${at}: label`, e.label);
    for (const u of list(`${at}.evidence`, e.evidence)) if (badUrl(u)) errs.push(`${at}: evidence ${JSON.stringify(u)} is not an http(s) URL`);
  }
  // Topics, indexes, the home and AI access share one title space; a title
  // used twice would merge two tiddlers into one.
  const seen = new Map();
  const claim = (t, what) => {
    if (seen.has(t)) errs.push(`"${t}" is used twice: ${seen.get(t)} and ${what}`);
    else seen.set(t, what);
  };
  claim(g.title, "the home tiddler");
  claim(AI_ACCESS, "the AI access tiddler");
  for (const c of cats) claim(c, "a category");
  for (const ty of types) claim(TYPE_INDEX(ty), "a type index");
  for (const l of labels) claim(l, "a node label");
  if (errs.length) throw new Error(errs.join("\n"));
  return g;
}

const byLabel = (a, b) => a.label.localeCompare(b.label);
const human = (type) => type.replace(/_/g, " ");
const link = (title, url) => `[[${title}|${url}]]`;

function evidence(e) {
  const ev = e.evidence || [];
  return ev.length ? ` <sup>${ev.map((u, i) => link(String(i + 1), u)).join(" ")}</sup>` : "";
}

/** Render one topic's text: docs, tutorials, then its direct links out and in. */
function topicText(n, out, inn, byId) {
  const lines = ["<$view field=\"description\"/>", ""];
  lines.push("!! Docs");
  if (n.docs) lines.push(`* ${link("Documentation", n.docs)}`);
  for (const l of n.links || []) lines.push(`* ${link(l.title, l.url)}`);
  if (!n.docs && !(n.links || []).length) lines.push("None recorded in the source.");
  lines.push("", "!! Tutorials");
  if ((n.tutorials || []).length) for (const l of n.tutorials) lines.push(`* ${link(l.title, l.url)}`);
  else lines.push("None recorded in the source.");
  const section = (heading, edges, fmt) => {
    lines.push("", heading);
    if (!edges.length) return lines.push("None.");
    for (const e of edges) lines.push(fmt(e));
  };
  const note = (e) => (e.label ? ` -- ${txt(e.label)}` : "");
  const sortBy = (key) => (a, b) => a.type.localeCompare(b.type) || byLabel(byId.get(a[key]), byId.get(b[key]));
  section("!! Links from here", [...out].sort(sortBy("target")),
    (e) => `* ${human(e.type)} [[${byId.get(e.target).label}]]${note(e)}${evidence(e)}`);
  section("!! Links to here", [...inn].sort(sortBy("source")),
    (e) => `* [[${byId.get(e.source).label}]] ${human(e.type)} this${note(e)}${evidence(e)}`);
  return lines.join("\n");
}

function membersList(nodes) {
  return nodes.length ? [...nodes].sort(byLabel).map((n) => `* [[${n.label}]]`).join("\n") : "None.";
}

/**
 * Map a validated topic graph to an array of tiddlers, sorted by title.
 * opts.store: absolute path of the .tiddlers.json an agent reads.
 * opts.agent: the agent CLI the copy-paste line starts (default "claude").
 */
export function toTiddlers(g, opts = {}) {
  validate(g);
  const store = opts.store || "<path to the .tiddlers.json>";
  const agent = opts.agent || "claude";
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = new Map(g.nodes.map((n) => [n.id, []]));
  const inn = new Map(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) { out.get(e.source).push(e); inn.get(e.target).push(e); }
  const degree = (n) => out.get(n.id).length + inn.get(n.id).length;
  const tiddlers = [];

  for (const n of g.nodes) {
    const t = {
      title: n.label,
      tags: tagList([n.category, n.type && TYPE_INDEX(n.type)].filter(Boolean)),
      topic_id: n.id,
      text: topicText(n, out.get(n.id), inn.get(n.id), byId),
    };
    if (n.description) t.description = n.description;
    if (n.type) t.topic_type = n.type;
    if (n.category) t.category = n.category;
    if (n.docs) t.docs_url = n.docs;
    if (n.status) t.status = n.status;
    t.links_out = String(out.get(n.id).length);
    t.links_in = String(inn.get(n.id).length);
    tiddlers.push(t);
  }

  const cats = [...new Set(g.nodes.map((n) => n.category).filter(Boolean))].sort();
  const types = [...new Set(g.nodes.map((n) => n.type).filter(Boolean))].sort();
  for (const c of cats) {
    const members = g.nodes.filter((n) => n.category === c);
    const parts = [`Every ${txt(g.title)} topic in the ${txt(c)} category, by type.`];
    for (const ty of types) {
      const m = members.filter((n) => n.type === ty);
      if (m.length) parts.push("", `!! ${TYPE_INDEX(ty)} (${m.length})`, membersList(m));
    }
    const untyped = members.filter((n) => !n.type);
    if (untyped.length) parts.push("", `!! Other (${untyped.length})`, membersList(untyped));
    tiddlers.push({ title: c, tags: tagList([g.title]), text: parts.join("\n") });
  }
  for (const ty of types) {
    const m = g.nodes.filter((n) => n.type === ty);
    tiddlers.push({ title: TYPE_INDEX(ty), tags: tagList([g.title]),
      text: `Every ${txt(g.title)} topic of type ${ty} (${m.length}).\n\n${membersList(m)}` });
  }

  const top = [...g.nodes].sort((a, b) => degree(b) - degree(a) || byLabel(a, b)).slice(0, 25);
  const src = g.source || {};
  const home = [
    g.description ? txt(g.description) : "",
    "",
    `${g.nodes.length} topics and ${g.edges.length} direct links. Each topic tiddler has its docs, its tutorials, and every topic it links to or is linked from.`,
    "",
    src.url ? `Source: ${link(src.name || src.url, src.url)}${src.fetched ? `, fetched ${src.fetched}` : ""}.` : "",
    "",
    "!! Categories",
    cats.length ? cats.map((c) => `* [[${c}]] (${g.nodes.filter((n) => n.category === c).length})`).join("\n") : "None.",
    "",
    "!! Types",
    types.length ? types.map((ty) => `* [[${TYPE_INDEX(ty)}]]`).join("\n") : "None.",
    "",
    "!! Most connected",
    top.map((n) => `* [[${n.label}]] (${degree(n)})`).join("\n"),
    "",
    "!! For agents",
    "[[AI access]]",
  ].join("\n");
  tiddlers.push({ title: g.title, text: home });

  // The agent line is shell text: the prompt is one single-quoted word, so
  // nothing in the title or the store path is expanded. It reaches the wiki
  // only through config tiddlers that a codeblock shows verbatim; it is
  // never spliced into markup.
  const head = `Read the topic wiki at ${store}: a JSON array of tiddlers, one per topic, whose text links other topics by title in double square brackets and whose fields are described in its tiddler titled ${AI_ACCESS}. Query it with jq by title or topic_id rather than reading it whole. `;
  const tail = " Then help me navigate it: answer from the tiddlers, follow those links, and cite docs_url and the evidence links.";
  const command = `${agent} '${shEsc(`${head}Start at the tiddler titled ${g.title}.${tail}`)}'`;
  const prefix = `${agent} '${shEsc(`${head}Start at the tiddler whose topic_id is `)}`;
  const suffix = `${shEsc(`.${tail}`)}'`;
  tiddlers.push({
    title: AI_ACCESS,
    tags: tagList([g.title]),
    text: [
      "An agent reads this wiki from its plain tiddler store, not from the HTML:",
      "",
      "<$codeblock code={{$:/config/topicwiki/store}}/>",
      "",
      "It is a JSON array with one object per tiddler. A topic tiddler carries these fields:",
      "",
      "* `title` -- the topic name; other tiddlers link it as `[[title]]`",
      "* `topic_id` -- a stable slug; `topic_type`, `category`, `status`",
      "* `description` -- one or two plain sentences",
      "* `docs_url` -- the public documentation",
      "* `links_out`, `links_in` -- how many direct links it has",
      "* `text` -- TiddlyWiki markup: sections Docs, Tutorials, Links from here, Links to here",
      "",
      "Start a session over the whole wiki with:",
      "",
      "<$codeblock code={{$:/config/topicwiki/command}}/>",
      "",
      "Every topic tiddler shows the same line, started at that topic.",
    ].join("\n"),
  });

  tiddlers.push({ title: "$:/config/topicwiki/command", text: command });
  tiddlers.push({ title: "$:/config/topicwiki/command-prefix", text: prefix });
  tiddlers.push({ title: "$:/config/topicwiki/command-suffix", text: suffix });
  tiddlers.push({ title: "$:/config/topicwiki/store", text: store });
  tiddlers.push({
    title: "$:/topicwiki/ViewTemplate/agent",
    tags: tagList(["$:/tags/ViewTemplate"]),
    text: [
      "<$list filter=\"[all[current]has[topic_id]]\" variable=\"ignore\">",
      "<details><summary>Ask an agent about this topic</summary>",
      "",
      // A filtered attribute, not a substituted one: TiddlyWiki expands
      // $(var)$ inside a substituted attribute, and the store path is text.
      "<$codeblock code={{{ [all[current]get[topic_id]addprefix{$:/config/topicwiki/command-prefix}addsuffix{$:/config/topicwiki/command-suffix}] }}}/>",
      "",
      "</details>",
      "</$list>",
    ].join("\n"),
  });
  tiddlers.push({ title: "$:/SiteTitle", text: txt(g.title) });
  tiddlers.push({ title: "$:/SiteSubtitle", text: txt(g.subtitle || "a topic wiki") });
  tiddlers.push({ title: "$:/DefaultTiddlers", text: `[[${g.title}]]` });

  return tiddlers.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

/** TiddlyWiki's tags field: space-separated, titles with spaces in [[ ]]. */
export function tagList(tags) {
  return tags.map((t) => (/\s/.test(t) ? `[[${t}]]` : t)).join(" ");
}

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--agent") args.agent = argv[++i];
    else args._.push(argv[i]);
  }
  return args;
}

function main(argv) {
  const args = parseArgs(argv);
  if (args._.length !== 1) {
    console.error("usage: build.mjs <graph.json> [--out <file.html>] [--agent <command>]");
    return 2;
  }
  const graph = validate(JSON.parse(readFileSync(args._[0], "utf8")));
  const html = resolve(args.out || join(defaultOutDir(), `${slugOf(graph.title)}.html`));
  const store = html.replace(/\.html$/, "") + ".tiddlers.json";
  const tiddlers = toTiddlers(graph, { store, agent: args.agent });
  mkdirSync(dirname(html), { recursive: true });
  writeFileSync(store, JSON.stringify(tiddlers, null, 1) + "\n");

  const tmp = mkdtempSync(join(tmpdir(), "topicwiki-"));
  try {
    const tw = (...a) => execFileSync("npx", ["-y", TIDDLYWIKI, ...a], { stdio: ["ignore", "ignore", "inherit"] });
    tw(join(tmp, "wiki"), "--init", "empty");
    tw(join(tmp, "wiki"), "--load", store, "--output", tmp, "--render", "$:/core/save/all", "out.html", "text/plain");
    copyFileSync(join(tmp, "out.html"), html);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`${html}\n${store}\n${tiddlers.length} tiddlers`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
