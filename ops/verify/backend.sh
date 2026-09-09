#!/usr/bin/env bash

set -euo pipefail
# Read-only runtime verification; does not provision Nginx or containers.

readonly EXPECTED_HOST="app-node"
readonly NGINX_CONFIG="/etc/nginx/sites-available/backend"

if [[ "$(hostname -s)" != "${EXPECTED_HOST}" ]]; then
    echo "ERROR: This script must run on ${EXPECTED_HOST}." >&2
    exit 1
fi

for command_name in docker curl nginx grep; do
    command -v "${command_name}" >/dev/null 2>&1 || {
        echo "ERROR: Required command is missing: ${command_name}" >&2
        exit 1
    }
done

[[ -r "${NGINX_CONFIG}" ]] || { echo "ERROR: Cannot read ${NGINX_CONFIG}." >&2; exit 1; }

active_port="$(grep -oP 'server 127\.0\.0\.1:\K(8081|8082)(?=;)' "${NGINX_CONFIG}" | head -1)"
case "${active_port}" in
    8081) active_container=backend-blue ;;
    8082) active_container=backend-green ;;
    *) echo "ERROR: Invalid active port in ${NGINX_CONFIG}." >&2; exit 1 ;;
esac

echo "Active backend: ${active_container} on 127.0.0.1:${active_port}"
docker inspect "${active_container}" --format 'container={{.Name}} state={{.State.Status}} health={{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}} image={{.Config.Image}}'

if [[ "$(docker inspect "${active_container}" --format '{{.State.Running}}')" != "true" ]]; then
    echo "ERROR: Active backend container is not running." >&2
    exit 1
fi

if [[ "$(docker inspect "${active_container}" --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}')" != healthy ]]; then
    echo 'ERROR: Active container Docker health is not healthy.' >&2
    exit 1
fi
if [[ ${EUID} -eq 0 ]]; then nginx -t; else sudo -n nginx -t; fi

internal_health="$(curl -fsS "http://127.0.0.1:${active_port}/actuator/health")"
hello_response="$(curl -fsS "http://127.0.0.1:${active_port}/api/hello")"
public_base="http://127.0.0.1"
public_curl_args=()

if grep -Eq '^[[:space:]]*listen[[:space:]]+443' "${NGINX_CONFIG}"; then
    public_base="https://j15a405.p.ssafy.io"
    public_curl_args=(--resolve j15a405.p.ssafy.io:443:127.0.0.1)
fi

nginx_health="$(curl -fsS "${public_curl_args[@]}" "${public_base}/actuator/health")"
public_hello="$(curl -fsS "${public_curl_args[@]}" "${public_base}/api/hello")"

grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' <<<"${internal_health}"
grep -Eq '"status"[[:space:]]*:[[:space:]]*"UP"' <<<"${nginx_health}"
grep -Eq '"message"[[:space:]]*:[[:space:]]*"hello"' <<<"${hello_response}"
grep -Eq '"message"[[:space:]]*:[[:space:]]*"hello"' <<<"${public_hello}"

curl -fsS --max-time 10 "${public_curl_args[@]}" "${public_base}/actuator/prometheus" | grep '^jvm_memory_used_bytes' >/dev/null

printf 'Internal health: %s\nNginx health: %s\nHello: %s\n' "${internal_health}" "${nginx_health}" "${public_hello}"
echo "Backend verification passed."
if [[ -e /etc/ody/backend.env ]]; then
    docker inspect "$active_container" --format '{{json .NetworkSettings.Networks}}' | grep 'ody-internal' >/dev/null
    curl -fsS --max-time 10 "http://127.0.0.1:${active_port}/actuator/health/dependencies" | grep '"status":"UP"' >/dev/null
    echo 'PASS: active Backend DB profile, shared network, PostgreSQL/Neo4j health group.'
fi
