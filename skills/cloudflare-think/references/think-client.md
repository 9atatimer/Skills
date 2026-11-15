# Think client -- frames, dev proxy, session registry

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## The client

- The browser opens a WebSocket to `/agents/<agent-path>/<session-id>`
  (same-origin in production, by route; see the cloudflare-hosting skill), reads
  history from `.../get-messages`, and speaks `cf_agent_use_chat_request`
  / `cf_agent_use_chat_response` / `cf_agent_state` frames.
- React apps get `useAgent` (`agents/react`) and `useAgentChat`
  (`@cloudflare/think/react`), including client tools and the
  `isRecovering` flag. Any other framework writes the adapter behind
  `AgentRuntimePort`: translate frames into the domain vocabulary, replay
  stored `UIMessage` parts as events on history load, derive `navigate`
  from state sync, and make the handle's methods bound properties so
  consumers may destructure them.
- **Dev proxies cannot upgrade WebSockets** (Nitro's `devProxy` returns a
  non-101). In dev the browser talks to the worker origin directly (a
  public runtime config, default `http://localhost:8788`) and the worker
  serves CORS; in production the route makes it same-origin and the
  base is empty.
- **The session registry is the product's, the transcript is the
  engine's.** Recents (id, title, origin page, pinned) live behind the
  store port, client-side first, server-backed when a job can create a
  session no browser opened. Transcripts live in the object's SQLite:
  swapping engines loses them, and that is a recorded acceptance, not a
  surprise.
- Every row in the recents list is the only handle on an engine-held
  transcript: forgetting one is a two-step confirm, and a pin exempts a
  row from the cap.
