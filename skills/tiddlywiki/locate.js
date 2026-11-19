/*\
title: $:/plugins/topicwiki/locate.js
type: application/javascript
module-type: startup

Where is this wiki? Read its own address and work out where its tiddler
store sits -- the file beside it with the same name and the extension
.tiddlers.json -- then fill the copy-paste agent lines with that location.
Opened from disk, the store is a path; opened from the web, a URL. So the
wiki can be moved or copied, with its store beside it, and its agent lines
stay right. Everything written here is a $:/temp/ tiddler, which TiddlyWiki
never saves and never counts as a change. build.mjs embeds this file.
\*/
"use strict";

/** The marker build.mjs puts in the agent-line templates where the store goes. */
const STORE_MARK = "{{topicwiki-store}}";

exports.name = "topicwiki-locate";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.synchronous = true;

/**
 * Where the tiddler store sits for a wiki opened at `href`: the same
 * folder, the same name, the extension .tiddlers.json. A file:// address
 * gives a filesystem path (a Windows drive letter keeps its colon); any
 * other gives a URL. Pure.
 */
function storeLocation(href) {
  const url = new URL(href);
  const path = url.pathname.replace(/\.html?$/i, "") + ".tiddlers.json";
  if (url.protocol !== "file:") return url.origin + path;
  const local = decodeURIComponent(path);
  return /^\/[A-Za-z]:\//.test(local) ? local.slice(1) : local;
}

/** POSIX shell single-quote escaping, without the surrounding quotes. */
function shEsc(s) {
  return s.replace(/'/g, "'\\''");
}

/** A template with the store put in, escaped for its single-quoted prompt. Pure. */
function fill(template, store) {
  return template.split(STORE_MARK).join(shEsc(store));
}

exports.startup = function startup() {
  const store = storeLocation(window.location.href);
  $tw.wiki.addTiddler({ title: "$:/temp/topicwiki/store", text: store });
  for (const name of ["command", "command-prefix"]) {
    const template = $tw.wiki.getTiddlerText(`$:/config/topicwiki/${name}`, "");
    $tw.wiki.addTiddler({ title: `$:/temp/topicwiki/${name}`, text: fill(template, store) });
  }
};
