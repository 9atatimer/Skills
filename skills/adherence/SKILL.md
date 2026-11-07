---
name: adherence
description: "Care and feeding of the architectural adherence gate in a repository: what the engine judges, the adherence.toml declaration and when an edit to it takes effect, adopting the gate (the caller job, its two pins, CODEOWNERS, the required check), the records and radar the checks read, reading and answering a verdict (held, lowered, inconclusive, not run), running bin/adhere locally, and declaring a monorepo package by package. Load when a task adopts the gate, edits or adds an adherence.toml, bumps the engine pins, answers an adherence verdict, runs the engine, or creates a file under a governed subtree. Skip for the engine's own code (the tds-utils design and architecture records govern it), for gate laws in general (gates) and for the structure the checks measure (coding, architecture)."
---

# SKILL: Adherence -- the architectural gate in a repository

> **Purpose:** keep a repository's adherence gate honest: declared by the
> owner, pinned to a reviewed engine, answered by fixing code, and never
> lowered by the change it judges.
> **When:** adopting the gate, editing any `adherence.toml`, bumping the
> engine pins, reading a verdict on a PR, running the engine locally, or
> creating files in a governed subtree.
> **Companion skills:** gates (Clear the Gate Before You Move It, the
> required check), architecture (the use-case surface Trace reads, the seam
> list Change reads), design (the Behaviors table and Domain Language),
> tech-radar (the rings Dependency and Edge only read), coding (the three
> axes the checks measure), self-review (the engine is one more reviewer of
> your own diff).

The authority is tds-utils `docs/design/DESIGN.ARCH-ADHERENCE.md` (what
the gate does) and `docs/design/ARCHITECTURE.ARCH-ADHERENCE.md` (where it
runs, Operability). Rulings are logged on tds-utils Issue#590; the rollout
is tracked on tds-utils Issue#601. This skill states what an agent decides
and types; the records and the engine's tests own the mechanics.

---

## What the gate is

The engine measures ten qualities (Layered, Hexagonal, LAW,
Domain-driven, Composable, Injectable, Behavior-driven, Complete,
Radar-true, Declared) through named checks. Layered is the dependency
rule between layers; LAW is Todd's LAW, every function exactly one of
logic, action and workflow (the coding skill, Todd's LAW: the function
taxonomy). A rule check is a fact: same code and declaration,
same result everywhere. A judged check asks a decision model one bounded
question about one unit and carries a confidence; it may abstain. The
design's Qualities table lists every check.

A change is judged head against base, by finding identity:

- A finding absent from the base's report is introduced. Only introduced
  findings can block. Existing findings never block, so a repository
  adopts with its debt in place.
- The verdict is the first that applies of not run, lowered, inconclusive,
  raised, held.
- Lowered and not run fail the gate. Inconclusive passes, with what was
  not covered named in the report (Key Decisions, Inconclusive at the
  gate). Raised and held pass.
- Nothing is scored. A fixed flaw that comes back is introduced again,
  with nothing configured.

---

## The declaration

One `adherence.toml` per repository root, per sub-project, or both. It
declares layers (domain, application, ports, adapters, composition root,
test), runtimes, records, radar, exemptions with reasons, vocabulary and
limits (`[layers]`, `[runtimes]`, `[records]`, `[radar]`, `[exemptions]`,
`[vocabulary]`, `[limits]`). Layers are globs, files or regions of a
file, not inferred from directories.

Rules you must hold when writing one:

- **Paths are relative to the file's own directory and cannot leave it.**
  A path that escapes makes the declaration unreadable: not run.
- **A file governs its subtree.** The governing declarations of a path are
  every `adherence.toml` from the root down to it, read as one: the union
  sections (layers, runtimes, exemptions, vocabulary) add up; the
  single-valued sections (records, radar, limits) take the nearest file's
  value. A nearer file replaces a section only under
  `[override.<section>]`. Refused, and so not run: a plain single-valued
  section where a file above already has it, an override of a section no
  file above has, one real path in two layers, and
  `[override.vocabulary]`. Run `declaration check` after every edit.
- **An undeclared subtree has no adherence.** Nothing is measured or
  found there; coverage says so. Leaving a tree undeclared is a legitimate
  choice, not a gap to paper over with guesses.
- **Under a governing declaration, every unit a change creates must be in
  a layer.** A created file outside every layer is a Covered finding:
  lowered. Give each new file its layer in the PR that creates it.
- **A file named `adherence.toml` under a path a governing declaration
  assigns to the test layer is a fixture**, not a declaration.
- **Never declare assets, art or the scripts that make them.**

Say in the file's header what is left undeclared on purpose and why: what
the code is, what has no layer yet and is coverage until the owner decides
its layer, why there is no `[records]` or `[radar]`, and that a new file
in the governed tree needs a layer when it lands. template-tools
`packages/designomatic/adherence.toml` and
`packages/naatm-ci-magic/adherence.toml` are the worked examples; guess no
layer to make coverage look complete.

### When an edit is in force

