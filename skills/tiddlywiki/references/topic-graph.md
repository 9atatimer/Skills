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
| `nodes[].x`, `nodes[].y` | no | the source's layout, finite numbers; give them for every node or for none |
| `nodes[].size` | no | the source's weight for the node, a positive number; defaults to 2 + 2 * sqrt(number of links) |
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

An edge is directed. The source topic lists it under Links from here as
"binds to Target"; the target lists it under Links to here as "Source
binds to this". Use one edge per fact; do not add the reverse edge.

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
| `neighbors` | JSON list of `{title, rel, dir}` that the graph draws: each link to another topic (`dir` is `out` or `in`, `rel` the relation in words; a self-edge is left out), then the way up: `in category` and `of type` (`dir` `out`), or `part of` the home when the topic has neither |
| `tags` | the category and the type index, TiddlyWiki tag syntax |
| `text` | TiddlyWiki markup with sections Docs, Tutorials, Links from here, Links to here, Neighbor graph |

Index tiddlers carry `neighbors` too: the home links each category and
type index, a category links the home and its members (`rel` is the
member's type, or `other` when it has none), and a type index links the
home and its members (`rel` is the member's category, or `other`). A
tiddler with no neighbors has no graph section.

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
