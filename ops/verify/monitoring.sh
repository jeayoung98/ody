#!/usr/bin/env bash

set -euo pipefail

readonly HOST="$(hostname -s)"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

command -v curl >/dev/null 2>&1 || { echo "ERROR: curl is required." >&2; exit 1; }
command -v docker >/dev/null 2>&1 || { echo "ERROR: docker is required." >&2; exit 1; }

if [[ "${HOST}" == master-node ]]; then
    for container in ody-monitoring-prometheus-1 ody-monitoring-grafana-1 ody-monitoring-node-exporter-1; do
        [[ "$(docker inspect "${container}" --format '{{.State.Running}}')" == true ]] || {
            echo "ERROR: Monitoring container is not running: ${container}" >&2
            exit 1
        }
    done
    [[ "$(docker inspect ody-monitoring-prometheus-1 --format '{{.State.Health.Status}}')" == healthy ]]
    [[ "$(docker inspect ody-monitoring-grafana-1 --format '{{.State.Health.Status}}')" == healthy ]]

    curl -fsS http://127.0.0.1:9090/-/ready >/dev/null
    curl -fsS http://127.0.0.1:3000/api/health >/dev/null
    for job in node-master node-app spring-backend; do
        response="$(curl -fsS --get --data-urlencode "query=up{job=\"${job}\"}" http://127.0.0.1:9090/api/v1/query)"
        grep -Eq '"value"[[:space:]]*:[[:space:]]*\[[^]]*,[[:space:]]*"1"\]' <<<"${response}" || {
            echo "ERROR: Prometheus target is not UP: ${job}" >&2
            exit 1
        }
        echo "UP: ${job}"
    done
    python3 "${SCRIPT_DIR}/observability.py"
elif [[ "${HOST}" == app-node ]]; then
    [[ "$(docker inspect ody-app-monitoring-node-exporter-1 --format '{{.State.Running}}')" == true ]]
    curl -fsS --max-time 10 http://172.26.14.216:9100/metrics | grep '^node_cpu_seconds_total' >/dev/null
    echo "UP: app-node Node Exporter"
else
    echo "ERROR: Expected master-node or app-node, got ${HOST}." >&2
    exit 1
fi

echo "Monitoring runtime verification passed on ${HOST}."
