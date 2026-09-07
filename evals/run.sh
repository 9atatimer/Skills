#!/usr/bin/env bash
# run.sh -- run the persona gauntlet (evals/promptfooconfig.yaml) through
# promptfoo, with telemetry, update checks, sharing, and remote generation
# off. Results land in evals/output/latest.json (gitignored).
#
# promptfoo is NOT a dependency of this package. Point PROMPTFOO_BIN at a
# built checkout (default: the 9atatimer/promptfoo fork beside this repo).
# Cache is off on purpose: promptfoo keys its cache on the prompt, and a
# persona edit does not change the prompt.
set -euo pipefail

here() { cd "$(dirname "${BASH_SOURCE[0]}")" && pwd; }

main() {
  local dir bin
  dir=$(here)
  bin=${PROMPTFOO_BIN:-"$HOME/workplace/9atatimer/promptfoo/dist/src/entrypoint.js"}
  if [[ ! -f "$bin" ]]; then
    echo "run.sh: promptfoo not found at $bin -- build the fork or set PROMPTFOO_BIN" >&2
    exit 1
  fi
  export PROMPTFOO_DISABLE_TELEMETRY=1 PROMPTFOO_DISABLE_UPDATE=1
  export PROMPTFOO_DISABLE_SHARING=1 PROMPTFOO_DISABLE_REMOTE_GENERATION=1
  mkdir -p "$dir/output"
  node "$bin" eval -c "$dir/promptfooconfig.yaml" -o "$dir/output/latest.json" --no-cache "$@"
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
  main "$@"
fi
