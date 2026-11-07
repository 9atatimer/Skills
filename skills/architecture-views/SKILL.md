---
name: architecture-views
description: "Producing a repo's architecture view page, <system>-layers.html: the layer graph (bands from composition roots to domain, rendered from tds-utils bin/layer-graph JSON, click a node to trace its active paths), the runtime topology derived from deploy configuration with every gate drawn in the path it gates, the findings, and the Seam Abstractions view (to swap X, what you write and what else changes). Ships template.html, which renders any layer-graph/1 JSON. Load when asked for a layer graph, an architecture or dependency diagram, a runtime or request-path diagram, or a view of a repo's layers, domains or seams. Skip for writing the architecture record itself (architecture), the as-built prose (as-built), declaring layers in adherence.toml (adherence), and a chart of data (dataviz)."
---

# SKILL: architecture-views -- the layer graph and runtime topology page

> **Purpose:** one page per system that shows the whole import graph at
> once, lets the reader light up one component's active paths, shows the
> runtime request paths through every gate, and says what a swap costs.
> **Output:** `<system>-layers.html`, one self-contained file in the repo.
> **Start from:** `template.html` in this skill. It renders the layer graph,
> findings and seams from data; the runtime topology is data too.

---

## Gather procedurally, never from memory

- **The graph comes from the tool.** Run tds-utils `bin/layer-graph --root
  <repo>` and embed its JSON verbatim. Never hand-assemble nodes or edges
  from memory, from the design record, or from the architecture record's
  module map: those say what was intended, the page shows what is.
- **Schema `layer-graph/1`**, the only shape the template reads:
  - `repo`, `commit`, `declarations` (the adherence files read), `layers`
    (band order, outermost first);
  - `nodes` {id, layer, context, files, fileCount, runtimes}, ids like
    `domain/kernel` or `composition root/app:composition`;
  - `edges` {from, to, imports, direction: inward|lateral|outward};
  - `runtimes` {name: [node ids]};
  - `findings`: `outward` [{from, to, imports}], `cycles` [[node ids]],
    `unassigned` [file paths];
  - `stats` {files, imports, unresolved, viaBarrel, barrelFallback}, shown
    in the footer.
- **A new schema version is a template change**, made here in this skill,
  never a per-repo patch of the page.
- **The tool reads the repo's `adherence.toml`.** A repo without one gets
  one through the adherence skill first. If that is out of scope, the page
  says in its framing line that the graph is undeclared, and draws nothing
  pretending to be layers.
- **Build with the embedder.** `node <skill dir>/embed.mjs template.html
  <layer-graph.json> <notes.json> <out.html>` fills the two JSON blocks
  and writes `<out.html>.js` (the page script) for `node --check`. The
  notes file holds only the per-repo prose, seams and runtime figure.
- **Regenerate, do not patch.** The page is rebuilt from fresh JSON when
  the code moves. An edited node or edge in the embedded JSON is a
  fabricated record.
- **The meta line names the source:** repo, branch and the commit the JSON
  came from. A page with no commit cannot be checked against the code.

---

## Where the file goes

- Into the repo, beside the records (`docs/` or `docs/arch/`), named
  `<system>-layers.html`; open it with `open <file>`.
- Never a hosted artifact or a pasted image. It is reviewed in the PR like
  any other file.
- One file, no network: no CDN, no fonts, no fetch. The two JSON blocks
  are the only per-repo inputs besides the runtime and seam notes.

---

## The page: required content (preserve exactly)

- **Header:** title, a one-line framing of what the reader is looking at,
  and the meta line (repo, branch, commit, records read).
- **Layer graph:**
  - Horizontal bands, outermost (composition roots) at the top to
    innermost (domain) at the bottom; the band order is the tool's
    `layers` order when given, else root, adapters, application, ports,
    domain.
  - Every node a box colored by its layer, labeled with its file count.
    A band wider than six boxes wraps into balanced, staggered rows; no box
    overlaps another and every label fits its box.
  - A context name used in two layers (`table` in application and domain)
    is qualified with its layer wherever text names it.
  - Every edge a curve whose width scales with its import count; arrows
    point inward, down the page.
  - Same-layer (lateral) edges are arcs below their band.
  - Mutual and cyclic edges are amber; outward edges are red.
  - The whole graph is visible at once. No paging, no collapsed clusters,
    no "top N".
- **Click a node** to light its active paths: its edges and neighbors
  bright, everything else dimmed. Click again to clear. Enter and Space do
  the same from the keyboard.
- **Side panel** for the selected node: what it holds, its id and files,
  what it imports and what imports it, each with its import count.
- **Hover hints** on every box and every edge, in both figures: what it
  is, and what crosses it. The page draws them itself (the template's
  `data-tip` tooltip), shown at once beside the pointer; a native SVG
  `<title>` alone is not enough, because browsers show it late or not at
  all. Each element also keeps its `<title>` as first child for screen
  readers.
