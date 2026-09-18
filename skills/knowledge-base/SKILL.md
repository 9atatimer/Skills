---
name: knowledge-base
description: "Giving an LLM working knowledge of a pile of documents somebody else wrote: ingesting uploads, extracting PDFs and scans into structured text with provenance, chunking, embedding, retrieval, and grounded citation. Owns the Marker vs Docling extractor choice (decided by license, not benchmark) and the port set that makes every piece swappable. Load when a feature says 'upload your material and ask questions about it', when adding retrieval or a corpus to an agent, or when picking a document-extraction, embedding, or vector-store dependency. Skip when the whole document fits in the context window and always will, and for fine-tuning or live web search."
---

# Knowledge Base

> **Purpose:** the retrieval domain, modeled once, so that "let users upload
> their documents and ask questions" is an assembly job rather than a
> research project.
> **Scope:** the domain language and its invariants, the four ports, the
> license-driven choice between the two extraction stacks, the process
> boundary both of them force on a non-Python app, and the turnkey
> checklist.
> **Companion skills:** coding (stable core / volatile edges -- this skill
> is an application of it), testing, tech-radar (rows land with the code),
> design (the corpus model belongs in the design doc).

## The short version

Two things decide the whole build, and only one of them is interesting.

- **The extractor is chosen by license, not by benchmark.** Quality is a
  wash between Marker and Docling on ordinary documents. Marker for hobby,
  personal, and research work -- especially where Surya is already on the
  machine. Docling for anything commercial: MIT code, CDLA-Permissive
  models, Apache-2.0 VLM, no threshold to track.
- **Everything else is the same either way.** One `DocumentExtractionPort`,
  and the choice becomes a one-file swap that must never hold up a design
  review.

## The domain

Name these things and the rest of the design writes itself. The wrong
model here is what turns a knowledge base into a pile of scripts.

| Term | What it is | What it is not |
|---|---|---|
| **Corpus** | The aggregate root: the set of documents one asker may draw on. The tenancy and permission boundary | A folder, a bucket prefix, a table |
| **Source Document** | The uploaded bytes plus identity, revision, owner, and access rule. Immutable; a re-upload is a new revision | The extracted text |
| **Extraction** | The structured reading of one revision: text with heading structure, tables, and provenance. Derived, cacheable, and re-derivable | The source of truth. Keep the original bytes forever |
| **Passage** | The retrievable unit: text, its heading path, and its provenance | An arbitrary slice of characters |
| **Embedding** | A vector of one passage under one **named** model | Interchangeable with a vector from another model |
| **Retrieval** | Query plus filter, in, ranked passages out | A database query the caller composes freely |
| **Grounded Answer** | Answer plus citations that resolve to passages | A summary with a bibliography bolted on afterward |

Three invariants. Each one is a defect when violated, not a preference:

- **A passage without provenance cannot be indexed.** It must resolve to
  one document revision and a location in it (page, and bounding box where
  the extractor gives one). The product promise is "where did you get
  that"; an unanswerable citation is a broken promise, and provenance
  cannot be reconstructed after chunking.
- **An embedding names its model.** Vectors from two models in one index
  rank as noise and fail silently -- nothing errors, the answers just get
  worse. The model id and the extractor version together are the reindex
  key.
- **A retrieval names its corpus.** The tenancy filter is a **parameter of
  the port**, not something the caller remembers to pass. A caller who can
  forget it will, and that is a data breach rather than a bug.

## Decisions and mechanisms

The coding skill's split, applied here. Getting this wrong is what makes a
knowledge base impossible to move off its first vendor.

| Core (decisions -- the domain) | Edge (mechanisms -- adapters) |
|---|---|
| Chunk policy: what a passage is, how big, what context rides with it | The extractor (Marker, Docling, a hosted API) |
| Retrieval policy: k, hybrid weighting, filters, freshness | The OCR engine and the layout model |
| Citation rules: what must be cited, what "not in the corpus" means | The embedding model and its client |
| Reindex policy: which version changes force which rebuild | The vector store (pgvector, a vector database) |
| Ingestion lifecycle: the states a document moves through | The reranker, the LLM, the queue, the object store |

The grep test applies unchanged: `docling`, `marker`, `openai`, a model id,
or a bucket name inside domain code is a leak. The swap test is the one
that matters most here, because **you will swap the extractor** -- hobby
projects turn commercial, and that transition should cost one file.

## The ports

Four seams. Full signatures, adapter skeletons, and a composition root in
[references/ports.md](references/ports.md).

