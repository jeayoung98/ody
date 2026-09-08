#!/usr/bin/env bash
set -euo pipefail
# Read-only host/container resource snapshot.
hostname
free -m
nproc
df -h / /data
docker stats --no-stream --format '{{.Name}} CPU={{.CPUPerc}} MEM={{.MemUsage}}'
docker ps --format '{{.Names}} {{.Status}} {{.Ports}}'
# Resource observation instead of exposing Docker socket to a metrics container.
