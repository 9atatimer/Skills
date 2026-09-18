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
    document_id: str
    revision: str
    page: int              # 1-based, as a human counts pages
    bbox: tuple[float, float, float, float] | None  # x0, y0, x1, y1


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
class Passage:
    passage_id: str
    corpus_id: str
    text: str              # what gets embedded, already contextualized
    heading_path: tuple[str, ...]
    provenance: Provenance


@dataclass(frozen=True, slots=True)
class ScoredPassage:
    passage: Passage
    score: float
    retrieved_by: str      # "vector" | "text" | "fused" | "rerank"
```

## The ports

```python
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
        model_id: str,
    ) -> None: ...

    def search(
        self,
        *,
        corpus_id: str,          # never optional, never defaulted
        query_text: str,
        query_vector: Sequence[float],
        model_id: str,
        limit: int,
    ) -> Sequence[ScoredPassage]: ...

    def forget_document(self, *, corpus_id: str, document_id: str) -> None: ...


class RerankPort(Protocol):
    def rerank(
        self, *, query: str, candidates: Sequence[ScoredPassage], limit: int
    ) -> Sequence[ScoredPassage]: ...
```

`corpus_id` is a required keyword on every index method. That is the
tenancy invariant expressed where it cannot be skipped.

## Chunk policy lives in the core

Not a port -- a policy that takes a token counter as a parameter. The
counter comes from the edge (a tokenizer for the embedding model); the
decisions stay in the domain.

```python
from collections.abc import Callable, Iterable, Sequence

TokenCounter = Callable[[str], int]


@dataclass(frozen=True, slots=True)
class ChunkPolicy:
    max_tokens: int = 512
    merge_peers: bool = True
    include_heading_path: bool = True   # the contextualization decision

    def passages(
        self, extraction: Extraction, corpus_id: str, count: TokenCounter
    ) -> Iterable[Passage]:
        """Group blocks into passages under max_tokens, never splitting a
        table row, always prefixing the heading path when configured."""
```

An adapter may *implement* this by delegating to Docling's `HybridChunker`
(see `docling.md`) -- the policy still owns the parameters and the
invariants, so a Marker corpus and a Docling corpus chunk the same way.

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
        self._converter = PdfConverter(
            artifact_dict=create_model_dict(),
            config={"output_format": "chunks"},
        )
```

```python
# adapters/extraction/http_adapter.py
class HttpExtractor:
    """DocumentExtractionPort against a docling-serve or marker_server
    sidecar. The default shape for a non-Python app: same port, the
    process boundary is the adapter's business."""

    def __init__(self, base_url: str, client: HttpClient) -> None: ...
```

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

The only place that knows which extractor exists. One line changes when a
hobby project turns commercial.

```python
def build_ingestion(settings: Settings) -> IngestDocument:
    extractor: DocumentExtractionPort = (
        DoclingExtractor()
        if settings.extractor == "docling"
        else MarkerExtractor()
    )
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
