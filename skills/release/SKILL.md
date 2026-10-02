---
name: release
description: "Phase 7 of the SDLC: shipping -- deploy, publish, or tag -- and leaving the change operable. Sizes each release by class (routine, new surface, launch) so the bar scales with blast radius; the runbook every operated component keeps (ship, verify, roll back, signals); docs owed to users, developers, operators and agents; nonprod and prod stages; distribution per claimed platform; the observability minimum (real-behavior probe, heartbeat, symptom alert, SLO); turning release failures into hooks and CI checks; staged rollout, flags and rollback; supply chain; the launch readiness review. Load when shipping anything, writing or fixing a deploy or publish workflow, adding a stage, probe, alert or runbook, wiring a deploy credential, or diagnosing a red CD run. Skip for ordinary PR/CI flow with no deploy boundary (github-workflow, gates) and for terraform itself (iac)."
---

# Release (Phase 7)

> Purpose: ship fast by making shipping boring. A release is done when
> the change runs where it was meant to, someone other than its author
> can operate it, and the system would tell us if it broke.

Every release owes these, in proportion to its class:

- **Proven** -- it ran on the stage that matters, and any unattended path
  it depends on has run it too.
- **Operable** -- the component's runbook says how to verify it, roll it
  back, and read its alerts.
- **Legible** -- every audience whose world changed has the doc that tells
  them.

The point of the classes below is speed: most releases owe very little,
and the expensive questions are asked once per component, not once per
change.

## What counts as a release

**Deploy, publish, or tag.** A Worker releases by deploying; a package
releases by publishing; a library releases by tagging. That is the moment
the change becomes part of the shared system, and the moment phase 7a
fires: `docs/arch/` is updated to describe what now runs, before the
retrospective. -> the architecture skill

A change that ships nowhere elides this phase and 7a together (sdlc,
Elision). That is a correct no-op, not a loophole.

## Size the release

Name the class in the PR body -- `Release: R2 -- adds the export command`
-- so the reviewer knows which bar to hold. The class is the highest
trigger present.

| Class | Triggered by | Owes |
|---|---|---|
| R0 Nowhere | no deploy, publish, or tag | nothing here; elide 7 and 7a |
| R1 Routine | a change inside an already-operated component, adding no surface | a pipeline ships it, not a hand; proven on nonprod (or the repo's named stand-in) before prod; docs the diff made false are fixed in the same PR; a release-notes line if a user can see it |
| R2 New surface | a user-visible feature, endpoint, CLI command or flag, config key, secret, scheduled job, dependency, data migration | R1, plus: the doc delta for each audience; the runbook delta; a probe or heartbeat that exercises the new surface; expand-contract for anything a running version still names; a flag if the behavior is risky or half-built |
| R3 Launch | a new component, stage, data store, external dependency, user population, or distribution platform | R2, plus the launch readiness review (`references/readiness.md`): the new runbook, rollback rehearsed on nonprod with its time recorded, alerts routed, an SLO if it has users |

- **Most releases are R1.** If R1 feels heavy, the pipeline is missing
  automation: fix the pipeline, not the bar.
- **Calling a release a lower class than its triggers is lowering a
  gate** (the gates skill). Calling it higher is always allowed.
- **A component with no runbook gets one with its next release,**
  whatever its class: the skeleton filled from what is already known,
  every unknown under Known gaps with its issue. Paid once; it does not
  wait for a launch.

## The runbook: answer once, diff each release

Readiness is assessed when a component starts being operated and then
kept current -- not re-litigated per launch. The thing that is kept
current is the runbook.

Every operated component -- anything that runs on a stage, or is
published for others to install -- has one `RUNBOOK.md`, beside its
as-built at `docs/arch/<topic>/RUNBOOK.md` unless the repo's `AGENT.md`
names another home. It obeys the as-built's law: factual, living, and it
describes only what runs now. An existing deploy or publish doc that
already covers these sections IS the runbook -- point `AGENT.md` at it
rather than writing a second one. Sections (skeleton in
`references/readiness.md`):

- **Promise** -- the SLO, if anyone but the author uses it.
- **Ship** -- per stage: URL, the workflow that deploys it, who may start
  it.
- **Verify** -- the probe per stage and what green looks like.
- **Roll back** -- the command, when it was last rehearsed and how long
  it took, and what it does not undo (data, secrets, infrastructure).
- **Signals** -- where logs, metrics and heartbeats are; one subsection
  per alert: symptom, first check, mitigation, escalation.
- **Dependencies** -- each upstream, and what the user sees when it is
  down.
- **Data** -- what is stored, how it is backed up, when restore was last
  drilled.
- **Credentials** -- names only; the infra repo's registry holds the rest.
- **Known gaps** -- each with its issue.

A release edits only the sections it changed. An alert that names no
runbook section is noise, and noise is how the real alert gets missed.

## Docs, by audience

| Audience | Artifact | Home | Owed when |
|---|---|---|---|
| Users | release notes; the help or usage text | the product's own surface (a site page, `--help`, the README's usage); a `CHANGELOG.md` or GitHub Release notes | user-visible behavior changed |
| Developers | the as-built; setup steps | `docs/arch/` (7a); the README | a component, seam, or setup step changed |
| Operators | the runbook | above | ship, verify, roll back, or signals changed |
| Agents | repo facts; a repo-owned skill | the repo's `AGENT.md`; a committed skill carved out of the provisioned mirror | an agent working here would otherwise get it wrong |

