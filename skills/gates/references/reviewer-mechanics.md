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
  MEMBER or COLLABORATOR of the repo (the human's token qualifies, design
  Key Decisions Q3), or a dispatch:
  `gh workflow run ocr-review-caller.yml -R <owner>/<repo> -f pr=<N>`.
  The comment path uses the configured model and backend; a dispatch may
  override either. The repo must carry
  `.github/workflows/ocr-review-caller.yml` and be seeded; tds-utils
  `bin/seed-ocr-review status` says. A fork PR fails with cause `fork`
  and nothing reads the secret. The default backend is the laptop's
  Ollama Gateway; on `cf-ai-gateway` or `anthropic` every run is billed.
- **In flight.** `eyes` on the `/ocr` comment once the run is approved.
  Fetch: `gh api /repos/<OWNER>/<REPO>/issues/comments/<ID>/reactions`
  (or the MCP `pull_request_read` `get_comments`, which carries reaction
  counts). A dispatch gets no reaction: watch the run with
  `gh run list -R <owner>/<repo> -w ocr-review-caller.yml`.
- **Done.** A review by `github-actions[bot]` on the head whose body
  opens with `<!-- ocr-review-mark sha=<head> -->`: the run's summary,
  with the reviewed-file counts and every reviewable file ocr did not
  review. The `eyes` is replaced by `+1`. Findings are inline review
  comments by `github-actions[bot]`; triage them like any thread.
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
  `limited`: report; the fix is the human's.
- **Stall.** The review job's limit is 9 minutes. `eyes` still on the
  comment and no summary after 15 minutes: report the sha and time, stop,
  leave the re-run to the human.

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
