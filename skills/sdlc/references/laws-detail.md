# SDLC -- detail of the laws and flow sections

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when SKILL.md points to it.

## Law 5 -- TDD is the means, BDD is the deliverable

TDD and BDD are not alternatives, and the slash that used to be here
read as though they were. **TDD is the means**: driving a unit from a
failing test is how correct code gets written, and it is welcome
wherever it helps. **BDD is the deliverable**: the test that is *kept*
names a contract someone depends on, and its failure message names the
harm. Usually that is a human action and what they then observe; for
the architect behaviors of phase 3 it is a named structural contract
(Grep, Swap, Decision, Arrow), whose dependant is the next person who
needs the seam. What it is never is the mechanism's own internals: that
test dies the day the mechanism is replaced and stays green while the
feature is unusable, where a contract test survives the rewrite and is
the only kind that can report the thing is missing. Scaffolding may be
written and may be thrown away -- it is not what the suite is for.

## Law 6 -- stable core, volatile edges, and the three rules beside it

6. **Stable core, volatile edges -- and three more rules beside it.**
   Separate what the software *means* (decisions and rules, in the
   problem's language) from how it *connects to the world* (vendors,
   HTTP, fs, env vars, model ids). The core imports nothing concrete.
   Quick check: if "we now also use <new vendor>" would touch the core,
   there is a missing seam. Counter-check: a port with one
   forever-implementation is ceremony -- seam only at real axes of change
   (YAGNI). That is the **core vs edge** rule (Hexagonal), and it is the
   one agents hear. Three more hold with equal force. **Layered:** a
   unit imports only its own layer or a layer below it. The order,
   bottom to top: `domain`, `ports`, then `application` and `adapters`
   side by side, then the composition root. A layer does not know who
   calls it. **Todd's LAW:** every function is logic, action, or
   workflow, never two of them. Logic computes a value. Action changes
   something. Workflow calls the other two in order. Logic takes values
   and needs no fake; dependency injection starts at the workflow and
   never goes below it. **Language and boundaries:** the nouns in the
   code are the nouns in the design doc, and each invariant has one
   owner. A change is architecturally done only when it passes the
   mechanical tests of all four rules. -> the architecture skill (where
   the seams and the module map are named) and the coding skill (where
   they are built and tested)

## Law 15 -- the layer table and the per-line cost

| Layer | `about:` | A lesson about... | Read by whom, when |
|---|---|---|---|
| `TODO_PLAN.md` Lessons Learned | `wip` | the work in progress, still unsettled | agents continuing that work, every session until it settles |
| a code comment | the file's path | that implementation in that file (not architectural) | whoever edits the file, when they edit it |
| `docs/arch/` | `component:<name>` | that component of the deployed system | whoever touches the component |
| the repo's `AGENT.md` | `repo` | that repo -- what an agent must know before it can work safely | every session in the repo; the most expensive repo-local layer |
| a shared skill | `skill:<name>` | the topic, universally, fleet-wide | any session whose task enters the topic |
| global agent instructions | `global` | how the human wants agents to behave | every session, everywhere -- the most expensive layer of all |

The cost is per line, not per lesson. In `AGENT.md` and global
instructions an entry is the rule in a line or two, plus a pointer (a
file, a doc, a skill) if the reader needs more. Keep the one clause of
why only when the rule is unsafe to follow without it. History and PR
numbers belong in the commit; the rest in the layer below.

## Law 17 -- the full test for a number

"item 3" rots silently. **Bugs, todos and lessons are never a numbered
sequence**: they are an unordered set that grows and shrinks, and the
numbering invites the false reading that item 1 outranks item 9. Where
order really is load-bearing, say it in prose or name the dependency
-- `blocked_by` in a task file is the machine-readable form. Where
identity is what you wanted, mint a stable identifier instead: a
`task-NNN` id, a `D14` key-decision row, a `Q2` open question. Those
are names, not positions, and they are exactly why the laws in this
section are numbered -- they are cited as "law 15" from other skills.
A number you can cite is an identifier; a number that shifts when you
insert above it is a list, and lists get bullets. The one exception
to the ban on ordered markup follows from that: a step list whose
numbers other text actually cites ("proceed to step 3") keeps its
`1.` `2.` markers -- there the number is the step's name, and
converting it breaks every citation into it. The same test governs
numbers outside list markup: a count in a lead-in ("the five gates"),
a numbered heading nobody cites, "the third option" -- all rot on the
next edit. A number earns its place only as a measured quantity, a
minted identifier, or a section/step number other text actually cites;
otherwise refer by name and leave the number out.

