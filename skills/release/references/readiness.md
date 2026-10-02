# Launch readiness (release skill reference)

> For R3: a new component, stage, data store, external dependency, user
> population, or platform. Cut down from Google's launch checklist to
> what a small fleet on managed platforms must answer.

## How it runs

- The answers go into the new `RUNBOOK.md` (skeleton below). The review
  is that diff in the release PR. No separate document.
- "None" is an answer; a blank is not. A known gap is fine if it has an
  issue -- the risk is then taken on purpose.
- Once the runbook exists, later releases edit it; this does not run
  again for that component.

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
  backup and one restore run on nonprod. User content never reaches a
  log.
- **Access:** who can reach it, and what an unauthenticated caller can
  do. Public-facing gets a security-engineer pass.
- **Credentials:** each in the registry, read from the vault, scoped to
  this component and tier.
- **Rollout:** the stages, and the rollback rehearsed on nonprod.
- **Debug:** OTel resource attributes set, telemetry visible in LMDE
  from nonprod, a request findable by trace id.

## RUNBOOK.md skeleton

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
Telemetry: <service.name> in LMDE. Find a request: <query>.
Platform logs (when LMDE was offline): <where>.

## Gotchas
- <symptom> -> <cause> -> <action>

## Known gaps
- <gap> (<repo> issue#N)
```
