# Chunking, embedding, index, and eval

Everything downstream of extraction. Identical whichever extractor was
chosen -- which is the point of the port.

## Chunk policy

A passage is the smallest thing that still answers a question on its own.
That is a domain judgement, so it lives in the core, with these defaults:

| Decision | Default | Why |
|---|---|---|
| Size | 256-512 tokens of the embedding model's tokenizer | Below that, context is lost; above, the vector averages several topics into mush |
| Overlap | None, when chunking on structure | Overlap is a patch for structure-blind splitting. Both extractors give structure |
| Context | Prepend the heading path | "Loot" means nothing; "Chapter 3 > The Vault > Loot" means something. Docling's `contextualize()` does exactly this |
| Tables | Never split a row; repeat the header if a table must split | A half table with no header is worse than no chunk |
| Tiny blocks | Merge peers under the limit | A four-word caption is not a retrievable unit |

Store the passage text as embedded, including the heading prefix, so that
what was indexed and what is shown are the same string.

## Embedding

The model id is an edge parameter and part of the reindex key. Choose for
cost and dimension count first; every serious model is good enough for
prose.

- **Batch** -- one request per passage is a rate-limit incident waiting to
  happen.
- **Normalize** if the store's operator expects it (cosine distance
  usually does).
- **Record the model id with every vector.** Changing model means a
  rebuild, and a partially rebuilt index that silently mixes the two is
  the hardest bug in this domain to see.
- **Local is viable.** A small sentence-transformer on CPU costs nothing
  and never leaves the machine -- a real consideration for other people's
  documents.

## Index: pgvector

Postgres (Supabase included) is the right first store. It puts passages,
their full text, tenancy, and the vectors in one place, so hybrid search
is one query and row-level security applies to both halves.

```sql
create extension if not exists vector;

create table passages (
  id            uuid primary key default gen_random_uuid(),
  corpus_id     uuid not null references corpora(id) on delete cascade,
  document_id   uuid not null references documents(id) on delete cascade,
  revision      text not null,
  page          int,          -- paged media
  bbox          jsonb,        -- paged media
  anchor        text,         -- unpaged media: fragment, offset, timestamp
  constraint passages_locatable check (page is not null or anchor is not null),
  heading_path  text[] not null default '{}',
  content       text not null,
  -- 1536 is an EXAMPLE. The dimension must match the embedding model:
  -- text-embedding-3-small is 1536, all-MiniLM-L6-v2 is 384. Getting it
  -- wrong fails on the first insert.
  embedding     vector(1536) not null,
  model_id      text not null,
  extractor     text not null,
  extractor_ver text not null,
  chunk_pol_ver text not null,
  content_fts   tsvector generated always as (to_tsvector('english', content)) stored,
  created_at    timestamptz not null default now()
);

create index on passages using hnsw (embedding vector_cosine_ops);
create index on passages using gin (content_fts);
create index on passages (corpus_id, document_id);

-- The second enforcement point. The port's required corpus_id is the
-- first; neither is sufficient alone.
alter table passages enable row level security;

create policy passages_by_membership on passages
  for all
  using (
    exists (
      select 1 from corpus_members m
      where m.corpus_id = passages.corpus_id and m.user_id = auth.uid()
    )
  );
```

Notes that are not optional:

- `on delete cascade` from both corpus and document is how "deletion means
  deletion" stops being a promise and becomes a constraint.
- The `passages_locatable` check is the provenance invariant in the
  storage layer: a paged document fills `page` (and usually `bbox`), an
  unpaged one -- HTML, email, a transcript -- fills `anchor`, and a row
  with neither cannot be cited, so it cannot be stored.
- `model_id`, `extractor`, `extractor_ver`, and `chunk_pol_ver` are the
  reindex key -- the columns behind `IndexVersion` in `ports.md`. The
  extractor version carries the pipeline too (`"2.7/vlm"`), because a
  classical and a VLM run of the same library produce different text.
  Without all four, "what is stale" is guesswork, and a chunking change
  is the case that leaves no trace at all.
- The policy above assumes a `corpus_members` table and Supabase's
  `auth.uid()`; substitute the app's own membership rule, but do not ship
  the table without one -- an un-policied table with RLS enabled is at
  least closed, while an un-enabled one is open to every role that can
  reach it.
- The vector dimension is in the DDL, so a model with a different
  dimension is a migration. Under the expand-contract rule that means a
  new column or a new table, never an in-place type change.

## Hybrid search

Vector-only retrieval fails on exactly the queries a document corpus
attracts: names, places, identifiers, quoted phrases. Fuse a full-text
ranking with a vector ranking using reciprocal rank fusion, which needs no
score calibration between the two.

