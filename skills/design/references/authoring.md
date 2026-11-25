# Design records -- authoring and review procedure

Procedure moved out of this skill's `SKILL.md`. Each section here is
named there with a summary. A section named here and not found below
("Behaviors", "Lifecycle is metadata") is in `SKILL.md`.

Contents:

- Gather Context
- Start from the Template
- Improving a Design Doc
- If a concept exists, phase 2 converts it
- Fill Sections in Order
- Apply the Style Guide
- Quality Checklist
- Review Output Format
- Common Improvements

#### If a concept exists, phase 2 converts it

A concept (-> the concept skill) holds a statement of work and user
stories: intent at full width, deliberately unconverged, and possibly not
all achievable. **Converting it is this phase's job, and much of it is a
conversation with the human, not a transcription.**

| The concept holds | Becomes | Who converts it |
|---|---|---|
| The idea | Overview | you, from the text |
| Aspirations and user stories | Goals, and what is deferred | the human, in conversation |
| What the human settled that shapes what the design can do | Key Decisions rows, citing the concept | you |
| What is still open | Open Questions | you |
| What the idea leans on | dependencies and sequencing | you |
| Anything the agent assumed | confirmed or dropped | the human, before anything else |
| Alternatives dismissed aloud | Rejections | you, from the record |

These rules govern that conversion:

- **A concept with no Goals, Non-Goals or Rejections is complete.** Those
  are outputs of this phase. Do not treat their absence as a defect in the
  concept, and never send work back to phase 1 to manufacture them.
- **This is where feasibility enters.** Concept was forbidden to say "we
  cannot do that." You may -- and an aspiration you cannot reach becomes a
  Non-Goal or a Rejection with a reason, in front of the human, never
  silently.
- **The concept is not authority.** It is unfunded, non-binding, and never
  frozen. Cite it as the origin of a decision; never as approval for one.
  Do not edit it to match the design, and do not delete it.

**A concept is hoped for, not assured.** Most work arrives here without one
-- from an accepted issue, or straight from a human. That is elision
working as intended, not a gap to backfill: gather the same context from
the issue and the conversation and carry on.

### Fill Sections in Order

**Do not skip sections.** Write them in this order:

- **Header block** -- date and authors; no status line (Lifecycle is metadata)
- **Overview** -- 2-3 sentences. If you can't explain it briefly, you don't understand it yet
- **Problem and approach** -- three short parts, before any goal: the problem (what the existing answers get wrong and what this one must solve), the approach (the handful of moves that solve it, each one sentence), and a tradeoffs table (what is given up, why it is worth it). A reader needs the shape before the rules
- **Goals** -- capabilities and constraints, each testable, each with a stable id (`G1`...) so a Behaviors row and the architecture record can cite it
- **Non-Goals** -- explicit scope boundaries. Think: "what will someone ask for that we should say no to?"
- **Design** -- the rules and capabilities, one subsection per concern, in the problem's language; what each part is responsible for, never how it is built
- **Behaviors** -- the BDD surface: one row per behavior, Given/When/Then. See "Behaviors" above
- **State Machine** -- if the system has lifecycle states (most do), document transitions
- **Domain Language** -- every noun the Goals, Behaviors and State Machine use, defined once, with its invariants; no tables, no fields, no storage
- **Parameters** -- every bound the design names, and the constraint on it; no values, no owner (the architecture record places each)
- **Security Considerations** -- the threats and the constraint each imposes on the system; the mitigation's mechanism is the architecture record's. State each mitigation against the data and its flows ("page text never leaves the device"), never against a container: a new copy of the data in a new store triggers no re-review of a mitigation written about the old store (tds-utils Issue#420, Issue#411)
- **Ships where** -- one line: the stages and platforms it is for, or "ships nowhere"
- **Key Decisions** -- the few choices that shape what the design can or cannot do, each with its rationale. This is the most valuable section for future readers
- **Open Questions** -- be honest about unknowns. This builds trust
- **Rejections** -- alternatives considered and explicitly dismissed, each with a one-line reason. Distinct from Non-Goals (which is scope) and Key Decisions (which is what was chosen)
- **Future Considerations** -- explicitly deferred work
- **Related Documents** -- links to other design and architecture records

### Apply the Style Guide

This skill is the standard. A repo's `docs/design/STYLE-GUIDE.md`, where one
exists, is a local copy for human readers; where it differs from this skill,
this skill wins and the copy is stale.

The prose rules. A record is read by people deciding whether to approve
it and by agents building from it; both need plain, specific text.

- **One sentence, one job.** No stacked clauses. No parenthetical carrying
  a second idea. No trailing "which is what makes..." justification: if the
  reason matters, it is its own sentence or its own column.
- **Short.** A goal is one or two sentences. A definition is noun, meaning,
  invariant. A rationale is a sentence, not a paragraph.
- **Plain words.** "Random tag", not "opaque identifier". No metaphor in
  the technical body; the Overview may have one line of it.
- **Shape before rules.** Problem, approach and tradeoffs come before the
  goals, so the reader knows why each rule exists when they reach it.
- **Tradeoffs are a table:** what is given up, why it is worth it. A
  tradeoff hidden in a rationale cell is a tradeoff nobody reviewed.
- **Origin is a column, not a clause.** In Key Decisions, the "why" is a
  plain sentence and where it was decided sits beside it.
- **Be explicit** -- No "handle errors gracefully"; state the bound and the failure posture ("retries are bounded; on exhaustion it fails closed") and name the parameter that carries the count. The count itself is a tuned value and lives in the as-built
- **Be testable** -- No "fast response times"; name the observable and the bound ("resolve latency is measured at P95 and has a ceiling") so a test can read the ceiling from configuration. The target is tuned, not designed
- **State an inventory as the rule that generates it** -- A closed list ("durable state is exactly these keys") is outgrown by the record's own guarantees: each at-least-once path needs state that outlives a restart, and each is added inside its task with no route back to the list (tds-utils Issue#420). Derive the inventory from the guarantees, or state the rule ("whatever an at-least-once path needs, and nothing that holds page text")
- **Be unambiguous** -- No "the system"; name the specific component
- **Prefer tables over prose** -- State machines, decisions, responsibilities all belong in tables
- **Use ASCII diagrams** -- They work everywhere, including in AI agent prompts

The test for a draft: read the Overview and the Problem and approach
aloud. If a sentence needs a second pass, split it. A record that reads
as generated -- long sentences, every clause hedged, every rule followed by
its reason in the same breath -- is sent back before a human reads it.

---

### Quality Checklist

Run through these checks:

**Structure:**

- [ ] Has all required sections (header, overview, goals, non-goals, design, behaviors, domain language, parameters, key decisions, open questions, rejections)
- [ ] Header has date and authors, and no status line

**Content quality:**

- [ ] Overview is 2-3 sentences, explains the "why"
- [ ] Goals are testable and measurable, and no goal, rule or decision carries a tuned value that belongs in the as-built
- [ ] Non-goals explicitly exclude likely scope creep
- [ ] State machines have both diagram AND transition table
- [ ] Key decisions have rationale (not just the choice)
- [ ] Open questions are honest about unknowns
- [ ] Rejections section captures alternatives that were considered and dismissed, each with a one-line reason

**Style:**

- [ ] No vague language ("gracefully", "efficiently", "properly")
- [ ] Problem and approach precede the goals, with a tradeoffs table
- [ ] Sentences do one job each; no stacked clauses, no trailing justifications
- [ ] No walls of text -- uses tables, lists, diagrams
- [ ] ASCII-only in diagrams and prose (no smart quotes, no Unicode arrows)
- [ ] Consistent heading levels (no skipping H2 -> H4)
- [ ] Blank lines after headings and before lists

**Completeness:**

- [ ] Could an AI agent implement this without asking clarifying questions?
- [ ] Could a new team member understand the "why" behind each decision?
- [ ] Are error cases and edge cases documented?
- [ ] Does every change that hides or demotes content name the path that brings it back (else it is a soft delete)?
- [ ] Where the record says an existing surface already handles a case, has the author opened that surface and read the condition that decides it?
- [ ] Does every Non-Goal chosen to avoid a cost name the cost it defers?
- [ ] Does every behavior have a Given/When/Then row, including the error paths and the "is told nothing" paths?
- [ ] Does every noun in Goals, Behaviors and State Machine appear in the Domain Language under exactly one name?
- [ ] Is every bound the record names in the Parameters table with its constraint, and does no bound carry a value?
- [ ] Does every quantity the record derives from other things (a score, an index, a ratio) name the one decision it changes? One that names none is dropped and logged under Rejections as a dismissed alternative; the list it summarised is usually the capability (tds-utils PR#610)
- [ ] Is the record free of mechanism: no seam, port, signature, store, vendor, release class or failure mode? (those are the architecture record's; see "What stays out of a design record")

### Review Output Format

When reviewing, organize feedback as:

```
## Design Doc Review: [Title]

### Blocking Issues

- [Issues that must be fixed before implementation]

### Suggestions

- [Improvements that would strengthen the doc]

### Questions

- [Clarifications needed from the author]

### Strengths

- [What the doc does well -- reinforce good patterns]
```

---

### Common Improvements

| Problem | Fix |
|---------|-----|
| Missing non-goals | Ask: "what will users request that's out of scope?" |
| Vague goals | Name the observable and its bound (a latency ceiling, an error-rate ceiling, a coverage floor); the number is tuned and lives in the as-built |
| No state machine | Look for lifecycle states in the design section and extract them |
| Prose-heavy design | Convert responsibilities and transitions to tables |
| Missing key decisions | Look for implicit choices that shape what the design can do, and make them explicit with rationale |
| No open questions | Every design has unknowns -- be honest about them |
| No rejections section | Look at the conversation/PR history for alternatives that were debated and dropped; surface them with one-line reasons so they don't get relitigated |

---

## Gather Context

Before writing, understand:

- **What problem are we solving?** (not what we're building)
- **Who is the audience?** (AI agents implementing it + human reviewers)
- **What already exists?** Check `docs/design/` for related docs, and
  `docs/concepts/<idea>/` for a phase 1 record of this idea
- **What are the constraints?** (tech stack, timeline, dependencies)

## Start from the Template

Copy `docs/design/TEMPLATE.md` to a new file following naming conventions:

| Pattern | Use For |
|---------|---------|
| `DESIGN.<name>.md` | Feature or component design |
| `INTEGRATION.md` | How components connect |

(As-built system documentation is not a design doc -- it belongs in
`docs/arch/`. See the as-built skill. The architecture record is written
after this one is approved; see the architecture skill.)

## Improving a Design Doc

When asked to improve an existing doc:

- **Read the full doc first** -- Understand the intent before suggesting changes
- **Check against the template** -- Identify missing sections
- **Apply this skill's style rules** -- Fix vague language, add tables, improve diagrams
- **Preserve the author's intent** -- Improve clarity without changing decisions
- **Add, don't remove** -- Missing sections should be added; existing content should be refined
