#!/usr/bin/env bash
set -euo pipefail
source "$(dirname -- "${BASH_SOURCE[0]}")/../lib/database.sh"
DB=neo4j
db_role
db_verify
