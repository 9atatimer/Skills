---
name: agent-instructions
description: "Writing or editing the instructions an agent loads: a skill (SKILL.md, its description and its reference files), a repo's AGENT.md (and its CLAUDE.md / AGENTS.md symlinks), the machine-global instruction file, and an agent persona. States what such a file holds (instructions for the present, never history), which layer a rule belongs in, how to word a rule for current models, soft size limits per file type, how to write a description that loads the skill when it should, and what to check before committing. Load before creating a skill, changing a skill's description or body, adding, trimming or rewording a rule in AGENT.md or the global file, or reviewing such a change. Skip for where a lesson is routed after a retrospective (retrospective, todo-plan), Markdown characters and list markup (markdown), the wording of runbooks, PRs and issues (technical-writing), and prompts a product sends to a model at run time (coding, decision-models)."
---

# Agent Instructions

An agent instruction file is text an agent loads and then acts on: a
skill, a repo's `AGENT.md`, the machine-global instruction file, a
persona under `agents/`. The reader is a capable model that has not seen
your session, reads every sentence as something to act on, and cannot
ask what you meant.

The technical-writing skill sets the wording: plain, literal English in
connected sentences. This skill sets what the file holds, where a rule
goes, how large the file may grow, and how a skill gets loaded.
`references/sources.md` lists the vendor and community guidance behind
the rules here, with the date each source was read.

## Instructions, not history

A rule says what to do and when, in the present tense. It may carry one
clause that gives the reason. It carries nothing about how the rule came
to exist.

- The incident, its date, the PR number and who ruled go in the commit
  message and the PR body. `git log` and `git blame` keep them for the
  rare reader who needs them.
- Test each sentence by removing it. If the agent would act the same
  without it, leave it out.
- When a fact changes, rewrite the rule. Do not append a correction, an
  exception dated later, or a note that the old behaviour was wrong.
- Leave out words that expire: "currently", "new", "recently", "for
  now", a version that will move.