## Law 20 -- the refusals that show the label is no diagnosis

decides. Do not read anything into the label. GammaGo hit three
refusals, each with a different label and none matching
the call: "instruction poisoning" on a Key Decisions append,
"ChatOps trigger comments" on a bare `date`, and "irreversible
local destruction" on a `sed -n` read that followed a `git rm`.
The cause is not diagnosed. In the third case the same read went
through once the human asked for it in a new turn.

## Product or tooling -- the phase table and the tooling record

| Phase | Product | Tooling |
|---|---|---|
| 1 Concept | per the concept skill | skipped -- an issue frames it |
| 2 Design | `docs/design/DESIGN.<name>.md` | skipped |
| 3 / 3b Architecture + Planning | per their skills | skipped |
| 4-6 Behaviors, Code, Gates | always | always -- test first, branch, PR, review |
| 7a As-built | `docs/arch/` | skipped; the runbook is the record |
| 8 Retrospective | the full checklist | lessons and discovered issues only -- there is no design to drift from |

**The tooling record is `docs/ops/<tool>.md`:** what the tool does, how
to install, use and disable it, and its known limits. It is living --
edit it in the same PR that changes the tool. The tooling exception
covers the *paperwork* only: law 5 (test first), law 10 (branch + PR),
law 11 (clear the gate) and law 14 (defect anatomy) hold unchanged.

## Entering mid-flow -- the rules for arriving in the middle

The rules for arriving in the middle:

- **Enter at the phase the work is actually in**, not at phase 1. Locate
  it by what exists, then load that phase's skill.
- **Do not backfill an upstream artifact to fill a slot.** A concept
  reconstructed after funding, or a design doc written to justify
  finished code, documents nothing that happened. If an upstream artifact
  is genuinely needed -- there is no approved design and you are about to
  implement -- that is a real gate, and you stop and produce it properly.
- **Do not skip a gate because you came in late.** Elision is by rule
  (above). "I joined at phase 5" is not one of the rules.

Backing up a phase is allowed and cheap: an idea that turns out to be
unframed goes back to concept, a design that will not survive its seams
goes back to design. What is not allowed is backing up *silently* -- say
which phase you moved to and why.

## Law 2 -- the frozen design, in full

2. **The design doc is frozen while you implement.** An approved doc is
   the contract your code is checked against -- never notes to reconcile.
   When the code and the doc disagree, **cut an issue; do not edit the
   doc.** That holds for POC and MVP too. Editing the spec to match what
   you built destroys the only artifact that can show you drifted, and
   turns an unreviewed decision into apparent spec. The single exception
   is *appending* the owner's ruling to the Key Decisions log, citing its
   issue, in its own commit on the session's one PR; a choice made while
   building goes in its issue, never in the log. Status is
   metadata, never document content and never a question: a human's
   merge is the approval, no record carries a status line, and the agent
   never raises one with a human. -> the design skill

## Law 3 -- the folder law, in full

3. **The folder law: concept disposable, design frozen, arch living.**
   The concept tree -- `docs/concepts/`, or wherever the repo's `AGENT.md`
   says -- is unfunded, non-binding, never frozen, and **nothing
   downstream may cite it as authority**; an intention on disk is not a
   decision. A design record in `docs/design/` is aspirational and its
   body freezes once merged -- only its append-only Key Decisions log
   moves after that. `docs/arch/` is factual, never frozen,
   and describes **only what is deployed**. Those three lifecycles are why
   they are three trees. A want promoted to spec was never reviewed; a
   design doc rewritten to match the code is a lie; an as-built containing
   intentions is worthless. The law governs design *records*, not the
   process artifacts beside them (`STYLE-GUIDE.md`, `TEMPLATE.md`), which
   have no approval lifecycle and evolve freely. The architecture record
   beside the design freezes the same way. -> the concept skill (the
   disposable end), the architecture skill and the as-built skill

