# Launch readiness (release skill reference)

> For R3: a new component, stage, data store, external service dependency, user
> population, or platform. Cut down from Google's launch checklist to
> what a small fleet on managed platforms must answer.

## How it runs

- The answers go into the component's runbook (the release skill, The
  runbook; skeleton below). The review is that diff in the release PR.
  No separate document.
- "None" is an answer; a blank is not. A known gap is fine if it has an
  issue -- the risk is then taken on purpose -- but a gap never waives
  what the release class owes or the exit gate (the rollback rehearsal,
  a findable request), and **Access** and **Credentials** are answered
  before prod, never deferred.
- Runs for every R3 release. On a component that already has a runbook,
  answer only what the R3 trigger changes and edit the runbook.

## Questions

- **Upstreams:** for each, what the user sees when it is slow, down, or
  wrong. Timeouts and retries are numbers.
- **Limits and spend:** the platform limit it hits first (CPU time,
  subrequests, quota, rows). Anything that spends per call (an LLM, a
  paid API) has a hard ceiling.
- **Failure modes:** the likeliest ones, and whether rollback undoes
  each. Duplicate deliveries (retries, cron re-runs, webhooks) are
  harmless or writes are idempotent.
- **Data:** what is stored, whether it can be recreated; if not, the
  backup and one restore run on nonprod (or the stand-in). User content
  never reaches telemetry.
- **Access:** who can reach it, and what an unauthenticated caller can
  do. Public-facing gets a security-engineer pass.
- **Credentials:** each in the registry, read from the vault, scoped to
  this component and tier.
- **Rollout:** the stages, and the rollback rehearsed on nonprod (or
  the stand-in).
- **Debug:** OTel resource attributes set; one request or run findable
  in wherever its telemetry lands today (the release skill, Debuggability).

## Runbook skeleton

```markdown
# <component> -- runbook

## Ship

| Stage | URL | Deployed by | Who may start it |
|---|---|---|---|

## Verify

<smoke command per stage>; green looks like <...>.

## Roll back

<command per stage>. Does not undo: <data, secrets, infra>.

## Debug

Telemetry: <where it lands> as <service.name>. Find a request: <query>.

## Gotchas

- <symptom> -> <cause> -> <action>

## Known gaps

- <gap> (<repo> issue#N)
```
