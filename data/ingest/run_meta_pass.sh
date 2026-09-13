#!/usr/bin/env bash
# 메타데이터 재패스 30파트 — meta_pass.py 를 파트별로 돌린다 (스펙 18, Jira S15P21A405-291).
#
#   PAR=4 bash ingest/run_meta_pass.sh          # 전 파트, 4-way
#   bash ingest/run_meta_pass.sh 10 24          # 특정 파트만
#
# 멱등: work/meta_parts/meta_partN.parquet 이 있으면 그 파트를 건너뛴다. 죽여도 재실행하면 이어간다.
# 2026-09-13 실측: 단독 5.4분/파트, PAR=4 에서 13분/파트(디스크 I/O 병목). 30파트 약 2시간.
# 파트 순서는 run_v2_extract.sh 와 같다 — 큰 파트부터 돌려 꼬리 시간을 줄인다.
set -u
cd "$(dirname "$0")/.."
PY="${ODY_PYTHON:-.venv/Scripts/python.exe}"
W="${ODY_WORK:-$(pwd)/work}"
DUMP="${ODY_DUMP_DIR:-C:/abz_data/lowlevel}"
PAR="${PAR:-1}"
mkdir -p "$W/meta_parts" "$W/vlogs_meta"
DEFAULT_PARTS="24 25 1 2 3 4 27 12 23 8 20 28 5 26 10 11 6 9 7 13 19 21 22 18 0 16 15 17 14 29"
PARTS="${*:-$DEFAULT_PARTS}"
export PYTHONUTF8=1
printf '%s\n' $PARTS | xargs -P "$PAR" -I{} sh -c \
  "if [ -f '$W/meta_parts/meta_part{}.parquet' ]; then echo 'part-{} skip'; else \
   '$PY' -u ingest/meta_pass.py {} '$DUMP/acousticbrainz-lowlevel-json-20220623-{}.tar.zst' \
   '$W/meta_parts/meta_part{}.parquet' > '$W/vlogs_meta/part{}.log' 2>&1; echo \"part-{} rc=\$?\"; fi"
echo "META_PASS_DONE $(date '+%H:%M:%S')"
echo "다음: PYTHONUTF8=1 $PY ingest/meta_merge.py   (work/v2_meta.parquet 생성)"