- **Docs ship in the change's PR.** A PR that changes behavior and leaves
  a doc describing the old behavior is incomplete. The as-built is the
  one exception: it moves when the release lands (7a).
- **Release notes are written for the user**, one line per user-visible
  change, in the user's vocabulary -- not the PR title. A repo whose
  every merge is a release to agents (a skills tree) may let its commit
  log be its notes; its `AGENT.md` says so.
- **Agent docs go to the narrowest layer** (sdlc, law 15). A repo-owned
  skill earns its place when a procedure is repeated, agent-run, and
  specific to that repo. A one-off fact goes in `AGENT.md`. Mechanics
  -- flags, exit codes, call sequences -- go in a script with tests, and
  the skill names the script.

## Stages

- **Two stages, `nonprod` and `prod`,** for anything with users other
  than its author or data that cannot be recreated. Never "staging" --
  staging is a verb. The two differ only in scale, data, and the
  literals the tier directory pins (the iac skill); a nonprod with a
  different config shape proves nothing about prod.
- **A component with one stage says so** in its runbook and names what
  stands in for nonprod: consumer CI, a prerelease dist-tag, a PR
  preview, or nothing (and why that is acceptable).
- **Nonprod is where agents work unattended**: verification, rehearsal,
  smoke. Prod is a human's call, named in the conversation, unless the
  repo's `AGENT.md` records an automatic path.
- **Build once, promote the artifact.** A prod deploy that rebuilds from
  `main` ships something nonprod never ran.
- **A new stage is an R3 release, and its resources come first**: the
  routes, gates, buckets and tokens are terraform in the infra repo,
  applied by a human, before the deploy that needs them (sdlc, law 18).
  -> the iac skill

## Distribution: per platform you claim

- **Name the supported platforms** in the README and the runbook. The
  fleet default for agent tooling is linux-x64 (cloud sessions) and
  darwin-arm64 (laptops).
- **Each claimed platform smokes the published artifact in CI** -- a
  runner per platform, running the artifact as built, not the source
  tree. "Arch-neutral" is a claim to test: a `py3-none-any` wheel packed
  into a shiv `.pyz` carried the build runner's compiled dependencies
  and could not start on macOS.
- **A platform with no CI smoke is unsupported.** Say so rather than let
  a consumer find out.
- **Consumers move by pin.** A bad publish should reach nobody until a
  pin moves. Where a merge rolls out to the whole fleet with no pin in
  between, the repo's `AGENT.md` says so, and review is the only gate.
- **Never re-publish or move a version someone may have installed.**
  Roll forward with a new version, or move the pin back.

## Observability: the minimum that tells us it broke

For every served component -- anything a user, another service, or a
schedule calls:

