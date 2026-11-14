# Reviewer mechanics

Per-reviewer surface for the review-watch loop in `SKILL.md`: how each
agentic reviewer is summoned, how its queue reads, where it files
findings outside threads, and when it counts as stalled. Who may summon
whom is policy and stays in `SKILL.md` (Reviewer Selection); this file
is the vendor surface that section points at, and it stands until a
`gadmin` verb carries these signals as tested code.

## OCR on Demand (`ocr`)

The default reviewer, and the one an agent may summon. Runbook: tds-utils
`docs/ops/ocr-review.md`; design: `docs/design/OCR-ON-DEMAND.DESIGN.md`.

- **Summon.** A PR comment whose body starts with `/ocr`, from an OWNER,
  MEMBER or COLLABORATOR of the repo (the human's token and
  `9atatimer-bot`, a direct collaborator, both qualify; design Key
  Decisions Q3). The comment path uses the configured model and backend.
  The dispatch form,
  `gh workflow run ocr-review-caller.yml -R <owner>/<repo> -f pr=<N>`,
  may override either and is the human's (SKILL.md, Reviewer Selection).
  The repo must carry
  `.github/workflows/ocr-review-caller.yml` and be seeded; tds-utils
  `bin/seed-ocr-review status` says. A fork PR fails with cause `fork`
  and nothing reads the secret. The default backend is the laptop's
  Ollama Gateway; on `cf-ai-gateway` or `anthropic` every run is billed.
- **In flight.** `eyes` on the `/ocr` comment once the run is approved.
  Fetch: `gh api /repos/<OWNER>/<REPO>/issues/comments/<ID>/reactions`
  (or the MCP `pull_request_read` `get_comments`, which carries reaction
  counts). A dispatch gets no reaction: watch the run with
  `gh run list -R <owner>/<repo> -w ocr-review-caller.yml`.
- **Not picked up.** A comment the authorize job skips (body not starting
  with `/ocr`, or an author outside the three associations) gets no
  reaction, no comment and no record. No `eyes` within ~2 minutes of
  posting, and no run in `gh run list`: say so, check the body and the
  posting identity, and leave the retry to the human. Do not wait out the
  stall backstop on it.
- **Done.** A review by `github-actions[bot]` on the head whose body
  opens with `<!-- ocr-review-mark sha=<head> -->`: the run's summary,
  with the reviewed-file counts and every reviewable file ocr did not
  review. The `eyes` is replaced by `+1`. Findings are inline review
  comments by `github-actions[bot]`; triage them like any thread.
- **Done, but no mark.** `+1` on the comment and the summary posted as an
  issue comment saying it "settles no review": a finding failed to post.
  The run is over; triage what did post, then re-run `/ocr` once.
- **Body-only findings.** Upstream's sticky summary comment (updated in
  place each run) holds the findings that could not be anchored inline
  and any that failed to post; the mark review links it. Read it on
  every wake.
- **Failed.** `-1` on the comment and a summary issue comment naming the
  cause (that comment settles no review). `cold-model`: re-run `/ocr`
  once. `gateway-down`: the laptop side is down; report, do not retry.
  `reviewed-nothing` (ocr never selects Markdown): the agentic rung is
  unserved; say so in the handoff and summon no other bot.
  `configuration`, `credential`, `runner-tool-missing`, `budget`,
  `limited`: report; the fix is the human's. `timeout`: the review job hit
  its limit; read the plan (below) before anything else, then report.
- **The plan: which runner, how long.** The authorize job decides the
  review job's runner and limit from the PR's size (tds-utils
  `lib/ocr-review/tier.mjs`, Issue#776) and logs one line in its
  Authorize step: `plan: <tier> tier, <N> minutes`, with the reason in
  parentheses when the plan could not be honoured. A PR changing more than
  25 files or more than 800 lines (callers move these with
  `long_review_files`, `long_review_lines`) is `long`: it runs on the
  owner's `CI_RUNS_ON_LONG`, the long niner (`cf-pool-long`, a 2-hour
  ceiling), for 115 minutes. Every other PR is `standard`: `CI_RUNS_ON`,
  9 minutes. A caller's own `review_runs_on` always wins, with its own
  timeout. Read the plan line first whenever a run times out, stalls or
  queues.
