/*\
title: $:/plugins/topicwiki/topicgraph.js
type: application/javascript
module-type: widget

Two widgets over the map data in $:/topicwiki/map (see build.mjs):

- <$topicmap/>: the whole map, laid out as the source laid it out. A node
  grows and names itself under the pointer and lights its links; a click
  opens its tiddler; drag pans; the toolbar zooms and hides a category.
- <$topicgraph/>: the current tiddler's direct links from its `neighbors`
  field (a JSON list of {title, rel, dir}), drawn around it with the map's
  colours and sizes. A click opens the neighbor.

Every click navigates with tm-navigate, so the address bar and the browser
history follow it like any link. No dependencies beyond the TiddlyWiki core.
\*/
"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
const MAP_TITLE = "$:/topicwiki/map";
const GREY = "#a6a6a6";
const EDGE_GREY = "#b0b0b0";
const SPACING = 26; // arc length kept between neighbouring nodes on one ring
const FIRST_RING = 90;
const RING_GAP = 34;
const LABEL_LIMIT = 36; // label every neighbor when there are at most this many
const LABEL_PAD = 110; // room around the outer ring when every node is labelled
const HOVER_PAD = 40; // room around the outer ring when labels show on hover
const MAP_PAD = 60;

/** A neighbors entry the widget can draw. */
const wellFormed = (n) => n !== null && typeof n === "object" && typeof n.title === "string" &&
  typeof n.rel === "string" && (n.dir === "in" || n.dir === "out");

/** JSON text as {value} or {error}: a hand edit must cost the graph, not the tiddler. */
function parseJson(text, what) {
  try {
    return { value: JSON.parse(text) };
  } catch (e) {
    return { error: `The ${what} is not valid JSON: ${e.message}` };
  }
}

/** The neighbors field as {list} or, when it cannot be drawn, {error}. */
function parseNeighbors(text) {
  if (!text) return { list: [] };
  const parsed = parseJson(text, "neighbors field");
  if (parsed.error) return parsed;
  if (!Array.isArray(parsed.value)) return { error: "The neighbors field is not a list." };
  const bad = parsed.value.find((n) => !wellFormed(n));
  return bad === undefined ? { list: parsed.value } : { error: `A neighbors entry cannot be drawn: ${JSON.stringify(bad)}` };
}

let mapCache = { text: null, map: null };

/**
 * The map data, parsed once per text, with a title index. {} when the wiki
 * has no map tiddler; {error} when it cannot be read.
 */
function loadMap(wiki) {
  const text = wiki.getTiddlerText(MAP_TITLE, "");
  if (text === mapCache.text) return mapCache.map;
  const parsed = text ? parseJson(text, "map tiddler") : { value: {} };
  const map = parsed.error ? { error: parsed.error } : Object.assign({ categories: {}, relations: {}, nodes: [], edges: [] }, parsed.value);
  map.byTitle = new Map((map.nodes || []).map((n, i) => [n.t, Object.assign({ i }, n)]));
  mapCache = { text, map };
  return map;
}

/** A neighbor's fill and radius, as the map draws that tiddler. */
function styleOf(map, title) {
  const node = map.byTitle.get(title);
  if (node) return { fill: map.categories[node.c] || GREY, r: 3 + node.s * 0.35 };
  if (map.categories[title]) return { fill: map.categories[title], r: 8 };
  return { fill: GREY, r: 6 };
}

/** Each relation present, sorted, with the map's colour for it. */
function relationColours(map, neighbors) {
  const rels = [...new Set(neighbors.map((n) => n.rel))].sort();
  return new Map(rels.map((r) => [r, map.relations[r] || EDGE_GREY]));
}

/** Neighbors in drawing order: by relation, then direction, then title. */
function drawingOrder(neighbors) {
  return [...neighbors].sort((a, b) =>
    a.rel.localeCompare(b.rel) || a.dir.localeCompare(b.dir) || a.title.localeCompare(b.title));
}