```sql
create or replace function search_passages(
  p_corpus_id    uuid,
  p_query        text,
  p_embedding    vector(1536),
  p_model_id     text,
  p_extractor    text,
  p_extractor_ver text,
  p_chunk_pol_ver text,
  p_limit        int default 20
) returns table (
  id uuid, content text, document_id uuid, revision text,
  page int, bbox jsonb, anchor text, heading_path text[], score float
)
language sql stable as $$
  with live as (
    select p.*
    from passages p
    where p.corpus_id     = p_corpus_id
      and p.model_id      = p_model_id
      and p.extractor     = p_extractor
      and p.extractor_ver = p_extractor_ver
      and p.chunk_pol_ver = p_chunk_pol_ver
  ),
  semantic as (
    select l.id, row_number() over (order by l.embedding <=> p_embedding) as rank
    from live l
    order by l.embedding <=> p_embedding
    limit p_limit * 4
  ),
  lexical as (
    select l.id,
           row_number() over (order by l.rk desc) as rank
    from (
      select l.id,
             ts_rank_cd(l.content_fts, websearch_to_tsquery('english', p_query)) as rk
      from live l
      where l.content_fts @@ websearch_to_tsquery('english', p_query)
      order by rk desc
      limit p_limit * 4
    ) l
  )
  select p.id, p.content, p.document_id, p.revision,
         p.page, p.bbox, p.anchor, p.heading_path,
         coalesce(1.0 / (60 + s.rank), 0.0) + coalesce(1.0 / (60 + x.rank), 0.0) as score
  from semantic s
  full outer join lexical x using (id)
  join live p on p.id = coalesce(s.id, x.id)
  order by score desc
  limit p_limit;
$$;
```

Three things in that query are not decoration. The `live` CTE applies the
whole `IndexVersion` once, so **both** legs see the same index generation
-- filtering only the semantic leg lets full-text search return
old-generation passages during a reindex. The lexical leg carries an
explicit `order by` inside its `limit`, since a `limit` without one takes
an arbitrary subset and the window rank then describes whatever survived.
And the projection returns revision, bbox, and heading path, because the
port hands back a `Passage` and a citation cannot be reconstructed from
content and a page number.

The constant 60 is the standard RRF damping term; it is a tuning
parameter, not a magic number, and the eval harness below is how it gets
tuned.

## Reranking

Retrieve wide (40-60 candidates), rerank to what the answer prompt gets
(5-10). A cross-encoder reranker is the cheapest large quality win once
recall is adequate -- and *only* then. Reranking a candidate set that does
not contain the answer improves nothing, so fix recall first, and let the
eval say which problem you have:

- Recall@50 low -> chunking or hybrid weighting, not reranking.
- Recall@50 high, recall@5 low -> reranking is exactly the fix.

## Grounded answering

- Pass passages as **data**, in a delimited block, each with a citation
  handle. Never splice passage text into the instruction part of a prompt.
- Require citation handles in the answer and resolve them; an answer that
  cites a handle not in the candidate set is a hallucination the system can
  catch by itself.
- Give the model an explicit "not in the corpus" answer, and test it with
  questions the corpus cannot answer. A knowledge base that cannot say "I
  do not know" is not grounded, it is decorated.

## Eval harness

Retrieval quality is a test. Without it, every tuning change is a guess.

- **The question set**: 20-50 questions over the fixture corpus, each
  labeled with the passage id that answers it. Written by whoever knows the
  corpus, stored as data next to the fixtures.
- **The metrics**: recall@k (is the answer in the candidate set) and MRR
  (how high). Recall diagnoses retrieval; MRR diagnoses ranking.
- **The gate**: floors in CI. Per the gates skill, a floor may rise
  immediately and may only fall after the change has cleared the floor as
  it stands.
- **The deterministic fake**: a hash-based embedder gives stable ranks for
  the unit suite. The real-model eval is an integration job, run on demand
  and before any chunking or fusion change merges.
- **Answer quality is a separate, later problem.** Measure retrieval
  first; an LLM-judged answer score on top of bad retrieval measures
  nothing.

## Reindex

Cheap to forget, expensive to discover. Reindex when any field of
`IndexVersion` changes: the extractor, its version or pipeline (classical
vs VLM), the chunk policy version, or the embedding model. Each one has a
column, so a reindex writes a second generation beside the live one and
queries keep naming the generation they want. Keep the original bytes so
it is always possible, and cut over when the eval says the new generation
is at least as good.
