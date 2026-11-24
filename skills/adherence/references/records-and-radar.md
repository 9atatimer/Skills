# Adherence -- records and radar

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

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
- **Renaming a behavior is removing it.** Record kept matches rows by
  name, so a row renamed to fit a changed check lowers the change (tds-utils
  PR#723, the Two jobs row). Keep the old row, say in it which row
  supersedes it and which Key Decisions row ruled, and add the new row
  beside it: an approved record only grows.
- **Never count the record's own parts in prose.** "Nine qualities" in
  the overview, the Domain Language and a Key Decisions row each went
  stale when the tenth landed, and nothing mechanical reads a count. Name
  the set, or point at the table that holds it.
- **One radar.** A repository whose dependencies the fleet's radar rings
  carries a row for each in its own radar, at the fleet's ring, naming the
  fleet as the source (Key Decisions, One radar, carrying the fleet's
  packages).
- **When a check reading a record finds a gap**, fix the record (through
  its own phase and review) or the code. Never edit the declaration to
  stop the check reading the record.
