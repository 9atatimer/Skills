/*\
title: $:/plugins/topicwiki/landing.js
type: application/javascript
module-type: startup

When the wiki is opened with no tiddler in the address, name the landing
page there before the story starts, by replacing the current history entry.
Without this, TiddlyWiki pushes "#<landing page>" on top of the blank entry,
and the first press of back lands on a blank address that shows nothing new.
build.mjs embeds this file as a tiddler.
\*/
"use strict";

exports.name = "topicwiki-landing";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.before = ["story"];
exports.synchronous = true;

exports.startup = function startup() {
  if (window.location.hash.length > 1) return;
  const first = $tw.wiki.filterTiddlers($tw.wiki.getTiddlerText("$:/DefaultTiddlers", ""))[0];
  if (!first) return;
  $tw.locationHash = `#${encodeURIComponent(first)}`;
  window.history.replaceState(window.history.state, "", $tw.locationHash);
};
