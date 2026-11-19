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
function badTitle(t) {
  const forbidden = FORBIDDEN_IN_TITLE.find((s) => t.includes(s));
  if (forbidden) return `contains ${JSON.stringify(forbidden)}`;
  if (t.startsWith("$:/")) return 'contains "$:/"';
  if (/[\r\u2028\u2029\u0085]/.test(t)) return "contains a line break";
  if (t.endsWith("]")) return 'ends in "]"';
  if (t !== t.trim()) return "starts or ends with a space";
  if (URLISH.test(t)) return "reads as a URL";
  return "";
}
const badUrl = (u) => !isStr(u) || !/^https?:\/\/[^\s|\]]+$/.test(u);
const QUOTE_HELP = `cannot be quoted: it holds ', " and """ (or ends in ")`;
const listOf = (x) => (Array.isArray(x) ? x : []);

/** Problems with a title-valued field; [] when it is safe. */
function titleErrors(at, t) {
  if (!isStr(t) || !t) return [`${at}: missing`];
  const bad = badTitle(t);
  return bad ? [`${at} ${JSON.stringify(t)} ${bad}`] : [];
}

/** Problems with an optional free-text field that txt() shows. */
function textErrors(at, s) {
  if (s === undefined) return [];
  if (!isStr(s)) return [`${at} is not a string`];
  return quoteAttr(s) === null ? [`${at} ${QUOTE_HELP}`] : [];
}

/** A problem when an optional field is present and is not a list. */
function listErrors(at, x) {
  return x === undefined || Array.isArray(x) ? [] : [`${at}: not a list`];
}

function sourceErrors(src) {
  if (src === undefined) return [];
  if (!isObj(src)) return ["source: not an object"];
  const errs = [];
  if (src.name !== undefined) errs.push(...titleErrors("source.name", src.name));
  if (src.url !== undefined && badUrl(src.url)) errs.push("source.url is not an http(s) URL");
  if (src.fetched !== undefined && !(isStr(src.fetched) && DATE_RE.test(src.fetched))) {
    errs.push("source.fetched is not a YYYY-MM-DD date");
  }
  return errs;
}

/** Problems with the graph's own fields, before its nodes and edges. */
function graphErrors(g) {
  const errs = titleErrors("title", g.title);
  if (!errs.length) {
    if (!slugOf(g.title)) errs.push("title has no letters or digits");
    if (quoteAttr(g.title) === null) errs.push(`title ${QUOTE_HELP}`);
  }
  errs.push(...textErrors("subtitle", g.subtitle), ...textErrors("description", g.description));
  errs.push(...sourceErrors(g.source));
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) errs.push("nodes: missing or empty");
  if (!Array.isArray(g.edges)) errs.push("edges: missing");
  return errs;
}

/** Problems with a node's id and label, given the nodes before it. */
function idLabelErrors(n, at, ids, labels) {
  const errs = [];
  if (!isStr(n.id) || !ID_RE.test(n.id)) errs.push(`${at}: id ${JSON.stringify(n.id)} is not a lowercase slug`);
  else if (ids.has(n.id)) errs.push(`${at}: duplicate id ${n.id}`);
  if (!isStr(n.label) || !n.label) return [...errs, `${at}: label missing`];
  errs.push(...titleErrors(`${at}: label`, n.label));
  if (labels.has(n.label)) errs.push(`${at}: duplicate label ${n.label}`);
  return errs;
}

/** Problems with a node's type, category, text fields and docs URL. */
function fieldErrors(n, at) {
  const errs = [];
  if (n.type !== undefined && !(isStr(n.type) && NODE_TYPE_RE.test(n.type))) {
    errs.push(`${at}: type ${JSON.stringify(n.type)} is not a lowercase word`);
  }
  if (n.category !== undefined) {
    const bad = titleErrors(`${at}: category`, n.category);
    errs.push(...bad);
    if (!bad.length && quoteAttr(n.category) === null) errs.push(`${at}: category ${QUOTE_HELP}`);
  }
  for (const key of ["description", "status"]) {
    if (n[key] !== undefined && !isStr(n[key])) errs.push(`${at}: ${key} is not a string`);
  }
  if (n.docs !== undefined && badUrl(n.docs)) errs.push(`${at}: docs is not an http(s) URL`);
  return errs;
}

