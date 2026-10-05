# [Name] -- architecture

> **Status:** DRAFT
> **Date:** YYYY-MM-DD
> **Authors:** [Names]
> **Implements:** [DESIGN.name.md](./DESIGN.name.md) (status: APPROVED)
> **As-built read:** `docs/arch/...` as of YYYY-MM-DD, or "none yet"

---

## Overview

_One paragraph: the shape of the mechanism. No capability the design did
not grant._

---

## Component diagram

```
+-------------+      +-------------+
| Component A |----->| Component B |
+-------------+      +-------------+
```

---

## Seams

| Axis of change | Seam | Kind (port / policy / parameter) | Why it is a seam |
|---|---|---|---|
| | | | |

---

## Module map

| Unit | Layer (domain / application / ports / adapters / composition root) | Runtime |
|---|---|---|
| | | |

One composition root per runtime: [list them].

---

## Use-case surface

Every row of the design's Behaviors table, by name, with its home.

| Design behavior | Use case (signature) | Ports |
|---|---|---|
| | | |

---

## Mechanism

### [Capability, as the design names it]

| Responsibility | Component | Seams crossed |
|---|---|---|
| | | |

---

## Parameters placed

| Design-named bound | Carried by | Supplied at |
|---|---|---|
| | (policy value / parameter set / store config) | (composition root / stage config) |

No values here. The as-built holds them.

---

## Operability

| Question | Answer |
|---|---|
| Release class | |
| Stages and platforms | |
| Rollout | |
| Rollback | |
| Data that cannot be rolled back | |
| Data warehouse | |

| Failure | Seen as | Debugged by |
|---|---|---|
| | | |

---

## Radar proposals

| Dependency | Ring proposed | Why |
|---|---|---|
| | | |

---

## Key Decisions

| Decision | Choice | Rationale |
|---|---|---|
| | | |

---

## Open Questions

- **Q1 [Question]** -- [context]

---

## Rejections

- **[Mechanism or seam]** -- [one-line reason]

---

## Related Documents

- [DESIGN.name.md](./DESIGN.name.md) -- the design this implements
- `docs/arch/` -- the as-built this was written against
