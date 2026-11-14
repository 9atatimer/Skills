# Adoption shapes -- the adherence caller, scope and owners

Worked shapes for the adoption steps in the adherence skill. Each is
copied from a live caller; the reusable workflow's header comment
(tds-utils `.github/workflows/adherence.yml`) is the authority on its
inputs, secrets and permissions, and the architecture record's
Operability table on the rollout.

---

## The caller job

Two shapes, chosen by how the repository's `gate` counts a skipped job.

**A gate that counts a skip as a failure** (Skills `.github/workflows/ci.yml`):
the job carries no `if:` and runs on every event.

```yaml
  adherence:
    uses: 9atatimer/tds-utils/.github/workflows/adherence.yml@<sha>
    permissions:
      contents: read
      pull-requests: read
    with:
      tools_ref: <sha>
      base: ${{ (github.event_name == 'push' && startsWith(github.ref, 'refs/heads/tedium/')) && format('{0}^1', github.sha) || '' }}
      timeout_minutes: 15
```

**A gate that counts a skip as a pass** (template-tools
`.github/workflows/gate.yml`): the job needs the scope job and is skipped
when the scope is untouched or the PR is from a fork. This one also
dispatches `gate` on the default branch, so the base expression names the
first parent there too.

```yaml
  adherence:
    needs: changes
    if: needs.changes.outputs.adherence == 'true' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository)
    uses: 9atatimer/tds-utils/.github/workflows/adherence.yml@<sha>
    permissions:
      contents: read
      pull-requests: read
    with:
      tools_ref: <sha>
      base: ${{ ((github.event_name == 'push' && startsWith(github.ref, 'refs/heads/tedium/')) || (github.event_name == 'workflow_dispatch' && github.ref == format('refs/heads/{0}', github.event.repository.default_branch))) && format('{0}^1', github.sha) || '' }}
      timeout_minutes: 9
```

- `<sha>` is one full tds-utils commit on `master`, the same in both
  places. tds-utils itself calls `./.github/workflows/adherence.yml` with
  `tools_ref` set to the PR's own head, so the engine judges itself.
- An empty `base` is the merge-base with the PR's base, or on a push the
  tip it replaced. tedium force-pushes its staging branches, so the
  replaced tip is not fetched there; the expression names the staging
  commit's first parent, which judges the last landed change.
- `timeout_minutes` defaults to 9. template-tools keeps 9 because its
  runner pool kills a job at 10; checks unfinished in time are coverage.
- The workflow accepts one secret, `ADHERENCE_OP_SA_TOKEN`, optional:
  pass it as `secrets: ADHERENCE_OP_SA_TOKEN: ${{ secrets.ADHERENCE_OP_SA_TOKEN }}`
  (from tds-utils f28ea3c0, PR#716; the seven earlier secrets are gone).
  The judge's token and the warehouse's credential are items the workflow
  finds by tag; the caller passes no variable.
- The job joins `gate`'s `needs` only after its first green run on the
  repository.

---

## The gate's scope for the job

The scope is the only place the job's paths live. It selects every
`adherence.toml`, the root included, and the declared trees.

A repo whose gate scopes with ci-scope names them in
`.github/ci-scope.table`. template-tools:

```
scope adherence     adherence.toml docs/**/adherence.toml .github/**/adherence.toml
scope adherence     packages/naatm-tedium/**/adherence.toml packages/ast-mcp/**/adherence.toml
scope adherence     packages/naatm-ci-magic/** packages/designomatic/** packages/common/**
```

The declarations are named tree by tree on purpose. One
`**/adherence.toml` would also name a declaration inside a package that
has no Scope of its own; that path would then select this job alone,
where every other path in such a package selects every suite. Add a tree
when a package gains a Scope, and an `example` line for it.

A repo not yet on ci-scope keeps the scope in its changed-scopes script.
tds-utils adds its two adherence records and its radar to the scope,
because the checks read them.

---

## CODEOWNERS

Every `adherence.toml`, the caller workflow and its pins are code-owned by
a user, never a team: a team entry counts as no owner when the engine
settles which landing is in force.

```
**/adherence.toml        @9atatimer
.github/workflows/       @9atatimer
```

Skills names the single root file (`adherence.toml  @9atatimer`) beside a
`.github/workflows/` line.

---

## A declaration header

The header says what the subtree is, what is left undeclared on purpose,
and why sections are absent. From template-tools
`packages/naatm-ci-magic/adherence.toml`:

```toml
# Left UNDECLARED on purpose: everything in this package outside the layers
# below, today src/yaml.mjs and the scripts under bin/ (ci-magic-toolkit,
# install.sh, ledger-query.mjs, mirror.sh). Each is coverage the owner
# widens when its layer is decided, not a guess made here. In a governed
# package a unit a change creates outside the declared layers is a Covered
# finding and fails gate, so a new file anywhere in this package, bin/
# included, must be given a layer when it lands: the owner widens this
# declaration in the same PR.
#
# No [records]: a declaration's paths cannot leave its directory, and this
# repository's design records live under the root docs/design/
# (DESIGN.CI-MAGIC*.md). Trace, Language, Change, Kept test and Record kept
# are therefore coverage until the records live with the package.

[layers]
domain = ["src/domain/**"]
application = ["src/application/**"]
adapters = ["src/adapters/**"]
"composition root" = [
    "src/composition.mjs",
    "src/cli.mjs",
]
test = [
    "test/**",
    "spec/**",
]

[runtimes]
ci-magic = ["src/**"]
```

A single-package repository with records and a radar (tds-utils
`adherence.toml`) adds:

```toml
[records]
design = "docs/design/DESIGN.ARCH-ADHERENCE.md"
architecture = "docs/design/ARCHITECTURE.ARCH-ADHERENCE.md"

[radar]
path = "lmde/TECH_RADAR.md"
```
