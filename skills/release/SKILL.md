---
name: release
description: "Phase 7 of the SDLC: shipping -- deploy, publish, or tag -- so the next change ships faster. Release classes (R0-R3) that scale the bar with blast radius; the per-component runbook (ship, verify, roll back, debug, gotchas); docs as gotchas written for LLM readers; nonprod/prod stages; per-platform distribution smoke; debuggability on OpenTelemetry (traces, logs, events, metrics), landing today in platform-native logs and LMDE metrics; turning release failures into hook and CI checks; rollout, flags and rollback; supply chain; launch readiness for new components. Load when shipping anything, writing or fixing a deploy or publish workflow, adding a stage or telemetry, wiring a deploy credential, or diagnosing a red CD run. Skip for PR/CI flow with no deploy boundary (github-workflow, gates) and terraform itself (iac)."
---

# Release (Phase 7)

> Purpose: ship features to the customer faster. Process and docs here
> exist only to make the next release quicker or safer; a step that does
> neither is a defect in this skill -- say so.

A release is done when it is **proven** (ran on the stage that matters,
unattended paths included), **reversible** (the rollback is known), and
**debuggable** (when it breaks, its telemetry says why).

## What counts as a release

Deploy, publish, or tag: the moment the change becomes shared. Phase 7a
fires with it (`docs/arch/` updated) -> the architecture skill. A change
that ships nowhere elides 7 and 7a (sdlc, Elision).

## Size the release

Put the class in the PR body (`Release: R2 -- adds export`). The class is
the highest trigger present. Most releases are R1; if R1 feels slow, the
pipeline is missing automation -- fix the pipeline, not the bar.

| Class | Triggered by | Owes |
|---|---|---|
| R0 | ships nowhere | nothing |
| R1 | a change inside an operated component, no new surface | a pipeline ships it; proven on nonprod (or the named stand-in) before prod; docs the diff made false are fixed in the same PR |
| R2 | new endpoint, command, flag, config key, secret, scheduled job, package or library dependency, or data migration | R1 + its telemetry; the runbook delta; expand-contract for anything a running version still names; a flag if risky or half-built |
| R3 | new component, stage, data store, external service dependency, user population, or platform | R2 + `references/readiness.md`; rollback rehearsed on nonprod (or the named stand-in) |

- Calling a release a lower class than its triggers lowers a gate (the
  gates skill). Higher is always allowed.
- A component with no runbook gets one with its next R1-R3 release: what is known now, unknowns under Known gaps with an issue.

## The runbook

One per operated component (runs on a stage, or is published for others
to install). Default home `docs/runbook.<component>.md`, never
`docs/arch/` (which holds only what is deployed, written at 7a); the
repo's `AGENT.md` may name another, and an existing deploy doc that covers
these sections IS the runbook. Living: it ships in the change's PR, and a
release edits only the sections it changed. Skeleton:
`references/readiness.md`.

- **Ship** -- per stage: URL, deploying workflow, who may start it.
- **Verify** -- the post-deploy smoke and what green looks like.
- **Roll back** -- the command; what it does not undo (data, secrets,
  infra).
- **Debug** -- where its telemetry lands and how to find one request
  or one run there.
- **Gotchas** -- the traps an agent will otherwise hit.
- **Known gaps** -- each with its issue.

## Docs

Docs are read far more often by LLMs than by humans. Write for that
reader; keep it legible to a human.

- **Record pitfalls, not descriptions.** An agent reads the code in
  seconds. What it cannot recover is the trap: the non-obvious failure,
  the order that matters, the thing that looks right and is not.
- **Terse, imperative, specific.** Symptom -> cause -> action. No
  narrative, no restating the code, no history unless it prevents a
  repeat.
- **Narrowest layer** (sdlc, law 15): code comment, runbook Gotchas,
  `docs/arch/`, the repo's `AGENT.md`, a repo-owned skill (only for a
  repeated, agent-run procedure specific to that repo), a shared skill.
- **Mechanics go in a tested script**; the doc names the script.
- **Ship docs in the change's PR.** A doc left saying the old thing is a
  defect. The as-built moves at 7a.
- **No release notes.** If a repo ever needs them, GitHub's generated
  notes are enough.

## Stages

- `nonprod` and `prod` for anything with users other than its author or
  data that cannot be recreated. Never "staging". Same shape; they differ
  in scale, data, and the literals the tier directory pins (the iac
  skill). The GitHub Environments that gate them are `nonprod` and
  `production` (the infra-credentials skill); `prod` is the stage's
  short name, not an environment name.
- One stage only: the runbook names the stand-in (consumer CI, a
  prerelease dist-tag, a PR preview) or says none, and why.
- Agents deploy to nonprod unattended. Prod is a human's call, named in
  the conversation, unless `AGENT.md` records an automatic path.
