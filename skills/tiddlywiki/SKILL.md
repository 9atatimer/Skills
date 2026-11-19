---
name: tiddlywiki
description: "Building a single-file TiddlyWiki that is the one reference for a subject (a technology, a vendor's product line, a domain): one tiddler per topic, hyperlinked to every topic it relates to in both directions, with links to the public docs and tutorials, and a plain JSON tiddler store plus a copy-paste command that starts an agent session over it. Load when asked for a tiddlywiki, a topic wiki, or a navigable reference or map of a subject that a person and an agent can both browse. Skip for answering questions over uploaded documents (knowledge-base) and for diagrams of a repository's own code (architecture-views)."
---

# Topic wikis in TiddlyWiki

A topic wiki is one HTML file a person opens in a browser and one JSON
file an agent reads, both built from the same topic graph. Each topic
is a tiddler. Each tiddler names its docs and tutorials and links every
topic it has a direct relation with, outgoing and incoming, so the
tiddler is the topic's navigable neighbourhood.

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
- **The agent reads the store, the human reads the HTML.** The
  `.tiddlers.json` beside the HTML is the agent interface. Its fields
  are listed in the wiki's `AI access` tiddler and in the reference.

## Build

Run the builder; it validates the graph, writes the store, and packs the
HTML with the TiddlyWiki CLI it pins (`npx`, npm registry):

```sh
node <skill dir>/build.mjs <graph.json> [--out <file.html>] [--agent codex]
```

It prints the HTML path, the store path and the tiddler count. A
validation error lists every problem in the graph at once: a duplicate
id or label, a label with `[[`, `]]`, `|`, `{{` or `}}` in it, an edge
to an unknown id, a URL that is not http(s), a label that collides with
a category or type index. Fix the graph, not the builder.

`--agent` sets the command in the copy-paste line (default `claude`).

## Procedure

Follow the steps in this order; each needs the one before.

- Fetch the source into a scratch directory and read its structure
  before mapping it. A JavaScript-rendered site usually loads its data
  as a separate JSON or JS file; read that, not the rendered page.
- Map it to a topic graph with a short script, and keep the graph
  beside the output as `<name>.graph.json` so the wiki can be rebuilt.
- Enrich: docs URLs, product pages as `links`, tutorials. Check each URL
  as the rules above say, in parallel, with a timeout.
- Build.
- Verify before you report. Open the HTML (serve its directory on
  localhost if the browser refuses `file://`), open one well-connected
  topic, and check that its docs, tutorials and both link sections
  render and its agent line names the right `topic_id`. Check that every
  `[[link]]` in the store names a tiddler in the store. Run the agent
  line once with a real question and read the answer.
- Report the two paths, the topic and link counts, and what the source
  did not cover (for example, how many topics have no tutorials).

## AI access

Each topic tiddler shows a command that starts an agent session at that
topic over the store; the `AI access` tiddler shows the same command
for the whole wiki. The prompt tells the agent to query the store with
`jq` by `title` or `topic_id`, because a large store does not fit in
one read.

An MCP server that serves a topic wiki to an agent, and an Emacs
frontend that navigates one, belong in tds-utils, not in this skill.
When they exist, this skill names the command that starts each.