## Law 9 -- one plan, many tasks, in full

9. **One plan, many tasks.** `TODO_PLAN.md` at the repo root holds
   strategy -- what is happening now, in what order, and why -- and no
   task bodies. Every unit of work is its own file under `tasks/`,
   feature and defect alike, distinguished by `kind: task | bug`.
   Reference a task by its ID, never by its path: closing one moves the
   file. The local store works with no network, so the SDLC still runs
   for an offline or purely local project. A legacy mono-file (a
   `TODO.md`/`BUGS.md`, or a `TODO_PLAN.md` carrying task bodies) is
   migrated into `tasks/` before the plan is worked, not alongside.
   -> the todo-plan skill

## Law 16 -- the self-review epilogue, in full

16. **A self-review leaves its epilogue on the PR.** When you run the
    adversarial pass over your own diff (a fresh-context lens panel that
    decides together, one verifier that assumes each finding is wrong, one
    round), the
    ledger -- scope, adapter and models, each finding with its verdict and
    disposition, rebuttals awaiting the human's judgement, `upheld k of n`
    -- is posted as ONE comment on the PR alongside the fix, or the review
    is invisible to every later reader. A self-review never satisfies Zero
    Unreviewed Code, except on a documentation-only PR, where it is the
    whole review: no agentic reviewer (design and architecture drafts in
    phases 2 and 3 get designomatic instead). A review turn of any kind is
    spent only on a load-bearing fix, never on hygiene. -> the self-review
    skill, and the gates skill (Spend Review Turns on Load-Bearing Fixes)

## Three records, and the two skills that are not phases

Three records, three skills, three kinds of fact. The design record holds
what the system can and cannot do; the architecture record holds how it
intends to; the as-built holds what runs, including every tuned value. A
number, a label or a threshold is never a design or architecture fact: the
design says the bound exists, the architecture says which seam carries it,
the as-built says what it is set to. Phase 3 reads `docs/arch/` and writes
only its own record; phase 7a is the only thing that writes `docs/arch/`.

The github-workflow skill is not a phase. Branch, push, and PR mechanics
span the whole flow; load it whenever you touch a remote.

Neither is the designomatic skill. It is the reviewer-panel pass over a
design record, used inside phases 2 and 3 -- most valuable on a draft you
wrote yourself, because you cannot review your own document. Load it when a
record is drafted or amended and before a human is asked to read it.

## Law 18 -- infrastructure, in full

Long-lived cloud resources are terraform in the fleet's private
infra repo by default, named in each repo's `AGENT.md` under
"Infrastructure". Shared, foundational and security-bearing
resources always live there; a private project may keep a
non-security, project-only module for a listed reason (the iac
skill). Deploy workflows stay with the code they ship. An
agent writes the config and hands the human the plan line; it never
runs `apply`, `import`, `state mv` or `destroy` from a terminal
(the plan/apply server's `atlantis plan` and `atlantis apply -p <project>`
comments, where the infra repo's `AGENT.md` grants them, are the one
exception), never passes
`-auto-approve`, never mints or seeds a credential, and never creates
a resource by hand to unblock a deploy. A move or refactor is proven
by an empty plan. -> the iac skill (and infra-credentials,
cloudflare-hosting, gcp-ops, aws-ops for the surface in play)

## Elision -- what never elides

**For product work, Design, Behaviors, Code, Gates, and Retrospective
never elide.** Design is satisfiable by an existing approved doc, but it is
never skipped: you still read it, and you still check your change against
it. Developer tooling is not elision by feel -- it is a classification with
its own rule and its own record (see "Product or tooling" below).

Architecture and Planning elide *together* or not at all -- planning is the
delta between the design and the as-built, so a route computed without the
as-built is fiction.

## Product or tooling -- the three conditions

A change is **tooling** when all three hold:

- **It serves the people building the product** -- developer
  quality-of-life: git hooks, scripts, CI helpers, linters, dotfiles,
  agent configuration, local automation.
- **It is self-contained** -- nothing else codes against its interfaces,
  so it carries no seam another component depends on.
- **It is invisible to the product** -- removing it would change nothing a
  product user or a downstream consumer can observe.

If any one fails, it is product. When in doubt, it is product: a missing
design costs more than an unneeded one.