- **Stall.** The limit is the plan's N: 9 minutes on the standard tier,
  115 on the long one. `eyes` still on the comment and no summary 6
  minutes past N: report the sha, the time and the plan line, stop, and
  leave the re-run to the human.
- **A large PR that went wrong.** Check, in this order:
  - Plan says `standard` on a large PR: the caller pins the reusable
    workflow at a commit before tds-utils PR#780 (`f7d4fbbc`), or the
    caller passes its own `review_runs_on`. Report the pin; bumping it is
    a PR in that repository.
  - Plan says `long`, with "CI_RUNS_ON_LONG is not set": the review ran on
    the standard runner with the standard limit. Setting the variable on
    the repository or its org is the human's.
  - Review job queued and never started: no long runner took it. The long
    pool's cap is 2, so a third large review waits for one to finish; past
    that, the pool or its deploy is the problem. The infra repo's
    runner-pool runbook ("The long pool", "First run") has the checks;
    report, do not re-run.
  - Review job ran on a runner not named `cfpool-long-*`: the labels the
    job asked for were not the long pool's. Report the job's `runs-on`.
  - `timeout` on the long tier after about 115 minutes: the review itself
    was too slow for 2 hours. Report the PR size and the model; splitting
    the PR or a faster backend is the human's call. The Review step has
    its own limit 2 minutes under the job's, so the verdict and the result
    upload should still run; whether the runner enforces a step limit on
    the upstream composite action is not yet confirmed (tds-utils PR#780),
    so a timeout with no verdict is that, not a new fault.

## Copilot (human-summoned)

- **Summon (human only).** A Copilot review request on the PR:
  `gh pr edit <N> --add-reviewer @copilot` (the `gh` CLI special-cases
  `@copilot`; the plain `requested_reviewers` REST API rejects it as "not
  a collaborator") or the MCP `request_copilot_review`. The agent never
  fires either. Copilot does not review drafts and does not re-review on
  `synchronize`.
- **In flight.** `copilot-pull-request-reviewer[bot]` in the requested
  reviewers (`gh pr view <N> --json state,reviewRequests,reviews`, or
  `mcp__github__pull_request_read method=get` -> `.requestedReviewers`).
  Judge by that bot, not by an empty list: a human reviewer request
  keeps the list non-empty after Copilot is done.
- **Done.** That bot absent from the requested reviewers and its review
  posted. It consumes the request near-instantly, so an empty
  `reviewRequests` right after the human fires it is normal. Observed
  response window ~4-6 min.
- **Body-only findings.** The review body carries a collapsed
  `Suppressed comments` block beside the surfaced findings. On
  template-tools PR#485, across three rounds, the suppressed entries were
  the more serious findings every time (a silently ignored config field,
  a validation that ran mid-run instead of at preflight) while one
  surfaced finding was a misdiagnosis. Findings in code unchanged since
  its previous review go under `Previously missed`, with no thread; on
  [Skills PR#77](https://github.com/9atatimer/Skills/pull/77) the fifth
  review's only finding was body-only and the PR merged with it
  unanswered. Triage the whole body, and weigh each finding on the code,
  not on where the bot filed it.

## Codex (human-summoned)

- **Summon (human only).** A PR comment containing `@codex review`,
  posted by the human. The agent never posts it. `@codex` text not
  starting with `review` is a cloud task, run only where the repo has a
  Codex Cloud environment the bot's refusal links to.
- **In flight.** `eyes` on the trigger comment (same reactions fetch as
  OCR). Codex posts a `codex-review-state` summary comment at start and
  edits it only at completion.
- **Done.** A posted review, or `+1` on the trigger comment with no
  review (no suggestions). Neither reaction: not picked up; say so.
- **Stall.** A dead job leaves `status: running` and `eyes` on forever
  (observed: 2 h, 2026-10-25). `running` with the state comment's
  `updated_at` older than 15 minutes: report the sha and timestamp, stop,
  leave the re-trigger to the human.

## Greptile (human-invited)

Never summoned, never re-requested, never awaited. Its reviews are events
to triage, not a queue to poll; the loop ends as soon as its review is
fully triaged.
