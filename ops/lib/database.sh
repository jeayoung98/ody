#!/usr/bin/env bash
# Source-only runtime operations. Never echo credentials or resolved environment.
set -euo pipefail
db_role() {
    [[ "$(hostname -s)" == app-node && $EUID == 0 ]] || { echo 'ERROR: Run with sudo on app-node'; exit 1; }
    docker info >/dev/null
}
db_health() {
    local name="ody-$DB"
    for ((i=0;i<60;i++)); do
        state="$(docker inspect "$name" --format '{{if .State.Health}}{{.State.Health.Status}}{{end}}')"
        [[ "$state" != healthy ]] || return 0
        [[ "$state" != unhealthy ]] || { echo "ERROR: $name unhealthy; inspect server logs locally"; return 1; }
        sleep 5
    done
    echo "ERROR: $name did not become healthy within 300s"; return 1
}
db_verify() {
    [[ "$(docker inspect "ody-$DB" --format '{{.State.Health.Status}}')" == healthy ]]
    if [[ "$DB" == postgres ]]; then
        docker exec ody-postgres sh -c 'PGPASSWORD="$APP_DB_PASSWORD" psql -h postgres -U ody_app -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -c "SELECT 1;"'
    else
        docker exec ody-neo4j sh -c 'export NEO4J_USERNAME=neo4j NEO4J_PASSWORD="${NEO4J_AUTH#*/}"; cypher-shell -a bolt://neo4j:7687 "RETURN 1 AS connected;"'
    fi
    [[ "$(docker inspect "ody-$DB" --format '{{len .HostConfig.PortBindings}}')" == 0 ]]
    docker inspect "ody-$DB" --format 'image={{.Image}} health={{.State.Health.Status}} mounts={{range .Mounts}}{{.Name}}:{{.Destination}} {{end}}'
}
