# IaC root layout and tiers

Detail moved out of this skill's SKILL.md. Each section here is named there with a summary; read the section when SKILL.md points to it.

## Root module per concern; the tier is a directory

- One root module per concern (`ops/terraform/<concern>/`), each with
  its own providers, variables, README, and state. Do not grow one root
  into a whole account: blast radius and authority differ per concern,
  and a token loaded for one concern should not be loaded for another.
- **A tier is the directory you run in, not a flag you pass.** For
  anything with its own credentials, identities, or failure metrics per
  tier, lay out `<concern>/modules/<shared>/`, `<concern>/preview/`,
  `<concern>/prod/`; each root has its own state, its own gitignored
  `terraform.tfvars`, its own `.terraform/`. There is no `-var stage=`
  and no workspace to select, because both are things you can get wrong
  silently. To touch production you change directory, and that is the
  whole gate. Run with `-chdir` so the scrollback records the tier and a
  later command cannot inherit a directory you forgot.
- The tier-defining values (service name, secret id, metric name) are
  LITERALS in each root's `main.tf`, deliberately not variables. A tier
  you can repoint from a gitignored tfvars is a tier you can repoint by
  accident.
- A single cheap resource per stage inside one root (a route, a
  namespace) may use `count` on a boolean. The boolean is a committed
  DEFAULT, never a `-var` at the command line: with the flag supplied
  ephemerally, the next bare apply sees it false and DESTROYS the
  production resource with nobody having asked.
- Say what the tiers still share (a project, an image digest, an
  upstream) in the README before an incident rather than during one.
