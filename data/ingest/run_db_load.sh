#!/usr/bin/env bash
# 파이프라인 끝에서 DB 까지 한 번에 (스펙 18, Jira S15P21A405-385).
#
#   S7 spark-submit (HDFS→HDFS CSV)  →  getmerge + 헤더  →  app-node 로 scp  →  load_postgres.sh (COPY)
#
# master-node(j15a405a)에서 실행한다. app-node(j15a405)에는 SSH 로 붙는다.
#
#   bash ingest/run_db_load.sh --expect-rows 4694202 --table music_v2 --link-table music_genre_v2
#
# JDBC 로 바로 INSERT 하지 않는 이유는 spark/jobs/db_load_csv.py 머리말에 있다(5432 미공개 + COPY 66초).
# 각 단계는 앞 단계가 성공해야 돈다. 중간에 실패하면 거기서 멈춘다.
set -euo pipefail

SPARK="${ODY_SPARK_SUBMIT:-/opt/spark/bin/spark-submit}"
HDFS_IN="${ODY_HDFS_DATA:-hdfs:///ody/data}"
HDFS_OUT="${ODY_HDFS_CSV:-$HDFS_IN/ingest_csv}"
STAGE_DIR="${ODY_STAGE_DIR:-/home/ubuntu/stage/ingest_csv}"   # /data 는 root 소유라 못 쓴다
APP_NODE="${ODY_APP_NODE:-ubuntu@j15a405.p.ssafy.io}"
APP_SSH_KEY="${ODY_APP_SSH_KEY:-$HOME/.ssh/J15A405T.pem}"
REMOTE_DIR="${ODY_REMOTE_DIR:-/tmp/ingest}"
MUSIC_TABLE="${ODY_MUSIC_TABLE:-music}"
LINK_TABLE="${ODY_LINK_TABLE:-music_genre}"
GENRE_TABLE="${ODY_GENRE_TABLE:-genre}"
EXPECT_ROWS=""
SKIP_SPARK=0
APPLY=0

while [ "$#" -gt 0 ]; do
  case "$1" in
    --expect-rows) EXPECT_ROWS="$2"; shift 2 ;;
    --table) MUSIC_TABLE="$2"; shift 2 ;;
    --link-table) LINK_TABLE="$2"; shift 2 ;;
    --genre-table) GENRE_TABLE="$2"; shift 2 ;;
    --skip-spark) SKIP_SPARK=1; shift ;;          # HDFS 에 CSV 가 이미 있을 때
    --apply) APPLY=1; shift ;;                    # 없으면 COPY 직전에 멈춘다
    *) echo "모르는 인자: $1" >&2; exit 2 ;;
  esac
done

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
STAMP="$(date +%Y-%m-%d)"
REPORT="$ROOT/output/spark_run_S7_$STAMP.json"

if [ "$SKIP_SPARK" = "0" ]; then
  echo "== 1. S7 제출 — CSV 를 $HDFS_OUT 에 쓴다"
  hdfs dfs -rm -r -f "$HDFS_OUT"        # saveAsTextFile 은 기존 경로가 있으면 실패한다
  "$SPARK" --master yarn --deploy-mode client \
    --num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g \
    --name ody-S7-ingest-csv \
    --py-files "$ROOT/ingest/build_csv.py" \
    "$ROOT/spark/jobs/db_load_csv.py" \
    --catalog "$HDFS_IN/catalog" --coords "$HDFS_IN/coords" \
    --meta "$HDFS_IN/v2_meta" --song-meta "$HDFS_IN/v2_song_meta" \
    --feats "$HDFS_IN/v2_feats" "$HDFS_IN/v2_feats_pilot" \
    --out "$HDFS_OUT" \
    ${EXPECT_ROWS:+--expect-rows "$EXPECT_ROWS"} \
    --report "$REPORT"
  echo "실행 증거: $REPORT"
else
  echo "== 1. S7 건너뜀 (--skip-spark)"
fi

echo "== 2. 파트 파일 합치고 헤더를 붙인다"
# 파트마다 헤더를 넣으면 COPY 가 그 줄을 데이터로 읽는다. 잡은 헤더 없이 쓰고 여기서 한 번만 붙인다.
mkdir -p "$STAGE_DIR"
header_of() { python3 -c "
import json, sys
print(json.load(open(sys.argv[1], encoding='utf-8'))['headers'][sys.argv[2]])
" "$REPORT" "$1"; }

for table in music genre music_genre neo4j_music; do
  target="$STAGE_DIR/$table.csv"
  rm -f "$target" "$target.body"
  hdfs dfs -getmerge "$HDFS_OUT/$table" "$target.body"
  header_of "$table" > "$target"
  cat "$target.body" >> "$target"
  rm -f "$target.body"
  echo "  $table.csv  $(wc -l < "$target") 줄 (헤더 포함)"
done

echo "== 3. app-node 로 전송 — $APP_NODE:$REMOTE_DIR"
ssh -i "$APP_SSH_KEY" "$APP_NODE" "mkdir -p $REMOTE_DIR"
scp -i "$APP_SSH_KEY" "$STAGE_DIR"/music.csv "$STAGE_DIR"/genre.csv "$STAGE_DIR"/music_genre.csv \
    "$APP_NODE:$REMOTE_DIR/"

if [ "$APPLY" = "0" ]; then
  echo
  echo "CSV 까지만 했다. COPY 는 --apply 를 줘야 돈다."
  echo "  ODY_MUSIC_TABLE=$MUSIC_TABLE ODY_LINK_TABLE=$LINK_TABLE bash ingest/run_db_load.sh --skip-spark --apply"
  exit 0
fi

echo "== 4. COPY — app-node 에서 load_postgres.sh"
LINKS=$(python3 -c "
import json, sys
print(json.load(open(sys.argv[1], encoding='utf-8'))['music_genre_rows'])
" "$REPORT")
MUSIC_ROWS=$(python3 -c "
import json, sys
print(json.load(open(sys.argv[1], encoding='utf-8'))['music_rows'])
" "$REPORT")
scp -i "$APP_SSH_KEY" "$ROOT/ingest/load_postgres.sh" "$APP_NODE:$REMOTE_DIR/"
ssh -i "$APP_SSH_KEY" "$APP_NODE" \
  "ODY_MUSIC_TABLE=$MUSIC_TABLE ODY_LINK_TABLE=$LINK_TABLE ODY_GENRE_TABLE=$GENRE_TABLE \
   ODY_EXPECT_MUSIC=$MUSIC_ROWS ODY_EXPECT_LINKS=$LINKS \
   bash $REMOTE_DIR/load_postgres.sh $REMOTE_DIR"

echo "완료. 지도 레이어는 따로다:"
echo "  psql -v music_tbl=$MUSIC_TABLE -v sample_tbl=map_sample_v2 -v l1_idx=${MUSIC_TABLE}_l1_gist -v l2_idx=${MUSIC_TABLE}_l2_gist -f build_map_layer.sql"
