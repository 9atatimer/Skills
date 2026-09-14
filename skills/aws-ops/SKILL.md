---
name: aws-ops
description: "Operating what the fleet reaches through the AWS API surface: S3-compatible object storage on Cloudflare R2 through the AWS CLI and SDKs (endpoint, region auto, credential_process, profiles), a terraform s3 backend on R2, and the rules for a real AWS account should one come into use (OIDC federation over static keys, one role per workload, the state-bucket-plus-lock-table scaffold). Load with the infra skill whenever a task uses AWS_* credentials, an S3 URL, or the aws CLI, whichever cloud is actually behind it. Skip for R2 bucket and token provisioning (cloudflare-ops)."
---

# AWS-surface operations

> **Purpose:** the fleet holds no production workload on AWS today. It
> DOES speak the AWS API constantly: every R2 bucket is read and written
> through the S3 API, terraform's remote-state leaning is the `s3`
> backend on R2, and git mirrors ride `git-remote-s3`. The traps are the
> ones where AWS tooling assumes AWS. This skill names them, and states
> the rules for a real account so the first one is not improvised.

## R2 through the S3 API

- Endpoint `https://<account-id>.r2.cloudflarestorage.com`, region
  `auto`, path-style addressing. Every SDK and the CLI need all three;
  the CLI takes `--endpoint-url` per call or `endpoint_url` in the
  profile, and `region = auto` in `~/.aws/config`.
- The credential pair is derived from a Cloudflare API token (the
  cloudflare-ops skill): Access Key ID is the token ID, Secret Access
  Key is the SHA-256 of the token value. It is stored as a 1Password
  LOGIN item (`username` = key id, `password` = secret) so both fields
  survive the item category.
- Never write the pair into `~/.aws/credentials`. Use a named profile
  with `credential_process` pointing at a small script that reads the
  1Password item at call time and prints the JSON the CLI expects, or
  export `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` under `op run`
  for the one command that needs them.
- R2 has no IAM, no bucket policies, no KMS: authorization is the
  token's scope (bucket-level read or read+write), and that is all.
  Tooling that tries `GetBucketPolicy`, `PutBucketEncryption` or STS
  will fail and is not wrong to; ignore it or turn the feature off.
- Read-back proof after a credential is minted: `aws s3 ls
  s3://<bucket>/ --endpoint-url <endpoint>` lists (possibly nothing) on a
  live pair and returns `InvalidAccessKeyId` or `SignatureDoesNotMatch`
  on a bad one. The distinction names the fault: the first is the id,
  the second is the secret.

## Terraform state on R2

- Backend `s3` with `bucket`, `key = "<module>/terraform.tfstate"`,
  `region = "auto"`, the R2 endpoint, and the four skips
  (`skip_credentials_validation`, `skip_region_validation`,
  `skip_metadata_api_check`, and `force_path_style` on Terraform 1.5 or
  `use_path_style` on 1.6+ -- the backend is Terraform core, so the
  core version decides). No DynamoDB lock table exists on R2; locking
  is absent, so one machine at a time remains the rule.
- Under Terraform 1.5 the endpoint is the singular `endpoint`
  argument; the `endpoints = { s3 = ... }` attribute parses only on
  1.6+. A module that pins 1.5.6 and copies the attribute form fails at
  `init` with `Unsupported argument ... Did you mean "endpoint"?`.
- The backend credential arrives as `AWS_ACCESS_KEY_ID` /
  `AWS_SECRET_ACCESS_KEY` in the environment under `op run`; the
  backend block never holds them. A backend whose credential item does
  not exist fails BEFORE terraform starts and the module silently runs
  on local state through a gitignored `backend_override.tf`; say so in
  the module README and in the hand-off.
- Migrating a module onto the backend is `terraform init
  -migrate-state`, by the human, followed by a plan that must be empty.

## If a real AWS account comes into use

- **OIDC federation, never static keys, for CI.** A GitHub Actions job
  assumes a role through `aws-actions/configure-aws-credentials` with a
  trust policy scoped to the repo and the branch or environment; there
  is no long-lived secret to leak. An IAM user with access keys in a
  GitHub secret is the shape to refuse.
- **One role per workload per tier**, least privilege, no wildcard
  resources. The human's identity (SSO through IAM Identity Center)
  does the applying; no shared "admin" user.
- **State bucket plus lock table** is the standard bootstrap: a
  versioned, encrypted, public-access-blocked S3 bucket and a
  `PAY_PER_REQUEST` DynamoDB table keyed on `LockID`. The infra repo
  holds an unapplied scaffold for exactly this; it is a candidate
  answer to the state-backend question, not a decision.
- Region and account id are repository variables, never secrets; a
  role ARN is a variable too.
- Cost is a reliability signal: a budget alert before the first
  workload, not after the first bill.

## Verification without change

- `aws sts get-caller-identity` -- on real AWS, who you are. On R2 it
  fails; that failure is expected and proves nothing either way.
- `aws s3 ls`, `aws s3api head-bucket`, `aws s3api get-bucket-location`
  -- read-only, safe from an agent session with a read-scoped pair.
- `aws configure list --profile <p>` -- which credential source the
  CLI resolved, without printing the secret.

## Related

- the cloudflare-ops skill -- minting the R2 token the pair derives from
- the infra skill -- the state posture and who migrates it
- the infra-credentials skill -- item categories and the registry
- the release skill -- the workflow that consumes the pair
