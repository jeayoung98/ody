#!/usr/bin/env bash

set -euo pipefail
# Read-only Jenkins deployment prerequisite verification.

readonly EXPECTED_HOST="master-node"
readonly JAVA17_HOME="/usr/lib/jvm/java-17-openjdk-amd64"
readonly SSH_KEY="/var/lib/jenkins/.ssh/app_deploy"
readonly DEPLOY_TARGET="ubuntu@app-node"
readonly APP_DIR="/home/ubuntu/S15P21A405"

if [[ "$(hostname -s)" != "${EXPECTED_HOST}" ]]; then
    echo "ERROR: This script must run on ${EXPECTED_HOST}." >&2
    exit 1
fi

for command_name in docker ssh systemctl; do
    command -v "${command_name}" >/dev/null 2>&1 || {
        echo "ERROR: Required command is missing: ${command_name}" >&2
        exit 1
    }
done

[[ -x "${JAVA17_HOME}/bin/java" ]] || { echo "ERROR: Java 17 is missing." >&2; exit 1; }
"${JAVA17_HOME}/bin/java" -version 2>&1 | grep -Eq 'version "17([.]|")'

systemctl is-active --quiet jenkins || { echo "ERROR: Jenkins is not active." >&2; exit 1; }
[[ -r "${SSH_KEY}" ]] || { echo "ERROR: Jenkins deploy key is not readable by current user." >&2; exit 1; }
[[ -s /var/lib/jenkins/.ssh/known_hosts ]] || { echo "ERROR: Jenkins known_hosts is missing." >&2; exit 1; }

docker ps >/dev/null

ssh \
    -i "${SSH_KEY}" \
    -o BatchMode=yes \
    -o StrictHostKeyChecking=yes \
    "${DEPLOY_TARGET}" \
    "test \"\$(hostname -s)\" = app-node && command -v docker >/dev/null && test -x '${APP_DIR}/deploy.sh'"

echo "CI/CD prerequisites passed for the current user."
echo "Run this script as Jenkins to validate Jenkins permissions: sudo -u jenkins $0"
