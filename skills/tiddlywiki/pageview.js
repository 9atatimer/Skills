/*\
title: $:/plugins/topicwiki/pageview.js
type: application/javascript
module-type: storyview

The "page" story view: one tiddler at a time, like pages. A step forward
(a link, a click on a map or graph, the browser's forward button) moves
the page ESE; a step back (the browser's back button) moves it WNW.

The direction comes from the browser, not from titles: each history entry
carries a step number in its state, so returning to an entry with a
lower number than the current one is a step back, and a new entry is a
step forward. That holds across reloads, because the browser keeps the
state. build.mjs embeds this file as a tiddler and sets $:/view to "page".
\*/
"use strict";

const OFFSET = { x: 48, y: 18 }; // how far a page starts from its resting place, ESE
const EASING = "cubic-bezier(0.645, 0.045, 0.355, 1)";
const PAGE_CLASS = "tc-storyview-zoomin-tiddler"; // the core's absolute, full-width layout
const STATE_KEY = "topicwikiStep";

let position = null; // this entry's step number, once known
let pendingBack = false; // the browser has stepped back; the next navigateTo slides WNW
let watching = false;

/**
 * The step after a history event: `restored` is the step number on the
 * entry the browser now shows (undefined for a new entry). Returns the new
 * position, whether it was a step back, and whether the entry needs its
 * number written. Pure.
 */
function traverse(restored, current) {
  if (Number.isInteger(restored)) {
    const back = current !== null && restored < current;
    return { position: restored, back, stamp: false };
  }
  return { position: current === null ? 0 : current + 1, back: false, stamp: true };
}

/** The step number stored on the current history entry, if any. */
function storedStep() {
  const state = window.history.state;
  return state && typeof state === "object" ? state[STATE_KEY] : undefined;
}

/** Write a step number onto the current history entry, keeping its other state. */
function stamp(step) {
  window.history.replaceState(Object.assign({}, window.history.state, { [STATE_KEY]: step }), "");
}

/** On popstate or hashchange: note the browser's step, and number a new entry. */
function onHistoryEvent() {
  const restored = storedStep();
  if (restored === position && position !== null) return;
  const step = traverse(restored, position);
  position = step.position;
  pendingBack = step.back;
  if (step.stamp) stamp(position);
}

/** Start following the browser history, once per page load. */
function watchHistory() {
  if (watching) return;
  watching = true;
  onHistoryEvent();
  window.addEventListener("popstate", onHistoryEvent);
  window.addEventListener("hashchange", onHistoryEvent);
}

/** Whether this navigation is a step back, and forget it. */
function takeBack() {
  const back = pendingBack;
  pendingBack = false;
  return back;
}

/** A CSS translate `sign` offsets from the resting place: +1 is ESE, -1 is WNW. */
function shift(sign) {
  return `translate(${sign * OFFSET.x}px, ${sign * OFFSET.y}px)`;
}

/** The styles of a slide: where the incoming page starts, where the outgoing one ends. Pure. */
function slideStyles(back, duration) {
  const start = back ? 1 : -1;
  return {
    from: { display: "block", transition: "none", opacity: "0", transform: shift(start), pointerEvents: "" },
    to: { transition: `transform ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`, opacity: "1", transform: "none", zIndex: "500" },
    away: { transition: `transform ${duration}ms ${EASING}, opacity ${duration}ms ${EASING}`, opacity: "0", transform: shift(-start), zIndex: "0", pointerEvents: "none" },
    rest: { transition: "", opacity: "", transform: "", zIndex: "" },
  };
}

/** The element a list item renders, or null when it renders a text node. */
function elementOf(itemWidget) {
  const el = itemWidget && itemWidget.findFirstDomNode();
  return el && el.nodeType === 1 ? el : null;
}

const settling = new WeakMap(); // element -> what to do when its own transition ends

/** transitionend on a page: run its pending step, ignoring transitions of its children. */
function onTransitionEnd(e) {
  const el = e.currentTarget;
  if (e.target !== el) return;
  const then = settling.get(el);
  settling.delete(el);
  el.removeEventListener("transitionend", onTransitionEnd);
  if (then) then();
}

/** Run `then` when `el` finishes its transition, or now when there is none. */
function whenSettled(el, duration, then) {
  if (!duration) return then();
  settling.set(el, then);
  el.addEventListener("transitionend", onTransitionEnd);
}

/**
 * Hide every page but the two in this step. A page whose slide never
 * finished (no transitionend arrives while the page is not being drawn)
 * would otherwise stay on the page, transparent.
 */
function hideStale(listWidget, keep) {
  for (const item of listWidget.children) {
    const el = elementOf(item);
    if (el && !keep.includes(el)) el.style.display = "none";
  }
}

/** Slide `incoming` to rest and `outgoing` away; each finishes only if still current. */
function slide(view, incoming, outgoing, styles, duration) {
  Object.assign(incoming.style, styles.from);
  void incoming.offsetWidth; // apply the start position before the transition
  Object.assign(incoming.style, styles.to);
  whenSettled(incoming, duration, () => { if (view.current === incoming) Object.assign(incoming.style, styles.rest); });
  if (!outgoing || outgoing === incoming) return;
  Object.assign(outgoing.style, styles.away);
  whenSettled(outgoing, duration, () => { if (view.current !== outgoing) outgoing.style.display = "none"; });
}

/** Show the item before (or after) a removed one, and return its element. */
function revealNeighbour(widget) {
  const el = elementOf(widget.previousSibling() || widget.nextSibling());
  if (el) Object.assign(el.style, { display: "block", opacity: "", transform: "", pointerEvents: "" });
  return el;
}

/** The title shown first: the top of the history when it is in the story, else the first. Pure. */
function firstShown(historyTop, titles) {
  return titles.includes(historyTop) ? historyTop : titles[0];
}

/** The title at the top of the list widget's history, if any. */
function historyTop(listWidget) {
  const history = listWidget.wiki.getTiddlerDataCached(listWidget.historyTitle, []);
  return history.length ? history[history.length - 1].title : undefined;
}

/** Show the page titled `title`, hide the rest; return the shown element. */
function showOnly(items, title) {
  let shown = null;
  for (const [t, el] of items) {
    el.classList.add(PAGE_CLASS);
    el.style.display = t === title ? "block" : "none";
    if (t === title) shown = el;
  }
  return shown;
}

function PageView(listWidget) {
  this.listWidget = listWidget;
  watchHistory();
  const items = listWidget.children.map((item) => [item.parseTreeNode.itemTitle, elementOf(item)]).filter((pair) => pair[1]);
  this.current = showOnly(items, firstShown(historyTop(listWidget), items.map((pair) => pair[0])));
}

PageView.prototype.navigateTo = function navigateTo(historyInfo) {
  const index = this.listWidget.findListItem(0, historyInfo.title);
  const el = index === undefined ? null : elementOf(this.listWidget.children[index]);
  if (!el) return;
  const outgoing = this.current;
  this.current = el;
  el.classList.add(PAGE_CLASS);
  hideStale(this.listWidget, [el, outgoing]);
  const duration = $tw.utils.getAnimationDuration();
  slide(this, el, outgoing, slideStyles(takeBack(), duration), duration);
  window.scrollTo(0, 0);
};

PageView.prototype.insert = function insert(widget) {
  const el = elementOf(widget);
  if (!el) return;
  el.classList.add(PAGE_CLASS);
  el.style.display = "none";
};

PageView.prototype.remove = function remove(widget) {
  if (elementOf(widget) === this.current) this.current = revealNeighbour(widget);
  widget.removeChildDomNodes();
};

exports.page = PageView;
