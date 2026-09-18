# Ports and adapter skeletons

The seams named in the skill, written out. Python first (both extractors
are Python); the TypeScript half covers an app that calls extraction over
HTTP.

## Domain types

Provenance is on the type, not bolted on later. If a field here cannot be
filled, the extraction adapter is incomplete.

```python
from dataclasses import dataclass
from enum import Enum


class BlockKind(Enum):
    TEXT = "text"
    HEADING = "heading"
    TABLE = "table"
    CAPTION = "caption"
    FORMULA = "formula"


@dataclass(frozen=True, slots=True)
class Provenance:
    """Where a block came from. Paged media fill page and bbox; unpaged
    media (HTML, email, transcripts, audio) fill anchor instead -- a
    fragment id, a character offset, or a timestamp. At least one of the
    two must be present, which is the invariant an adapter has to satisfy
    before the block may be indexed."""

    document_id: str
    revision: str
    page: int | None = None      # 1-based, as a human counts pages
    bbox: tuple[float, float, float, float] | None = None  # x0, y0, x1, y1
    anchor: str | None = None    # "#sec-3", "char:10423", "t=00:12:33"


@dataclass(frozen=True, slots=True)
class Block:
    kind: BlockKind
    text: str              # markdown for prose, markdown table for tables
    heading_path: tuple[str, ...]
    provenance: Provenance


@dataclass(frozen=True, slots=True)
class Extraction:
    document_id: str
    revision: str
    extractor: str         # "docling" | "marker" | ...
    extractor_version: str # part of the reindex key
    blocks: tuple[Block, ...]


@dataclass(frozen=True, slots=True)
class IndexVersion:
    """The reindex key, in one value. Any field changing invalidates the
    passages and vectors written under it, which is what makes a partial
    reindex safe: the old and new sets never mix in a query."""

    extractor: str             # "docling" | "marker"
    extractor_version: str     # library version AND pipeline: "2.7/vlm"
    chunk_policy_version: str  # bumped whenever chunking changes
    embedding_model_id: str


@dataclass(frozen=True, slots=True)
class Passage:
    passage_id: str
    corpus_id: str
    text: str              # what gets embedded, already contextualized
    heading_path: tuple[str, ...]
    provenance: tuple[Provenance, ...]  # primary first; merged peers add
                                        # the locations they came from


@dataclass(frozen=True, slots=True)
class ScoredPassage:
    passage: Passage
    score: float
    retrieved_by: str      # "vector" | "text" | "fused" | "rerank"
```

## The ports

```python
from collections.abc import Sequence
from typing import Protocol


class DocumentExtractionPort(Protocol):
    def extract(
        self, *, document_id: str, revision: str, data: bytes, media_type: str
    ) -> Extraction: ...


class EmbeddingPort(Protocol):
    @property
    def model_id(self) -> str: ...

    @property
    def dimensions(self) -> int: ...

    def embed(self, texts: Sequence[str]) -> Sequence[Sequence[float]]: ...


class PassageIndexPort(Protocol):
    def upsert(
        self,
        *,
        corpus_id: str,
        passages: Sequence[Passage],
        vectors: Sequence[Sequence[float]],
        version: IndexVersion,
    ) -> None: ...

    def search(
        self,
        *,
        corpus_id: str,          # never optional, never defaulted
        query_text: str,
        query_vector: Sequence[float],
        version: IndexVersion,   # both legs of a hybrid query filter on it
        limit: int,
    ) -> Sequence[ScoredPassage]: ...

    def forget_document(self, *, corpus_id: str, document_id: str) -> None: ...


class RerankPort(Protocol):
    def rerank(
        self, *, query: str, candidates: Sequence[ScoredPassage], limit: int
    ) -> Sequence[ScoredPassage]: ...
```

`corpus_id` is a required keyword on every index method. That is the
tenancy invariant expressed where it cannot be skipped. `IndexVersion`
travels with both writes and reads for the same reason: a reindex in
flight writes a second set of passages beside the live one, and a query
that does not name its version silently blends them.

## Chunk policy lives in the core

Not a port -- a policy that takes a token counter as a parameter. The
counter comes from the edge (a tokenizer for the embedding model); the
decisions stay in the domain.

```python
from collections.abc import Callable, Iterable, Sequence

TokenCounter = Callable[[str], int]


@dataclass(frozen=True, slots=True)
class ChunkPolicy:
    version: str = "v1"                 # goes into IndexVersion
    max_tokens: int = 512
    merge_peers: bool = True
    include_heading_path: bool = True    # the contextualization decision

    def passages(
        self, extraction: Extraction, corpus_id: str, count: TokenCounter
    ) -> Iterable[Passage]:
        """Group blocks into passages under max_tokens, never splitting a
        table row, always prefixing the heading path when configured, and
        carrying every merged block's Provenance onto the passage.

        Body elided: this is the shape, not a drop-in implementation. The
        repo writes it against its own extraction, and the contract suite
        is what holds it to the invariants.
        """
        raise NotImplementedError
```

Bump `version` whenever any of those decisions change. A chunking change
with the version unchanged leaves old and new passages indistinguishable
in the index, which is the one reindex failure that cannot be detected
after the fact.

