# Self-review -- adapter mechanics and sources

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary. A section named here and not found below
("Sizing", "The ReviewEngine port") is in
`SKILL.md`.

Contents:

- Adapters
- Why these rules

### Adapters

| Adapter | Who finds | Bound when | Covers |
|---|---|---|---|
| `ocr` | Open Code Review's full pipeline: deterministic file selection and bundling, per-file rules, sub-agent review, its own reflection filter | `OCR_NO_UPDATE=1 ocr version` reports v1.12.5 or later, and `OCR_NO_UPDATE=1 ocr llm test` exits 0 | Source code; it skips Markdown |
| `ocr-delegate` | `ocr` picks files and rules; the panel reviews them | `OCR_NO_UPDATE=1 ocr version` reports v1.12.5 or later but `OCR_NO_UPDATE=1 ocr llm test` fails | Source code, on session quota |
| `subagent` | The panel: fresh-context sub-agents, briefed with the template below | Always | Everything, including prose, skill and persona files |

**Selection is mechanical, per file class:** the first adapter whose
condition holds. An `ocr` older than v1.12.5 lacks the exclusion reasons
this skill routes on, so it binds neither `ocr` adapter. A diff that mixes code and Markdown runs `ocr` (or
`ocr-delegate`) over the code and `subagent` over the rest. Whether `ocr`
is a binary, a wrapper around a container, or something that forwards to a
remote endpoint is the machine's business. Cloud sessions normally have no
`ocr`, and land on `subagent`.

**`ocr`:**

```bash
OCR_NO_UPDATE=1 ocr review --repo <repo> --from <base> --to <head> \
  --background-file <background.md> \
  --format json --audience agent --effort low \
  --max-tokens-budget <budget> -o <out.json>
```

- **A change that touches `.opencodereview/` is not reviewed by `ocr` or
  `ocr-delegate`; all of it goes to `subagent`.** `ocr` always reads
  `.opencodereview/rule.json` from the working tree, and `--rule` only
  layers above it, so a change could exclude or rewrite the rules for its
  own files. Untouched, the head's rules are the base's -- provided `ocr`
  runs in a clean checkout of `<head>`, so no uncommitted edit stands in
  for them. The machine's global `~/.opencodereview/rule.json` is the
  machine's configuration, like the binding; its exclusions are handled
  below.
- **`<background.md>` is the intent with the do-not-flag list appended.**
  `ocr` has no other channel for either. It refuses a background over 8,000
  characters; when the two together are longer, the change goes to
  `subagent` rather than to a shortened intent.
- **`OCR_NO_UPDATE=1` on every `ocr` invocation, the probe included.**
  Without it the launcher checks the npm registry and upgrades itself in
  the background.
- Never pass `--no-filter`: the reflection filter is where its precision
  comes from.
- `ocr` sits on the panel as one more round-1 report: its rows join the
  synthesis table and take the other panelists' stances in round 2 like
  any other. It takes no lens.
- `ocr` serves correctness, security and tests. It has no category for
  intent compliance, so the `subagent` panel still runs over the same
  files and covers it.
- Map its output into findings: `content` -> claim; `existing_code` ->
  evidence (the quoted lines); `path` and `start_line` -> location; `severity` -> severity; `category` ->
  defect class: `security` -> security, `test` -> tests, and `bug`, `other` or
  no category -> correctness. Drop `style`, `documentation`,
  `maintainability` and `performance` unless the intent names that
  concern.
- A finding is E1 only when its `existing_code` actually shows the defect
  it claims; one without it, or whose quote does not show it, is E0 and
  synthesis drops it. Its reflection filter is not our verifier; the
  verifier still runs.
- **What `ocr` could not review goes to `subagent`; what is out of scope
  does not.** `OCR_NO_UPDATE=1 ocr review --preview --repo <repo> --from
  <base> --to <head> --format json` gives each excluded file an
  `exclude_reason`, and the result lists every selected
  file it failed to finish under `failed`, whatever the class (`budget`,
  `provider`, `timeout`, `configuration`, `input`, `panic`, `cancelled`,
  `unknown`). Route by reason:
  - to `subagent`, the same lenses: `unsupported_ext`, `too_large`,
    `deleted`, every `failed` file, and `default_path` when the file is a
    test -- engine limits on files still in scope.
    Also `user_exclude` when the path matches no `exclude` in the rule set
    committed at `<base>`: that exclusion came from the machine's global
    `~/.opencodereview/rule.json`, not the repo.
  - nowhere, listed in the ledger with the reason: `user_exclude` that the
    base's committed rules account for, `provider_directory`, `binary`, and
    `default_path` for generated, vendored, snapshot and lock files (the
    do-not-flag list).
  - never to any model: `secret_exclude`. A credential file in a diff is
    itself a finding for the human; list it as not reviewed, and why.

