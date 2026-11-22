# Adherence -- running locally and monorepos

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Running it locally

Run the engine from a clone of `9atatimer/workflows` at the commit the
repository pins, so the verdict is the one CI will reach. That commit is
not a tds-utils commit: a tds-utils checkout at the pinned SHA does not
exist. `bin/adhere` needs `uv`.
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

## What differs between places

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