- **A probe of real behavior, per stage, after every deploy and on a
  schedule.** It exercises the credential and the upstream, not just
  the process: a health route that returns 200 while the feature is
  dead is not a probe (the cloudflare-hosting skill). A deploy-time
  smoke alone proves it worked once.
- **Errors and latency from the platform's native telemetry,** switched
  on in config. Structured logs with a request id. Never a secret or
  user content in a log line.
- **A heartbeat for every unattended job:** a record of last success
  that something other than the job checks. Silence is the alert. A
  scheduled job that quietly does nothing is an outage nobody reports
  (see the exit gate).
- **Alerts on user-visible symptoms only,** few, delivered where the
  human actually looks, each naming its runbook section. Causes -- CPU,
  one 500, a slow query -- belong on a dashboard, not in an alert.
- **An SLO for each component with users other than its author:** one
  success-rate or availability target, measured by the probe or the
  platform. It is a decision tool, not a report: a component missing its
  target gets a reliability fix as its next release; one meeting it
  ships features.
- **Cost is a signal.** Every account that bills has a budget alert; a
  bill that doubled is an incident until explained.

Where telemetry lands and where alerts are delivered is fleet and repo
fact, in the repo's `AGENT.md`. For the local Grafana stack -> the
lmde-dashboards skill; for GCP alert policies -> the gcp-ops skill.

## Shift release failures left

The fastest release process is one that bad changes never reach.

- **Every release failure asks where it could first have been caught,
  and puts a check there.** A rollback, a hotfix, a red deploy, a dead
  scheduled job: each is an input. Earliest first:

  | Stage | Fits | Examples |
  |---|---|---|
  | pre-commit | fast, local, deterministic | format, lint, secret scan, ASCII, config schema, deploy-posture check |
  | pre-push | slower local | unit tests, build |
  | CI `gate` | everything, every platform | full suite, workflow lint, cross-platform smoke |
  | deploy preflight | needs the target | secrets resolved non-empty, stage named, migration applied first |
  | post-deploy | needs the running thing | the real-behavior probe |

- **A check beats a sentence.** A lesson that can be a check becomes
  one; the doc then names the check instead of restating the rule.
- **Keep pre-commit fast.** A hook that makes committing slow gets
  bypassed; anything that takes more than a few seconds belongs at
  pre-push or in CI. Hook discipline is the gates skill's.
- **Declare deploy posture in the repo and assert it in CI** -- which
  workflow can reach which stage, and what gates it. -> the
  cloudflare-hosting skill, Deploy workflows

## Rollout and rollback

A release is a sequence of increasingly expensive bets. Do not skip
straight to the last one.

| Stage | Population | What it proves | Rollback cost |
|---|---|---|---|
| Preview / PR environment | you | it starts and serves | none |
| Nonprod | the team, synthetic traffic | integration and config are right | none |
| Canary | a small real slice | it survives real traffic and real data | small |
| Full | everyone | -- | large |

- **A canary needs a signal and a bound.** State what you will watch and
  for how long before starting. A canary nobody measures is a slow full
  deploy.
- **Know the rollback before the deploy.** It is in the runbook. Prefer
  a mechanism that needs no rebuild -- the previous artifact, a platform
  version rollback. If rolling back requires a green CI run, it is not a
  rollback.
- **Decouple deploy from release with a flag** when user-visible behavior
  is risky or half-built: ship it dark, turn it on per stage, and the
  rollback is a flag flip. Every flag carries its removal issue; a flag
  nobody removes is a second code path nobody tests.
- **Data does not roll back.** A migration that removes something a
  running version still names ships expand-contract. A destructive
  change on prod takes a backup first, and restoring it is the rollback.
- **Never push to the default branch to exercise CD.** Branch,
  dispatch on the branch, prove, then merge -- and before merging
  anything a deploy workflow triggers on, know that the merge deploys.
- **Prefer scoped, short-lived downstream tokens.** A leaked value's
  blast radius is its scope times its lifetime.
- **Never dispatch a production workflow to test it.** Nonprod and
  preview are what verification is for (`references/deploy-mechanics.md`,
  Verifying a workflow fix before merge).
- **Stage progression is a gate** (the gates skill, first law):
  tightening it is free; skipping the canary, widening the slice, or
  shortening the watch must clear the bar as it stands today.

