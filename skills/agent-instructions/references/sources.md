# Sources for the agent-instructions skill

Read this file when you revise the skill, or when someone questions a
rule in it. It records which guidance each rule rests on and the date
the source was read, so that a later reader can check whether the source
still says it. All pages were read on 2026-11-14. Reddit could not be
reached on that date, so no rule rests on a Reddit thread.

Reread these sources when a new model generation ships. Prompt guidance
written for a retired model is not evidence for this skill.

## Vendor documentation

The vendor pages are living documents with no publication date. The
models they name (Claude Fable 5.2, the GPT-6 family) show they were
current when read.

| Source | Rules it supports |
|---|---|
| [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) | state the action; give the reason; varied examples; aggressive wording now over-triggers |
| [Prompting Claude Fable 5.2](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-2) | "never" is read as absolute; write scope and reason; hard style limits are followed literally; delete cautions whose reason no longer holds |
| [Prompting Claude Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5) | one brief instruction over enumerated cases; skills written for older models are often too prescriptive |
| [Claude Code best practices](https://code.claude.com/docs/en/best-practices) | no capitals or IMPORTANT; a missed line means a long file or a rule that needs a hook; hold only what the code does not show; drop keep-going lines |
| [Claude Code memory](https://code.claude.com/docs/en/memory) | under 200 lines per file; context, not enforcement; imports do not reduce cost; contradictions are resolved arbitrarily |
| [Claude Code skills](https://code.claude.com/docs/en/skills) | description listing budget; standing rules in the first 5,000 tokens; should-load and should-not-load tests |
| [Agent Skills best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices) | body under 500 lines; references one level deep; table of contents over 100 lines; third-person description of 1,024 characters; one term per concept; evaluations before prose |
| [OpenAI prompt guidance, Using GPT-6](https://developers.openai.com/api/docs/guides/prompt-guidance) | current models follow instruction files more strongly, so audit them |
| [Codex AGENTS.md](https://learn.chatgpt.com/docs/agent-configuration/agents-md) | files concatenate from the root down; 32 KiB default cap |
| [Codex skills](https://learn.chatgpt.com/docs/build-skills) | one job per skill; key use case and trigger words first; clear scope and boundaries |
| [Codex best practices](https://learn.chatgpt.com/guides/best-practices) | a short, accurate file beats a long vague one; update the file after a repeated mistake |

The OpenAI pages and Anthropic's `skill-creator` skill were read through
a summarizing fetch. Check a phrase against the page before quoting it.

## Community and research

| Source | Date | Rules it supports |
|---|---|---|
| [Harbor, review of five studies of AGENTS.md](https://gethrbr.com/blog/is-agents-md-useful) | 2026-09-23 | repository overviews do not help; hand-written files score slightly higher than generated ones |
| [ETH study of context files](https://arxiv.org/abs/2602.11988) | revised 2026-09-29 | context files raise cost by over 20% on average without a general gain in task success |
| [Thoughtworks Radar, agent instruction bloat](https://www.thoughtworks.com/radar/techniques/agent-instruction-bloat) | 2026-11-04 | instruction bloat is a Caution item; enforce with mechanisms |
| [Hacker News thread 49955753](https://news.ycombinator.com/item?id=49955753) | 2026-10-04 | stale instruction text misleads; rewrite a fact when it changes |
| [Hacker News thread 49623538](https://news.ycombinator.com/item?id=49623538) | 2026-09-09 | each description says where the skill stops; overlapping descriptions cause wrong loads |
| [Hacker News thread 49595338](https://news.ycombinator.com/item?id=49595338) | 2026-09-07 | deterministic work in a script, judgement in prose; write a skill from a failed case |
| [Hacker News thread 50251993](https://news.ycombinator.com/item?id=50251993) | 2026-10-26 | agents add text and do not remove it; prune on purpose |
| [Hacker News thread 50445763](https://news.ycombinator.com/item?id=50445763) | 2026-11-10 | re-evaluate skills at each model release |

## Where the sources disagree

- **File length and compliance.** Anthropic says longer files reduce
  adherence. [McMillan](https://arxiv.org/abs/2605.10039) (2026-05-11,
  1,650 sessions) found that size, position, splitting and conflicts did
  not change compliance. The skill therefore justifies its size targets
  by cost.
- **Emphasis.** Anthropic's Claude Code pages say to stop using capitals
  and IMPORTANT. Its Agent Skills page still shows "ALWAYS" and "MUST"
  in examples. The skill follows the pages written for current models.
- **Assertive descriptions.** Anthropic's `skill-creator` says to make a
  description slightly assertive because skills under-trigger. Its
  prompting page says wording written against under-triggering now
  over-triggers. The skill asks for trigger words and a stated boundary,
  and relies on the loading eval to settle each case.
- **Precedence between files.** Codex says the file closest to the
  working directory overrides. Claude Code says conflicting scopes have
  no guaranteed order. The skill tells the writer to remove the
  conflict.
- **Scripts.** Anthropic leans toward bundled scripts; OpenAI says to
  prefer instructions unless behaviour must be deterministic. The fleet
  rule is the stricter one: mechanics go in tested code.
- **Referenced files.** Most sources favour a short file that points to
  detail. One Hacker News tester reports that referenced files are
  ignored more often. The skill keeps rules that apply to every task in
  the always-loaded file and moves only task-specific detail out.

## What no source covered

No source dated within the window measured the effect of incident
history inside an instruction file, or compared terse fragments with
plain sentences. Those two rules in the skill are the owner's.
