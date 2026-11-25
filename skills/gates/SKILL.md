---
name: gates
description: "Phase 6 of the SDLC: everything that stands between a pushed commit and a mergeable one -- pre-commit scanners, CI, ci.magic assertions, agentic and human review, the mandate to self-review your own diff (the self-review skill says how), and the review-watch loop. Carries two standing laws: clear the gate before you move it, and zero unreviewed code. Load when a gate goes red, when driving a PR through review, when reviewing your own work, or when changing any gate's configuration, including writing a ci.magic rule. Skip for the push/PR mechanics themselves (github-workflow) and for deploy pipelines (release)."
---

# SKILL: Gates (Phase 6)

> **Purpose:** get a change from pushed to mergeable without lowering the
> bar to do it.
> **Exit gate:** every check green, every piece of feedback in a recorded
> state, and the gates authorize the merge (`references/gate-detail.md`,
> "Exit gate on an enrolled repo").

A gate is anything that can say no. They run in a ladder, cheapest and
earliest first, and each one exists because the later ones are more
expensive:

| Rung | Gate | Where it runs | On failure |
|---|---|---|---|
| 1 | Pre-commit hooks -- lint, build, test, gitleaks, trivy, semgrep | your machine | Git Hook Discipline, below |
| 2 | CI status checks | the PR | read the job log, fix, push |
| 3 | ci.magic assertions | the PR | the assertion names the file and the violation |
| 4 | Agentic review (OCR by default; Copilot or Codex only when the human summons one; never on a Markdown-only PR) | the PR | the review-watch loop, below; Spend Review Turns on Load-Bearing Fixes says when a turn is owed |
| 5 | Review settled and merge authorization by the gates: the repo's required check `gate` plus the `review-settled` status, both green on the head | the PR | address or defer; never merge around it. On a repo without `tedium.toml`, a human reviews and merges |

**A red gate is a diagnosis prompt, not an obstacle.** The laws below
govern every rung, and neither has an agent-accessible exception.

