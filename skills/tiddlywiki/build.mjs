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
/** The <$topicgraph/> widget, embedded in the wiki as a module tiddler. */
export const WIDGET_FILE = fileURLToPath(new URL("./topicgraph.js", import.meta.url));
/** The startup module that names the landing page in an empty address. */
export const LANDING_FILE = fileURLToPath(new URL("./landing.js", import.meta.url));
const MAX_COORD = 1e6;
const MAX_SIZE = 1e4;
const GRAPH_SECTION = "\n\n!! Neighbor graph\n\n<$topicgraph/>";
const GRAPH_CSS = `.tw-topicgraph { margin: 0.5em 0 1em; border: 1px solid #ddd; border-radius: 6px; background: #fcfcfd; }
.tw-tg-toolbar { display: flex; flex-wrap: wrap; gap: 4px; padding: 6px; border-bottom: 1px solid #eee; font-size: 0.85em; }
.tw-tg-toolbar button { border: 1px solid #ccc; border-radius: 4px; background: #fff; padding: 1px 7px; cursor: pointer; }
.tw-tg-chip.tw-tg-off { opacity: 0.4; text-decoration: line-through; }
.tw-tg-swatch { display: inline-block; width: 9px; height: 9px; border-radius: 50%; }
.tw-tg-svg { display: block; width: 100%; cursor: grab; user-select: none; touch-action: pan-y pinch-zoom; }
.tw-tg-edge { stroke-width: 1.2; opacity: 0.45; }
.tw-tg-in { stroke-dasharray: 4 3; }
.tw-tg-node { cursor: pointer; }
.tw-tg-node:hover circle { stroke: #111; stroke-width: 2; }
.tw-tg-label { font-size: 11px; fill: #333; paint-order: stroke; stroke: #fcfcfd; stroke-width: 3px; }
.tw-tg-hover { display: none; }
.tw-tg-node:hover .tw-tg-hover, .tw-tg-selected .tw-tg-hover { display: inline; }
.tw-tg-selected circle { stroke: #111; stroke-width: 2; }
.tw-tg-error { color: #b91c1c; padding: 6px 8px; margin: 0; }
.tw-tg-centre circle { fill: #111; }
.tw-tg-centre-label { font-size: 13px; font-weight: bold; }
.tw-tm-svg { height: 640px; background: #fff; touch-action: none; }
.tw-tm-edge { stroke-width: 0.8; stroke-opacity: 0.3; }
.tw-tm-edge.tw-tm-lit { stroke-width: 2.4; stroke-opacity: 0.95; }
.tw-tm-node circle { stroke: #fff; stroke-width: 1; transform-box: fill-box; transform-origin: center; transition: transform 0.12s; }
.tw-tm-node.tw-tm-on circle, .tw-tm-node.tw-tg-selected circle { transform: scale(1.9); stroke: #111; stroke-width: 1.5; }
.tw-tm-label { font-size: 20px; fill: #707070; paint-order: stroke; stroke: #fff; stroke-width: 5px; pointer-events: none; }
.tw-tm-product { font-size: 24px; fill: #292929; }
.tw-tm-on .tw-tm-label, .tw-tg-selected .tw-tm-label { display: inline; font-size: 30px; fill: #111; }`;
/** Colours the map uses when the graph gives no palette, in sorted-name order. */
const PALETTE = ["#f46021", "#25855a", "#7559b8", "#d6409f", "#e5484d", "#1570c8", "#cf8500",
  "#0f8b8d", "#a6a6a6", "#b45309", "#0d9488", "#9333ea"];
const COLOUR_RE = /^#[0-9a-f]{6}$/i;
/** Each tiddler is a page: the address bar names it and the browser history follows it. */
const NAVIGATION = [
  { title: "$:/config/Navigation/UpdateAddressBar", text: "permalink" },
  { title: "$:/config/Navigation/UpdateHistory", text: "yes" },
  { title: "$:/view", text: "zoomin" },
];

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
  errs.push(...sourceErrors(g.source), ...paletteErrors(g.palette));
  if (!Array.isArray(g.nodes) || g.nodes.length === 0) errs.push("nodes: missing or empty");
  else errs.push(...layoutErrors(g.nodes));
  if (!Array.isArray(g.edges)) errs.push("edges: missing");
  return errs;
}

/** Problems with the optional palette: {categories, relations}, each name -> #rrggbb. */
function paletteErrors(palette) {
  if (palette === undefined) return [];
  if (!isObj(palette)) return ["palette: not an object"];
  const errs = [];
  for (const key of ["categories", "relations"]) {
    const table = palette[key];
    if (table === undefined) continue;
    if (!isObj(table)) errs.push(`palette.${key}: not an object`);
    else for (const [name, c] of Object.entries(table)) if (!isStr(c) || !COLOUR_RE.test(c)) errs.push(`palette.${key}.${name}: ${JSON.stringify(c)} is not #rrggbb`);
  }
  return errs;
}

