# Launch readiness review (release skill reference)

> For an R3 release (the release skill's classes): a new component, stage,
> data store, external dependency, user population, or distribution
> platform. Adapted from Google's launch coordination checklist and
> production readiness review, cut to what a small fleet on managed
> platforms actually has to answer.

## How it runs

- **The answers are the runbook.** Write each answer into the component's
  `RUNBOOK.md` (skeleton below), not into a separate review document.
  The review is that runbook's diff in the release PR; a human reads it
  there. No meeting, no second copy to rot.
- **Answer only what applies, and say so.** "No data stored" is an
  answer. A blank is not.
- **A "no" is allowed; an unknown is not.** Shipping without an alert or
  a rehearsed restore can be the right call for a first launch to five
  users. Write the gap down with its issue, so the risk was taken on
  purpose rather than by omission.
- **Later releases diff, they do not redo.** Once the runbook exists, an
  R2 release updates the sections it touched; the review never runs
  again for that component unless the release is R3 for a new reason.

## The questions

### Shape and dependencies

- What runs where, per stage? (Draft the `docs/arch/` entry now; 7a
  finalizes it.)
- Every upstream it calls: what does the user see when that upstream is
  slow, down, or returns garbage? Timeouts and retries are numbers.
- Every credential it reads: named in the registry, read from the vault,
  scoped to this component and tier.

### Capacity and cost

- Expected load at launch and the platform limit it would hit first
  (requests, CPU time, subrequests, quota, rows, storage).
- What it costs per month at expected load, and the budget alert that
  fires when that doubles. Anything that spends per call (an LLM, a paid
  API) has a hard ceiling, not just an alert.

### Failure modes

- The likeliest ways it fails, how each is detected, and the
  mitigation. "Roll back" is a valid mitigation only for a failure a
  rollback undoes.
- Retries, cron re-runs and duplicate webhooks: is every write
  idempotent, or is the duplicate harmless?

### Data

- What it stores, where, and whether it can be recreated.
- Unrecreatable data: backup mechanism, retention, and a restore run on
  nonprod with its duration recorded. A backup never restored is a hope.
- User content and personal data: what is kept, for how long, and that
  none of it reaches a log line.
- Schema changes: expand-contract for anything a running version still
  names.

### Security

- Who can reach it (Access gate, auth, public), and what an
  unauthenticated caller can do. Anything public-facing gets a
  security-engineer pass before launch.

### Rollout and rollback

- The stages it goes through, and the signal and the bound for each
  (what is watched, for how long, what aborts).
- Rollback rehearsed on nonprod: the command, the time it took, and what
  it does not undo.
- Risky user-visible behavior behind a flag, with the flag's removal
  issue.

### Observability

- The real-behavior probe, per stage, on a schedule.
- The heartbeat for every unattended job.
- Each alert: the symptom it fires on, where it is delivered, and its
  runbook section.
- The SLO, if it has users other than its author.

### Docs and ownership

- User docs and release notes, dev setup, the AGENT.md facts (the
  release skill's docs table).
- Who receives the alerts. A component nobody receives alerts for is
  unowned; say so.

## RUNBOOK.md skeleton

```markdown
# <component> -- runbook

Living, factual: describes what runs now. Beside the as-built.

## Promise
SLO: <target> measured by <probe or platform metric>, over <window>.
(Or: none -- author is the only user.)

## Ship
| Stage | URL | How it deploys | Who may start it |
|---|---|---|---|

## Verify
Per stage: the probe command and what green looks like.

## Roll back
Command per stage. Last rehearsed <date>, took <duration>.
Does not undo: <data, secrets, infra>.

## Signals
Logs: <where>. Metrics: <where>. Heartbeats: <job -> where checked>.

### Alert: <name>
- Symptom:
- First check:
- Mitigation:
- Escalation / issue:

## Dependencies
| Upstream | When it is down, the user sees | Timeout / retry |
|---|---|---|

## Data
Stored: <what, where>. Backup: <how>. Restore last drilled: <date>.

## Credentials
Names only; the registry is the infra repo's.

## Known gaps
Each with its issue.
```