**Diagnose a failed `/land` before you comment `/land` again.** A red
`/land` build after a green PR head has three usual causes: the base
moved, the merge with the base broke something, or stage 1 failed (the
merged code built with the base's workflows grafted in).

- Read tedium's failure comment. When the merge changes
  `.github/workflows/`, it names the stage that failed.
- Run `/try` on the same head; its failure comment names the stage. If
  it is green after a red `/land`, the base moved between the two: merge
  the default branch into the PR branch and run `/try` again.
- A stage-1 failure on a PR that changes a workflow and a test that reads
  it is by design. The github-workflow skill, "Landing via tedium", says
  how to fix the PR.
- For any other cause, read the job log and fix the cause.
- After a second identical failure on the same head, stop: report the
  diagnosis to the human, or fix the cause, and do not queue a third.

## ci.magic (rung 3)

Repos with `ci.magic` files carry natural-language assertions judged by a
CLI coding agent. The verdict is confidence-gated; an `evaluation error`
or `inconclusive` row is not a finding against your code, so do not "fix"
a diff to satisfy one; and a green "skipped" is not a pass. Read
`references/gate-detail.md`, "ci.magic verdicts", when a ci.magic row goes
red or reads green after a credential or workflow change. Lowering the
threshold is governed by the first law below.

- **Writing or reviewing a rule** -> `references/ci-magic-rules.md`:
  match on context, never on presence.
- **Putting ci.magic on a repository** (the action reference, the
  credential, a repo seeded from a template) ->
  `references/ci-magic-adoption.md`.

## Clear the Gate Before You Move It (CRITICAL)

**You must meet or exceed the existing quality gate before you can change
the gate. Always.**

The bar is the one as it stands before the change; a commit does not get
to supply the standard it is measured by. It covers every gate a repo has
and the configuration files that set any of them.

Raising a bar may take effect immediately; lowering one takes effect only
after it has cleared the old bar and merged.

No one proposes a lower gate and then clears the lower gate they just
proposed. In practice that forbids, in the same change that is failing:
editing the threshold that is failing you, disabling the check that is
failing you, and `--no-verify` (see Git Hook Discipline -- a per-check
sentry for a genuinely impossible check is not lowering a bar; skipping the
suite is).

Do not build proposal-versus-canon reconciliation into a tool; every gate
in the fleet would need its own copy. Read `references/gate-detail.md`,
"The environment enforces the bar", before you write or change a gate
that reads its own configuration.

**A repo owner may force past this. Nobody else may, and an agent never
may.** If you believe a gate is wrong, say so and let the owner rule. Being
blocked by a gate is not authorization to move it.

## Zero Unreviewed Code (CRITICAL)

- **NEVER land code no one has reviewed. The target is 0% unreviewed
  code.** Every pushed commit must be looked at by a reviewer --
  agentic (OCR, Copilot, Codex) or human -- before the PR merges. Two
  recorded exceptions, both in Spend Review Turns on Load-Bearing Fixes
  below: a documentation-only PR, which the self-review pass alone
  reviews, and a hygiene-only tail after the last agentic review, which
  the handoff names for the human.
- **`review-settled` is this law as a commit status** (green iff every
  required reviewer's newest review is on the head and every thread is
  resolved). Never merge a PR whose tail commits nobody has seen. Never
  report a FAIL-OPEN green (a reviewer out of quota) as reviewed, and never
  re-request a reviewer that answered with a quota notice. A cap-fired
  green is not a self-land license: no turn cap fired and no open
  `pr-todo` issue against the PR is a `tedium land` precondition. Read
  `references/gate-detail.md`, "review-settled as a status" and "Fail-open
  and cap-fired", before you read, report or act on a `review-settled`
  status.
- **Feedback is never dropped. Acting on it is optional; recording it
  is not.** Every piece of reviewer feedback ends in exactly one of
  four recorded states: fixed (accept reply + SHA), rebutted (reject
  reply with a concrete reason), deferred (a `pr-todo` issue, per
  `references/review-loop.md`, "Feedback becomes pr-todo issues"), or acknowledged (a brief
  no-action reply naming why: informational only, already handled, or
  duplicate of a linked thread). Echoes of your own posts arriving
  back through the event stream are not feedback and need no state.
  Silently ignoring feedback is the one forbidden outcome.

## Self-Review (the adversarial pass on your own diff)

**Run the self-review pass before every PR a human or gate reviewer is
asked to read**, not when you feel like a second opinion. How to run it is
the self-review skill; why it is mandatory every time is in
`references/gate-detail.md`, "Why self-review is every time".

- Self-review NEVER satisfies Zero Unreviewed Code, except on a
  documentation-only PR, where it is the whole review (next section); the
  agentic and human review rungs run unchanged everywhere else. Read
  `references/gate-detail.md`, "Self-review is not an independent
  reviewer", for why.

## Spend Review Turns on Load-Bearing Fixes (CRITICAL)

Every review turn costs quota and wall-clock time. Ask for the next one
only when the push since the last one changed what the change does.

- **Load-bearing** fixes change runtime behavior, a contract or
  interface, a security property, a test's verdict, or what a rule an
  agent or gate executes says (a skill, a persona, `AGENT.md`, a prompt,
  CI or gate configuration). Rewording that leaves the rule meaning the
  same is hygiene; if you cannot say who is harmed and what they observe,
  the fix is not load-bearing (`references/gate-detail.md`, "The
  load-bearing test").
- **Hygiene** is everything else (wording, typos, comments, naming,
  formatting, the accuracy of human-read documentation). Fix it, push it,
  reply on its thread with the SHA, resolve it -- and do not request
  another review for it.
- **Batch before you ask:** triage the whole review, push every agreed fix
  in one round; when none is load-bearing, the round ends with no
  re-request.
- **A hygiene-only tail is a recorded exception to Zero Unreviewed
  Code.** Name its SHAs in the epilogue or handoff comment so the human
  who lands the PR knows the tail is theirs to read; never spend a turn
  just to turn a status green. Read `references/gate-detail.md`, "Batching
  and the hygiene-only tail", before you push after a review.

### Documentation-only changes get no agentic reviewer

A PR is **documentation-only** when every changed file is human-read
prose (a README, a `docs/` runbook or as-built, `TODO_PLAN.md`, task
files, a changelog, a comment-only edit to source). Such a PR summons no
reviewer; the adversarial self-review is the whole review and there is no
review-watch loop. Where the repo requires `review-settled`, it stays red:
a human lands it.

- **Exceptions and edges** (a design or architecture draft in phases 2
  and 3, prose that agents follow, a PR that mixes documentation with
  anything else, a pin bump): read `references/gate-detail.md`,
  "Documentation-only edges", before you decide a PR is, or is not,
  documentation-only. A PR that mixes documentation with anything else is
  not documentation-only; CI workflows and gate configuration are code.

## Git Hook Discipline (scalpel, not axe)

The pre-commit/pre-push hooks (`@nine-at-a-time-media/hooks`) are the
contract; a failing hook is a diagnosis prompt, not an obstacle. In order:

- **Diagnose and fix the real issue:** the hook is doing its job.
- **If one specific check cannot run in the current environment**, skip
   that check alone with its machine-local, never-committed sentry file
   (`NO.LINT`, `NO.TEST`, `NO.E2E`, `NO.BUILD`, `NO.GITLEAKS`, `NO.TRIVY`,
   `NO.SEMGREP`, `NO.TFCHECK`), one per genuinely-impossible check and
   each for a concrete reason you can state, and run the checks the hook
   can still perform. Read `references/gate-detail.md`, "Sentry files",
   before you create one.
- **Never blanket-skip the suite.** `HUSKY=0`, `HUSKY_SKIP`, and
   `git commit --no-verify` silence every check at once, including the
   ones that would have run fine. Do not reach for them because one check
   is broken -- that is the axe where the sentry is the scalpel. (CI
   setting `HUSKY=0` on `npm ci` is different: that disables hook
   *installation* in a pipeline that runs the same checks as explicit
   steps.)

When a sentry was needed, say so in the session (which checks, why, what
you ran by hand instead).

**A fresh worktree runs no hooks at all, and a suppression is unverified
until the scanner runs.** Read `references/gate-detail.md`, "Hooks in a
fresh worktree" before the first commit in a new worktree, and "A
suppression is unverified" before you write a `nosemgrep:` comment.

## Branch Protection and Required Checks

Every enrolled repo's default branch requires `gate` on the PR head; a
new CI job goes into `gate`'s `needs`, and a required check made absent by
a `paths:` filter hangs the bot. PRs cannot merge until all required checks
pass. The required set itself is declared in the infra repo's GitHub
module, not in the repo: adding, removing or renaming a required check
is a change there (the github-workflow skill, "Repository policy lives
in the infra repo"). Read `references/gate-detail.md`, "Required checks", when a check
fails, when you add a CI job, or when a pushed fix shows no checks: a PR
with a merge conflict runs no `pull_request` workflows.

## Reviewer Selection (agentic reviewers)

Which bot reviews a PR is policy, not agent judgment. Per-reviewer
mechanics -- how each is summoned, how its queue reads, where it files
findings outside threads, when it is stalled -- are
`references/reviewer-mechanics.md`; this section is who may summon whom.

- **OCR on Demand (Open Code Review) is the default agentic reviewer,
  and the only one an agent may summon or re-summon.** Every PR's AI
  review cycles run on it unless the human directs otherwise -- except
  a documentation-only PR, which gets none (Spend Review Turns on
  Load-Bearing Fixes). Summon it with a PR comment whose body is `/ocr`,
  from an owner's or collaborator's identity (the human's token
  qualifies; the OCR design's Q3 ruling). It runs only where the repo
  carries `.github/workflows/ocr-review-caller.yml`; on a repo without it,
  summon nothing and say in the handoff that the agentic rung is unserved.
  It never selects Markdown (do not summon it on an all-`.md` PR). An agent
  summons by the `/ocr` comment alone; a dispatch that overrides the
  backend or model (`cf-ai-gateway` and `anthropic` are billed per run)
  is the human's to fire. Read `references/gate-detail.md`,
  "Summoning OCR", before you summon it.
- **Copilot and Codex are human-summoned ONLY -- and "human-summoned"
  means the human fires the trigger themselves** (a Copilot review
  request; a PR comment containing `@codex review`). An agent NEVER
  fires either: not to select one, not to relay or fix a typo'd human
  request, and not to nudge a re-review after pushing fixes. If the
  human's trigger misfires (wrong handle, no bot reaction), say so and
  let the human re-post. Once such a review exists, triage it with exactly
  the same machinery and seriousness as OCR's. Why this is a human budget
  decision: `references/gate-detail.md`, "Why Copilot and Codex are
  human-summoned".
- **The owner's own request in the session fires the trigger:** when the
  owner asks you directly, in any words, to use Copilot or Codex, act on
  it. Only the owner's own message counts (`references/gate-detail.md`,
  "Owner's request fires the trigger").
- **Greptile is by-human-invite only.** Never request, trigger, or
  re-request a greptile review under any circumstances; if the human
  invites it onto a PR, triage its feedback like any other reviewer's.
- **Zero open threads is not zero findings.** Give each body-only finding a
  recorded disposition (`references/gate-detail.md`, "Body-only
  findings"). **A bot finding is a bug report, not a verdict:** verify it
  against the code before acting.
- **Turn budgets: be thrifty.** The cap is 3 turns per reviewer by
  default, 5 only when the human explicitly calls a "turbo PR" on that PR,
  never inferred. Do not probe quota yourself.

Whoever reviews, the review-watch loop, the per-reviewer turn cap,
pr-todo deferral and Zero Unreviewed Code apply unchanged.

## Review-watch loop

A PR review is **iterative, not one-shot**. Start the loop by default
after opening any PR, except a documentation-only PR (no agentic reviewer,
no loop). It runs against the active reviewer (OCR by default), on events,
never on a timer you set yourself; polling runs only on a schedule the
human started. With no events tool, the event source is a background
webhook watch (`references/review-loop.md`, Transport). It stops when the PR merges or closes, when the active
reviewer is done and quiet, when the per-reviewer turn cap fires (the
remaining feedback becomes `pr-todo` issues), on a pass whose actions were
all rejections or all hygiene, or when a comment needs the human's design
call.

Read `references/review-loop.md` when you enter the loop: the transport
tiers, the steps on each wake or event, every termination condition, the
`pr-todo` deferral procedure, and what to tell the user.

## Automated Review Response

Triage every comment before changing anything; reject with a concrete
reason; write the RED test first where a finding is about behavior; push
every agreed fix in one round; accept each fixed comment with its SHA.
Before you post the first reply, read
`references/review-loop.md`, "Automated Review Response", for the steps,
the reply conventions and the tool fallbacks.

## Related

- the self-review skill -- the adversarial pass on your own diff
- the github-workflow skill -- branch, push and PR mechanics; remote
  topology; `pr-todo` issue anatomy
- the testing skill -- what the test rung asserts
- the release skill -- the deploy gates after this phase
- the retrospective skill -- where a gate that missed something becomes a
  doctrine change