/** How many rings n nodes need so that nodes on one ring stay SPACING apart. */
function ringCount(n) {
  return Math.max(1, Math.ceil((n * SPACING) / (2 * Math.PI * FIRST_RING)));
}

/**
 * Place neighbors around the origin. Each node gets an angle by its place
 * in drawing order, so a relation forms one sector; consecutive nodes
 * alternate between rings so a crowded sector stays readable. Pure.
 */
function layout(neighbors) {
  const ordered = drawingOrder(neighbors);
  const rings = ringCount(ordered.length);
  const nodes = ordered.map((n, i) => {
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / ordered.length;
    const r = FIRST_RING + (i % rings) * RING_GAP;
    return { ...n, x: Math.round(r * Math.cos(angle)), y: Math.round(r * Math.sin(angle)) };
  });
  return { nodes, radius: FIRST_RING + (rings - 1) * RING_GAP };
}

/** The square view that holds every map node, with room for labels. Pure. */
function mapBounds(nodes) {
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const size = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) + 2 * MAP_PAD;
  const cx = (Math.max(...xs) + Math.min(...xs)) / 2;
  const cy = (Math.max(...ys) + Math.min(...ys)) / 2;
  return { x: cx - size / 2, y: cy - size / 2, w: size, h: size, size, cx, cy };
}

