#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../lib/database.sh"
DB=postgres
db_role
dump="$(realpath -e "${1:?Usage: ops/restore/postgres.sh /absolute/ody.dump ody_restore_NAME}")"
target="${2:?Provide a NEW restore database name}"
[[ "$target" =~ ^ody_restore_[a-z0-9_]+$ ]] || { echo 'ERROR: Only isolated ody_restore_* databases are allowed'; exit 1; }
docker exec -i ody-postgres pg_restore --list <"$dump" >/dev/null
# createdb fails if the target exists. Never --clean, never overwrites production.
docker exec ody-postgres sh -c 'createdb -U "$POSTGRES_USER" "$1"' sh "$target"
docker exec -i ody-postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$1" --exit-on-error --no-owner' sh "$target" <"$dump"
docker exec ody-postgres sh -c 'psql -U "$POSTGRES_USER" -d "$1" -v ON_ERROR_STOP=1 -c "SELECT 1;"' sh "$target"
echo "PASS: restored to isolated $target. Production is unchanged. Retained for inspection."
