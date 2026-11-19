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
never saves and never counts as a change. It runs before the story is
built, so the first render already has the lines. build.mjs embeds it.
\*/
"use strict";

/** The marker build.mjs puts in the agent-line templates where the store goes. */
const STORE_MARK = "{{topicwiki-store}}";
/** What the lines say when the address is neither a file nor a web page. */
const UNKNOWN = "the .tiddlers.json file beside this wiki";

exports.name = "topicwiki-locate";
exports.platforms = ["browser"];
exports.after = ["startup"];
exports.before = ["story"];
exports.synchronous = true;

/**
 * The store's path part for a page at `pathname`: the page's own name with
 * the extension .tiddlers.json, or -- for a folder address such as "/" --
 * the store name the build recorded, in that folder. Pure.
 */
function storePath(pathname, builtName) {
  if (/\.html?$/i.test(pathname)) return pathname.replace(/\.html?$/i, ".tiddlers.json");
  return pathname.replace(/[^/]*$/, "") + builtName;
}

/**
 * A file path from its URL form. An escape that does not decode, or one
 * that decodes to a control character, is kept as written, so the line
 * never fails to build and never carries a NUL or a line break. Pure.
 */
function decodePath(path) {
  let local;
  try {
    local = decodeURIComponent(path);
  } catch (e) {
    return path;
  }
  return /[\u0000-\u001f\u007f]/.test(local) ? path : local;
}

/**
 * Where the tiddler store sits for a wiki opened at `href`: a filesystem
 * path for file:// (a network share keeps its server, a Windows drive
 * letter its colon), a URL for http(s), and null for anything else. Pure.
 */
function storeLocation(href, builtName) {
  const url = new URL(href);
  const path = storePath(url.pathname, builtName);
  if (url.protocol === "http:" || url.protocol === "https:") return url.origin + path;
  if (url.protocol !== "file:") return null;
  const local = decodePath(path);
  if (url.host) return "//" + url.host + local;
  return /^[/][A-Za-z]:[/]/.test(local) ? local.slice(1) : local;
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
  const builtName = $tw.wiki.getTiddlerText("$:/config/topicwiki/store-name", "topicwiki.tiddlers.json");
  const found = storeLocation(window.location.href, builtName);
  const store = found === null ? UNKNOWN : found;
  const shown = found === null ? `This copy cannot tell where its store is: open it from a file or a web address. The store is ${UNKNOWN}.` : found;
  $tw.wiki.addTiddler({ title: "$:/temp/topicwiki/store", text: shown });
  for (const name of ["command", "command-prefix"]) {
    const template = $tw.wiki.getTiddlerText(`$:/config/topicwiki/${name}`, "");
    $tw.wiki.addTiddler({ title: `$:/temp/topicwiki/${name}`, text: fill(template, store) });
  }
};
