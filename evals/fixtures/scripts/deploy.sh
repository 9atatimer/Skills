#!/usr/bin/env bash
# deploy.sh -- GAUNTLET FIXTURE, deliberately vulnerable. Never run this.
# The security-engineer persona is asked to fix the injection on the ssh
# line: BRANCH arrives from a PR title and is interpolated unquoted into a
# remote command.
set -euo pipefail

BRANCH="${1:?branch required}"

ssh prod "cd /srv/tedium && git fetch && git checkout $BRANCH && systemctl restart tedium"
