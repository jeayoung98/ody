#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../lib/database.sh"
DB=neo4j
db_role
dump="$(realpath -e "${1:?Usage: ops/restore/neo4j.sh /absolute/neo4j.dump ody-neo4j-restore-NAME}")"
volume="${2:?Provide a NEW restore volume}"
[[ "$volume" =~ ^ody-neo4j-restore-[a-z0-9-]+$ && "$(basename "$dump")" == neo4j.dump ]] || exit 2
if docker volume inspect "$volume" >/dev/null 2>&1; then echo 'ERROR: target volume exists; refusing overwrite'; exit 1; fi
docker volume create --label ody.restore=true "$volume" >/dev/null
docker run --rm --user 0 --hostname localhost --network none -v "$volume:/data" -v "$(dirname "$dump"):/backups:ro" neo4j:5.26.30-community neo4j-admin database load neo4j --from-path=/backups
echo "PASS: isolated restored volume=$volume. Production volume unchanged."
echo "Use a temporary no-published-port Neo4j container to verify the restored graph before cutover."