- Build once, promote the artifact. A prod build from `main` ships
  something nonprod never ran.
- A new stage's resources are terraform -- in the infra repo by default
  (the iac skill says when a project may keep them) -- applied by a
  human before the deploy that needs them (sdlc, law 18).

## Distribution

- Name supported platforms in the README. Fleet default for agent
  tooling: linux-x64 (cloud sessions), darwin-arm64 (laptops).
- Each claimed platform smokes the **published artifact** in CI. A
  `py3-none-any` wheel packed into a shiv `.pyz` carried the build
  runner's compiled deps and could not start on macOS.
- No CI smoke on a platform = unsupported. Say so.
- Consumers move by pin. Never re-publish or move an installed version;
  roll forward or move the pin back. Where a merge reaches the fleet with
  no pin in between, `AGENT.md` says so.

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
  `deployment.environment.name` (`nonprod` / `prod`). Without them two
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

## Shift release failures left

Every rollback, hotfix, red deploy, or silent job asks: where could this
first have been caught? Put a check there. A check beats a sentence.

| Stage | Can see | Examples |
|---|---|---|
| git hooks | the local tree | lint, build, tests, secret scan, config schema, deploy-posture check |
| CI `gate` | every platform, a clean checkout | full suite, workflow lint, per-platform smoke |
| deploy preflight | the target stage | secrets resolved non-empty, stage named, migration applied first |
| post-deploy | the running thing | the real-behavior smoke |

What runs in which hook, and never moving a check later, is the gates
skill's. Declare deploy posture in the repo and assert it in CI -> the
cloudflare-hosting skill, Deploy workflows.

## Rollout and rollback

| Stage | Population | Proves |
|---|---|---|
| Preview / PR | you | it starts and serves |
| Nonprod | team, synthetic | integration and config |
| Canary | a small real slice | real traffic and data |
| Full | everyone | -- |

- A canary states its signal and its duration before it starts.
- Know the rollback before the deploy. Prefer no-rebuild mechanisms
  (previous artifact, platform version rollback). A rollback that needs
  green CI is not one.
- Risky or half-built behavior ships dark behind a flag; rollback is a
  flip. Every flag has a removal issue.
- Data does not roll back. Removals ship expand-contract; a destructive
  prod migration takes a backup first.
- Never push to the default branch to exercise CD: branch, dispatch,
  prove, merge. Know what a merge triggers before merging.
- Never dispatch a production workflow to test it.
- Prefer scoped, short-lived downstream tokens: blast radius is scope
  times lifetime.
- Stage progression is a gate (the gates skill, first law): tightening
  is free; skipping or shortening a stage must clear today's bar.

## Supply chain

- Never install from a piped script. Signed package managers only.
- Pin actions by SHA, images by digest; commit the lockfile.
- Ship the artifact you verified; prove it where the format allows (npm
  tarball sha256).
- Publish credentials are deploy credentials -> the infra-credentials
  skill.
- A dependency that shipped without a radar row is a retrospective
  finding -> the tech-radar skill.

## Repo facts

This skill is shared policy. The repo's `AGENT.md` holds: stages and
URLs, deploying workflows, who may start prod, runbook home if not the
default, where its telemetry lands, supported platforms. Derive
GitHub identity at runtime (the github-workflow skill). Defaults the
repo may override: prod deploys run in CI, never from a laptop; nonprod
deploys go through the repo's scripts, not the bare tool. A deploy that
needs a resource that does not exist stops and raises it in the infra
repo -> the iac skill.

## Mechanics

- `references/deploy-mechanics.md` -- consuming a credential through the
  1Password service account, op:// discipline, diagnosing a red deploy,
  proving a workflow change with `workflow_dispatch`, the
  `/releases/latest/` prerelease trap, project-local tool state.
- `references/readiness.md` -- R3 questions and the runbook skeleton.

## Exit gate

- Shipped, to the final stage or deliberately stopped.
- Proven: deploy run URL and green smoke cited in the PR or release
  record; for a scheduled path, the unattended run's own output.
- What the class owes is merged; `docs/arch/` updated at 7a.

**An unattended path is live only once it has run.** A hand run proves
the code, not the deployment: the interactive shell carries direnv
exports, an authorized 1Password session, an unlocked keychain. GammaGo
issue 396: an archive verified by hand uploaded nothing from every
scheduled run for a day, because its bucket name lived only in `.envrc`.

**A release that needed a rollback or hotfix is a change failure.** The
retrospective files the check that would have caught it.

## Related

- architecture (7a), design (Operability), gates (hooks, the gate law),
  iac and cloudflare-hosting / gcp-ops / aws-ops (stages' resources),
  infra-credentials, lmde-dashboards (Grafana), retrospective, tech-radar
