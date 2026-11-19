---
name: tiddlywiki
description: "Building a single-file TiddlyWiki that is the one reference for a subject (a technology, a vendor's product line, a domain): one tiddler per topic with a plain-English explanation, comparisons with similar topics, case studies, docs and tutorials, a full map of the subject and a graph of each topic's neighbors, and a plain JSON tiddler store plus a copy-paste command that starts an agent session over it. Load when asked for a tiddlywiki, a topic wiki, or a navigable reference or map of a subject that a person and an agent can both browse. Skip for answering questions over uploaded documents (knowledge-base) and for diagrams of a repository's own code (architecture-views)."
---

# Topic wikis in TiddlyWiki

A topic wiki is one HTML file a person opens in a browser and one JSON
file an agent reads, both built from the same topic graph and the
content written for it. Each topic is a tiddler that explains the topic
and points to where to learn more; its relations to other topics are
drawn as a graph.

## Standing rules

- **The topic graph is the source; the wiki is built from it.** Write
  the subject as a topic graph (`references/topic-graph.md`) and build
  with `build.mjs` in this skill's directory. To change the wiki, change
  the graph and rebuild. Do not edit the HTML or the tiddler store by
  hand, because the next build overwrites the edit.
- **Every topic and every relation comes from a source you can cite.**
  Prefer a structured source (a published graph, a sitemap, a product
  directory, an API listing) over prose you summarise. Put the source in
  the graph's `source` field; the home tiddler shows it. Do not add a
  topic or a relation from your own knowledge without a page that
  states it: an agent that reads the wiki trusts every link in it.
- **Link only URLs you checked.** A docs or tutorial URL is kept when a
  request for it returns 200 and the page it lands on is the page you
  meant. A redirect to a different kind of page (examples, reference, a
  product overview) is not a tutorial; drop it. A topic with no
  tutorials says so; it does not link a guess.
- **Cover the subject, then stop.** Include every topic the source
  names, at every level it names (product, feature, integration,
  protocol). Do not prune to the popular ones; a reference that is
  missing a topic sends the reader elsewhere.
- **Keep it out of the checkout.** The build writes to
  `$XDG_DATA_HOME/topicwiki/` (else `~/.local/share/topicwiki/`). Pass
  `--out` only for a place the human names. A wiki built from someone
  else's unlicensed material stays a local file: do not commit it to a
  public repository or publish it.
- **A tiddler is a page.** Moving from one tiddler to another, by a
  hyperlink or by a click on a map or a graph, behaves like moving from
  page to page: one tiddler shows at a time, the address bar names it,
  and the browser's back and forward buttons step through the tiddlers
  visited. A step forward moves the page one way and a step back moves it
  the opposite way, as pages do. The builder sets this up (the `page` story
  view in `pageview.js`); do not change the navigation
  settings, and do not add a control that opens a tiddler without
  `tm-navigate`, because only that message updates the history. Check
  back and forward in the browser when you verify a build.
- **The landing page shows the whole map; other pages show their
  neighbors.** The home tiddler opens with the full map of the subject.
  Every other tiddler ends with its nearest-neighbor graph. Both draw a
  topic in the same colour and size, so a reader recognises it from
  one view to the other.
- **A subject tiddler explains; the graph shows relations.** A topic's
  tiddler holds, in this order: a plain-English explanation of the
  subject with links to the topics it mentions, a comparison with
  similar topics (each linked), case studies when there are any, doc
  links, tutorials, and last its neighbor graph. Do not restate the
  graph in text: no lists of links in and out. The explanation,
  comparisons and case studies are written content (Write the content,
  below); a topic with none yet shows its one-line description.
- **The agent reads the store, the human reads the HTML.** The
  `.tiddlers.json` beside the HTML is the agent interface. Its fields
  are listed in the wiki's `AI access` tiddler and in the reference.

## Build

Run the builder; it validates the graph, writes the store, and packs the
HTML with the TiddlyWiki CLI it pins (`npx`, npm registry):

```sh
node <skill dir>/build.mjs <graph.json> [--content <content.json>] [--out <file.html>] [--agent codex]
```

