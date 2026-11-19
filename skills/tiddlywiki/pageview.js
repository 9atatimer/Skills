/*\
title: $:/plugins/topicwiki/pageview.js
type: application/javascript
module-type: storyview

The "page" story view: one tiddler at a time, like pages. It keeps the
trail of tiddlers visited, as the browser history does, so a step back
along the trail (the browser's back button) moves the page the opposite
way from a step forward: forward moves ESE, back moves WNW. build.mjs
embeds this file as a tiddler and sets $:/view to "page".
\*/
"use strict";

const OFFSET = { x: 48, y: 18 }; // how far a page starts from its resting place, ESE
const EASING = "cubic-bezier(0.645, 0.045, 0.355, 1)";
const PAGE_CLASS = "tc-storyview-zoomin-tiddler"; // the core's absolute, full-width layout

let trail = { list: [], at: -1 };

/**
 * The trail after visiting title, and whether the visit was a step back:
 * the entry before the current one is back, the entry after it is
 * forward, and any other title cuts the trail there and is appended. Pure.
 */
function stepTrail(t, title) {
  if (t.at > 0 && t.list[t.at - 1] === title) return { trail: { list: t.list, at: t.at - 1 }, back: true };
  if (t.list[t.at] === title) return { trail: t, back: false };
  if (t.list[t.at + 1] === title) return { trail: { list: t.list, at: t.at + 1 }, back: false };
  const list = t.list.slice(0, t.at + 1).concat(title);
  return { trail: { list, at: list.length - 1 }, back: false };
}

/** A CSS translate `sign` offsets from the resting place: +1 is ESE, -1 is WNW. */
function shift(sign) {
  return `translate(${sign * OFFSET.x}px, ${sign * OFFSET.y}px)`;
}

/** The element a list item renders, or null when it renders a text node. */
function elementOf(itemWidget) {
  const el = itemWidget.findFirstDomNode();
  return el && el.nodeType === 1 ? el : null;
}

/**
 * Slide `incoming` to rest and `outgoing` away. A forward step starts the
 * incoming page WNW of rest and moves it ESE; a back step mirrors that.
 */
function slide(view, incoming, outgoing, back, duration) {
  const start = back ? 1 : -1;
  const transition = `transform ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`;
  Object.assign(incoming.style, { display: "block", transition: "none", opacity: "0", transform: shift(start) });
  void incoming.offsetWidth; // apply the start position before the transition
  Object.assign(incoming.style, { transition, opacity: "1", transform: "none", zIndex: "500" });
  setTimeout(() => Object.assign(incoming.style, { transition: "", opacity: "", transform: "", zIndex: "" }), duration);
  if (!outgoing || outgoing === incoming) return;
  Object.assign(outgoing.style, { transition, opacity: "0", transform: shift(-start), zIndex: "0" });
  setTimeout(() => { if (view.current !== outgoing) outgoing.style.display = "none"; }, duration);
}

function PageView(listWidget) {
  this.listWidget = listWidget;
  const history = listWidget.wiki.getTiddlerDataCached(listWidget.historyTitle, []);
  const top = history.length ? history[history.length - 1].title : undefined;
  for (const [i, item] of listWidget.children.entries()) {
    const el = elementOf(item);
    if (!el) continue;
    el.classList.add(PAGE_CLASS);
    const shown = top ? item.parseTreeNode.itemTitle === top : i === 0;
    el.style.display = shown ? "block" : "none";
    if (shown) {
      this.current = el;
      trail = stepTrail(trail, item.parseTreeNode.itemTitle).trail;
    }
  }
}

PageView.prototype.navigateTo = function navigateTo(historyInfo) {
  const index = this.listWidget.findListItem(0, historyInfo.title);
  const el = index === undefined ? null : elementOf(this.listWidget.children[index]);
  if (!el) return;
  const step = stepTrail(trail, historyInfo.title);
  trail = step.trail;
  const outgoing = this.current;
  this.current = el;
  el.classList.add(PAGE_CLASS);
  slide(this, el, outgoing, step.back, $tw.utils.getAnimationDuration());
  window.scrollTo(0, 0);
};

PageView.prototype.insert = function insert(widget) {
  const el = elementOf(widget);
  if (!el) return;
  el.classList.add(PAGE_CLASS);
  el.style.display = "none";
};

PageView.prototype.remove = function remove(widget) {
  widget.removeChildDomNodes();
};

exports.page = PageView;
