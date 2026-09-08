#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ "$(hostname -s)" == master-node && $EUID == 0 ]] || { echo 'ERROR: Run with sudo on master-node'; exit 1; }
scenario="${1:-smoke}"
case "$scenario" in smoke|baseline|load|zero-downtime) ;; *) exit 2;; esac
bash "$ROOT/ops/verify/monitoring.sh"
curl -fsS --max-time 10 "${BASE_URL:-https://j15a405.p.ssafy.io}/actuator/health" | grep '"status":"UP"' >/dev/null
result="/var/backups/ody-infra/performance/$(date -u +%Y%m%dT%H%M%S%NZ)-$scenario"
install -d -m 0755 "$result"
args=(run --summary-export /results/summary.json "/scripts/$scenario.js")
# Base URL is private traffic from master; no production credentials are passed to k6.
k6run() {
    docker run --rm --user 0 --network host -v "$ROOT/infra/k6:/scripts:ro" -v "$result:/results" \
        -e BASE_URL="${BASE_URL:-https://j15a405.p.ssafy.io}" -e API_PATH="${API_PATH:-/api/hello}" \
        -e DURATION="${DURATION:-60s}" grafana/k6:2.2.0 "${args[@]}"
}
if [[ "$scenario" == zero-downtime ]]; then
    image="${2:?Provide tested backend image tag for the deployment during traffic}"
    [[ "$image" =~ ^backend:[A-Za-z0-9_.-]+$ ]] || exit 2
    key=/var/lib/jenkins/.ssh/app_deploy
    sshcmd=(sudo -u jenkins ssh -i "$key" -o BatchMode=yes -o StrictHostKeyChecking=yes ubuntu@app-node)
    "${sshcmd[@]}" "docker image inspect '$image' --format '{{.Id}}'; grep 'server 127.0.0.1:' /etc/nginx/sites-available/backend" >"$result/before.txt"
    k6run >"$result/k6.log" 2>&1 &
    load_pid=$!
    sleep 10
    if ! "${sshcmd[@]}" "cd /home/ubuntu/S15P21A405 && ./backend/deploy.sh '$image'" >"$result/deploy.log" 2>&1; then
        wait "$load_pid" || true
        echo "FAIL: deployment; inspect $result"; exit 1
    fi
    wait "$load_pid"
    "${sshcmd[@]}" "docker ps --format '{{.Names}} {{.Image}} {{.Status}}'; grep 'server 127.0.0.1:' /etc/nginx/sites-available/backend" >"$result/after.txt"
    # The port must change, not just remain healthy.
    before="$(grep -o '127.0.0.1:808[12]' "$result/before.txt")"
    after="$(grep -o '127.0.0.1:808[12]' "$result/after.txt")"
    [[ "$before" != "$after" ]]
else
    k6run >"$result/k6.log" 2>&1
fi
echo "PASS: $scenario; artifacts: $result"
cat "$result/summary.json"
