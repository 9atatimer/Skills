# Think tools -- contract, factory, forwarding

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Tools: contract, factory, forwarding

- **Factory, not hand-written tools.** One function takes the domain
  contract plus edge configuration (`baseUrl`, the shared secret, the
  actor getter, the navigation effect, an injectable `fetch`) and returns
  AI SDK `tool()`s built with `jsonSchema(...)` from the domain's plain
  schemas. A different engine composes the same contract through its own
  factory.
- **Reachability is the binding; authority is the secret.** The deployed
  app sits behind Cloudflare Access, which gates the whole hostname, tool
  route included. A public fetch from the worker carries the secret and
  no Access credential, so every tool receives a login page. A service
  binding is a worker-to-worker call that never re-enters the edge, and
  it is the only shape that reaches the route on a deployed stage. The
  binding does not replace the secret: the secret still gates the route
  against anything else that reaches it.
- **Refuse the misconfiguration at construction.** No binding plus a
  loopback base URL is `wrangler dev` on a laptop (global fetch is
  right). No binding plus a REMOTE base URL is a mistake: throw, naming
  the missing binding, rather than let Access turn every tool into a
  `302`.
- **The secret is one half of a pair.** The worker presents it; the app
  verifies it from server-only config. Both deploy workflows read the
  same vault field, which is what keeps them in agreement. Fail closed:
  unconfigured `503`, mismatch `401`, before any store access.
- **Attribution crosses the seam, and the client is not its source.**
  The actor the tool route records must come from a verified identity:
  the Access assertion on the WebSocket upgrade (the `cf-access-jwt-`
  `assertion` header, validated against the team's certificates), or a
  server-minted session credential. A user id the client seeds into
  synced state is client-asserted, and since clients replace state
  wholesale, any authenticated caller could name another user. The
  worked example shipped that way as a recorded PoC compromise with a
  blocking issue; it is not the pattern. A headless run carries a per-run
  capability instead of the standing secret, in a private instance field
  for the length of one turn and never in synced state, and the route
  reads the actor from the run record.
- **The prompt tells the model what a tool does to the world**: a
  "create" that lands as a draft, an "update" that files a proposal and
  changes nothing live. The model repeats what the prompt says, so the
  prompt must say the true thing.
