/*\
title: $:/plugins/topicwiki/topicgraph.js
type: application/javascript
module-type: widget

The <$topicgraph/> widget: the current tiddler's direct links, drawn as a
radial graph from its `neighbors` field (a JSON list of {title, rel, dir}).
Click a node to open that tiddler; drag to pan; the toolbar zooms and
hides a relation. build.mjs embeds this file as a tiddler; it has no
dependencies beyond the TiddlyWiki core.
\*/
"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
const PALETTE = ["#2563eb", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2",
  "#db2777", "#65a30d", "#475569", "#b45309", "#0d9488", "#9333ea"];
const SPACING = 26; // arc length kept between neighbouring nodes on one ring
const FIRST_RING = 90;
const RING_GAP = 34;
const LABEL_LIMIT = 36; // label every node when there are at most this many
const LABEL_PAD = 110; // room around the outer ring when every node is labelled
const HOVER_PAD = 40; // room around the outer ring when labels show on hover

/** The neighbors field as a list; [] when the field is absent. */
function parseNeighbors(text) {
  return text ? JSON.parse(text) : [];
}

/** Each relation, sorted, with its colour. */
function relationColours(neighbors) {
  const rels = [...new Set(neighbors.map((n) => n.rel))].sort();
  return new Map(rels.map((r, i) => [r, PALETTE[i % PALETTE.length]]));
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

/** A neighbor's label, placed outward from the centre. */
function labelEl(doc, n, visible) {
  const right = n.x >= 0;
  const t = svgEl(doc, "text", {
    x: right ? 10 : -10, y: 4, "text-anchor": right ? "start" : "end",
    class: visible ? "tw-tg-label" : "tw-tg-label tw-tg-hover",
  });
  t.textContent = n.title;
  return t;
}

/** One neighbor: its edge from the centre, its dot, its label. */
function drawNeighbor(doc, g, n, colour, opts) {
  g.appendChild(svgEl(doc, "line", {
    x1: 0, y1: 0, x2: n.x, y2: n.y, stroke: colour,
    class: n.dir === "in" ? "tw-tg-edge tw-tg-in" : "tw-tg-edge",
  }));
  const node = svgEl(doc, "g", { class: "tw-tg-node", "data-title": n.title, transform: `translate(${n.x},${n.y})` });
  const dot = svgEl(doc, "circle", { r: opts.dot, fill: colour });
  const tip = svgEl(doc, "title", {});
  tip.textContent = describe(n);
  dot.appendChild(tip);
  node.appendChild(dot);
  node.appendChild(labelEl(doc, n, opts.labelAll));
  g.appendChild(node);
}

/** One group per relation, so the toolbar can hide a relation. */
function drawRelations(doc, svg, nodes, colours) {
  const opts = { labelAll: nodes.length <= LABEL_LIMIT, dot: nodes.length > 80 ? 5 : 7 };
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
  if (factor === 0) Object.assign(v, { x: -v.size / 2, y: -v.size / 2, w: v.size, h: v.size });
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

/** Hide or show one relation's group, and mark its chip. */
function toggleRelation(chip, group) {
  const hidden = group.style.display === "none";
  group.style.display = hidden ? "" : "none";
  chip.classList.toggle("tw-tg-off", !hidden);
}

/** Zoom buttons, then one chip per relation with its count. */
function toolbar(widget, svg, colours, groups, neighbors) {
  const doc = widget.document;
  const bar = htmlEl(doc, "div", "tw-tg-toolbar");
  bar.appendChild(button(doc, "tw-tg-zoom", "+", "Zoom in", () => zoom(widget, svg, 0.75)));
  bar.appendChild(button(doc, "tw-tg-zoom", "-", "Zoom out", () => zoom(widget, svg, 1 / 0.75)));
  bar.appendChild(button(doc, "tw-tg-zoom", "fit", "Show the whole graph", () => zoom(widget, svg, 0)));
  for (const [rel, colour] of colours) {
    const count = neighbors.filter((n) => n.rel === rel).length;
    const chip = button(doc, "tw-tg-chip", ` ${rel} (${count})`, `Hide or show: ${rel}`, (e) => toggleRelation(e.currentTarget, groups.get(rel)));
    const swatch = htmlEl(doc, "span", "tw-tg-swatch");
    swatch.style.background = colour;
    chip.insertBefore(swatch, chip.firstChild);
    bar.appendChild(chip);
  }
  return bar;
}

/** Drag to pan: move the view by the pointer's travel, in view units. */
function panTo(widget, svg, e) {
  const d = widget.drag;
  const scale = widget.view.w / (svg.clientWidth || widget.view.w);
  const dx = (e.clientX - d.x) * scale;
  const dy = (e.clientY - d.y) * scale;
  if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 4) d.moved = true;
  widget.view.x = d.vx - dx;
  widget.view.y = d.vy - dy;
  svg.setAttribute("viewBox", viewBoxOf(widget.view));
}

/** Pointer handlers: drag pans, a click on a node opens that tiddler. */
function attachPointer(widget, svg) {
  svg.addEventListener("pointerdown", (e) => {
    widget.drag = { x: e.clientX, y: e.clientY, vx: widget.view.x, vy: widget.view.y, moved: false };
  });
  svg.addEventListener("pointermove", (e) => { if (widget.drag && e.buttons) panTo(widget, svg, e); });
  svg.addEventListener("click", (e) => {
    const node = e.target.closest(".tw-tg-node");
    const moved = widget.drag && widget.drag.moved;
    widget.drag = null;
    if (node && !moved) {
      widget.dispatchEvent({ type: "tm-navigate", navigateTo: node.getAttribute("data-title"), navigateFromTitle: widget.target });
    }
  });
}

/** Build the toolbar and the graph into root. */
function buildGraph(widget, root, neighbors) {
  const doc = widget.document;
  const colours = relationColours(neighbors);
  const placed = layout(neighbors);
  const size = 2 * (placed.radius + (neighbors.length <= LABEL_LIMIT ? LABEL_PAD : HOVER_PAD));
  widget.view = { x: -size / 2, y: -size / 2, w: size, h: size, size };
  const svg = svgEl(doc, "svg", { class: "tw-tg-svg", viewBox: viewBoxOf(widget.view) });
  svg.style.height = `${Math.min(640, Math.max(340, 300 + neighbors.length))}px`;
  const groups = drawRelations(doc, svg, placed.nodes, colours);
  drawCentre(doc, svg, widget.target);
  root.appendChild(toolbar(widget, svg, colours, groups, neighbors));
  root.appendChild(svg);
  if (typeof svg.addEventListener === "function") attachPointer(widget, svg);
}

const Widget = require("$:/core/modules/widgets/widget.js").widget;

function TopicGraph(parseTreeNode, options) {
  this.initialise(parseTreeNode, options);
}
TopicGraph.prototype = new Widget();

TopicGraph.prototype.execute = function execute() {
  this.target = this.getAttribute("tiddler", this.getVariable("currentTiddler"));
};

TopicGraph.prototype.render = function render(parent, nextSibling) {
  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();
  const tiddler = this.wiki.getTiddler(this.target);
  const neighbors = parseNeighbors(tiddler && tiddler.fields.neighbors);
  const root = htmlEl(this.document, "div", "tw-topicgraph");
  if (neighbors.length) buildGraph(this, root, neighbors);
  parent.insertBefore(root, nextSibling);
  this.domNodes.push(root);
};

TopicGraph.prototype.refresh = function refresh(changed) {
  const attrs = this.computeAttributes();
  if (attrs.tiddler || changed[this.target]) {
    this.refreshSelf();
    return true;
  }
  return false;
};

exports.topicgraph = TopicGraph;
