#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../lib/database.sh"
DB=postgres
db_role
db_verify
backup="/var/backups/ody-infra/postgres/$(date -u +%Y%m%dT%H%M%S%NZ)"
install -d -m 0700 "$backup"
umask 077
docker exec ody-postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' >"$backup/ody.dump.partial"
docker exec -i ody-postgres pg_restore --list <"$backup/ody.dump.partial" >/dev/null
mv "$backup/ody.dump.partial" "$backup/ody.dump"
sha256sum "$backup/ody.dump" >"$backup/SHA256SUMS"
echo "PASS: backup $backup/ody.dump (no retention deletion)"
