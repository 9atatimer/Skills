# Think corpus -- Think-specific rules

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Giving the assistant a corpus

When the assistant must answer from documents somebody uploaded, the
knowledge-base skill owns the domain and the ports. Four rules are
Think-specific:

- **Retrieval is a tool over a port**, like every other tool. The worker
  calls a `search_corpus` tool on the app's tool route and receives
  ranked passages with citation handles. It never holds a database
  handle, an embedding key, or a vector store client.
- **The corpus filter is derived server-side from the verified actor**,
  never a tool argument the model supplies. A model that can name the
  corpus can name somebody else's, and the attribution rule above is the
  same rule: the client is not the source of identity.
- **Extraction never runs in the worker.** Both extractors are Python
  with model weights measured in hundreds of megabytes. The upload lands
  in R2, the worker enqueues, and a container job extracts and indexes.
- **Passage text is data, not instruction.** It reaches the transcript
  from a document the user did not write. Pass it in a data envelope
  with handles, keep it out of the system prompt, and render it with
  remote subresources off -- an image in an uploaded document is a
  zero-click exfiltration channel.
