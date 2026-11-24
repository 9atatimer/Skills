# Debuggability (release skill reference)

Detail moved out of this skill's `SKILL.md`. The section here is named there with a summary; read it when `SKILL.md` points to it.

## Debuggability (OpenTelemetry)

Goal: diagnose a problem detected elsewhere -- by a user, a failed run, a
red smoke. No alerting; nothing here notifies anyone.

- **One model: OpenTelemetry.** Traces, logs, events (log records
  carrying `event.name`), and metrics where a count is cheaper than a
  search. Export OTLP over HTTP where a supported endpoint exists;
  otherwise the platform's native capture of the same signals is the
  sink. The exporter is configured at the edge; no vendor SDK in the
  core (the coding skill's core/edge axis).
- **Resource attributes on everything:** `service.name`,
  `service.version` (commit sha or published version),
  `deployment.environment.name` (`preview` / `prod`). Without them two
  stages or two versions are indistinguishable.
- **Propagate trace context** (`traceparent`) across every hop you own,
  and log inside the active span so log records carry the trace id.
- **Structured logs only:** key-value, one event per record.
- **No secret, token, or user content in any telemetry:** log fields,
  span and resource attributes, metric labels. Exclude or redact it
  where the record is made -- platform capture records before any
  exporter runs. Traces carry URLs and headers by default; exporter
  scrubbing is defense in depth, not the control.
- **Unattended jobs log each run's outcome** (what it wrote, or why it
  did nothing), so "did it run" is a query.
- **Sink, today:** the platform's own logs and traces for cloud
  components (Workers Logs, Cloud Logging); the LMDE collector
  (tds-utils `lmde/components/observability/`) for local tools, which
  stores metrics only -- LMDE has no log or trace backend yet. The target
  is LMDE for everything, cloud included through an Access-gated tunnel;
  until that is built, do not wire a cloud exporter to it. Where a
  repo's telemetry lands is a repo fact in `AGENT.md`.
- **Cloudflare Workers:** enable `observability` in wrangler config;
  Workers Logs then holds traces and logs. Workers can also export them
  (not metrics) to an OTLP destination -- the future route into LMDE.
  -> the cloudflare-hosting skill