The policy may delegate the mechanics to Docling's `HybridChunker` (see
`docling.md`) when the extraction came from Docling, and do the same
grouping over Marker's `chunks` blocks when it did not. The parameters,
the version, and the invariants stay here either way, which is what keeps
a Marker corpus and a Docling corpus chunked the same.

## Adapter skeletons

Each adapter's whole job is to satisfy the port and keep the vendor inside
itself. Both of these are one file.

```python
# adapters/extraction/docling_adapter.py
from docling.document_converter import DocumentConverter

import docling


class DoclingExtractor:
    """DocumentExtractionPort via the Docling library, in process."""

    def __init__(self, converter: DocumentConverter | None = None) -> None:
        self._converter = converter or DocumentConverter()

    def extract(
        self, *, document_id: str, revision: str, data: bytes, media_type: str
    ) -> Extraction:
        doc = self._converter.convert(_as_stream(data, media_type)).document
        blocks = tuple(
            _to_block(item, document_id, revision)
            for item, _level in doc.iterate_items()
        )
        return Extraction(
            document_id=document_id,
            revision=revision,
            extractor="docling",
            extractor_version=docling.__version__,
            blocks=blocks,
        )
```

```python
# adapters/extraction/marker_adapter.py
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict


class MarkerExtractor:
    """DocumentExtractionPort via Marker, in process.

    Model weights are under a license that is free for research, personal
    use, and startups under $5M funding/revenue. Commercial use past that
    threshold needs a paid weights license -- use DoclingExtractor instead.
    """

    def __init__(self) -> None:
        # Built once and held for the process lifetime -- rebuilding it
        # per document reloads the model weights.
        self._converter = PdfConverter(
            artifact_dict=create_model_dict(),
            config={"output_format": "chunks"},
        )

    def extract(
        self, *, document_id: str, revision: str, data: bytes, media_type: str
    ) -> Extraction:
        rendered = self._converter(_as_temp_file(data, media_type))
        return Extraction(
            document_id=document_id,
            revision=revision,
            extractor="marker",
            extractor_version=marker.__version__,
            blocks=tuple(
                _block_from_chunk(chunk, document_id, revision)
                for chunk in rendered.blocks
            ),
        )
```

```python
# adapters/extraction/http_adapter.py
class HttpExtractor:
    """DocumentExtractionPort against a docling-serve or marker_server
    sidecar. The default shape for a non-Python app: same port, the
    process boundary is the adapter's business. Body elided -- it posts
    the bytes, polls the task, and maps the response to Extraction."""

    def __init__(self, base_url: str, client: HttpClient) -> None: ...
```

The two in-process skeletons show the shape and the mapping seam
(`_to_block`, `_block_from_chunk`); the mapping itself is the adapter's
real work and is where the contract suite points.

The fake that unit tests use is the fourth adapter, and it is the one most
of the suite runs against:

```python
class FakeExtractor:
    def __init__(self, canned: dict[str, Extraction]) -> None:
        self._canned = canned

    def extract(self, *, document_id: str, **_: object) -> Extraction:
        return self._canned[document_id]
```

## Composition root

The only place that knows which extractor exists. One setting changes
when a hobby project turns commercial -- and an unknown value fails
loudly rather than falling through to a default, because the default
would be a license decision made by a typo.

```python
EXTRACTORS: dict[str, Callable[[], DocumentExtractionPort]] = {
    "docling": DoclingExtractor,
    "marker": MarkerExtractor,
}


def build_ingestion(settings: Settings) -> IngestDocument:
    try:
        extractor = EXTRACTORS[settings.extractor]()
    except KeyError:
        raise ConfigurationError(
            f"unknown extractor {settings.extractor!r}; "
            f"expected one of {sorted(EXTRACTORS)}"
        ) from None
    return IngestDocument(
        extractor=extractor,
        embedder=OpenAICompatEmbedder(settings.embedding_model),
        index=PgVectorIndex(settings.database_url),
        policy=ChunkPolicy(max_tokens=settings.chunk_max_tokens),
    )
```

## The TypeScript half

For a Nuxt or Workers app the extraction adapter is an HTTP client and
nothing else. Types mirror the Python ones; zod validates the sidecar's
response at the boundary, per the tech radar.

```typescript
// app/domain/knowledge/ports.ts  -- no imports from anything concrete
export interface DocumentExtractionPort {
  extract(input: {
    documentId: string;
    revision: string;
    data: ArrayBuffer;
    mediaType: string;
  }): Promise<Extraction>;
}

export interface PassageIndexPort {
  search(input: {
    corpusId: string;
    queryText: string;
    queryVector: number[];
    modelId: string;
    limit: number;
  }): Promise<ScoredPassage[]>;
}
```

```typescript
// server/adapters/extraction/doclingServe.ts
const ConvertResponse = z.object({
  document: z.object({ md_content: z.string(), json_content: z.unknown() }),
});

export function doclingServeExtractor(baseUrl: string): DocumentExtractionPort {
  return {
    async extract({ documentId, revision, data, mediaType }) {
      const body = await postMultipart(`${baseUrl}/v1/convert/file`, data, mediaType);
      const parsed = ConvertResponse.parse(body);
      return toExtraction(parsed, documentId, revision);
    },
  };
}
```

The Worker never calls this in a request handler: it writes the upload to
object storage, enqueues, and a container consumer runs the adapter.
