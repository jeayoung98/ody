#!/usr/bin/env bash
set -euo pipefail
# Runtime Docker inventory; no cleanup or mutation.
docker version
docker compose version
docker ps --format '{{.Names}} {{.Image}} {{.Status}}'
docker volume ls
docker network ls