/** Problems with one {title, url} entry of a node's links or tutorials. */
function linkErrors(l, at) {
  if (!isObj(l)) return [`${at}: title missing or unsafe`, `${at}: url is not an http(s) URL`];
  const errs = [];
  if (!isStr(l.title) || !l.title || badTitle(l.title)) errs.push(`${at}: title missing or unsafe`);
  if (badUrl(l.url)) errs.push(`${at}: url is not an http(s) URL`);
  return errs;
}

/** Problems with one node, given the ids and labels of the nodes before it. */
function nodeErrors(n, at, ids, labels) {
  if (!isObj(n)) return [`${at}: not an object`];
  const errs = [...idLabelErrors(n, at, ids, labels), ...fieldErrors(n, at)];
  for (const key of ["links", "tutorials"]) {
    errs.push(...listErrors(`${at}.${key}`, n[key]));
    for (const [j, l] of listOf(n[key]).entries()) errs.push(...linkErrors(l, `${at}.${key}[${j}]`));
  }
  return errs;
}

/** Problems with one edge, given every node id. */
function edgeErrors(e, at, ids) {
  if (!isObj(e)) return [`${at}: not an object`];
  const errs = [];
  if (!ids.has(e.source)) errs.push(`${at}: unknown source ${e.source}`);
  if (!ids.has(e.target)) errs.push(`${at}: unknown target ${e.target}`);
  if (!isStr(e.type) || !EDGE_TYPE_RE.test(e.type)) errs.push(`${at}: type ${JSON.stringify(e.type)} is not snake_case`);
  if (e.label !== "") errs.push(...textErrors(`${at}: label`, e.label));
  errs.push(...listErrors(`${at}.evidence`, e.evidence));
  for (const u of listOf(e.evidence)) if (badUrl(u)) errs.push(`${at}: evidence ${JSON.stringify(u)} is not an http(s) URL`);
  return errs;
}

/**
 * Topics, indexes, the home and AI access share one title space; a title
 * used twice would merge two tiddlers into one. entries: [title, what].
 */
function titleClashes(entries) {
  const seen = new Map();
  const errs = [];
  for (const [t, what] of entries) {
    if (seen.has(t)) errs.push(`"${t}" is used twice: ${seen.get(t)} and ${what}`);
    else seen.set(t, what);
  }
  return errs;
}

/** Throw one Error listing every problem with the graph; return it if valid. */
export function validate(g) {
  if (!isObj(g)) throw new Error("graph: not an object");
  const head = graphErrors(g);
  if (head.length) throw new Error(head.join("\n"));

  const errs = [];
  const ids = new Set();
  const labels = new Set();
  const cats = new Set();
  const types = new Set();
  for (const [i, n] of g.nodes.entries()) {
    errs.push(...nodeErrors(n, `nodes[${i}]`, ids, labels));
    if (!isObj(n)) continue;
    ids.add(n.id);
    if (isStr(n.label) && n.label) labels.add(n.label);
    if (isStr(n.category) && n.category) cats.add(n.category);
    if (isStr(n.type) && NODE_TYPE_RE.test(n.type)) types.add(n.type);
  }
  for (const [i, e] of g.edges.entries()) errs.push(...edgeErrors(e, `edges[${i}]`, ids));
  errs.push(...titleClashes([
    [g.title, "the home tiddler"],
    [AI_ACCESS, "the AI access tiddler"],
    ...[...cats].map((c) => [c, "a category"]),
    ...[...types].map((ty) => [TYPE_INDEX(ty), "a type index"]),
    ...[...labels].map((l) => [l, "a node label"]),
  ]));
  if (errs.length) throw new Error(errs.join("\n"));
  return g;
}

const byLabel = (a, b) => a.label.localeCompare(b.label);
const human = (type) => type.replace(/_/g, " ");
const link = (title, url) => `[[${title}|${url}]]`;

/** Text after a link: the edge label, shown as plain text. */
const edgeNote = (e) => (e.label ? ` -- ${txt(e.label)}` : "");

