# Planning -- templates, adaptations and examples

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read it when you write the plan.

Contents:

- The BDD TODO_PLAN Template [OK]
- Language-Specific Adaptations
- Phase Structure Template
- Examples

## The BDD TODO_PLAN Template [OK]

> **NOTE -- this is the shape of your thinking, not a file template.**
> The structure below describes the content a plan must cover. That
> content is **distributed**: each phase's steps become task files under
> `tasks/`, sequenced with `blocked_by`; the philosophy and recovery
> sections belong in `TODO_PLAN.md`'s "How to Use This File"; the ordering
> becomes its "Now" list. The `# Title` / `> Branch:`
> front-matter shown is illustrative of what a plan should capture -- it is
> **not** the header of a new standalone file. See the todo-plan skill.

### Structure Overview

```markdown
# [Component] Implementation TODO Plan

> **Created:** YYYY-MM-DD
> **Design:** Link to architecture doc
> **Branch:** branch-name

---

## Implementation Philosophy

**BDD/TDD Process:**

- Write skeleton tests FIRST (call the real API, assert on expected behavior)
- Tests fail because the code does not exist yet -- never use placeholder assertions like `assert False`
- Implement ONE test at a time
- Green before moving to next test
- Commit after EACH test passes (not after phase)

**Commit Strategy:**

- After EACH test goes from RED -> GREEN
- Before and after learning checkpoint updates
- After completing acceptance criteria

**Learning Checkpoints:**

- Every 2-3 commits OR 30 minutes of work
- Explicit steps to update this TODO with discoveries
- Notes on what worked well / what to improve
- Patterns to reuse in future phases

---

## Testing Philosophy (CRITICAL)

[Include test separation, timeout requirements, mocking strategy]

---

## RESUMING AFTER COMPACT AMNESIA 

If you lose context mid-session:

- **Check last commit:** `git log -1 --oneline`
- **Read commit message:** Tells you what test passed
- **Check `TODO_PLAN.md`'s Now list**, then open that task file: find
   where you were, see what is next
- **Run tests:** `[test command]` -- what's still RED?
- **Read last learning checkpoint:** Context of decisions made
- **Continue from next RED test**

**Example:**
```bash
$ git log -1
test(feature): add foo validation test (RED)

# You were writing a failing test but didn't finish implementation

# Next step: Make test_foo_validation pass (GREEN)

```

---

## PHASE [N]: [Phase Name] [Emoji]

**Goal:** One sentence describing the phase outcome

### Step [N.1]: Write [Feature] Tests (SKELETON)

- [ ] Create `tests/unit/test_[feature].py`
- [ ] Write `test_[behavior_1]()` calling real API with real assertions
- [ ] Write `test_[behavior_2]()` calling real API with real assertions
- [ ] Run tests: `[command]` -- expect RED (code not implemented yet)

**Tests Written (list them explicitly):**

- `test_[behavior_1]` - Validates [what]
- `test_[behavior_2]` - Validates [what]

**Acceptance:** Tests exist, all RED (failing because code doesn't exist, not because of placeholders)

**Commit Point:** `test(feature): add tests for [feature] (RED)`

---

### Step [N.2]: Implement [Behavior 1]

- [ ] Implement [specific function/class]
- [ ] Make `test_[behavior_1]()` pass (GREEN)
- [ ] Run: `[command]::test_[behavior_1]`

**Acceptance:** Test goes from RED -> GREEN, all others still pass

**Commit Point:** `feat(feature): implement [behavior_1] (GREEN)`

---

### Step [N.3]: Implement [Behavior 2]

- [ ] Implement [specific function/class]
- [ ] Make `test_[behavior_2]()` pass (GREEN)
- [ ] Run: `[command]::test_[behavior_2]`

**Acceptance:** Test goes from RED -> GREEN, all others still pass

**Commit Point:** `feat(feature): implement [behavior_2] (GREEN)`

---

### Step [N.4]: Learning Checkpoint - [Phase Name]

- [ ] Update this TODO with findings from steps N.1-N.3

**Notes:**
```
[PHASE N LEARNINGS - Fill after N.1-N.3]

What worked well:
-

What was harder than expected:
-

Discoveries/surprises:
-

Patterns to reuse:
-

Technical decisions made:
-

Next time I would:
-
```

**Commit Point:** `docs(feature): update TODO_PLAN with [phase] learnings`

---

## Definition of Done 

### Feature Complete When:

**Functional:**

- [ ] All tests written FIRST (skeleton with RED)
- [ ] All tests passing (GREEN)
- [ ] No placeholder assertions remaining
- [ ] Integration tests pass (if applicable)

**Testing:**

- [ ] Unit test coverage >80% (or project standard)
- [ ] All edge cases covered
- [ ] Mock usage appropriate (no real I/O in unit tests)

**Documentation:**

- [ ] All learning checkpoints filled in
- [ ] Architecture doc updated (if design changed)
- [ ] README updated (if user-facing)

**Quality:**

- [ ] Linter passes
- [ ] Type checker passes (if applicable)
- [ ] No TODO/FIXME comments in code
- [ ] Code review complete (if required)

---

## Progress Tracking

**Current Phase:** [Phase number and name]
**Current Step:** [Step number and name]
**Overall Progress:** [X%]

**Phase Completion:**

- [ ] Phase 0: [Name] (0/N steps)
- [ ] Phase 1: [Name] (0/N steps)
- [...]

**Last Commit:** `[git log -1 --oneline]`
**Last Test:** `[test name]` - [RED/GREEN]

---

## Notes & Decisions

### Architectural Decisions

```
[Date] - [Decision]: [Rationale]
```

### Deviations from Design

```
[Date] - [What changed]: [Why]
```

### Technical Debt

```
[Date] - [Shortcut taken]: [Plan to address]
```

---

**This TODO_PLAN is a living document. Update it after EVERY commit!**
```

