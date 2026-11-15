# Think worker -- wrangler.jsonc essentials

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## wrangler.jsonc essentials

`wrangler.jsonc` essentials, with the cloudflare-hosting skill owning the
rest:

```jsonc
{
  "main": "src/index.ts",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "observability": { "enabled": true },
  "durable_objects": { "bindings": [{ "name": "MyAgent", "class_name": "MyAgent" }] },
  "migrations": [{ "tag": "v1", "new_sqlite_classes": ["MyAgent"] }],
  "env": {
    "preview":    { "durable_objects": { /* REPEATED */ }, "vars": { /* REPEATED */ } },
    "production": { "durable_objects": { /* REPEATED */ }, "vars": { /* REPEATED */ } }
  }
}
```

`durable_objects`, `vars`, `kv_namespaces`, `services`, `r2_buckets` and
`triggers` do NOT inherit into named environments. Repeat them in every
stage or the stage ships without them, with no error anywhere.

## Worked example

quillmap's wiki agent: `cloudflare/wiki-agent/` (the subclass, the tool
factory, the SDK-free decision modules and their tests, the smoketest
script), `apps/quillmap/app/domain/agent/` and
`app/domain/ports/agentRuntime.ts` (the core), `app/utils/agentChat.ts`
(the client adapter), `server/api/agent/tools.post.ts` (the tool route),
and `docs/design/DESIGN.WIKI-AGENT.md` (the as-built layer map and
security perimeter). Its `NOTES.md` is the decision log; its
`docs/DEPLOY_WIKI_AGENT.md` is the operator manual.
