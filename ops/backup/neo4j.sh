#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../lib/database.sh"
DB=neo4j
db_role
[[ "${1:-}" == --offline ]] || { echo 'Usage: ops/backup/neo4j.sh --offline (explicit graph outage; schedule maintenance)'; exit 2; }
db_verify
backup="/var/backups/ody-infra/neo4j/$(date -u +%Y%m%dT%H%M%S%NZ)"
install -d -o 7474 -g 7474 -m 0700 "$backup"
# Community dump is offline. Always restore the prior running state on failure.
trap 'docker start ody-neo4j >/dev/null' EXIT
docker stop -t 60 ody-neo4j >/dev/null
docker run --rm --user 0 --hostname localhost --network none -v ody-neo4j-data:/data -v "$backup:/backups" neo4j:5.26.30-community neo4j-admin database dump neo4j --to-path=/backups
sha256sum "$backup/neo4j.dump" >"$backup/SHA256SUMS"
docker start ody-neo4j >/dev/null
db_health
db_verify
trap - EXIT
echo "PASS: backup $backup/neo4j.dump"
