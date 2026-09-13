---
name: gcp-ops
description: "Operating the fleet's Google Cloud estate through terraform and read-only verification: Application Default Credentials, one identity per workload per tier, Cloud Run services, Secret Manager read as a data source with versions seeded out of band, IAM bindings, project services, and logging-based metrics with alert policies and uptime checks. Load with the infra skill whenever a task touches a GCP resource. Skip for the container image or the service's code (coding, release)."
---

# GCP operations

> **Purpose:** the fleet runs a small number of services on Google Cloud
> (Cloud Run, with Secret Manager and Cloud Monitoring around them). The
> hazards are specific: a credential that reaches terraform through a
> variable, a secret version that lands in state, a second machine
> applying against an empty state, a project service disabled on
> destroy. This skill names them. The infra skill governs who applies.

## Authentication

- Terraform and `gcloud` authenticate through **Application Default
  Credentials**: `gcloud auth application-default login` on the laptop,
  or `GOOGLE_APPLICATION_CREDENTIALS` pointing at a service-account key
  file that never enters a repo. A module declares NO credentials
  variable: a variable invites a default, and a default puts a credential
  in git.
- Prefer a human's ADC for plans and applies (laptop only). A service
  account key is a long-lived credential; if one must exist for
  automation, it lives in a 1Password item, is minted by a human, and is
  scoped to one project and the minimum roles.
- Workload Identity Federation from GitHub Actions is the right shape
  for any future CI apply; static keys in GitHub secrets are not.
- Verify who you are before anything else: `gcloud auth list` and
  `gcloud config get-value project`. The active project is a foot-gun;
  set it per shell, never rely on a global default.

## Identity and blast radius

- One service account per service per tier, named for the service
  (`<service>` in nonprod, `<service>-prod` in production). It carries
  only the roles the service needs at run time; the human's identity
  does the applying.
- Tiers are separate roots over one shared module; tier-defining
  literals (service name, secret name, metric name) live in the tier
  root, not in variables with defaults.
- Project services (`google_project_service`) are owned by ONE tier root
  (nonprod), with `disable_on_destroy = false`. Two roots enabling the
  same API fight; a destroy that disables an API takes the other tier
  down with it.
- Projects are shared across systems today. A new system gets its own
  service account, secrets and IAM; it never reuses another system's.

## Secret Manager

- Terraform reads a secret as a **data source**
  (`data.google_secret_manager_secret`) and grants the service account
  `roles/secretmanager.secretAccessor` on it. Terraform never creates a
  `google_secret_manager_secret_version`: a version's payload would be
  written into state in cleartext.
- Versions are seeded out of band by the human from a 1Password item:
  `op read "op://<vault>/<item>/<field>" | tr -d '\n' | gcloud secrets
  versions add <secret> --data-file=-`. The `tr` matters: a trailing
  newline becomes part of the secret and breaks every comparison.
- A secret with more than one live holder (a Worker, a relay, a
  workflow) is rotated by adding a version and updating the 1Password
  item in place, then re-deploying every holder from that item. Never
  mint a second value for a second holder; they must agree.
- Grant the previous version's accessor during a rotation window
  (`..._previous_accessor`) so a rollback does not need a re-grant.

## Cloud Run

- `google_cloud_run_v2_service` with the image **digest-pinned**
  (`image@sha256:...`), never a floating tag; the artifact you verified
  is the artifact you ship.
- Ingress and invoker are explicit: a public relay has
  `roles/run.invoker` for `allUsers` and does its own authentication
  (a pre-shared key or a signed header); a private service has a named
  invoker and no public IAM.
- `min_instances = 0` is a cost choice with a latency cost; state the
  cold-start expectation in the module README so an alert threshold can
  be set honestly.
- Health probes reach the container only on the paths the service
  actually serves; an uptime check on a path the service routes
  elsewhere can never pass and is noise from day one.
- Rollback is a traffic split to the previous revision, not a rebuild:
  `gcloud run services update-traffic <svc> --to-revisions <rev>=100`.
  Know the previous revision name before the deploy.

## Monitoring

- A logging-based metric (`google_logging_metric`) over the service's
  error lines, an alert policy on its rate, and an uptime check on the
  health path with its own alert. Notification channels are inputs from
  `terraform.tfvars`, gitignored, never defaults.
- Every alert names a runbook section in the module README: symptom,
  first check, mitigation, escalation.
- A bill that doubled is an incident until explained; set a budget
  alert on the project.

## Verification without change

- `gcloud run services describe <svc> --region <r> --format json` --
  the live revision, image digest, service account, ingress.
- `gcloud secrets versions list <secret>` -- versions and their state,
  never the payload.
- `gcloud projects get-iam-policy <project>` -- who holds what.
- `gcloud monitoring uptime list-configs`, `gcloud alpha monitoring
  policies list` -- what is watched.
- `terraform state list` in the tier root on the laptop that holds it;
  a root with resources and an empty state is a missing state file, and
  a plan will create duplicates.
- An unauthenticated `curl` to a gated service proves the gate (`401`
  with the service's error shape), not the function.

## Related

- the infra skill -- where the modules live and who applies
- the infra-credentials skill -- the 1Password item behind every seeded
  version
- the release skill -- the deploy that ships the image and the
  behavior-first diagnosis of a red run
- the lmde-dashboards skill -- when the metric should also reach the
  permanent observability stack
