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
| `title` | yes | the subject; becomes the home tiddler and the site title |
| `subtitle`, `description` | no | shown in the header and on the home tiddler |
| `source` | no, but give it | `name`, `url`, `fetched` (a date); shown on the home tiddler |
| `nodes[].id` | yes | a lowercase slug, unique; agents address a topic by it |
| `nodes[].label` | yes | the tiddler title: unique, no `[[ ]] { } |`, not starting `$:/`, not equal to a category, a type index or `AI access` |
| `nodes[].type` | no | the kind of topic; each type gets an index tiddler `<Type> index` |
| `nodes[].category` | no | the grouping; each category gets an index tiddler with that name |
| `nodes[].description` | no | plain text; shown as text, never parsed as markup |
| `nodes[].docs` | no | the public documentation, http(s) |
| `nodes[].links`, `nodes[].tutorials` | no | lists of `{title, url}`, http(s) |
| `edges[].source`, `edges[].target` | yes | node ids that exist |
| `edges[].type` | yes | a relation verb in snake_case (`binds_to`, `built_on`, `has_feature`); shown with spaces |
| `edges[].label` | no | a short note on the relation, without `"""` |
| `edges[].evidence` | no | http(s) URLs that state the relation |

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
| `tags` | the category and the type index, TiddlyWiki tag syntax |
| `text` | TiddlyWiki markup with sections Docs, Tutorials, Links from here, Links to here |

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