It prints the HTML path, the store path and the tiddler count. A
validation error lists every problem in the graph at once: a duplicate
id, a title used twice (topics, categories, type indexes, the home and
`AI access` share one title space), a title a link would misread (`[[`, `]]`, `|`, `{{`, `}}`,
a trailing `]`, a URL shape), a type that is not a lowercase word, an edge to an
unknown id, a URL that is not http(s), written text that links a title
no tiddler has. Fix the graph or the content, not the builder.

`--agent` sets the command in the copy-paste line (default `claude`).
The prompt after it is one single-quoted shell word, so nothing in the
title or the store path is expanded when the line is pasted.

## Procedure

Follow the steps in this order; each needs the one before.

- Fetch the source into a scratch directory and read its structure
  before mapping it. A JavaScript-rendered site usually loads its data
  as a separate JSON or JS file; read that, not the rendered page.
- Map it to a topic graph with a short script, and keep the graph
  beside the output as `<name>.graph.json` so the wiki can be rebuilt.
- Enrich: docs URLs, product pages as `links`, tutorials. Check each URL
  as the rules above say, in parallel, with a timeout.
- Write the content, below, for the topics a reader meets first, and
  keep it beside the graph as `<name>.content.json`.
- Build, with `--content`.
- Verify before you report. Open the HTML (serve its directory on
  localhost if the browser refuses `file://`), open one well-connected
  topic, and check that its explanation, comparisons, docs and tutorials
  render, its graph comes last, and its agent line names the right
  `topic_id`. Check that every
  `[[link]]` in the store names a tiddler in the store. Run the agent
  line once with a real question and read the answer.
- Report the two paths, the topic and link counts, how many topics
  have written content, and what the source did not cover (for example,
  how many topics have no tutorials or case studies).

## Write the content

The source gives a topic a name, a category, links and a one-line
description; a reader needs more. For each topic you write, put in
`<name>.content.json`, keyed by topic id:

- `explanation`: what the topic is, what it is for and when to use it,
  in plain English, a short paragraph or two. Link the other topics you
  mention as `[[Title]]` or `[[shown text|Title]]`.
- `compare`: the similar topics a reader would weigh against this one,
  each `{title, text}`, where `text` says when to pick which.
- `cases`: published case studies, each `{title, url, summary}`.

Write every sentence from a page you read for this topic -- the
product's docs overview, a comparison page such as a vendor's storage
options guide -- not from memory, and link only case studies whose page
you opened. Keep the content in its own file, because the graph is
regenerated from the source and the content is not. The builder rejects
a link to a title that has no tiddler and text it cannot show as plain
text; `references/topic-graph.md` has the format.

## Map and neighbor graph

The home tiddler starts with the full map: every topic at its place,
coloured by category and sized by weight, every link drawn faintly. A
topic grows, shows its name and lights its links under the pointer; a
click opens it; drag pans; the mouse wheel over a drawing zooms it
about the pointer instead of scrolling the page; the toolbar zooms and
hides a category.
When the source publishes its own layout, sizes and colours, carry them
into the topic graph (`x`, `y`, `size`, `palette`) so the map looks like
the source; otherwise the builder lays the topics out by category and
sizes them by their number of links.

Every category, type index and topic that has neighbors ends with a
Neighbor graph section, after Docs and Tutorials: its
direct links drawn around it, each neighbor in its map colour and size,
each link in its relation's colour, incoming links dashed. A click on a node opens that tiddler;
on a touch screen, a crowded graph's first tap shows the name. A topic's
graph also includes its category and its type index, or the home tiddler
when it has neither, and every index's graph includes the home tiddler,
so any topic is at most two steps from the root. A category or type
index shows its members only in its graph, not as a list. Both widgets are in `topicgraph.js` in this
skill's directory; `build.mjs` embeds it, so the HTML stays one file
with no network dependency. Check the map and one hub topic's graph in
the browser when you verify a build.

## AI access

Each topic tiddler shows a command that starts an agent session at that
topic over the store; the `AI access` tiddler shows the same command
for the whole wiki. The prompt tells the agent to query the store with
`jq` by `title` or `topic_id`, because a large store does not fit in
one read.

An MCP server that serves a topic wiki to an agent, and an Emacs
frontend that navigates one, belong in tds-utils, not in this skill.
When they exist, this skill names the command that starts each.
