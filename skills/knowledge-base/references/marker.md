# Marker cookbook

The hobby-and-research extractor, built on Surya. Reach for it when the
work is personal, research, or a startup under the weights threshold --
and especially when Surya is already installed, because the weights are
then already on the disk.

## The license gate, first

- **Code: Apache-2.0.** Free to use, including commercially.
- **Model weights: modified AI Pubs Open RAIL-M.** Free for research,
  personal use, and startups under $5M funding or revenue. Past that, a
  paid weights license from Datalab.

Surya carries the same split (Apache-2.0 code, same weights terms).

The threshold is about the **organization**, not the deployment, and it
moves without anyone touching the code -- a funding round can put a
project on the wrong side of it. That is the whole argument for Docling in
a commercial product, and the reason the adapter carries the license note
in its docstring where the next reader will see it.

## Install

```bash
uv add marker-pdf                  # or: pip install marker-pdf
```

Torch-based; a GPU helps enormously, and Surya runs roughly a few pages per
second on modern hardware. Weights download on first use -- pre-fetch in
the image build.

## Convert

```python
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict
from marker.output import text_from_rendered

converter = PdfConverter(artifact_dict=create_model_dict())
rendered = converter("report.pdf")
text, _, images = text_from_rendered(rendered)
```

`create_model_dict()` loads the models once. **Hold the converter for the
process lifetime** -- constructing one per document reloads weights and is
the single biggest performance mistake with this library.

Inputs: PDF, images, PPTX, DOCX, XLSX, HTML, EPUB.

## Output formats

| Format | Shape | Use |
|---|---|---|
| `markdown` | One markdown string plus extracted images | Reading, diffing, quick starts |
| `json` | Block tree: `id`, `block_type`, `polygon`, `children`, `section_hierarchy` | The adapter's real input -- this is where provenance lives |
| `html` | Rendered HTML | Faithful display |
| `chunks` | Flattened top-level blocks per page, each with its own HTML | RAG. Skips tree traversal |

For the extraction port, take `json` or `chunks` and map `polygon` (four
corner points) plus the page to `Provenance`. Do not parse the markdown
back into structure -- the structure is right there.

## Configuration

Through `ConfigParser`, which is also what the CLI uses:

```python
from marker.config.parser import ConfigParser
from marker.converters.pdf import PdfConverter
from marker.models import create_model_dict

config_parser = ConfigParser({"output_format": "chunks", "force_ocr": False})

converter = PdfConverter(
    config=config_parser.generate_config_dict(),
    artifact_dict=create_model_dict(),
    processor_list=config_parser.get_processors(),
    renderer=config_parser.get_renderer(),
    llm_service=config_parser.get_llm_service(),
)
```

Options worth knowing:

| Option | Effect |
|---|---|
| `output_format` | `markdown`, `json`, `html`, `chunks` |
| `mode` | `balanced` or `fast` |
| `force_ocr` | Re-OCR everything. Needed for PDFs with a bad text layer |
| `disable_ocr` | Text layer only. Fastest path for born-digital documents |
| `page_range` | `"0,5-10,20"`. Essential for cheap fixtures and spot checks |
| `paginate_output` | Page separators in the output |
| `disable_image_extraction` | Skip figure extraction |
| `use_llm` | LLM-assisted cleanup of tables, forms, inline math |
| `block_correction_prompt` | Custom formatting instruction for the LLM pass |

## LLM-assisted mode

`use_llm` sends page images and candidate blocks to an LLM (Gemini by
default; Claude, OpenAI, Vertex, Azure, OpenRouter, and Ollama are
supported) to clean up tables spanning pages, forms, and inline math.

It is worth it on hard documents and wasteful on easy ones. Treat it as a
per-corpus setting, not a default, and note two consequences: results stop
being deterministic, so golden-text assertions break; and pages leave the
machine unless the service is Ollama, which makes it a policy decision for
sensitive material, not a tuning knob.

## CLI and server

```bash
marker_single report.pdf --output_format chunks     # one file
marker /path/to/folder --workers 4                  # batch
marker_server --port 8001                           # REST sidecar
marker_gui                                          # Streamlit playground
```

`marker_single` with `--page_range` is how to build small committed test
fixtures from a large source document. `marker_server` is the sidecar for
a non-Python app; Datalab also sells a hosted API, which is the same port
with someone else's GPU behind it.

## Failure modes

- **Converter rebuilt per document** -- reloads weights every time. Build
  once, reuse.
- **Bad text layer, OCR off** -- ligature soup and dropped columns. When
  output looks subtly wrong rather than empty, try `force_ocr`.
- **Markdown parsed back into structure** -- use `json` or `chunks`.
- **`use_llm` in a test** -- non-deterministic output in an assertion. Keep
  it out of the contract suite.
