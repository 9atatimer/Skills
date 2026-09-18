# Docling cookbook

The commercial-safe extractor. MIT code, CDLA-Permissive-2.0 layout and
TableFormer weights, Apache-2.0 granite-docling VLM. Stewarded by the
Linux Foundation's Agentic AI Foundation after IBM's donation.

Everything below is the adapter's inside. None of it appears in domain
code.

## Install

```bash
uv add docling                    # or: pip install docling
```

Python 3.10+. macOS, Linux, and Windows, x86_64 and arm64. First run
downloads model weights -- in a container, pre-fetch them at build time so
a cold start is not a download.

```bash
docling-tools models download     # bake into the image layer
```

## Convert

```python
from docling.document_converter import DocumentConverter

result = DocumentConverter().convert("report.pdf")
doc = result.document                  # a DoclingDocument
markdown = doc.export_to_markdown()
```

`convert()` takes a path, a URL, or a stream. `DoclingDocument` is the
point of the library: one representation across every input format, with
layout, tables, and reading order preserved. Exports include Markdown,
HTML, JSON, and DocTags.

Inputs cover PDF, images, DOCX, PPTX, XLSX, HTML, EPUB, LaTeX, email, and
audio and video via ASR.

## Provenance

The invariant the skill demands comes straight off the item:

```python
for item, _level in doc.iterate_items():
    for prov in getattr(item, "prov", []):
        page = prov.page_no                 # 1-based
        bbox = prov.bbox                    # l, t, r, b in page coordinates
```

Note the bounding box's coordinate origin (`CoordOrigin.BOTTOMLEFT` for
PDF pages) before drawing highlights over a rendered page. Normalize it in
the adapter; the domain gets one convention.

## Pipeline options

The knobs worth knowing, set through `PdfFormatOption`:

| Option | Effect |
|---|---|
| `do_ocr` | OCR scanned pages. Off saves a lot of time on born-digital PDFs |
| `do_table_structure` | TableFormer table reconstruction |
| `table_structure_options.mode` | `FAST` or `ACCURATE` |
| `generate_page_images` | Page rasters, for a citation-highlight UI |
| `ocr_options` | Engine selection (EasyOCR, Tesseract, RapidOCR, macOS OCR) and language list |

```python
from docling.datamodel.base_models import InputFormat
from docling.datamodel.pipeline_options import PdfPipelineOptions
from docling.document_converter import DocumentConverter, PdfFormatOption

opts = PdfPipelineOptions()
opts.do_ocr = True
opts.do_table_structure = True

converter = DocumentConverter(
    format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)}
)
```

The exact import paths move between minor versions. Pin the version in the
adapter's dependency, and check the installed package rather than trusting
a snippet -- including this one.

## VLM pipeline (granite-docling)

For hard pages -- heavy math, unusual layouts, charts to read as data --
swap the classical pipeline for the VLM one. granite-docling-258M is small
enough to run locally and is Apache-2.0, so it carries no license caveat.
It is slower per page than the layout pipeline; use it selectively rather
than as the default, and record which pipeline produced an extraction
(part of the reindex key).

## Chunking

`HybridChunker` is tokenizer-aware, respects document structure, and can
repeat a table's header across a split table. This is the tool the core's
`ChunkPolicy` delegates to.

```python
from docling.chunking import HybridChunker
from docling_core.transforms.chunker.tokenizer.huggingface import HuggingFaceTokenizer
from transformers import AutoTokenizer

EMBED_MODEL_ID = "sentence-transformers/all-MiniLM-L6-v2"

tokenizer = HuggingFaceTokenizer(
    tokenizer=AutoTokenizer.from_pretrained(EMBED_MODEL_ID),
    max_tokens=512,
)
chunker = HybridChunker(
    tokenizer=tokenizer,
    merge_peers=True,
    repeat_table_header=True,
)

for chunk in chunker.chunk(dl_doc=doc):
    text_to_embed = chunker.contextualize(chunk=chunk)   # prepends headings
    meta = chunk.meta                                    # doc items, headings, prov
```

Two rules follow from this API:

- **Embed `contextualize(chunk)`, not `chunk.text`.** The contextualized
  form carries the heading path, which is most of what makes a passage
  answerable on its own.
- **The tokenizer must be the embedding model's tokenizer.** Chunking to
  512 tokens of a different tokenizer means silent truncation at embed
  time.

## Sidecar: docling-serve

The default shape when the app is not Python.

```bash
podman run -p 5001:5001 quay.io/docling-project/docling-serve
# or: pip install "docling-serve[ui]" && docling-serve run
```

Images come in base, CPU-only, and CUDA variants; CUDA images are tagged
by version, never `latest`. The interactive API docs on a running instance
(`/docs`) are the authority for the version deployed.

```bash
curl -X POST http://localhost:5001/v1/convert/source \
  -H 'Content-Type: application/json' \
  -d '{"sources": [{"kind": "http", "url": "https://arxiv.org/pdf/2501.17887"}]}'
```

There is also a multipart file endpoint, and recent versions carry an
async task API (submit, poll, fetch result) -- the right one for anything
that outlives an HTTP timeout. Check `/docs` on the instance you deployed.

Operational notes for the sidecar:

- Size for the largest document, not the median. A 400-page scan with OCR
  is minutes of CPU.
- Give it a request size limit and a page-count limit, and surface the
  rejection as a domain `failed(reason)` state.
- It holds model weights in memory; run one per node rather than many
  small replicas.
