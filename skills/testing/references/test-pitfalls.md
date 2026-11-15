# Testing -- test pitfalls and worked examples

Detail moved out of this skill's `SKILL.md`. Each section here is named there with a summary; read the section when `SKILL.md` points to it.

Contents:

- A name is not a behavior
- A fake process must model the real one's lifetime
- Drive a script the way its caller does
- A guard needs an accept case
- A fake cannot test a third-party tool's behavior

### A name is not a behavior

The failure mode is subtle enough to be worth an example, because it
survives review and it makes coverage look real.

```python
def test_a_server_still_starts_against_an_unmigrated_store(self, db):
    """Given an unmigrated store, When a desk starts, Then it comes up."""
    drop_desk_tables(db)
    store = DeskStore(db)
    try:
        store.abandon_stale_calls()
    finally:
        store.close()
```

It shipped. It has no assert statement at all: it passes because nothing
raises, and it never starts a server. The docstring is in Given/When/Then
and describes a behavior the body does not exercise -- which is worse than
no test, because the next reader sees the case is covered.

Two checks catch it:

- **Does the body do what the name says?** If the name says a server
  starts, a server starts. Setup may reach into the store; the *acting*
  and the *asserting* go through the door the human uses.
- **Can it fail?** A test with no assertion, or one whose only assertion
  is that nothing raised, is asserting the absence of a crash -- say so in
  the name, or give it the assertion it implies.

The same check catches the commoner version: a test that names a behavior
and then asserts an internal value. If the failure message would read
`assert lease == 780.0` rather than something the human would notice,
the name is writing a cheque the body does not honour. TDD is welcome to
produce that test on the way to correct code -- it is just not the one to
keep.

### A fake process must model the real one's lifetime

A fake standing in for something long-lived -- a browser, a server, a
daemon -- has to **stay running**. Faking its output is not enough. Code
that supervises a process watches two things: what it says, and whether it
is still there. A stub that records its arguments and exits immediately
gets the first right and tells the second a lie: it looks exactly like a
crash.

This does not fail where you wrote it. Supervising code typically probes
for readiness and then checks liveness, so an exiting stub leaves a window
about one process-spawn wide in which the probe reads "not ready yet" and
the liveness check then finds a corpse. On a fast machine the stub wins
that race every time and the suite is green; on a loaded CI runner it
loses it now and then. The tell is a flake that **moves**: a different
case fails each run, all of them calling the same fixture. A defect in the
code under test does not wander like that -- when the failures move and
the fixture is common, suspect the fixture.

The check, before writing any process double: what does the code under
test observe about this thing besides its output? If "is it still alive"
is on the list, the double needs a lifetime, and the test needs to reap it
in teardown. Cover the other direction too, on purpose -- a process that
dies without ever becoming ready is a real case, and it should be a test
rather than an accident of scheduling.

### Drive a script the way its caller does

A test that invokes a script under test with tidier arguments than the
real caller uses tests a program the caller never runs. A mirror-sync
script passed its `<package-dir>` argument straight into Node's
`require()`; the suite handed it absolute `mkdtemp` paths and stayed
green, the workflow handed it `packages/naatm-ci-magic` and the first
real run died with "Cannot find module" -- a bare specifier without `./`
or `/` is a module name, not a path. Mechanism: the argument form is part
of the interface, and the suite had silently narrowed it.

Before the first case, read how the production caller invokes the thing
(the workflow step, the cron line, the hook) and copy that shape: relative
or absolute paths, the cwd, quoting, env, argument order. At least one
case runs the exact production invocation; the rest may be tidier. The
same rule covers a CLI's own subcommand/flag forms: if the docs say
`tool -n seed`, one test says `tool -n seed`, not a hand-built call into
the function underneath.

### A guard needs an accept case

A check that refuses things needs a test that valid input gets through. A
suite made only of refusal cases stays green when the check refuses
everything: template-base PR #86's state-guard suite passed 10/10 with the
path check mutated to never match. Once per new guard, mutate it both ways
-- refuse all, accept all -- and confirm the suite goes red each time.

Nothing to check is an accept case too, and the one most often missing.
template-tools#714: a pre-commit guard whose suite had accept cases for
prose, comments and path arguments still exited 1 -- silently -- on a staged
change that only deleted lines, because no case staged a change with no
added lines to scan. For a guard over a diff, a file or a list, include the
empty input (nothing in scope, only removals) and expect a pass.

### A fake cannot test a third-party tool's behavior

A fake of an external CLI encodes your assumption about that CLI, so a
suite built on it proves only the assumption. template-tools' `cfw` tests
used a fake docker and asserted "the seeded config has no `credsStore`",
which was true -- and the real docker CLI still sent the registry
credential to the macOS keychain, because with no `auths` entry it
auto-detects a credential helper on PATH (template-tools#711). When a claim
is about what a third-party tool does, at least one test runs the real
binary -- with its side-effect edges faked (here, fake `docker-credential-*`
helpers first on PATH) -- and is skipped, never faked, when the tool is
absent.
