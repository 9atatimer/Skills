# Self-review -- the domain terms

Detail moved out of this skill's `SKILL.md`. Each section here is
named there with a summary; read the section when `SKILL.md` points to it.

## The domain

| Term | What it is | What it is not |
|---|---|---|
| **Change** | Repo, base SHA (the merge-base with the target branch), head SHA | A branch name; a moving ref is not reviewable |
| **Intent** | What the change is supposed to do, from a durable source: the issue, the design record, the PR description | Your plan, your reasoning, your transcript |
| **Rule set** | The per-file review checklist: the repo's committed rules plus the do-not-flag list | A persona |
| **Panel** | Two or three fresh-context panelists who each review the whole change, every defect class | Specialists who each own one class and never hear the others |
| **Lens** | The question a panelist keeps asking of the whole change, e.g. "what does someone acting on this do?" | A persona. Personas change tone, not accuracy |
| **Coverage** | The defect classes the pass must cover: correctness, security, intent compliance, tests. Audited at synthesis | The way the work is divided |
| **Finding** | Claim + location (`path:line`) + defect class + severity + evidence | A style preference, a question, a suggestion |
| **Stance** | One panelist's mark on one row of the synthesis table: agree, disagree or refine, with evidence | A vote that counts toward truth |
| **Decision** | The synthesis table after round 2: each row with its stances and status -- consensus, contested, or minority (Synthesis and the panel's decision) | A verdict. Only the verifier rules |
| **Evidence tier** | E0 asserted; E1 cited (quotes the lines that show the defect); E2 reproduced (a failing test or a command with its output) | A vote count. Ten reviewers agreeing on a nonexistent bug is still E0 |
| **Verdict** | The verifier's ruling on one row of the decision: upheld or dropped, with the reason | The author's opinion, or the panel's majority |
| **Disposition** | What the author did with an upheld finding: fixed (SHA), rebutted (with evidence), deferred (`pr-todo` issue), escalated (to the human) | Silence. Silently dropping a finding is forbidden |
| **Ledger** | Every finding with its verdict and disposition | The session transcript. The ledger goes on the PR |
