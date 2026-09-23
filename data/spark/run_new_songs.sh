#!/usr/bin/env bash
# 신곡 증분 — S1.5 → S2 → S3 → S5 를 YARN 에서 돌린다 (Jira S15P21A405-600, D20).
#
#   로컬(Windows):
#     .venv/Scripts/python.exe spark/prepare_new_songs.py --songs new/songs.csv --out-dir work/new_songs/<batch>
#     scp -i ~/.ssh/J15A405T.pem -r work/new_songs/<batch> ubuntu@j15a405a.p.ssafy.io:/home/ubuntu/stage/new_songs/
#   master-node:
#     bash ~/S15P21A405/data/spark/run_new_songs.sh <batch>
#     ODY_HDFS_DATA=hdfs:///ody/new_songs/<batch> bash ~/S15P21A405/data/ingest/run_db_load.sh --append --apply
#
# 전곡 경로와 다른 점
#   - S1 없음. 신곡은 제출본이 하나다. 입력은 prepare_new_songs.py 가 만든 raw.jsonl(S1.5 --from-raw)과 meta.parquet.
#   - S4 없음. node_paths 는 DB 로 가지 않는다. 지도 대표곡(map_sample) 재빌드는 이 범위 밖이다.
#   - S5 는 좌표를 S3 산출과 조인하고(--coords), R8·R15 분위는 전곡 catalog_input 에서 잰다(--quantile-base).
#     R5·R6 중복 접기는 배치 안에서만 본다 — 기존 곡과 같은 곡인지는 판정하지 않는다.
#   - 좌표 계산은 전곡과 같은 동결 번들(model_bundle.npz)이다. 재학습 없음(규칙 3).
set -euo pipefail

BATCH="${1:?배치 이름을 주세요 (stage/new_songs/<batch>)}"
SPARK="${ODY_SPARK_SUBMIT:-/opt/spark/bin/spark-submit}"
SPARK_CONF="${ODY_SPARK_CONF:---conf spark.ui.enabled=false}"   # Spark 4.2 + Jetty ee10 AmIpFilter 깨짐 회피
RES="--num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g"
LOCAL="${ODY_NEW_SONGS_DIR:-$HOME/stage/new_songs}/$BATCH"
HDFS="${ODY_HDFS_NEW_SONGS:-hdfs:///ody/new_songs}/$BATCH"
QUANTILE_BASE="${ODY_QUANTILE_BASE:-hdfs:///ody/data/catalog_input}"
BUNDLE="${ODY_BUNDLE_DIR:-$HOME/stage/bundle}"   # feature_list.json + model_bundle.npz. 드라이버가 읽는 로컬 경로
export PYSPARK_PYTHON=python3 PYSPARK_DRIVER_PYTHON=python3

HERE="$(cd "$(dirname "$0")" && pwd)"
JOBS="$HERE/jobs"
OUT="$(dirname "$HERE")/output"
mkdir -p "$OUT"

echo "== 0. 선행 조건"
for f in "$LOCAL/raw.jsonl" "$LOCAL/meta.parquet" "$LOCAL/album.parquet" "$BUNDLE/feature_list.json" "$BUNDLE/model_bundle.npz"; do
  [ -f "$f" ] || { echo "!! $f 없음" >&2; exit 1; }
done
hdfs dfs -test -e "$QUANTILE_BASE" || { echo "!! $QUANTILE_BASE 없음. 전곡 S5 입력이 있어야 분위를 잰다" >&2; exit 1; }
hdfs dfs -rm -r -f "$HDFS"
hdfs dfs -mkdir -p "$HDFS/raw" "$HDFS/meta" "$HDFS/album"
hdfs dfs -put -f "$LOCAL/raw.jsonl" "$HDFS/raw/"
hdfs dfs -put -f "$LOCAL/meta.parquet" "$HDFS/meta/"
hdfs dfs -put -f "$LOCAL/album.parquet" "$HDFS/album/"   # S7 --meta. album 만 있고 연도·앨범 MBID 는 비어 있다

# ponytail: 증거는 잡 로그만 남긴다(yarn app id 포함). 전곡 경로의 evidence json 이 필요해지면 run_cluster_parity.sh 의 evidence() 를 뽑아 공유한다.
submit() {   # submit <stage> <job.py 와 인자...>
  local stage="$1"; shift
  local log="$OUT/new_songs_${BATCH}_${stage}.log"
  echo "== $stage"
  # shellcheck disable=SC2086
  $SPARK --master yarn --deploy-mode client $SPARK_CONF $RES "$@" 2>&1 | tee "$log"
  local rc=${PIPESTATUS[0]}
  [ "$rc" = "0" ] || { echo "!! $stage 종료 코드 $rc — 멈춘다. 로그: $log" >&2; exit "$rc"; }
}

submit S1.5 "$JOBS/feature_select.py" --from-raw --in "$HDFS/raw" --out "$HDFS/features" --bundle "$BUNDLE"
submit S2 "$JOBS/preprocess.py" --in "$HDFS/features" --out "$HDFS/features_pre" --bundle "$BUNDLE"
submit S3 --py-files "$JOBS/preprocess.py" "$JOBS/pca.py" --in "$HDFS/features_pre" --out "$HDFS/coords" --bundle "$BUNDLE"
submit S5 "$JOBS/catalog_rules.py" --in "$HDFS/meta" --coords "$HDFS/coords" \
  --quantile-base "$QUANTILE_BASE" --out "$HDFS/catalog"

echo
echo "완료. 적재(기존 id 유지, MAX(id)+1 부터):"
echo "  ODY_HDFS_DATA=$HDFS bash $(dirname "$HERE")/ingest/run_db_load.sh --append --apply"