- **A declaration is in force only once a code owner approved or merged
  its landing**, settled per file: each file's newest landed revision with
  a counted landing is its declaration in force. The author's own review
  counts nothing; an owner who authored and merged it counts (Key
  Decisions, An owner who is the author).
- **A declaration new at the head governs nothing for its own change.**
  It governs from the next change. An approved deletion ends governance
  from the next change; an unapproved one leaves the last approved
  revision in force.
- **Widening is honored at once; narrowing waits.** A change's own layer
  assignment for a unit the change creates counts for that change. Covering
  an existing unit, removing or moving an assignment, and adding an
  exemption take effect from the next change.
- **A change cannot exempt what it broke.** An exemption a change adds is
  inert for that change. A flaw a change must introduce is exempted, by
  unit and check, in an earlier change the owner lands.
- **The Declared quality (Covered, Record kept) cannot be exempted.**

The widening is keyed on paths, not units. A function added to a file that
existed at the base, under no layer, is a Covered finding the same PR
cannot clear by declaring the file. Declare the file first, in its own PR
(tds-utils PR#698 is the shape), then merge the default branch into the PR
that adds the function: the declaration in force is read from the
merge-base's history, so the branch must contain the declaring landing.

---

## Adopting the gate in a repository

One PR per repository per step. Each is a gate change, so it clears the
gate as it stands (the gates skill's Clear the Gate Before You Move It).
The caller shapes, scope lines and CODEOWNERS lines are in
`references/adoption.md`.

- **Declare first, in its own PR.** The first judged change is then held
  to the base's own findings and nothing older, and an existing unit the
  declaration covers is measured at the next base, so its flaws are
  existing, not introduced.
- **Add the caller job** that calls
  `9atatimer/tds-utils/.github/workflows/adherence.yml@<sha>` with
  `tools_ref: <sha>`. The two pins name one tds-utils commit, always move
  together, and only to a commit on tds-utils `master`. Grant
  `contents: read` and `pull-requests: read`, nothing more. Set `base` for
  tedium's staging pushes (the staging commit's first parent, since the
  replaced tip is not fetched) and, where the repository dispatches the
  gate on its default branch, for that too. Set `timeout_minutes` under the
  runner pool's own kill limit; the judgement is bounded by what is left
  of it.
- **Pass the one secret, `ADHERENCE_OP_SA_TOKEN`** (the owner bound the
  hosted judge in CI on 2026-11-07; tds-utils PR#716): the adherence
  vault's read-only 1Password service account, through which the
  workflow finds the judge's token by tag. Seed it per repository on a
  personal account, or select the repository on the organization secret;
  the private ops repo's credential registry lists the holders. Without
  it the judged checks are coverage and the verdict is inconclusive at
  best, which passes. Never add a variable naming a vault or item: a step's log
  header prints variables, and the judge needs none.
- **Select the job with a changed-scopes scope**, never a `paths:` filter:
  a workflow that does not run never reports the required check. The
  scope matches every `adherence.toml` at any depth, the root included,
  and the declared trees, plus whatever the records and radar the
  declarations name.
- **CODEOWNERS names users for every `adherence.toml`, the caller
  workflow and its pins**, and branch protection requires code-owner
  review. Without that, nothing stops a PR rewriting its own judge.
- **Join the required check after one green run.** The job enters
  `gate`'s `needs` only after it has run green once on the repository.
  Read how that `gate` counts a skip: where a skip is a failure (Skills
  `ci.yml`), the job carries no `if:`; where a skip is a pass (tds-utils
  `dist-ci.yml`, template-tools `gate.yml`), it carries the scope and the
  fork guard in `if:`.
- **Bump pins by PR**, both lines in one commit, only to a commit on
  tds-utils master. An adopter's branch cut before a bump keeps the old
  pair, so its workflow and engine still agree. Only tds-utils itself
  fetches the engine at the PR head (`dist-ci.yml` passes the head sha as
  `tools_ref`), so there, and only there, a branch cut before an engine
  change must merge master first or it runs the old engine against the new
  workflow and dies on an unknown option.

Rollback is the reverse: remove the job from `gate`'s `needs` and the
check from branch protection. An `adherence.toml` may stay; without a
caller it changes nothing. Rolling back is the owner's call, never an
agent's response to a red verdict.

---

## Records and radar

Trace, Language, Change, Kept test and Record kept read the design and
architecture records `[records]` names: the Behaviors table, the Domain
Language, the use-case surface and the seam list, at the revision of the
code. A record on the default branch is approved; nothing reads a status
word. Without a record those five checks are coverage, and the report
names the record. The radar `[radar]` names drives Dependency and Edge
only.

- **A sub-project's records must live under its directory**, because
  paths cannot leave it. A package whose records sit in the root
  `docs/design/` declares no `[records]` and says so in its header.
- **A behavior and its use case may land together**: the record is read
  with its code.
- **Removing a behavior or a term from an approved record is a Record
  kept finding.** It lowers, and it cannot be exempted.
- **One radar.** A repository whose dependencies the fleet's radar rings
  carries a row for each in its own radar, at the fleet's ring, naming the
  fleet as the source (Key Decisions, One radar, carrying the fleet's
  packages).
- **When a check reading a record finds a gap**, fix the record (through
  its own phase and review) or the code. Never edit the declaration to
  stop the check reading the record.

---

## Reading a verdict and answering it

The job summary carries the verdict, findings, notices and coverage; the
SARIF is a run artifact. Each finding names its quality, check, kind,
unit, evidence and provenance: the fix is read from the report.

- **Lowered.** Fix each introduced finding in the code. When you believe
  a finding is wrong, cut an issue on tds-utils citing the rulings log
  (tds-utils Issue#590), name the finding and the evidence, and let the
  owner rule. To clear a finding, never edit an `adherence.toml`, add an
  exemption, loosen a limit, remove the job from `gate`'s `needs`, or move
  the pins, in that PR or in one before it: an exemption is the owner's
  act, proposed on the issue and landed by the owner. The engine refuses
  most of these on its own; the rest is the gates skill's law.
- **Inconclusive.** A pass with named coverage. Read the coverage lines:
  an analyzer missing on the runner, the judge unbound, a judged-check
  budget spent, CI out of time, a base that could not be measured the same
  way. Say in the PR what was not covered; fix what is yours (a timeout
  too short for the repository is a caller change, by PR).
- **Not run.** Nothing was measured. The report names why: a declaration
  that cannot be read (escaping path, conflict, misplaced override, parse
  error), or a repository that cannot be read or has no unit in a measured
  language. Fix the declaration on its own PR or report the engine fault on
  tds-utils. A job that fails before any verdict because it found no base
  (a force push whose old tip is not fetched) needs `base` set, not a
  retry.
- **Held or raised.** Pass. Raised names the findings removed.

What differs between places:

- **Judged checks are coverage wherever no judge is bound**: a CI caller
  that does not pass `ADHERENCE_OP_SA_TOKEN`, the hook, and a laptop with
  no door. A judged finding on the laptop does not mean such a caller
  will see it.
- **The laptop reads no reviews.** Outside the `ci` stage the newest
  landed revision of each `adherence.toml` stands as in force, approved or
  not, so a laptop verdict can differ from CI's. To see what CI sees, run
  the `ci` stage with `GITHUB_REPOSITORY`, `GITHUB_BASE_REF` and
  `GITHUB_TOKEN` set; without them every landing reads "reviews cannot be
  read" and nothing is in force.
- **A cloud sandbox cannot reach the reviews either**, so its verdict is
  the newest-landing one, the laptop's.

---

## Running it locally

Run the engine from a tds-utils checkout at the commit the repository
pins, so the verdict is the one CI will reach. `bin/adhere` needs `uv`.
`--stage` comes before the verb.

- `bin/adhere declaration check --root <repo>`: reads every
  `adherence.toml` and the merge of them. Run it after every declaration
  edit, before committing.
- `bin/adhere measure --root <repo>`: the working tree's report, no
  verdict. Use it to see findings and coverage before declaring or
  refactoring.
- `bin/adhere judge --root <repo> --base <sha> --head <sha>`: the
  verdict on a change. Run it on your branch against its merge-base before
  opening the PR; it is one more reviewer of your own diff (the
  self-review skill).
- `bin/adhere --stage hook judge --root <repo> --staged`: the staged
  index against `HEAD`, within the commit-time bound, as the pre-commit
  stage runs it.
- `bin/adhere --stage ci judge --root <repo> --base <sha> --head <sha>`
  with the three variables above: the gate's own view of which
  declarations are in force.

`--format` takes `terminal`, `json`, `sarif` or `summary`. The laptop
stage asks the hosted judge only when the decide client is configured
(tds-utils `docs/ops/decide.md`); otherwise the judged checks are coverage
there too.

---

## Monorepos

- **Declare package by package**, each with its own `adherence.toml`
  whose paths are relative to the package. A root declaration that names
  two packages makes every file created anywhere else a Covered finding;
  per-package files are the ruling (tds-utils Issue#695).
- **Leave the rest undeclared**, and say so in each file's header. A
  shared package no declaration governs is coverage, not a finding.
- **Inside a declared package, a new file needs its layer in the PR that
  creates it.** That holds for its `bin/`, `scripts/` and `bench/` trees
  too.
- **The scope selects every `adherence.toml` and each declared package's
  tree**, so a change outside them skips the job.
- **Records go with the package** or the package declares none.
- **Land a new package declaration on its own**, then the code it
  governs is judged from the next change.

---

## Rulings

The engine's behavior is settled by the records and the owner's rulings,
not by an agent's reading. When you disagree with a check, a threshold, a
refusal or a coverage rule:

- Cut an issue on tds-utils naming the finding or the refusal, the
  evidence, and the design section it applies, and cite tds-utils
  Issue#590.
- The owner rules. The records are amended only under a ruling, as a
  Key Decision naming it.
- Never change the engine's limits, its vocabulary, the design or the
  declaration to make a PR pass. When the gate refuses something the owner
  wants (an amendment that removes a behavior, a revert), the owner
  decides how it lands; an agent never bypasses the gate.