**`ocr-delegate`:** with `OCR_NO_UPDATE=1`, run `ocr delegate preview
--repo <repo> --from <base> --to <head> --format json` for the file list,
then `ocr delegate rule --repo <repo> --from <base> --to <head> --format
json <paths...>` for each file's rules, and
hand each panelist its files and rules in the brief. Panelists are
sub-agents: pin their model as for `subagent`. Excluded files go to `subagent` exactly
as for `ocr`. Alibaba's delegate skill says to "discard likely false
positives silently"; ignore that. Findings go through our verifier like any
other.

**`subagent`:** pin the model on every spawn; an omitted model inherits the
session's, which is the expensive one. Panelists run on a cheaper model,
the verifier on the strongest available. Probe sub-agent tooling before fanning
out: dispatch one agent doing one trivial write and confirm it landed.
Every finder and verifier report is appended to the spawning session's
context when it hands back: a pass of seven finders and eight verifiers
delivered fifteen reports to the author at once, and the session hit its
context ceiling mid-triage (tds-utils PR#467, Skills PR#122). When a pass
fans out to more than a few agents, run the fan-out under one orchestrator
(a forked agent, or a workflow script where the harness has one) that
collates and returns only the ledger table.

---

## Why these rules

Sources as read on 2026-10-01. Directions agree across them; the
magnitudes are soft, and vendor numbers are marked as such.

- **Fresh context:** fresh-session review scored F1 28.6 against 24.6 for
  same-session self-review; a sub-agent given the author's context scored
  23.8, no better than self-review. Song, "Cross-Context Review" (2026),
  https://arxiv.org/abs/2603.12123
- **Noise in production:** in Greptile's data 19% of comments were
  addressed, 79% were nits and 2% were wrong (vendor-reported),
  https://www.zenml.io/llmops-database/improving-ai-code-review-bot-comment-quality-through-vector-embeddings
- **Precision on a benchmark:** on AACR-Bench, Claude Code reviewing with Opus 4.6 posted 5,980
  comments of which 7.2% matched an expert-annotated defect; Open Code
  Review on the same model reached 33.9% precision, 20.0% recall, about a
  ninth of the tokens (Alibaba, self-reported),
  https://arxiv.org/abs/2608.09290
- **Evidence over votes:** ten reviewers unanimously endorsed a nonexistent
  OpenSSL padding oracle; one empirical test killed it. "Refute-or-Promote"
  (2026), https://arxiv.org/abs/2604.19049
- **Verification:** Anthropic's code-review plugin validates each finding
  in a separate sub-agent and drops what does not validate,
  https://github.com/anthropics/claude-code/tree/main/plugins/code-review ;
  Cloudflare's reviewers feed one strong coordinator that drops the
  speculative findings, with cheaper models on trivial diffs,
  https://blog.cloudflare.com/ai-code-review/ -- the shape of one verifier
  over the panel's whole decision.
- **Lenses, not personas:** personas in system prompts did not improve
  task performance. Zheng et al., Findings of EMNLP 2024,
  https://aclanthology.org/2024.findings-emnlp.888/ . A lens is a question
  asked of the change, not a character to play.
- **A panel that deliberates:** model instances that see and answer each
  other's reasoning reached more accurate answers than any one alone. Du
  et al., "Improving Factuality and Reasoning in Language Models through
  Multiagent Debate" (2023), https://arxiv.org/abs/2305.14325 . A blind
  first round, as in the Delphi method, keeps the first view from
  anchoring the rest.
- **Silos lose the shared view:** on a private infrastructure PR
  (2026-10-14) two single-class finders wrote up the same sentence apart,
  a third reported nothing about it, and the verifier saw one row alone;
  the panel had no decision to hand on. Skills issue#124.
- **One round:** a reported review loop went 37, 39, 35, 54, 52, 46, 45, 45
  findings per cycle because each fix pass added the text the next round
  reviewed, https://github.com/daniel-ospina/agent-infra/issues/1089
- **Triage isolation:** rebuttals pushed models from a correct answer to an
  incorrect one in 14.66% of cases (SycEval, https://arxiv.org/abs/2502.08177);
  models endorse a counterargument more readily as a follow-up than when
  both sides are shown at once, https://arxiv.org/abs/2509.16533
