# Todo-plan -- IDs and lessons

Detail moved out of this skill's `SKILL.md`. Each section here is named there with a summary; read the section when `SKILL.md` points to it.

Contents:

- Two tiers, one contract
- Lessons Learned (format, `about:` routing, graduation)

### Two tiers, one contract

The contract the whole layout rests on is one sentence:

> Mint an ID that collides with nothing in `tasks/`, including
> `tasks/done/`.

Everything downstream consumes an opaque string and cares about nothing
else, so there are two ways to satisfy that sentence and no difference
beyond it.

| | Tier 1 -- the repo has a task tool | Tier 0 -- fallback |
|---|---|---|
| Who mints | the tool | you, by hand |
| Scheme | opaque, e.g. `red-fox-hills` | `task-NNN`, one past the highest |
| Collision check | every ID under `tasks/`, retried | one `ls tasks/` |
| Graph checking | its checker, in CI | none |

**Never name the tool in a skill, and never assume one exists.** A skill
that says "run `<tool> task new`" is broken in every repo that does not
have it -- which is exactly the case tier 0 is for. Ask the repo: if it
ships a task command, use it; otherwise mint `task-NNN` yourself. The
repo's `AGENT.md` is where a specific tool gets named.

**Tier 0 is this rule, not a program.** A fallback binary is something you
must install in order to avoid needing an installed thing, and it rots --
everyone with the tool runs tier 1, so nothing exercises the fallback. A
rule cannot rot, and it works in a repo holding nothing but git and an
editor.

**What tier 0 costs**, so the degradation is chosen rather than
discovered: no transitive queries, no duplicate detection when filing, no
CI dangling-reference check, and monotonic brings back branch collisions
-- two branches both mint `task-007`, and the merge resolves it by
renumbering the later one and fixing its inbound references.

**Mixing the two schemes in one repo is free.** A repo that starts on
`task-001` and later gets a tool ends up with `task-001` beside
`red-fox-hills`, permanently, and that is fine -- it is the direct payoff
of never parsing an ID. Adopting a tool is a no-op migration: nothing is
renamed, nothing is backfilled, no edge changes. **Never renumber to tidy
up**; it breaks every inbound reference and buys nothing.

## Lessons Learned

Record a lesson when an assumption was wrong, a tool did not behave as
documented, a non-obvious root cause cost real time, an approach was tried
and rejected, or something worked unexpectedly well.

**Format:**

```markdown
### {Short title}

about: {layer}

{What happened and what to do differently. 2-4 sentences max.}
```

A good lesson saves someone 30+ minutes in a future conversation.

**`about:` names the layer the lesson is for.** It is law 15's routing
decision, recorded at the moment you write the lesson instead of
rediscovered at triage months later -- when whoever is triaging no longer
has the context that made the routing obvious.

| `about:` | The lesson's layer |
|---|---|
| `wip` | none yet -- unsettled, belongs in this file |
| a repo path, e.g. `goldfish/shell.py` | a code comment in that file |
| `component:<name>` | `docs/arch/<name>` -- only once it ships (the folder law) |
| `repo` | the repo's `AGENT.md` |
| `skill:<name>` | that shared skill |
| `global` | the global agent instructions |

**Only `wip` belongs in this file.** Everything else is a lesson that has
already settled and is naming its own destination, so write it there
directly and never record it here first.

What the field is good for beyond routing:

- **A lesson you cannot label is one you have not finished diagnosing.**
  If you cannot say which layer's readers need this, you are still
  describing a symptom. Say so plainly rather than filing `wip` as a
  parking space.
- **The same `about:` recurring across lessons is the signal to change
  the layer itself.** Three lessons pointing at one skill means the
  doctrine is wrong, not that agents keep being careless.

**A task is never a lesson's home**, and neither is an issue. Both are
transitory -- they vanish when the work is done, taking anything parked in
them along.

**Do not record:** obvious things, anything already in a style guide or
the repo's agent instruction file, implementation details that belong in
code comments, or settled lessons.

**Graduation (mandatory triage).** At every retrospective, and at any
wrapup whose sweep touches this file, walk the whole list; each entry gets
exactly one of:

- **Promote**: `about:` is anything other than `wip` -- move the lesson to
  that layer and delete it here. Until the change that moves it lands,
  the entry keeps its full text here: a number or a title alone cannot
  be promoted. The field already decided; triage only executes it.
- **Keep**: still `wip`, still tied to the work in progress.
- **Delete**: superseded, or its root cause is fixed. Delete outright --
  never annotate an entry as "Historical"; git history holds the past.