- A legend, a "Copy SVG" button per figure, and light and dark through
  CSS variables.
- **Desktop only** (owner, 2026-11-07). These pages are read on a desktop;
  size the figures for a wide window and never shrink a graph to fit a
  phone.

---

## Runtime topology: every gate in the path

- **Derive it from the deploy configuration**: Terraform, the wrangler
  config, the workflow files, the load balancer or gateway config. Never
  from memory or the design record. Cite the files in the caption or the
  hover titles.
- **List each request path before drawing:** client, entry hostname or
  route, every gate it crosses, the service that answers, the stores
  behind it. Confirm from config that each gate covers each path.
- **A gate or proxy is drawn in the path of the traffic it gates:**
  browser -> gate -> services. Access, an SSO edge, an auth middleware, a
  load balancer, an API gateway. A gate drawn off to the side, unconnected,
  is a defect: it hides the one fact the figure exists to show.
- **A gate transparent after the first hit** (Cloudflare Access, an SSO
  edge) is a tall, thin, dashed band spanning the full height of the
  request lanes, perpendicular to the left-to-right flow, no fill, muted
  ink, its label rotated along the band. Request paths pass through it.
  Never a solid, colored, square box. Its hover title says it stops only
  the first hit (sign-in), then stamps every request.
- **A gate that acts on every request** (an auth middleware, a gateway) is
  a box in the path with edges in and out.
- **A path that legitimately bypasses the gate** (a service binding, an
  internal queue, a cron trigger) is drawn, dashed, and labeled as a
  bypass with its reason.
- **A configured gate on no path, or a path into a service with no gate
  and no bypass label, is a finding to report, not a drawing choice.** The
  template checks this from the runtime data and prints it under the
  figure in red; fix the data from config, never silence the check.
- In the template's runtime notes: each node has `kind` (client, gate,
  service, store), gates have `transparent`, each edge into a service
  names its gate in `via` or carries `bypass`.

---

## Findings: say what holds, then what costs

- State what holds in plain words: no outward edges, no cycles, every file
  in a declared layer. The template writes these from `findings`.
- State each finding plainly: outward edges, cross-context cycles,
  unassigned files, each with the nodes named.
- For each finding worth a sentence, say what it would cost to change a
  subsystem: "replacing `rules` today also touches `timeline`". That
  sentence goes in the notes' `costs`; it is the reason the reader opened
  the page.

---

## Seam Abstractions: to swap X, what changes

A static seams table told the owner nothing. The section is titled **Seam
Abstractions** and answers "to swap X, what do I write and what else
changes?".

- **It opens with the explanation the template carries:** a seam is a
  place where behavior can change without editing the code that uses it
  (Feathers, Working Effectively with Legacy Code). Three kinds: a port
  (an interface adapters plug into), a policy (a rule value handed to a
  use case), a parameter (a tuned value supplied from outside). The
  composition root makes the choice. To swap a listed seam, write one new
  adapter, policy or value and change the root; anything not listed is
  hard-wired.
- **Rows come from the architecture record's Seams table**, one per seam,
  each with its kind: port, policy or parameter. Never invent a seam the
  record does not name; a seam the code has and the record lacks is drift
  (the architecture skill).
- **Each row names graph nodes:** the node holding the port or value, the
  adapter nodes that implement it, and the composition roots that wire
  them.
- **The row reads:** "To change <axis>: write a new adapter for <port>;
  wire it in <roots>; nothing else changes." A policy or parameter row says
  the same with a new value.
- **A seam no root supplies** (a policy the core picks for itself) names
  the node that picks it in `chosenIn`; its row says the swap edits the
  core, not the root. That is a finding about the seam, stated plainly.
- **The graph overrules the sentence.** A non-root node importing one of
  the seam's adapters or roots means something else changes; the template
  replaces "nothing else changes" with the importing nodes, in red. A root
  importing an adapter is wiring, not a bypass. Report it as a finding
  too.
- **Clicking a row lights exactly those nodes and edges** in the layer
  graph, and the side panel repeats the sentence.

---

## Building it

- Copy `template.html` to `<repo>/docs/<system>-layers.html`.
- Paste the tool's JSON into the `layer-graph` script block, verbatim.
- Fill the `page-notes` block: system, repo, branch, framing, records,
  one line per node on what it holds, costs, seams, runtime nodes and
  edges. Hover text is written from the config and code, not recalled.
- Keep the template's look and behavior; extend it, never fork its
  layout per repo. A generic improvement goes back into this skill's
  `template.html`.
- Verify before handing it over: the page opens with no console error,
  clicking a node dims the rest, every seam row lights its nodes, and the
  runtime figure shows no red gate finding you have not reported.

---

## Related

- the adherence skill -- the `adherence.toml` the tool reads
- the architecture skill -- the Seams table and module map the page checks
- the as-built skill -- the record the page sits beside
- the cloudflare-hosting skill -- Access, bindings and the wrangler config
  the runtime figure is derived from
