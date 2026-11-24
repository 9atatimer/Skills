// embed.mjs <template> <layer-graph.json> <notes.json> <out.html>: fill the two JSON blocks.
import { readFileSync, writeFileSync } from "node:fs";
const [tpl, graph, notes, out] = process.argv.slice(2);
const j = f => JSON.stringify(JSON.parse(readFileSync(f, "utf8"))).replace(/</g, "\\u003c");
let html = readFileSync(tpl, "utf8");
html = html.replace(/(<script type="application\/json" id="layer-graph">\n)[\s\S]*?(\n<\/script>)/, (_, a, b) => a + j(graph) + b);
html = html.replace(/(<script type="application\/json" id="page-notes">\n)[\s\S]*?(\n<\/script>)/, (_, a, b) => a + j(notes) + b);
writeFileSync(out, html);
writeFileSync(out + ".js", html.match(/<script>\n([\s\S]*?)<\/script>/)[1]);
