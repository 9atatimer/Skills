# Choosing the extractor -- comparison table

Detail moved out of this skill's `SKILL.md`. The section here is named there with a summary; read it when `SKILL.md` points to it.

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