- Keep the reason when the rule is unsafe or easy to misapply without
  it. A reason is a property of the system ("GitHub refuses
  self-approval"). An anecdote ("two PRs went out as the owner") is
  history.

## Choose the layer before you write

Each layer is loaded by a different set of sessions, and every line
costs attention in each of them. Put a rule in the lowest layer whose
readers need it (sdlc, law 15).

| The rule is... | It goes in |
|---|---|
| something that must hold every time, with no exception | a hook, a lint check or a gate; the instruction file names it |
| a tool's flags, exit codes, file layout or step sequence | a tested script; the instruction names the script |
| about one file's implementation | a comment in that file |
| about one component of the deployed system | `docs/arch/` |
| needed by every session in one repo | that repo's `AGENT.md` |
| needed whenever a topic comes up, in any repo | a shared skill |
| detail that only some tasks in the topic need | a reference file under the skill |
| how the human wants every agent to behave, everywhere | the global instruction file |

An instruction file is context, not enforcement. A model follows it
most of the time. When a rule keeps being missed, move it to a
mechanism or shorten the file around it. Do not add emphasis.

## What belongs

Write down only what the agent cannot work out from the repository and
its own training:

- commands that are not the standard ones, and how to verify a change
- traps: the thing that looks right and is not, the order that matters
- decisions made outside the repo that the code does not show
- a correction the human has had to make more than once

Leave out:

- a repository overview, a directory tree, an architecture summary the
  code already shows
- general good practice a current model follows unprompted
- lines that tell the model to keep going, think harder or be thorough
- anything another loaded layer already says; point to it

## Wording

- **Plain sentences.** Follow the technical-writing skill. Do not
  compress a rule into fragments or telegraphic notes to save words; a
  rule the reader must decode is followed wrongly.
- **State the action.** Say what to do. When you must forbid something,
  name the exact pattern, and say what to do in its place. A vague
  prohibition replaces one unwanted default with another.
- **Scope every absolute.** A current model treats "never" and "always"
  as having no exception and applies them more widely than you meant.
  Write the condition and the action: "ask before deleting files outside
  the worktree", not "never delete files". Keep a bare "never" for a
  rule that truly has no exception.
- **Give the reason in a clause.** A model that knows the intent applies
  the rule correctly to cases you did not list.
- **No emphasis.** No capitals for stress, no "IMPORTANT", "CRITICAL" or
  "MUST" as intensifiers, no bold on whole sentences. Emphasis makes a
  current model over-apply the rule, and when every rule is emphasized
  none is.
- **One short instruction over a list of cases.** State the principle
  and its reason. Enumerate cases only when the principle cannot be
  inferred from one.
- **One term per thing.** Choose a word for a concept and use only that
  word. A second word reads as a second thing.
- **Examples.** A single example is copied closely. When an example is
  needed to show a format, give a few that differ, or say which part of
  the example is fixed.
- **Write for every agent that loads the file.** Name a tool or a
  harness feature only where the rule is about that tool.

## Size

These are soft limits. A file over its target is a signal to move
content down a layer. It is not a reason to compress the prose.

| File | Target | Hard limit |
|---|---|---|
| a repo's `AGENT.md` | under 200 lines | none |
| the global instruction file | under 200 lines; each rule one or two lines and a pointer | none |
| all instruction files one session loads, combined | under 32 KiB | Codex stops reading there by default |
| `SKILL.md` body | under 500 lines, with the rules that govern the whole task in the first 5,000 tokens | the skill lint's word budget |
| skill `description` | key use case and trigger words in the first sentence | 1,024 characters (skill lint) |
| a reference file | a table of contents when over 100 lines | none |

The targets are about cost. Every line of an always-loaded file is read
in every session, and every skill description is listed in every
session. Studies disagree on whether length alone lowers compliance, so
do not defend a long file by saying the agent still follows it.

An import or an `@` reference to another file does not reduce the cost
when the harness loads the file anyway. A skill and a reference file do
reduce it, because they load only when needed.

## Writing a skill

- **Look for an existing skill first.** Fetch `main` and search the
  skill tree for the topic. Extend the skill that owns the topic, or
  hang a narrower one under it.
- **Start from a failure.** A skill is worth writing when an agent
  without it gets a task wrong. Record that task; it is the first test.
  If the agent succeeds without the skill, the skill is not needed.
- **One job.** A skill covers one topic or one procedure.
- **The description decides whether the skill loads.** It is the only
  text the agent sees when it chooses.
  - Third person. Say what the skill covers, then when to load it, with
    the words a user or a task would use.
  - Say where the skill stops, and name the skill that takes each
    excluded case.
  - Two descriptions that both fit one request make the agent load
    one that does not fit. Read the neighbouring descriptions before
    you write yours.
- **Body order.** Put the rules that apply throughout the task first,
  written as standing rules. A procedure used at one step comes later or
  goes in a reference file.
- **Policy in the skill, mechanics in code.** A skill holds what the
  agent must decide and type. Deterministic work goes in a tested script
  that the skill names. Say whether the agent runs the script or reads
  it.
- **Reference files** sit one level below `SKILL.md`, and `SKILL.md`
  says when to read each one. A reference file does not point to another
  reference file.
- **Test loading both ways.** Add prompts that should load the skill and
  near-misses that belong to a neighbouring skill, and run the loading
  eval after each description change. The skill tree's `evals/loading`
  README has the method.

## Editing AGENT.md and the global file

- Edit `AGENT.md`. `CLAUDE.md` and `AGENTS.md` are symlinks to it.
- An entry is the rule in one or two lines, and a pointer to the skill,
  doc or script that has the rest.
- **Search before you add.** Grep the file, and the layers loaded with
  it, for the noun. Two rules that disagree are resolved arbitrarily by
  the reader, and neither harness guarantees which file wins.
- **Remove when you add.** Agents add text and rarely remove it. When
  you add a rule, look for one it replaces, one whose reason no longer
  holds, and one a mechanism now enforces.
- **A rewrite is checked by its deletions.** Read the removed lines of
  the diff, and for each removed rule name where it now lives or why it
  is gone.
- **A fleet rule has copies.** When you change a rule, search the
  consumer repos and the global file for the same noun and change each
  copy in the same piece of work.
- **Reread when the model changes.** A caution written for an older
  model can make a newer one over-correct. Remove cautions whose reason
  no longer holds.
- A human reads every change to an instruction file before it lands.
  These files are operating rules, so the change takes the review the
  gates skill requires for operating rules, not the lighter path for
  documentation.

## Before committing

- Each sentence is an instruction, a condition or a one-clause reason.
- No dates, incident accounts, PR numbers or names of who decided.
- No emphasis words; each "never" and "always" has no exception or has
  its scope written.
- The rule is in the lowest layer that needs it, and nothing above or
  beside it says the same thing or the opposite.
- The file is within its size target, or the PR says what will move out.
- For a skill: the description says what, when and where it stops; the
  loading cases exist and were run.
- For a rewrite: every removed rule is accounted for.