/** Edges ordered by relation, then by the label of the node at `end`. */
function sortEdges(edges, end, byId) {
  return [...edges].sort((a, b) => a.type.localeCompare(b.type) || byLabel(byId.get(a[end]), byId.get(b[end])));
}

/** A heading and its lines, or the heading and "None.". */
function edgeSection(heading, lines) {
  return ["", heading, ...(lines.length ? lines : ["None."])];
}

/** How many direct links a node has, out and in. */
function degreeOf(n, out, inn) {
  return out.get(n.id).length + inn.get(n.id).length;
}

/** Run the pinned TiddlyWiki CLI through npx. */
function tiddlywiki(...args) {
  execFileSync("npx", ["-y", TIDDLYWIKI, ...args], { stdio: ["ignore", "ignore", "inherit"] });
}

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
  lines.push(...edgeSection("!! Links from here", sortEdges(out, "target", byId).map(
    (e) => `* ${human(e.type)} [[${byId.get(e.target).label}]]${edgeNote(e)}${evidence(e)}`)));
  lines.push(...edgeSection("!! Links to here", sortEdges(inn, "source", byId).map(
    (e) => `* [[${byId.get(e.source).label}]] ${human(e.type)} this${edgeNote(e)}${evidence(e)}`)));
  return lines.join("\n");
}

function membersList(nodes) {
  return nodes.length ? [...nodes].sort(byLabel).map((n) => `* [[${n.label}]]`).join("\n") : "None.";
}

/** One topic's tiddler: its fields, tags and text. */
function topicTiddler(n, out, inn, byId) {
  const t = {
    title: n.label,
    tags: tagList([n.category, n.type && TYPE_INDEX(n.type)].filter(Boolean)),
    topic_id: n.id,
    text: topicText(n, out, inn, byId),
  };
  const fields = { description: n.description, topic_type: n.type, category: n.category, docs_url: n.docs, status: n.status };
  for (const [k, v] of Object.entries(fields)) if (v) t[k] = v;
  t.links_out = String(out.length);
  t.links_in = String(inn.length);
  return t;
}

/** A category's index tiddler: its members, grouped by type. */
function categoryTiddler(g, c, types) {
  const members = g.nodes.filter((n) => n.category === c);
  const parts = [`Every ${txt(g.title)} topic in the ${txt(c)} category, by type.`];
  for (const ty of types) {
    const m = members.filter((n) => n.type === ty);
    if (m.length) parts.push("", `!! ${TYPE_INDEX(ty)} (${m.length})`, membersList(m));
  }
  const untyped = members.filter((n) => !n.type);
  if (untyped.length) parts.push("", `!! Other (${untyped.length})`, membersList(untyped));
  return { title: c, tags: tagList([g.title]), text: parts.join("\n") };
}

/** A type's index tiddler: every topic of that type. */
function typeTiddler(g, ty) {
  const m = g.nodes.filter((n) => n.type === ty);
  return { title: TYPE_INDEX(ty), tags: tagList([g.title]),
    text: `Every ${txt(g.title)} topic of type ${ty} (${m.length}).\n\n${membersList(m)}` };
}

/** The source line on the home tiddler, or "" when the graph names none. */
function sourceLine(src) {
  if (!src || !src.url) return "";
  const fetched = src.fetched ? `, fetched ${src.fetched}` : "";
  return `Source: ${link(src.name || src.url, src.url)}${fetched}.`;
}

/** One line per item, or "None." for an empty list. */
function bulletList(items, fmt) {
  return items.length ? items.map(fmt).join("\n") : "None.";
}

/** The home tiddler: counts, source, categories, types, the most connected topics. */
function homeTiddler(g, cats, types, top) {
  const text = [
    g.description ? txt(g.description) : "",
    "",
    `${g.nodes.length} topics and ${g.edges.length} direct links. Each topic tiddler has its docs, its tutorials, and every topic it links to or is linked from.`,
    "",
    sourceLine(g.source),
    "",
    "!! Categories",
    bulletList(cats, (c) => `* [[${c}]] (${g.nodes.filter((n) => n.category === c).length})`),
    "",
    "!! Types",
    bulletList(types, (ty) => `* [[${TYPE_INDEX(ty)}]]`),
    "",
    "!! Most connected",
    bulletList(top, ([n, d]) => `* [[${n.label}]] (${d})`),
    "",
    "!! For agents",
    `[[${AI_ACCESS}]]`,
  ].join("\n");
  return { title: g.title, text };
}