| Port | Contract | Why it is a seam |
|---|---|---|
| `DocumentExtractionPort` | bytes plus media type, in; structured text with per-block provenance, out | Marker, Docling, a hosted API, or a plain text reader. The whole point of this skill |
| `EmbeddingPort` | passages in, vectors plus the model id out | Model changes are routine and force a reindex; batching and rate limits are the adapter's problem |
| `PassageIndexPort` | upsert passages, search within a corpus | pgvector today, something else later; the corpus filter is in the signature |
| `RerankPort` (optional) | candidate passages plus query, in; reordered, out | Absent in the first cut. Introduce it when the eval says recall is fine and precision is not |

Chunking is **not** a port. It is a policy in the core, parameterized by a
token counter the adapter supplies -- which is why Docling's `HybridChunker`
is used as a *tool* by the policy rather than treated as the policy itself.

## Choosing the extractor

Both are excellent and actively maintained. The decision is a licensing
decision that happens to be about software.

| | **Marker** (datalab-to) | **Docling** (Linux Foundation AAIF, donated by IBM) |
|---|---|---|
| Code license | Apache-2.0 | MIT |
| Model weights | Modified AI Pubs Open RAIL-M: free for research, personal use, and startups under $5M funding or revenue; a paid weights license past that | Layout and TableFormer under CDLA-Permissive-2.0; granite-docling VLM under Apache-2.0 |
| Stewardship | A company (Datalab), which also sells the hosted API | A foundation, with IBM Research behind the models |
| Inputs | PDF, images, PPTX, DOCX, XLSX, HTML, EPUB | Those, plus audio and video via ASR, email, LaTeX, and more |
| Outputs | Markdown, JSON, HTML, `chunks` | `DoclingDocument` -> Markdown, HTML, JSON, DocTags |
| Chunking | `chunks` output format: top-level blocks, HTML per block | `HybridChunker`: tokenizer-aware, heading-contextualized, table-header repeating |
| Service mode | `marker_server`, or Datalab's hosted API | `docling-serve` container image |
| LLM assist | `--use_llm` against Gemini, Claude, OpenAI, Ollama, and others | VLM pipeline with granite-docling, or a remote VLM |

**The rule:**

- **Money in the door, now or plausibly ever -> Docling.** The $5M
  threshold is a term somebody has to track for the life of the product,
  through funding rounds and acquisitions. MIT plus CDLA-Permissive is a
  term nobody ever thinks about again. That asymmetry, not accuracy,
  decides it.
- **Hobby, personal, research, or a spike, with Surya already pulled
  down -> Marker.** The weights are already on the disk and the terms
  explicitly cover this use. Paying a second multi-gigabyte download for a
  license you do not need is the wrong trade.
- **Cannot answer "is this commercial" -> Docling.** Pick the option that
  never needs a lawyer.
- **Do not open with a benchmark.** Both beat a naive text-layer extraction
  by a wide margin, and neither is reliably ahead of the other on ordinary
  pages. Benchmark only when the corpus is dominated by one hard class --
  dense tables, handwriting, heavy math -- and then measure on ten of
  **your** pages before writing either adapter.

Two things follow. The choice is **reversible in one file**, so it never
blocks design approval; and it is **a radar row that lands with the code**,
per the tech-radar skill -- propose the row when the adapter is written,
not before.

## Both are Python, and that is an architecture problem

Neither runs in a JS runtime. For a TypeScript, Nuxt, or Workers stack the
extractor is out of process, and pretending otherwise is the most common
way this feature goes wrong.

| Shape | When | Notes |
|---|---|---|
| In-process library | The app is Python | Simplest. Still behind the port |
| **HTTP sidecar** | The default for a non-Python app | `docling-serve` (container image) or `marker_server`. The adapter is an HTTP client; the contract is the port, not the vendor's JSON |
| Batch job or queue consumer | Bulk import, large files, GPU scheduling | A container job per document or per batch. Extraction is naturally a job, not a request |

Rules that hold in all three:

- **Never in the request path.** Upload returns as soon as the bytes are
  durable. Extraction is asynchronous, and the wait is a first-class,
  user-visible state.
- **Never inside a Cloudflare Worker.** No Python ML runtime, and the model
  weights alone exceed what belongs in a worker. The worker takes the
  upload to object storage and enqueues; something with a real container
  does the work.
- **Model weights are part of the deploy artifact.** Bake them into the
  image. Downloading hundreds of megabytes on a cold start turns a slow
  path into a broken one.
- **The lifecycle is domain, not plumbing.** `received -> extracted ->
  chunked -> indexed`, plus `failed(reason)` and `superseded(revision)`.
  Users see these states and ask about them, so they are modeled, named,
  and tested.

## The turnkey checklist