---

## Language-Specific Adaptations

### Python

```markdown
**BDD/TDD Process:**

- Create `tests/unit/test_[feature].py`
- Write test calling real API with real assertions on expected behavior
- Run: `pytest tests/unit/test_[feature].py` (RED -- code not implemented yet)
- Implement feature
- Run: `pytest tests/unit/test_[feature].py` (GREEN)
- Commit: `feat([module]): implement [feature] (GREEN)`

**Testing Framework:** pytest
**Mocking:** unittest.mock or pytest-mock
**Fixtures:** Use pytest fixtures liberally
```

### TypeScript

```markdown
**BDD/TDD Process:**

- Create `test/[feature].test.ts`
- Write test calling real API with real assertions on expected behavior
- Run: `npm run test:unit -- [feature]` (RED -- code not implemented yet)
- Implement feature
- Run: `npm run test:unit -- [feature]` (GREEN)
- Commit: `feat([module]): implement [feature] (GREEN)`

**Testing Framework:** Vitest (Jest is Hold -- see the tech-radar and testing-node skills)
**Mocking:** vi.mock()
**Environment:** happy-dom (unit) or node (integration)
```

---

## Phase Structure Template

Copy this for each phase:

```markdown
## PHASE [N]: [Phase Name] 

**Goal:** [One sentence outcome]

**Estimated:** [X commits, Y hours]

### Step [N.1]: Write [Feature] Tests (SKELETON)

- [ ] Create test file
- [ ] Write `test_[behavior_1]()` calling real API with real assertions
- [ ] Write `test_[behavior_2]()` calling real API with real assertions
- [ ] Run tests: expect RED (code not implemented yet)

**Tests Written:**

- `test_[behavior_1]` - [What it validates]
- `test_[behavior_2]` - [What it validates]

**Acceptance:** All tests RED (failing because code doesn't exist, not because of placeholders)

**Commit Point:** `test([scope]): add tests for [feature] (RED)`

---

### Step [N.2]: Implement [Behavior 1]

- [ ] Implement [specific function]
- [ ] Make `test_[behavior_1]()` pass
- [ ] Run: `[test command]`

**Acceptance:** Test GREEN, others still pass

**Commit Point:** `feat([scope]): implement [behavior_1] (GREEN)`

---

### Step [N.3]: Implement [Behavior 2]

- [ ] Implement [specific function]
- [ ] Make `test_[behavior_2]()` pass
- [ ] Run: `[test command]`

**Acceptance:** Test GREEN, others still pass

**Commit Point:** `feat([scope]): implement [behavior_2] (GREEN)`

---

### Step [N.4]: Learning Checkpoint

- [ ] Update TODO_PLAN with findings

**Notes:**
```
[LEARNINGS]

What worked:
-

Challenges:
-

Decisions:
-

Next time:
-
```

**Commit Point:** `docs([scope]): update TODO with [phase] learnings`
```

---

## Examples

### Good Phase (Small, Test-First)

```markdown
## PHASE 3: Password Validation 

**Goal:** Validate password strength before account creation

**Estimated:** 4 commits, 1 hour

### Step 3.1: Write Password Tests (SKELETON)

- [ ] Create `tests/unit/test_password.py`
- [ ] Write `test_password_min_length()` calling validate_length() with real assertions
- [ ] Write `test_password_has_number()` calling validate_has_number() with real assertions

**Tests Written:**

- `test_password_min_length` - Rejects passwords <8 chars
- `test_password_has_number` - Requires at least one digit

**Acceptance:** Both tests RED

**Commit:** `test(auth): add password validation tests (RED)`

---

### Step 3.2: Implement Min Length Check

- [ ] Add `validate_length()` to `auth/validators.py`
- [ ] Make `test_password_min_length()` pass

**Acceptance:** Test GREEN

**Commit:** `feat(auth): validate password minimum length (GREEN)`

---

### Step 3.3: Implement Number Requirement

- [ ] Add `validate_has_number()` to `auth/validators.py`
- [ ] Make `test_password_has_number()` pass

**Acceptance:** Test GREEN

**Commit:** `feat(auth): validate password has number (GREEN)`

---

### Step 3.4: Checkpoint

- [ ] Update TODO with learnings

**Notes:**
```
What worked: regex patterns from stdlib
Challenges: none
Decisions: Used re.search instead of parsing
```

**Commit:** `docs(auth): update TODO with validation learnings`
```

### Bad Phase (Large, Implementation-First)

```markdown
## PHASE 3: User Authentication

### Step 3.1: Implement Auth System

- [ ] Password validation
- [ ] Email validation
- [ ] Session management
- [ ] Token generation
- [ ] Password hashing
- [ ] Rate limiting
- [ ] 2FA support

**Commit:** feat(auth): implement authentication system
```

**Problems:**

- 7 features before commit = hours
- No tests mentioned
- No recovery points
- Too broad

---
