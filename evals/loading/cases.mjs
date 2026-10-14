// cases.mjs -- the loading cases (skill-creator's method): for each skill,
// ten prompts that should load it and ten near-misses that should not.
// A near-miss belongs to a neighbouring skill, named in the comment, so a
// description that overreaches shows up as a falseLoad. Started with the
// four skills whose descriptions Skills PR#90 made overlap.

const yes = (skill, prompts) => prompts.map((prompt) => ({ skill, expect: true, prompt }));
const no = (skill, prompts) => prompts.map((prompt) => ({ skill, expect: false, prompt }));

export const CASES = [
  ...yes("gates", [
    "CI is red on my PR. What do I do?",
    "Copilot left five review comments on my pull request. How should I triage them?",
    "Can I lower the coverage threshold so my PR goes green?",
    "The review-settled status is failing on my PR. Why, and what now?",
    "How many times am I allowed to re-request a Copilot review on one PR?",
    "The gitleaks pre-commit hook fails because there's no docker daemon here. How do I commit?",
    "I fixed a typo Copilot flagged. Do I request another review?",
    "A review bot's finding looks wrong to me. How do I respond to it?",
    "Should a PR that only changes the README get a Copilot review?",
    "Copilot's review body has a 'Previously missed' section with no threads. Does it matter?",
  ]),
  ...no("gates", [
    "Push my branch to my fork and open a PR against upstream.", // github-workflow
    "Write unit tests for this parser.", // testing
    "Record the lesson from this bug in TODO_PLAN.md.", // todo-plan
    "Run a reviewer panel over my design doc draft.", // designomatic
    "Replace the em-dashes in this README with ASCII.", // markdown
    "What should I name my feature branch?", // github-workflow
    "Deploy this worker to production.", // release
    "File a GitHub issue for the bug I just found.", // github-workflow
    "Set up a terraform backend for this module.", // iac
    "Break this approved design into phased tasks.", // planning
  ]),
  ...yes("self-review", [
    "Review my diff for bugs before I open the PR.",
    "Run an adversarial review of the changes on my branch.",
    "I wrote this code. Check it for defects before Copilot sees it.",
    "Is Open Code Review set up as my review engine, and how do I bind it?",
    "How many review dimensions should I run on a 50-line change?",
    "Post the self-review ledger on my PR.",
    "A finder flagged a possible null dereference. How do I verify it before fixing?",
    "My self-review found a typo. Do I re-review after fixing it?",
    "My own review of my branch turned up twelve findings. How do I triage them?",
    "Review my changes to a skill file before I PR them.",
  ]),
  ...no("self-review", [
    "Copilot left comments on my PR. How do I handle them?", // gates
    "Get a reviewer panel's opinion on my design record.", // designomatic
    "Open a pull request for my branch.", // github-workflow
    "Write tests for the new endpoint first.", // testing
    "Make this markdown file ASCII-only.", // markdown
    "CI failed on my PR with a lint error.", // gates
    "Should we adopt this new library? Check the radar.", // tech-radar
    "Record the as-built for the component we just shipped.", // as-built
    "Run the retrospective for the feature that landed.", // retrospective
    "Turn the approved design into a task plan.", // planning
  ]),
  ...yes("github-workflow", [
    "Push my branch and open a PR.",
    "What's the branch naming rule for agents here?",
    "Set up my fork as origin and the main repo as upstream.",
    "File a GitHub issue for this defect.",
    "How do I link a PR in chat so it's unambiguous?",
    "My PR already merged but I have two more commits. What do I do with them?",
    "Should I open my PR as a draft?",
    "Which gh command creates the pull request?",
    "What goes in the body of a bug issue?",
    "My PR is green and approved. How does it land on a tedium repo?",
  ]),
  ...no("github-workflow", [
    "CI went red after my last push.", // gates
    "Copilot asked for changes on my PR. Triage them.", // gates
    "Adversarially review my diff before the PR.", // self-review
    "Review my design doc with a panel.", // designomatic
    "Write the failing test first for this bug.", // testing
    "Convert the curly quotes in this doc to straight ones.", // markdown
    "Ship this release to production.", // release
    "Add a Cloudflare R2 bucket in terraform.", // iac
    "Sequence these tasks with blocked_by.", // planning
    "The lint hook rejects my commit. How do I fix it?", // gates
  ]),
  ...yes("designomatic", [
    "Review my design doc draft before I ask a human to read it.",
    "Run a reviewer panel on docs/design/DESIGN.CACHE.md.",
    "Which panel do I use for a seam review?",
    "Get a second opinion on the design record I just wrote.",
    "My design draft promises nothing checkable. Test whether its goals are falsifiable.",
    "The panel run failed partway. Where are its outputs?",
    "Add a security-minded persona to our design review panel.",
    "Check my phase-3 seam map before I request approval.",
    "Is this early design sketch worth continuing? Give it a quick panel pass.",
    "Can an agent amend an APPROVED design record with the panel?",
  ]),
  ...no("designomatic", [
    "Write a design doc for the new sync feature.", // design
    "Review my code diff for bugs.", // self-review
    "Copilot reviewed my PR; triage its comments.", // gates
    "Open a PR for the design doc.", // github-workflow
    "Fix the em-dashes in the design doc.", // markdown
    "Write tests for the cache layer.", // testing
    "Name the seams this change adds.", // architecture
    "Break the approved design into phases.", // planning
    "Turn my rough idea into a statement of work.", // concept
    "Walk the frozen design against what shipped.", // retrospective
  ]),
  ...yes("lmde-daemons", [
    "Add a LaunchAgent so my local webhook listener starts at login and restarts if it crashes.",
    "My launchd service pops up Keychain password dialogs every time it restarts. How do I stop that?",
    "Where should a laptop daemon keep the API token it needs at login, when 1Password is still locked?",
    "Write the setup.sh install and uninstall for a new LMDE component.",
    "HAProxy under launchd tops out at about 100 connections. Why?",
    "Run the local model server under sandbox-exec so it cannot read ~/.ssh.",
    "My launcher script retries in a loop when its config file is missing. What should it do instead?",
    "cloudflared started a tunnel I did not expect when its token was empty. How should its launcher prevent that?",
    "I'm adding a second ollama instance on the laptop. How do I prove the everyday one is left alone?",
    "The sandbox profile looks right to me. Can the launcher skip the probe and just start the service?",
  ]),
  ...no("lmde-daemons", [
    "Add the Access application and service token for the laptop tunnel's hostname.", // lmde-tunnels
    "Build a Grafana dashboard for the gateway's request counts.", // lmde-dashboards
    "Mint a new Cloudflare API token for the deploy workflow.", // infra-credentials
    "Write the GitHub Actions workflow that deploys the worker to nonprod.", // release
    "Set up a Cloudflare Worker with a KV binding.", // cloudflare-hosting
    "Restructure this bash script into header, helpers and a main function.", // style-bash
    "Should we add Redis as a dependency? Check the radar first.", // tech-radar
    "Plan the terraform for a new R2 bucket.", // iac
    "Rotate the service-account token the CI workflow reads from 1Password.", // infra-credentials
    "Make the tunnel's ingress admit only /v1/models.", // lmde-tunnels
  ]),
  ...yes("lmde-tunnels", [
    "Expose my laptop's local API to GitHub Actions through a Cloudflare tunnel.",
    "Write the cloudflared ingress rules so only /v1/chat/completions gets through.",
    "Add a second consumer with its own service token to the laptop gateway's Access policy.",
    "Revoke the CI caller's access to the endpoint served from my laptop.",
    "Callers of my laptop endpoint get a 524 after 100 seconds on a cold model load. What should the route do?",
    "Which 1Password vault should the tunnel's run token go in?",
    "Can the Access policy in front of my laptop tunnel just use any_valid_service_token?",
    "What hostname should the new laptop webhook endpoint get, and does it need a nonprod tier?",
    "How do I check that the tunnel's origin port still reaches the proxy layer and not some other listener?",
    "The human just applied the new tunnel module. What do I verify, and how?",
  ]),
  ...no("lmde-tunnels", [
    "Give the cloudflared LaunchAgent a throttled restart on crash.", // lmde-daemons
    "Deploy the Nuxt app to Cloudflare Workers on a custom domain.", // cloudflare-hosting
    "Gate the preview Worker's hostname with Cloudflare Access.", // cloudflare-hosting
    "Move this terraform root to a new directory with an empty plan.", // iac
    "Keep the daemon's runtime credential in the Keychain without ever raising a dialog.", // lmde-daemons
    "Add a GitHub secret for the 1Password service account.", // infra-credentials
    "Diagnose why the deploy workflow's op:// reference resolves empty.", // release
    "Add an R2 bucket for the archive in terraform.", // iac
    "Sandbox the local inference server so it cannot read my home directory.", // lmde-daemons
    "Wire a Think chat assistant into the product's worker.", // cloudflare-think
  ]),
];
