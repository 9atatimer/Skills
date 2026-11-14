# SDLC -- fleet tooling and why the sub-phases sit where they do

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when SKILL.md points to it.

### Fleet tooling -- look first, build once, depend never

A tool one repo needs, another repo usually has. Before writing a
script, a CI helper or a checker, find out, because the answer changes
what you build and where.

- **Look before you build.** Search the tooling repo's packages
  (template-tools `packages/`), the tools on the host's `PATH`, and the
  other repos' `scripts/` and `.github/scripts/` for the same job. A
  script that decides which CI suites a change needs was written three
  times in three repos before anyone looked; each copy had a different
  hole.
- **Do not write the next copy.** Where the job is already done
  somewhere, the work is one tool that replaces the copies, not another
  copy beside them. Say so to the human before building anything.
- **Replacing a copy is that repo's own change, in that repo's order.**
  A copy a gate depends on stays until its replacement has run on that
  repo's runners and selects at least what the copy selected (law 11).
  Never delete a working script because a better one exists elsewhere,
  and never reach into another repo to remove one.
- **A tool more than one repo needs is a package in the tooling repo.**
  The template repo is copied once at creation and never syncs, so a
  tool placed there reaches no existing repo.
- **A shared tool is product where it lives.** Other repos code against
  its command line and its file formats, so the self-contained test above
  fails: in the tooling repo it gets a design record and an architecture
  record. Each consumer still treats it as tooling.
- **A tool on the acquire rail is host-scoped: do not make it a project
  dependency.** The rail is the acquire engine's package table and the
  fleet pins beside it, in the tooling repo. A host that acquires gets
  each tool on `PATH` at its pinned version: `lmde acquire` on a laptop,
  `naatm-sandbox setup` where a machine is provisioned. Do not add a
  rail tool to a project's manifest, its lockfile, or an install step in
  its CI to make it available, and do not read a project's rule about
  where its dependencies come from as a rule about rail tools.
- **This removes nothing.** A repo that declares a fleet package as a
  dependency -- the hooks package its `prepare` script wires, a deploy
  runner -- keeps it, and keeps the token its install needs. The repo's
  agent instruction file says what it installs. The rule is about how a
  rail tool arrives, not a licence to strip a manifest.
- **Check the tool is there before a gate depends on it.** Being on the
  rail is not being on this host. A tool is on a host only after its
  package is published, its row and pin have landed, and the host has
  acquired since; a runner acquires when its image is built. A
  GitHub-hosted runner is never provisioned from the rail, and a public
  repository's gate, or a fork's pull request, runs on one. Confirm the
  command answers on the runner the gate uses. Do not assume it from
  this skill.
- **A tool missing from a host is a provisioning fault, and not yours to
  patch on the host.** Do not install it there by hand, and do not work
  round it with a dependency. Putting a tool on the rail, or moving its
  pin, is a reviewed change in the tooling repo that a human lands, and
  a pin change needs the engine package's own version raised or it never
  ships. Report what is missing and stop on that path.
- **Before you say how CI gets something, read the workflows and the
  provisioning.** "The runner only has the checkout" and "that repo is
  private, so nothing can reach it" were both asserted from memory in
  one session, and both were wrong. A reviewer's engine that a workflow
  takes as an action is not arriving by the rail, whatever the rail also
  carries.

## Why the sub-phases sit where they do

**3b Planning is an epilogue to Architecture, not a prologue to Behaviors.**
A plan is the route from where you actually stand to where the design says
you are going. It needs both endpoints: the design supplies the target, the
as-built supplies the start. That is also why planning is where scope gets
cut -- it is the first phase that meets real code.

**7a As-built fires with Release, not with the merge.** The as-built
describes the *deployed* system that other developers must code against.
CD is not universal, and merged is not shipped. Read "release" broadly:
deploy, publish, or tag. Work that ships nowhere changes no shared
architecture, which is a correct no-op rather than an exception. The gap
between merged and deployed is carried by the tracking issue, which
stays open until the change has shipped and its retrospective landed
-- never by a line in the design doc.

The loop is not closed until the retrospective. Shipping code is not the
same as shipping what was designed.
