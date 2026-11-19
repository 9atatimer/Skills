# Topic graph format

Read this when you map a source into a topic graph, or when an agent
needs the fields of a built tiddler store.

## Input: the topic graph

One JSON object. `build.mjs` rejects a graph that breaks a rule below.

```json
{
  "title": "Cloudflare",
  "subtitle": "every product, feature and integration, linked",
  "description": "One plain sentence about the subject.",
  "source": { "name": "Cloudflare, mapped", "url": "https://...", "fetched": "2026-10-29" },
  "nodes": [
    {
      "id": "workers",
      "label": "Workers",
      "type": "product",
      "category": "Compute",
      "description": "Serverless platform for running code on the network.",
      "docs": "https://developers.cloudflare.com/workers/",
      "links": [{ "title": "Product page", "url": "https://..." }],
      "tutorials": [{ "title": "Workers tutorials", "url": "https://..." }],
      "status": "ga"
    }
  ],
  "edges": [
    {
      "source": "workers",
      "target": "kv",
      "type": "binds_to",
      "label": "KV namespace binding",
      "evidence": ["https://..."]
    }
  ]
}
```

| Field | Required | Rule |
|---|---|---|
| `title` | yes | the subject; becomes the home tiddler and the site title. A title: no `[[`, `]]`, `{{`, `}}`, `|` or line break, not starting `$:/`, not ending in `]`, without a leading or trailing space, and not shaped like a URL (`mailto:x`), with at least one letter or digit (it names the output file) |
| `subtitle`, `description` | no | shown as plain text in the header and on the home tiddler |
| `source` | no, but give it | `name` (a title), `url` (http(s)), `fetched` (`YYYY-MM-DD`); shown on the home tiddler |
| `nodes[].id` | yes | a lowercase slug, unique; agents address a topic by it |
| `nodes[].label` | yes | the tiddler title: unique, no `[[`, `]]`, `{{`, `}}`, `|` or line break, not starting `$:/`, not ending in `]`, without a leading or trailing space, and not shaped like a URL (`mailto:x`) |
| `nodes[].type` | no | the kind of topic, one lowercase word (`product`, `sub-product`); each type gets an index tiddler `<Type> index` |
| `nodes[].category` | no | the grouping, a title; each category gets an index tiddler with that name |
| `nodes[].description` | no | plain text; shown as text, never parsed as markup |
| `nodes[].docs` | no | the public documentation, http(s) |
| `nodes[].x`, `nodes[].y` | no | the source's layout, numbers within 1e6 of 0; give them for every node or for none |
| `nodes[].size` | no | the source's weight for the node, a positive number up to 1e4; defaults to 2 + 2 * sqrt(number of links); the map and every neighbor graph draw it at the same radius |
| `nodes[].links`, `nodes[].tutorials` | no | lists of `{title, url}`, http(s) |
| `palette` | no | `{categories: {name: "#rrggbb"}, relations: {edge type: "#rrggbb"}}`; a name it leaves out gets a default colour |
| `edges[].source`, `edges[].target` | yes | node ids that exist |
| `edges[].type` | yes | a relation verb in lowercase snake_case (`binds_to`, `built_on`, `has_feature`); shown with spaces |
| `edges[].label` | no | a short note on the relation, shown as plain text |
| `edges[].evidence` | no | http(s) URLs that state the relation |

Every tiddler title comes from one space: the home `title`, `AI access`,
each category, each `<Type> index` and each label. A title used twice
is rejected, because the two tiddlers would merge into one.

Free text (`subtitle`, `description`, `category`, `edges[].label`) is
shown with a text widget and is never parsed as markup. A string that
holds `'`, `"` and `"""` together, or `'` and `"` and ends in `"`, cannot be
quoted for that widget and is rejected; reword it.

An edge is directed: the source topic's graph draws it outgoing, the
target's draws it incoming (dashed). Use one edge per fact; do not add
the reverse edge.

## Input: written content

`<name>.content.json` maps a topic id to the content written for it; the
builder merges it with `--content`. An unknown id or field is an error.

```json
{
  "kv": {
    "explanation": "Workers KV is a global key-value store ... Code in [[Workers]] reads it.\n\nSecond paragraph.",
    "compare": [{ "title": "D1", "text": "KV looks values up by key only. [[D1]] answers SQL queries." }],
    "cases": [{ "title": "How Acme cut latency", "url": "https://...", "summary": "One plain sentence." }]
  }
}
```

| Field | Rule |
|---|---|
| `explanation` | plain text; paragraphs split on a blank line; links as `[[Title]]` or `[[shown text|Title]]`, each naming a tiddler |
| `compare[].title` | another topic's title |
| `compare[].text` | plain text with links, as `explanation`, shown on one line: line breaks become spaces |
| `cases[].title`, `cases[].url` | a title with no link characters, an http(s) URL you opened |
| `cases[].summary` | optional plain text |

Everything outside a link is shown as plain text, never parsed as
markup. A plain-text run must be quotable (see free text above) and
must not hold `[[` or `]]` outside a link. Written text that is empty or
only spaces is rejected. An error names the topic by its graph index and
id, as `nodes[3] (kv): explanation links "Nowhere", which is not a
tiddler`; find the entry by the id.

## Output: the tiddler store

`<name>.tiddlers.json` is a JSON array sorted by title. A topic tiddler
has these fields:

| Field | Value |
|---|---|
| `title` | the node label |
| `topic_id` | the node id |
| `topic_type`, `category`, `status` | copied from the node when present |
| `description` | the node description |
| `docs_url` | the node docs URL |
| `links_out`, `links_in` | edge counts, as strings |
| `neighbors` | JSON list of `{title, rel, dir, label, evidence}` that the graph draws: each link to another topic (`dir` is `out` or `in`, `rel` the relation in words, `label` the edge's note and `evidence` its URLs when the source gives them; a self-edge is left out), then the way up: `in category` and `of type` (`dir` `out`), or `part of` the home when the topic has neither |
| `tags` | the category and the type index, TiddlyWiki tag syntax |
| `text` | TiddlyWiki markup: the explanation (or `<$view field="description"/>`), then Compared with and Case studies when present, Docs, Tutorials, Neighbor graph |

Index tiddlers carry `neighbors` too: the home links each category and
type index, a category links the home and its members (`rel` is the
member's type, or `other` when it has none), and a type index links the
home and its members (`rel` is the member's category, or `other`). A
tiddler with no neighbors has no graph section. A category or type
index's text is one line of counts; its members are in its graph.

`$:/topicwiki/map` holds what the full map draws: `nodes` (`t` title,
`x`, `y`, `s` size, `c` category, `k` type), `edges` as pairs of node
indexes, and the `categories` and `relations` colours (relations keyed
in words, `binds to`).

The store also holds the home tiddler (titled `title`), one tiddler per
category and per type index, `AI access`, and the `$:/` system tiddlers
that set the site title, the default tiddler and the per-topic agent
line. A query for topics selects `has("topic_id")`.

Useful queries:

```sh
jq '.[] | select(.topic_id == "workers")' store.tiddlers.json
jq -r '.[] | select(.category == "Storage") | .title' store.tiddlers.json
jq -r '.[] | select(.topic_id) | [.links_in, .title] | @tsv' store.tiddlers.json | sort -rn | head
```
