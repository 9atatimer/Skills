# Writing a ci.magic rule

Read this before writing or reviewing a `ci.magic` assertion. It is part
of the gates skill, moved out of `SKILL.md` to keep that file inside its
word budget; the gates skill's ci.magic section points here.

**Writing a rule: match on context, never on presence.** A rule written
as "flag X" collides with prose doing its job; write it as "flag X in
context Y" from the start. GammaGo's first six rules took three review
rounds to stop failing compliant prose, every round the same mistake
([GammaGo issue#277](https://github.com/Nine-At-A-Time-Media/GammaGo/issues/277)).
A rule that fails correct prose pushes authors toward vaguer prose to
stay green -- worse than no rule.

- **Every term carries the condition that makes it a violation.** If the
  rule cannot state that condition, it is not ready to ship.
- **Negation is usually compliant.** Prose that denies the forbidden
  thing ("the world has no gods", "not supernatural") is the rule being
  followed. Exempt it explicitly.
- **Grep the tree for every term before listing it.** Case-insensitive
  `ORC` (a license) hit the creature Orc; `Pathfinder` (a brand) hit the
  ordinary noun.
- **Never build a prohibition list from a permission list.** A
  carve-out's list of what may be said is not a list of what may not be
  said elsewhere; inverting it fails the prose the carve-out describes.
- **Stance rules are not word lists.** A voice or register check states
  its test, then a permission list longer than the prohibition; it never
  degrades into vocabulary.
- **Write placement rules as whitelists.** "Mechanics live only in X and
  Y" catches a new zone nobody enumerated; "no mechanics in A, B, C" lets
  everything through an unlisted D. Blacklists are how a numeric value
  slips into prose the gate never named.
- **Scope judgment rules to the diff.** Tell the rule to evaluate only
  lines the PR adds or modifies, a file the PR adds being wholly in
  scope. Otherwise a rule landed beside an edit audits that file's whole
  history.
- **Prefer `pass` when ambiguous, and close by refusing scope** ("check
  nothing else"). An agent handed a rulebook without that line starts
  reviewing prose.
- **Fix the class, not the instance.** When review reports one false
  positive, ask what else the same rule shape catches. Patching only the
  reported term is what turns one round into three.