## Supply chain

What you ship is only as trustworthy as what you built it from.

- **Never install from a piped script.** `curl ... | bash` executes
  unreviewed, unsigned, unpinned code with your credentials in scope. Use
  a package manager that verifies signatures. No deadline justifies it.
- **Pin what you build against.** Actions by SHA, base images by digest,
  the lockfile committed. A floating tag resolved at deploy time lets a
  compromised upstream reach production without a diff.
- **The artifact you verified is the artifact you ship.** Build once and
  promote; where the format allows, prove it (an npm tarball's sha256
  matches the published one).
- **Publish credentials are deploy credentials:** same vault chain, same
  scoping, same rotation. -> the infra-credentials skill
- **A dependency that reached production without a radar row is a
  finding** for the retrospective, not something to backfill quietly.
  -> the tech-radar skill

## Where repo facts come from

This skill is shared policy. Each repo's `AGENT.md` carries its facts --
under "Release", or beside "Infrastructure" and "Landing" where the repo
already keeps them:

- its stages, their URLs, and the workflow that deploys each;
- who may start a prod deploy, and any automatic path to prod;
- the runbook home, if not `docs/arch/<topic>/RUNBOOK.md`;
- where telemetry lands and where alerts are delivered;
- supported platforms, and the release-notes home;
- what stands in for nonprod where there is only one stage.

Derive GitHub identity at runtime, never from memory (the github-workflow
skill). Standing patterns, which the repo's own file may override:

- Production deploys run in CI, never from a laptop; a directory marked
  CI-only (e.g. `scripts/CD/`) is honored.
- Nonprod and preview deploys go through the repo's scripts, not the
  underlying tool invoked bare (wrangler, terraform, gcloud).

The resources a deploy lands on are not the deploy's to create; a deploy
that needs one that does not exist stops and raises it in the infra repo.
-> the iac skill

## Mechanics

`references/deploy-mechanics.md` holds the how-to, loaded when a task is
wiring or debugging one of these:

- consuming a credential from a workflow through the 1Password service
  account, and op:// reference discipline;
- diagnosing a red deploy from its log, rung by rung;
- proving a workflow change on its branch with `workflow_dispatch`
  before merge;
- GitHub's `/releases/latest/` skipping prereleases;
- project-local tool state, and rotating a credential item in place.

`references/readiness.md` holds the launch readiness questions and the
runbook skeleton.

## Exit gate

- Shipped: deployed, published, or tagged; the rollout reached its final
  stage or was deliberately stopped.
- Proven: the deploy run, the probe green after it, and -- for a
  scheduled path -- the unattended run's own output, cited in the PR or
  the release record. A job that names `environment:` leaves GitHub's
  deployment record; a publish leaves its tag.
- Operable and legible: what the class owes -- runbook delta, doc delta,
  probe, heartbeat, alert -- is merged.
- `docs/arch/` updated at 7a. Then the retrospective can diff the frozen
  design against a true as-built.

**A capability an unattended path depends on is live only once that path
has run it.** A hand run from an interactive shell proves the code, not
the deployment: the interactive shell carries things the unattended one
does not -- direnv exports, an authorized 1Password CLI session, an
unlocked keychain, a logged-in browser -- and a capability that reads any
of them works by hand and silently does nothing on the schedule. Observed
2026-09-27 (GammaGo issue 396): an archive verified by a hand-run backfill
uploaded nothing from every scheduled run for a day, because its bucket
name lived only in `.envrc`.

**A release that needed a rollback or a hotfix is a change failure.** Say
so in the retrospective; it is the input to "Shift release failures
left".

## Related

- the architecture skill -- phase 7a, which this phase triggers
- the design skill -- the Operability section this phase reads
- the gates skill -- hook discipline, and the law governing any change to
  a stage-progression rule or a release class
- the iac skill -- the stages' resources; cloudflare-hosting, gcp-ops and
  aws-ops for the platform specifics
- the infra-credentials skill -- where a deploy credential comes from
- the retrospective skill -- phase 8, where a change failure and an
  unradared dependency become findings