const isNum = (x) => typeof x === "number" && Number.isFinite(x);

/** The layout is all or nothing: every node has finite x and y, or none has either. */
function layoutErrors(nodes) {
  const placed = nodes.filter((n) => isObj(n) && (n.x !== undefined || n.y !== undefined));
  if (!placed.length) return [];
  const inRange = (v) => isNum(v) && Math.abs(v) <= MAX_COORD;
  const bad = nodes.findIndex((n) => !isObj(n) || !inRange(n.x) || !inRange(n.y));
  return bad === -1 ? [] : [`nodes[${bad}]: x and y must be finite numbers within ${MAX_COORD} of 0 when any node has a layout`];
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
  if (n.size !== undefined && !(isNum(n.size) && n.size > 0 && n.size <= MAX_SIZE)) errs.push(`${at}: size is not a positive number up to ${MAX_SIZE}`);
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

/** One entry of a tiddler's neighbors field. */
const neighbor = (title, rel, dir) => ({ title, rel, dir });

/**
 * A topic's neighbors: every link out and in to another topic, then the
 * way up -- its category and its type index, or the home tiddler when it
 * has neither -- so every topic is at most two steps from the root.
 */
function topicNeighbors(n, out, inn, byId, home) {
  const list = [
    ...sortEdges(out.filter((e) => e.target !== n.id), "target", byId).map((e) => neighbor(byId.get(e.target).label, human(e.type), "out")),
    ...sortEdges(inn.filter((e) => e.source !== n.id), "source", byId).map((e) => neighbor(byId.get(e.source).label, human(e.type), "in")),
  ];
  if (n.category) list.push(neighbor(n.category, "in category", "out"));
  if (n.type) list.push(neighbor(TYPE_INDEX(n.type), "of type", "out"));
  if (!n.category && !n.type) list.push(neighbor(home, "part of", "out"));
  return list;
}

/** A tiddler's text with the graph section, when it has neighbors to draw. */
const withGraph = (text, near) => (near.length ? text + GRAPH_SECTION : text);

/** One topic's tiddler: its fields, tags and text. */
function topicTiddler(n, out, inn, byId, home) {
  const near = topicNeighbors(n, out, inn, byId, home);
  const t = {
    title: n.label,
    tags: tagList([n.category, n.type && TYPE_INDEX(n.type)].filter(Boolean)),
    topic_id: n.id,
    text: withGraph(topicText(n, out, inn, byId), near),
    neighbors: JSON.stringify(near),
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
  const near = [neighbor(g.title, "category", "in"), ...[...members].sort(byLabel).map((n) => neighbor(n.label, n.type || "other", "out"))];
  return { title: c, tags: tagList([g.title]), text: withGraph(parts.join("\n"), near), neighbors: JSON.stringify(near) };
}

/** A type's index tiddler: every topic of that type. */
function typeTiddler(g, ty) {
  const m = g.nodes.filter((n) => n.type === ty);
  const near = [neighbor(g.title, "type", "in"), ...[...m].sort(byLabel).map((n) => neighbor(n.label, n.category || "other", "out"))];
  return { title: TYPE_INDEX(ty), tags: tagList([g.title]),
    text: withGraph(`Every ${txt(g.title)} topic of type ${ty} (${m.length}).\n\n${membersList(m)}`, near),
    neighbors: JSON.stringify(near) };
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

/**
 * A layout for a graph that brings none: each category gets a sector of a
 * circle, and its topics fill a sunflower spiral at the sector's centre,
 * largest first. Deterministic. Returns [x, y] by node index.
 */
export function fallbackLayout(nodes, sizes) {
  const cats = [...new Set(nodes.map((n) => n.category || ""))].sort();
  const spread = 120 + 18 * Math.sqrt(nodes.length);
  const at = new Array(nodes.length);
  for (const [ci, c] of cats.entries()) {
    const members = nodes.map((n, i) => i).filter((i) => (nodes[i].category || "") === c).sort((a, b) => sizes[b] - sizes[a]);
    const angle = (2 * Math.PI * ci) / cats.length - Math.PI / 2;
    const cx = cats.length > 1 ? spread * Math.cos(angle) : 0;
    const cy = cats.length > 1 ? spread * Math.sin(angle) : 0;
    for (const [k, i] of members.entries()) {
      const rr = 14 * Math.sqrt(k);
      const a = k * 2.39996;
      at[i] = [Math.round((cx + rr * Math.cos(a)) * 10) / 10, Math.round((cy + rr * Math.sin(a)) * 10) / 10];
    }
  }
  return at;
}

/**
 * Name -> colour for names, from the palette where it has one, else
 * PALETTE in order. Own properties only, so a name like "constructor" or
 * "__proto__" is a name and not an inherited member.
 */
function colourTable(names, given) {
  const has = (k) => given && Object.prototype.hasOwnProperty.call(given, k);
  const entries = [];
  let next = 0;
  for (const name of names) entries.push([name, has(name) ? given[name] : PALETTE[next++ % PALETTE.length]]);
  return Object.fromEntries(entries);
}

/**
 * The map data the widgets draw: every topic with its place, size,
 * category and type, every link as a pair of node indexes, and the colours
 * of categories and relations. Sizes default to 2 + 2 * sqrt(degree).
 */
function mapData(g, degrees) {
  const sizes = g.nodes.map((n, i) => (isNum(n.size) ? n.size : 2 + 2 * Math.sqrt(degrees[i])));
  const at = isNum(g.nodes[0].x) ? g.nodes.map((n) => [n.x, n.y]) : fallbackLayout(g.nodes, sizes);
  const index = new Map(g.nodes.map((n, i) => [n.id, i]));
  const palette = g.palette || {};
  const relTypes = [...new Set(g.edges.map((e) => e.type))].sort();
  const rels = colourTable(relTypes, palette.relations);
  return {
    categories: colourTable([...new Set(g.nodes.map((n) => n.category).filter(Boolean))].sort(), palette.categories),
    relations: Object.fromEntries(relTypes.map((t) => [human(t), rels[t]])),
    nodes: g.nodes.map((n, i) => ({ t: n.label, x: at[i][0], y: at[i][1], s: Math.round(sizes[i] * 100) / 100, c: n.category, k: n.type })),
    edges: g.edges.filter((e) => e.source !== e.target).map((e) => [index.get(e.source), index.get(e.target)]),
  };
}

/** The home tiddler: counts, source, categories, types, the most connected topics. */
function homeTiddler(g, cats, types, top) {
  const text = [
    "<$topicmap/>",
    "",
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
  const near = [...cats.map((c) => neighbor(c, "category", "out")), ...types.map((ty) => neighbor(TYPE_INDEX(ty), "type", "out"))];
  return { title: g.title, text, neighbors: JSON.stringify(near) };
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
        "* `neighbors` -- JSON list of `{title, rel, dir}` that the graph draws: each link to another topic (`dir` `out` or `in`, `rel` the relation in words), then the way up: `in category` and `of type`, or `part of` the home when the topic has neither",
        "* `text` -- TiddlyWiki markup: sections Docs, Tutorials, Links from here, Links to here, Neighbor graph",
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
 * opts.widget: the source of topicgraph.js; without it the graph sections
 * render nothing, which is how the unit tests build.
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
    ...g.nodes.map((n) => topicTiddler(n, out.get(n.id), inn.get(n.id), byId, g.title)),
    ...cats.map((c) => categoryTiddler(g, c, types)),
    ...types.map((ty) => typeTiddler(g, ty)),
    homeTiddler(g, cats, types, top),
    ...agentTiddlers(g, opts.store || "<path to the .tiddlers.json>", opts.agent || "claude"),
    { title: "$:/SiteTitle", text: txt(g.title) },
    { title: "$:/SiteSubtitle", text: txt(g.subtitle || "a topic wiki") },
    { title: "$:/DefaultTiddlers", text: `[[${g.title}]]` },
    { title: "$:/topicwiki/map", type: "application/json", text: JSON.stringify(mapData(g, g.nodes.map((n) => degreeOf(n, out, inn)))) },
    ...NAVIGATION,
    ...widgetTiddlers(opts.widget, opts.landing),
  ];
  return tiddlers.sort((a, b) => (a.title < b.title ? -1 : a.title > b.title ? 1 : 0));
}

/** The graph widget's module and stylesheet tiddlers, when its source is given. */
function widgetTiddlers(source, landing) {
  if (!source) return [];
  return [
    { title: "$:/plugins/topicwiki/topicgraph.js", type: "application/javascript", "module-type": "widget", text: source },
    ...(landing ? [{ title: "$:/plugins/topicwiki/landing.js", type: "application/javascript", "module-type": "startup", text: landing }] : []),
    { title: "$:/plugins/topicwiki/topicgraph.css", tags: "$:/tags/Stylesheet", type: "text/css", text: GRAPH_CSS },
  ];
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
  const tiddlers = toTiddlers(graph, { store, agent: args.agent, widget: readFileSync(WIDGET_FILE, "utf8"), landing: readFileSync(LANDING_FILE, "utf8") });
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