What a complete knowledge-base slice lands, by SDLC phase. Nothing here is
optional; the ones teams skip are deletion and eval, and both hurt later.

| Phase | What lands |
|---|---|
| Design | The corpus model and its tenancy rule; the citation promise; the hobby-or-commercial answer with the extractor it implies; retention and deletion; what happens when the answer is not in the corpus |
| Architecture | The four ports named in `docs/arch/`; the process boundary for extraction; the reindex key (extractor version plus embedding model); radar rows proposed |
| Behaviors | The contract suite both extraction adapters must pass; the labeled question set that defines retrieval quality; fixtures for born-digital text, a scan, and a table-heavy page |
| Code | Domain, then the chosen extraction adapter, then embedding, index, and the query use case. The other extractor is written only when needed, and costs one file |
| Gates | Recall and MRR floors in CI; contract suite green against every adapter; ingest-time secret and PII scanning |
| Release | Weights baked into the image; queue and dead-letter path; backfill and reindex runbook |
| Retrospective | Reindex cost measured against the estimate; eval floors revisited against real questions |

## Testing

The testing skill's rules, with the traps specific to this domain:

- **One contract suite, every adapter.** The same fixture documents through
  Marker and Docling, asserting on invariants rather than exact text: every
  block carries provenance, heading order survives, a known table yields
  the right cell count, page numbers are right. This suite is what makes
  the swap safe, and it is written before either adapter.
- **Unit tests never run OCR.** A fake extractor returns a canned
  extraction. Real-extractor tests are integration tests, marked, and run
  on demand -- a unit test that loads model weights is broken by
  definition.
- **Fake the embedder deterministically.** A hash-based fake gives stable
  rankings. Never assert on vector values; assert on ranking behavior.
- **Retrieval quality is a test, not a vibe.** Twenty to fifty questions,
  each labeled with the passage that answers it. Report recall@k and MRR.
  Put the floor in CI, where the gates skill's law applies: clear the bar
  before you move it, and a floor only moves up.
- **Fixtures stay small.** Three short documents, committed. Never a
  40MB PDF in git.

## Security

An uploaded corpus is attacker-controlled text in any multi-user product,
and it is read back by a model with tools.

- **Retrieved text is data, never instruction.** Pass passages in a data
  envelope, and never let passage text enter a tool-calling loop as though
  the user had typed it.
- **A surface that renders retrieved text disallows remote subresources.**
  A markdown image in an uploaded document is a zero-click exfiltration
  channel with attacker-chosen query data; sanitizing scripts does not
  close it. Render retrieved content with remote content off unless a CSP
  restricts `img-src` to trusted origins.
- **Tenancy in the signature**, as above, and enforced again at the storage
  layer (row-level security, or a namespace per corpus). Two independent
  enforcement points, because this is the failure nobody recovers from.
- **Scan on ingest.** A document dump is exactly where credentials and
  personal data arrive.
- **Deletion means deletion.** Removing a document removes its extractions,
  passages, vectors, and caches. Model it, and test it.

## Anti-patterns

| Symptom | Why it hurts | Instead |
|---|---|---|
| "Just put the whole document in the context" for a growing corpus | Works for three documents; fails silently and expensively at three hundred | Model the corpus now; the cutover later is a rewrite |
| Chunking by character count | Cuts tables in half and orphans headers | Structure-aware chunking with heading context (Docling's `HybridChunker`, or Marker's block `chunks`) |
| Vector-only retrieval | Proper nouns and rare names are exactly what embeddings blur -- and a campaign corpus, a codebase, or a contract set is mostly proper nouns | Hybrid: full-text plus vector, fused |
| One index, no corpus filter in the port | The caller eventually forgets | Filter in the signature, plus row-level security |
| No reindex key | Every model or extractor bump means guessing what is stale | Version by (extractor id and version, embedding model id) |
| Extraction treated as the source of truth | Re-extraction with a better model becomes impossible | Keep original bytes; extractions are derived |
| "RAG" used as a noun | Hides four separate seams behind one word, and the design stops at the acronym | Name the ports |

## References

| File | Holds |
|---|---|
| [references/ports.md](references/ports.md) | Port definitions and adapter skeletons, Python and TypeScript, plus the composition root |
| [references/docling.md](references/docling.md) | Docling cookbook: install, converter options, VLM pipeline, `HybridChunker`, `docling-serve` sidecar |
| [references/marker.md](references/marker.md) | Marker cookbook: install, converter API, config, `chunks` output, LLM mode, server mode |
| [references/retrieval.md](references/retrieval.md) | Chunk policy, embedding choice, pgvector schema and hybrid search, reranking, and the eval harness |
