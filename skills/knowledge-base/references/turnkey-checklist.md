# The turnkey checklist

Detail moved out of this skill's `SKILL.md`. The section here is named there with a summary; read it when `SKILL.md` points to it.

What a complete knowledge-base slice lands, by SDLC phase. Nothing here is
optional; the ones teams skip are deletion and eval, and both hurt later.

| Phase | What lands |
|---|---|
| Design | The corpus model and its tenancy rule; the citation promise; the hobby-or-commercial answer with the extractor it implies; retention and deletion; what happens when the answer is not in the corpus |
| Architecture | The four ports named in the architecture record; the process boundary for extraction; the reindex key (extractor version plus embedding model); radar rows proposed |
| Behaviors | The contract suite both extraction adapters must pass; the labeled question set that defines retrieval quality; fixtures for born-digital text, a scan, and a table-heavy page |
| Code | Domain, then the chosen extraction adapter, then embedding, index, and the query use case. The other extractor is written only when needed, and costs one file |
| Gates | Recall and MRR floors in CI; contract suite green against every adapter; ingest-time secret and PII scanning |
| Release | Weights baked into the image; queue and dead-letter path; backfill and reindex runbook |
| Retrospective | Reindex cost measured against the estimate; eval floors revisited against real questions |