/**
 * The agent line and the tiddlers that show it. The line is shell text: the
 * prompt is one single-quoted word, so nothing in the title or the store
 * path is expanded. It reaches the wiki only through config tiddlers that a
 * codeblock shows verbatim; it is never spliced into markup.
 */
function agentTiddlers(g, store, agent) {
  const head = `Read the topic wiki at ${store}: a JSON array of tiddlers, one per topic, whose text links other topics by title in double square brackets and whose fields are described in its tiddler titled ${AI_ACCESS}. Query it with jq by title or topic_id rather than reading it whole. `;
  const tail = " Then help me navigate it: answer from the tiddlers, follow those links, and cite docs_url and the evidence links.";
  return [
    {
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
    },
    { title: "$:/config/topicwiki/command", text: `${agent} '${shEsc(`${head}Start at the tiddler titled ${g.title}.${tail}`)}'` },
    { title: "$:/config/topicwiki/command-prefix", text: `${agent} '${shEsc(`${head}Start at the tiddler whose topic_id is `)}` },
    { title: "$:/config/topicwiki/command-suffix", text: `${shEsc(`.${tail}`)}'` },
    { title: "$:/config/topicwiki/store", text: store },
    {
      title: "$:/topicwiki/ViewTemplate/agent",
      tags: tagList(["$:/tags/ViewTemplate"]),
      // A filtered attribute, not a substituted one: TiddlyWiki expands
      // $(var)$ inside a substituted attribute, and the store path is text.
      text: [
        "<$list filter=\"[all[current]has[topic_id]]\" variable=\"ignore\">",
        "<details><summary>Ask an agent about this topic</summary>",
        "",
        "<$codeblock code={{{ [all[current]get[topic_id]addprefix{$:/config/topicwiki/command-prefix}addsuffix{$:/config/topicwiki/command-suffix}] }}}/>",
        "",
        "</details>",
        "</$list>",
      ].join("\n"),
    },
  ];
}

/**
 * Map a validated topic graph to an array of tiddlers, sorted by title.
 * opts.store: absolute path of the .tiddlers.json an agent reads.
 * opts.agent: the agent CLI the copy-paste line starts (default "claude").
 */
export function toTiddlers(g, opts = {}) {
  validate(g);
  const byId = new Map(g.nodes.map((n) => [n.id, n]));
  const out = new Map(g.nodes.map((n) => [n.id, []]));
  const inn = new Map(g.nodes.map((n) => [n.id, []]));
  for (const e of g.edges) { out.get(e.source).push(e); inn.get(e.target).push(e); }
  const cats = [...new Set(g.nodes.map((n) => n.category).filter(Boolean))].sort();
  const types = [...new Set(g.nodes.map((n) => n.type).filter(Boolean))].sort();
  const top = g.nodes.map((n) => [n, degreeOf(n, out, inn)])
    .sort((a, b) => b[1] - a[1] || byLabel(a[0], b[0])).slice(0, 25);

  const tiddlers = [
    ...g.nodes.map((n) => topicTiddler(n, out.get(n.id), inn.get(n.id), byId)),
    ...cats.map((c) => categoryTiddler(g, c, types)),
    ...types.map((ty) => typeTiddler(g, ty)),
    homeTiddler(g, cats, types, top),
    ...agentTiddlers(g, opts.store || "<path to the .tiddlers.json>", opts.agent || "claude"),
    { title: "$:/SiteTitle", text: txt(g.title) },
    { title: "$:/SiteSubtitle", text: txt(g.subtitle || "a topic wiki") },
    { title: "$:/DefaultTiddlers", text: `[[${g.title}]]` },
  ];
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
    tiddlywiki(join(tmp, "wiki"), "--init", "empty");
    tiddlywiki(join(tmp, "wiki"), "--load", store, "--output", tmp, "--render", "$:/core/save/all", "out.html", "text/plain");
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