/** An SVG element with its attributes set. */
function svgEl(doc, tag, attrs) {
  const el = doc.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

/** An HTML element with a class and text. */
function htmlEl(doc, tag, className, text) {
  const el = doc.createElement(tag);
  el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}

const viewBoxOf = (v) => `${v.x} ${v.y} ${v.w} ${v.h}`;

/** The hover text for a neighbor, in the words the tiddler text uses. */
function describe(n) {
  return n.dir === "in" ? `${n.title} ${n.rel} this` : `${n.rel} ${n.title}`;
}

/** A node's label, placed outward from its dot. */
function labelEl(doc, title, x, gap, className) {
  const right = x >= 0;
  const t = svgEl(doc, "text", { x: right ? gap : -gap, y: 4, "text-anchor": right ? "start" : "end", class: className });
  t.textContent = title;
  return t;
}

/** A dot with a tooltip. */
function dotEl(doc, r, fill, tipText) {
  const dot = svgEl(doc, "circle", { r: r.toFixed(1), fill });
  const tip = svgEl(doc, "title", {});
  tip.textContent = tipText;
  dot.appendChild(tip);
  return dot;
}

/** One neighbor: its edge from the centre, its dot, its label. */
function drawNeighbor(doc, g, n, colour, opts) {
  g.appendChild(svgEl(doc, "line", {
    x1: 0, y1: 0, x2: n.x, y2: n.y, stroke: colour,
    class: n.dir === "in" ? "tw-tg-edge tw-tg-in" : "tw-tg-edge",
  }));
  const style = styleOf(opts.map, n.title);
  const node = svgEl(doc, "g", { class: "tw-tg-node", "data-title": n.title, transform: `translate(${n.x},${n.y})` });
  node.appendChild(dotEl(doc, style.r, style.fill, describe(n)));
  node.appendChild(labelEl(doc, n.title, n.x, style.r + 4, opts.labelAll ? "tw-tg-label" : "tw-tg-label tw-tg-hover"));
  g.appendChild(node);
}

/** One group per relation, so the toolbar can hide a relation. */
function drawRelations(doc, svg, nodes, colours, map) {
  const opts = { labelAll: nodes.length <= LABEL_LIMIT, map };
  const groups = new Map();
  for (const [rel, colour] of colours) {
    const g = svgEl(doc, "g", { "data-rel": rel });
    for (const n of nodes) if (n.rel === rel) drawNeighbor(doc, g, n, colour, opts);
    svg.appendChild(g);
    groups.set(rel, g);
  }
  return groups;
}

/** The current tiddler at the centre. */
function drawCentre(doc, svg, title) {
  const g = svgEl(doc, "g", { class: "tw-tg-centre" });
  g.appendChild(svgEl(doc, "circle", { r: 15 }));
  const t = svgEl(doc, "text", { x: 0, y: 32, "text-anchor": "middle", class: "tw-tg-label tw-tg-centre-label" });
  t.textContent = title;
  g.appendChild(t);
  svg.appendChild(g);
}

/** Scale the view about its centre; factor < 1 zooms in. 0 resets it. */
function zoom(widget, svg, factor) {
  const v = widget.view;
  if (factor === 0) Object.assign(v, { x: v.home.x, y: v.home.y, w: v.home.w, h: v.home.h });
  else Object.assign(v, { x: v.x + (v.w * (1 - factor)) / 2, y: v.y + (v.h * (1 - factor)) / 2, w: v.w * factor, h: v.h * factor });
  svg.setAttribute("viewBox", viewBoxOf(v));
}

/** A toolbar button that runs onClick. */
function button(doc, className, text, title, onClick) {
  const b = htmlEl(doc, "button", className, text);
  b.title = title;
  b.addEventListener("click", onClick);
  return b;
}

/** Hide or show one group, and mark its chip. */
function toggleGroup(chip, group) {
  const hidden = group.style.display === "none";
  group.style.display = hidden ? "" : "none";
  chip.classList.toggle("tw-tg-off", !hidden);
}

/** Zoom buttons, then one chip per group: [name, colour, count, element]. */
function toolbar(widget, svg, chips) {
  const doc = widget.document;
  const bar = htmlEl(doc, "div", "tw-tg-toolbar");
  bar.appendChild(button(doc, "tw-tg-zoom", "+", "Zoom in", () => zoom(widget, svg, 0.75)));
  bar.appendChild(button(doc, "tw-tg-zoom", "-", "Zoom out", () => zoom(widget, svg, 1 / 0.75)));
  bar.appendChild(button(doc, "tw-tg-zoom", "fit", "Show the whole graph", () => zoom(widget, svg, 0)));
  for (const [name, colour, count, group] of chips) {
    const chip = button(doc, "tw-tg-chip", ` ${name} (${count})`, `Hide or show: ${name}`, (e) => toggleGroup(e.currentTarget, group));
    const swatch = htmlEl(doc, "span", "tw-tg-swatch");
    swatch.style.background = colour;
    chip.insertBefore(swatch, chip.firstChild);
    bar.appendChild(chip);
  }
  return bar;
}

/**
 * Drag to pan: move the view by the pointer's travel, in view units. The
 * viewBox is square and drawn to fit, so the shorter side sets the scale.
 */
function panTo(widget, svg, e) {
  const d = widget.drag;
  const scale = widget.view.w / (Math.min(svg.clientWidth, svg.clientHeight) || widget.view.w);
  const dx = (e.clientX - d.x) * scale;
  const dy = (e.clientY - d.y) * scale;
  if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
  widget.view.x = d.vx - dx;
  widget.view.y = d.vy - dy;
  svg.setAttribute("viewBox", viewBoxOf(widget.view));
}

/**
 * On a touch screen a node whose name shows only on hover needs two taps:
 * the first selects it and shows the name, the second opens it. True when
 * this tap only selected the node.
 */
function tapSelects(widget, node, touch) {
  if (!touch || !widget.hoverLabels || node.getAttribute("class").includes("tw-tg-selected")) return false;
  if (widget.selected) widget.selected.setAttribute("class", widget.nodeClass);
  node.setAttribute("class", `${widget.nodeClass} tw-tg-selected`);
  widget.selected = node;
  return true;
}

/** A click on a node opens that tiddler, unless the pointer dragged. */
function onGraphClick(widget, e) {
  const node = e.target.closest(`.${widget.nodeClass}`);
  const drag = widget.drag || {};
  widget.drag = null;
  if (!node || drag.moved || tapSelects(widget, node, drag.touch)) return;
  widget.dispatchEvent({ type: "tm-navigate", navigateTo: node.getAttribute("data-title"), navigateFromTitle: widget.target });
}

/** Pointer handlers: drag pans, a click on a node opens that tiddler. */
function attachPointer(widget, svg) {
  svg.addEventListener("pointerdown", (e) => {
    widget.drag = { x: e.clientX, y: e.clientY, vx: widget.view.x, vy: widget.view.y, moved: false, touch: e.pointerType === "touch" };
  });
  svg.addEventListener("pointermove", (e) => { if (widget.drag && e.buttons) panTo(widget, svg, e); });
  svg.addEventListener("click", (e) => onGraphClick(widget, e));
}

/** Build the neighbor graph's toolbar and drawing into root. */
function buildGraph(widget, root, neighbors) {
  const doc = widget.document;
  const map = loadMap(widget.wiki);
  const colours = relationColours(map.error ? { relations: {} } : map, neighbors);
  const placed = layout(neighbors);
  const size = 2 * (placed.radius + (neighbors.length <= LABEL_LIMIT ? LABEL_PAD : HOVER_PAD));
  const home = { x: -size / 2, y: -size / 2, w: size, h: size };
  widget.view = Object.assign({ home }, home);
  widget.hoverLabels = neighbors.length > LABEL_LIMIT;
  widget.nodeClass = "tw-tg-node";
  const svg = svgEl(doc, "svg", { class: "tw-tg-svg", viewBox: viewBoxOf(widget.view) });
  svg.style.height = `${Math.min(640, Math.max(340, 300 + neighbors.length))}px`;
  const groups = drawRelations(doc, svg, placed.nodes, colours, map.error ? { byTitle: new Map(), categories: {} } : map);
  drawCentre(doc, svg, widget.target);
  const chips = [...colours].map(([rel, colour]) => [rel, colour, neighbors.filter((n) => n.rel === rel).length, groups.get(rel)]);
  root.appendChild(toolbar(widget, svg, chips));
  root.appendChild(svg);
  if (typeof svg.addEventListener === "function") attachPointer(widget, svg);
}

/** One map node: its dot and its label (always for a product, else on hover). */
function drawMapNode(doc, g, n, colour) {
  const r = n.s * 0.9;
  const node = svgEl(doc, "g", { class: "tw-tm-node", "data-title": n.t, "data-i": n.i, transform: `translate(${n.x},${n.y})` });
  node.appendChild(dotEl(doc, r, colour, n.k ? `${n.t} (${n.c || "no category"}, ${n.k})` : n.t));
  node.appendChild(labelEl(doc, n.t, 1, r + 4, n.k === "product" ? "tw-tm-label tw-tm-product" : "tw-tm-label tw-tg-hover"));
  g.appendChild(node);
}

/** Every link as a line coloured by its source's category; lines indexed by node. */
function drawMapEdges(doc, svg, map, nodes) {
  const g = svgEl(doc, "g", { class: "tw-tm-edges" });
  const byNode = nodes.map(() => []);
  for (const [s, t] of map.edges) {
    const a = nodes[s];
    const b = nodes[t];
    const line = svgEl(doc, "line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: map.categories[a.c] || GREY, class: "tw-tm-edge" });
    g.appendChild(line);
    byNode[s].push(line);
    byNode[t].push(line);
  }
  svg.appendChild(g);
  return byNode;
}

/** Map nodes in one group per category, smallest first so hubs sit on top. */
function drawMapNodes(doc, svg, map, nodes) {
  const cats = [...new Set(nodes.map((n) => n.c || ""))].sort();
  const groups = new Map(cats.map((c) => [c, svgEl(doc, "g", { "data-cat": c })]));
  const order = nodes.map((n, i) => Object.assign({ i }, n)).sort((a, b) => a.s - b.s);
  for (const n of order) drawMapNode(doc, groups.get(n.c || ""), n, map.categories[n.c] || GREY);
  for (const g of groups.values()) svg.appendChild(g);
  return groups;
}

/** Light one map node and its links, and unlight the one lit before. */
function lightMapNode(widget, node) {
  if (widget.lit === node) return;
  for (const el of widget.litEls || []) el.setAttribute("class", el.getAttribute("class").replace(/ tw-tm-on| tw-tm-lit/g, ""));
  widget.lit = node;
  widget.litEls = [];
  if (!node) return;
  node.setAttribute("class", `${node.getAttribute("class")} tw-tm-on`);
  widget.litEls.push(node);
  for (const line of widget.edgesByNode[Number(node.getAttribute("data-i"))] || []) {
    line.setAttribute("class", "tw-tm-edge tw-tm-lit");
    widget.litEls.push(line);
  }
}

/** Build the whole map's toolbar and drawing into root. */
function buildMap(widget, root, map) {
  const doc = widget.document;
  const nodes = map.nodes;
  const home = mapBounds(nodes);
  widget.view = Object.assign({ home }, home);
  widget.hoverLabels = true;
  widget.nodeClass = "tw-tm-node";
  const svg = svgEl(doc, "svg", { class: "tw-tg-svg tw-tm-svg", viewBox: viewBoxOf(widget.view) });
  widget.edgesByNode = drawMapEdges(doc, svg, map, nodes);
  const groups = drawMapNodes(doc, svg, map, nodes);
  const chips = [...groups].filter(([c]) => c).map(([c, g]) => [c, map.categories[c] || GREY, nodes.filter((n) => n.c === c).length, g]);
  root.appendChild(toolbar(widget, svg, chips));
  root.appendChild(svg);
  if (typeof svg.addEventListener !== "function") return;
  attachPointer(widget, svg);
  svg.addEventListener("pointerover", (e) => lightMapNode(widget, e.target.closest(".tw-tm-node")));
  svg.addEventListener("pointerleave", () => lightMapNode(widget, null));
}

const Widget = require("$:/core/modules/widgets/widget.js").widget;

/** Shared widget plumbing: the target tiddler and refresh on its change or the map's. */
function execute() {
  this.target = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
}

function refresh(changed) {
  const attrs = this.computeAttributes();
  if (attrs.tiddler || changed[this.target] || changed[MAP_TITLE]) {
    this.refreshSelf();
    return true;
  }
  return false;
}

/** Mount a built root element where TiddlyWiki asked for it. */
function mount(widget, parent, nextSibling, root) {
  parent.insertBefore(root, nextSibling);
  widget.domNodes.push(root);
}

function TopicGraph(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
}
TopicGraph.prototype = new Widget();
TopicGraph.prototype.execute = execute;
TopicGraph.prototype.refresh = refresh;
TopicGraph.prototype.render = function render(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const tiddler = this.wiki.getTiddler(this.target);
  const parsed = parseNeighbors(tiddler && tiddler.fields.neighbors);
  const root = htmlEl(this.document, "div", "tw-topicgraph");
  if (parsed.error) root.appendChild(htmlEl(this.document, "p", "tw-tg-error", parsed.error));
  else if (parsed.list.length) buildGraph(this, root, parsed.list);
  mount(this, parent, nextSibling, root);
};

function TopicMap(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
}
TopicMap.prototype = new Widget();
TopicMap.prototype.execute = execute;
TopicMap.prototype.refresh = refresh;
TopicMap.prototype.render = function render(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const map = loadMap(this.wiki);
  const root = htmlEl(this.document, "div", "tw-topicgraph tw-topicmap");
  if (map.error) root.appendChild(htmlEl(this.document, "p", "tw-tg-error", map.error));
  else if (map.nodes.length) buildMap(this, root, map);
  mount(this, parent, nextSibling, root);
};

exports.topicgraph = TopicGraph;
exports.topicmap = TopicMap;
