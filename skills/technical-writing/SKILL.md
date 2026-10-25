---
name: technical-writing
description: "Writing text that humans read and act on: runbooks, playbooks, operator procedures, and every PR or issue title, body, and comment. Plain, literal wording in the style of ASD-STE100 (precise meaning, familiar words, clear references, explicit relationships), with technical terms kept. Load when writing or revising a runbook or playbook for a human operator, and before opening a PR, filing an issue, or posting a PR or issue comment. Skip for docs written for agents (release, Docs; markdown), what a PR or issue body must contain (github-workflow), Markdown formatting rules (markdown), and design records (design)."
---

# Technical Writing

Write clear, natural prose for a competent reader whose attention is
limited. The style is inspired by ASD-STE100 but does not follow it
rigidly: precise meaning, familiar words, clear references, and explicit
relationships. Keep necessary technical terms. Apply these principles in
the language the user is using.

Scope: documents a human reads under pressure or to make a decision,
such as a runbook or playbook (release phase), and the text of a PR or
issue: title, body, comment, review reply. The github-workflow skill
sets what a PR or issue contains (PR Anatomy, Issue Anatomy); this skill
sets how it reads. Docs written for agents follow the release skill's
Docs section (terse, imperative) instead.

These are writing preferences, not a change to the task. Follow the
requested format and tone. Keep deliberate warmth, humour, and creativity
where they fit. No preamble, editing report, external tool, or separate
rewriting step is needed.

## Say the substance

Explain directly what happens, why, what follows, and what the reader
needs to do. Do not announce that a point is important, interesting,
useful, or honest; the facts and consequences show their own importance.
Avoid staged revelations, dramatic transitions, canned contrasts,
self-praise, and commentary about how the answer is structured.

## Be literal

Describe processes and relationships as they are. Do not make abstract
things move, carry, fight, or act like people when a direct explanation
is clearer. Do not replace one decorative metaphor with another. Use an
analogy only when it makes an unfamiliar idea easier to understand
accurately.

## Shape

Write connected prose with varied sentence lengths. Cut filler and
repetition, but keep the reasons, conditions, exceptions, and examples
the reader needs. Do not compress into fragments. Use headings, lists,
and tables when they help navigation or comparison, not as a default
template. Do not end with a summary that repeats the answer.

## Be honest about status

Distinguish facts, assumptions, estimates, and recommendations. State
uncertainty and limits plainly. Do not invent evidence, personal
experience, consensus, or certainty. Correct errors when you can
establish them; do not turn a guess into a fact without saying so.

## PR and issue text

The reader decides whether to merge, fix, or close, and has not seen the
session. Name the thing: "the `plan` command prints 5", not "this
change" or "the issue". Lead with the problem, not with what was done
about it. Do not narrate the work ("I first read...", "after
investigating..."), grade it ("comprehensive", "robust", "carefully"),
or restate the diff line by line. A claim that a check passed names the
check and the commit it ran on.

## Before sending

Reread for vague references, unnecessary metaphors, rhetorical setups,
and sentences the reader must decode. Rewrite those from their meaning,
not by swapping synonyms. Keep useful detail, and check that the
revision has not changed the claims.
