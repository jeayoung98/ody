#!/usr/bin/env bash
# S1·S4·S5·S6 을 클러스터(YARN + HDFS)에서 순서대로 돌리고 증거 json 을 남긴다 (스펙 20 AC0, Jira S15P21A405-395).
#
#   master-node(j15a405a)에서:
#     bash ~/S15P21A405/data/spark/run_cluster_parity.sh            # 네 잡 전부
#     bash ~/S15P21A405/data/spark/run_cluster_parity.sh S5 S6      # 일부만
#
# 선행 조건 (없으면 시작 전에 멈춘다)
#   ~/stage/work/census_all.parquet        S1 입력. 로컬 work/ 에서 scp
#   ~/stage/work/catalog_input.parquet     S5 입력. 로컬에서 spark/build_catalog_input.py 로 만들어 scp
#   ~/stage/serving/v2.2-pca16/            기준 번들 전체(로컬 serving/v2.2-pca16 를 scp). 동결 파일 7개 +
#                                          manifest.json + coords_v2.parquet + map_tree/node_paths_v2.parquet.
#                                          S4 가 트리를, S6 조립이 동결 파일을, compare_bundle 이 대조 기준을 여기서 읽는다
#   hdfs:///ody/data/coords_v22            S4·S6 좌표 입력 (S7 v5 적재 때 올려둔 번들 좌표)
#
# 왜 coords_v22 인가: 클러스터 재계산 /ody/data/coords 는 번들과 최대 1.91e-06 다르다. 리프 배정 패리티를
# 번들의 node_paths_v2 와 100% 로 맞추려면 같은 좌표에서 시작해야 한다. ODY_HDFS_COORDS 로 바꿀 수 있다.
#
# S5 base 는 v2.1 번들 6,624,399곡이고 기대 제외는 v5 dry-run 값 1,930,196 이다(output/exclusion_dryrun.json).
# manifest 7,404,506 기준 누적 2,710,303 은 여기서 재현하지 않는다 — 그 곡들의 좌표가 번들에 없다.
set -euo pipefail

SPARK="${ODY_SPARK_SUBMIT:-/opt/spark/bin/spark-submit}"
SPARK_CONF="${ODY_SPARK_CONF:---conf spark.ui.enabled=false}"   # Spark 4.2 + Jetty ee10 AmIpFilter 깨짐 회피
RES="--num-executors 2 --executor-memory 4g --executor-cores 2 --driver-memory 2g"
HDFS="${ODY_HDFS_DATA:-hdfs:///ody/data}"
HDFS_COORDS="${ODY_HDFS_COORDS:-$HDFS/coords_v22}"
LOCAL_WORK="${ODY_WORK:-$HOME/stage/work}"
BUNDLE="${ODY_BUNDLE_DIR:-$HOME/stage/serving/v2.2-pca16}"
EXPECT_S1="${ODY_EXPECT_S1:-7404506}"
EXPECT_S5_EXCLUDED="${ODY_EXPECT_S5_EXCLUDED:-1930196}"
export PYSPARK_PYTHON=python3 PYSPARK_DRIVER_PYTHON=python3

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
JOBS="$HERE/jobs"
OUT="$ROOT/output"
STAMP="$(date +%Y-%m-%d)"
STAGES=("$@"); [ "${#STAGES[@]}" -gt 0 ] || STAGES=(S1 S4 S5 S6)
mkdir -p "$OUT"

want() { for s in "${STAGES[@]}"; do [ "$s" = "$1" ] && return 0; done; return 1; }

# 잡 stdout 의 마지막 JSON 줄 + yarn application -status 를 합쳐 증거 json 을 쓴다.
# client 모드는 드라이버가 죽어도 YARN 이 SUCCEEDED 로 남길 수 있다(2026-09-10 기록). 그래서 종료 코드와
# 잡이 찍은 행 수를 같이 본다. 종료 코드가 0 이 아니면 여기서 멈춘다.
evidence() {   # evidence <stage> <app-name> <log> <submitted-cmd> <started-epoch>
  local stage="$1" name="$2" log="$3" cmd="$4" started="$5"
  local app; app=$(yarn application -list -appStates ALL 2>/dev/null | awk -v n="$name" '$2==n{print $1}' | sort | tail -1)
  local status; status=$(yarn application -status "$app" 2>/dev/null || true)
  YARN_STATUS="$status" python3 - "$stage" "$app" "$log" "$cmd" "$started" "$OUT/spark_run_${stage}_$STAMP.json" <<'PY'
import json, os, re, sys, time
stage, app, log, cmd, started, out = sys.argv[1:7]
status = os.environ.get("YARN_STATUS", "")
def field(k):
    m = re.search(r"^\s*%s\s*:\s*(.*)$" % re.escape(k), status, re.M); return m.group(1).strip() if m else None
report = {}
for line in open(log, encoding="utf-8", errors="replace"):
    line = line.strip()
    if line.startswith("{") and line.endswith("}"):
        try: report = json.loads(line)
        except ValueError: pass
doc = {"stage": stage, "date": time.strftime("%Y-%m-%d"), "submitted": cmd,
       "yarn_application_id": app, "final_status": field("Final-State"), "yarn_state": field("State"),
       "queue": field("Queue"), "am_host": field("AM Host"),
       "executors": 2, "executor_memory": "4g", "executor_cores": 2, "driver_memory": "2g",
       "wall_clock_s": int(time.time()) - int(started), "job_report": report}
for k in ("input_path", "output_path", "input_rows", "output_rows", "rows", "excluded", "kept", "songs",
          "expected_rows", "rows_match", "expected_excluded", "excluded_match", "rows_outside_tree", "leaves_used"):
    if k in report: doc[k] = report[k]
try:
    s, f = int(field("Start-Time")), int(field("Finish-Time")); doc["duration_s"] = round((f - s) / 1000.0, 1)
except (TypeError, ValueError): pass
json.dump(doc, open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print("증거:", out, "|", doc["final_status"], "|", {k: doc[k] for k in ("output_rows", "rows", "excluded", "songs") if k in doc})
if doc["final_status"] != "SUCCEEDED": sys.exit("!! FinalStatus 가 SUCCEEDED 가 아니다")
PY
}

# <app-name> 은 잡 안의 SparkSession.appName 과 같아야 한다. --name 은 그것에 덮어써져 YARN 에 남지 않는다(S2 기록: ody-preprocess).
submit() {   # submit <stage> <app-name> <job.py> <job args...>
  local stage="$1" name="$2"; shift 2
  local log="$OUT/spark_run_${stage}_$STAMP.log"
  local cmd="$SPARK --master yarn --deploy-mode client $SPARK_CONF $RES --name $name $*"
  echo "== $stage 제출: $name"; echo "   $cmd"
  local started; started=$(date +%s)
  # shellcheck disable=SC2086
  $SPARK --master yarn --deploy-mode client $SPARK_CONF $RES --name "$name" "$@" 2>&1 | tee "$log"
  local rc=${PIPESTATUS[0]}
  [ "$rc" = "0" ] || { echo "!! $stage 종료 코드 $rc — 멈춘다. 로그: $log" >&2; exit "$rc"; }
  evidence "$stage" "$name" "$log" "$cmd" "$started"
}

hdfs_du() { hdfs dfs -du -s -h "$1" 2>/dev/null | awk '{print $1" "$2" (복제 포함 "$3" "$4")"}'; }

echo "== 0. 선행 조건"
for f in feature_list.json fit_manifest.json postprocess_rules.json manifest.json model_bundle.npz coords_v2.parquet \
         map_tree/tree.json map_tree/split_axes.npz map_tree/quality_by_depth.csv map_tree/node_paths_v2.parquet; do
  [ -f "$BUNDLE/$f" ] || { echo "!! $BUNDLE/$f 없음. 로컬 serving/v2.2-pca16/ 을 scp 로 올려라" >&2; exit 1; }
done
hdfs dfs -test -e "$HDFS_COORDS" || { echo "!! $HDFS_COORDS 없음. 번들 coords_v2.parquet 을 올려라" >&2; exit 1; }
upload_if_missing() {   # upload_if_missing <hdfs path> <local file>
  if hdfs dfs -test -e "$1"; then echo "  $1 있음 ($(hdfs_du "$1"))"
  elif [ -f "$2" ]; then echo "  $1 없음 → $2 업로드"; hdfs dfs -mkdir -p "$1"; hdfs dfs -put -f "$2" "$1/"
  else echo "!! $1 도 $2 도 없다" >&2; exit 1; fi
}
want S1 && upload_if_missing "$HDFS/census_all" "$LOCAL_WORK/census_all.parquet"
want S5 && upload_if_missing "$HDFS/catalog_input" "$LOCAL_WORK/catalog_input.parquet"

if want S1; then
  hdfs dfs -rm -r -f "$HDFS/manifest_rows"
  submit S1 ody-manifest-rows "$JOBS/manifest_rows.py" \
    --in "$HDFS/census_all" --out "$HDFS/manifest_rows" --expect-rows "$EXPECT_S1"
fi

if want S4; then
  hdfs dfs -rm -r -f "$HDFS/node_paths"
  # 트리 두 파일은 드라이버가 읽는다(client 모드, 로컬 경로). 축 값은 클로저에 실려 실행기로 간다.
  submit S4 ody-tree-assign "$JOBS/tree_assign.py" --in "$HDFS_COORDS" --out "$HDFS/node_paths" \
    --tree-json "$BUNDLE/map_tree/tree.json" --split-axes "$BUNDLE/map_tree/split_axes.npz"
fi

if want S5; then
  hdfs dfs -rm -r -f "$HDFS/catalog"
  submit S5 ody-catalog-rules "$JOBS/catalog_rules.py" \
    --in "$HDFS/catalog_input" --out "$HDFS/catalog" --expect-excluded "$EXPECT_S5_EXCLUDED" \
    --report "$OUT/spark_run_S5_${STAMP}_job.json"
fi

if want S6; then
  for need in "$HDFS/catalog" "$HDFS/node_paths"; do
    hdfs dfs -test -e "$need" || { echo "!! $need 없음. S5·S4 를 먼저 돌려라" >&2; exit 1; }
  done
  hdfs dfs -rm -r -f "$HDFS/bundle_stage"
  submit S6 ody-artifact-export "$JOBS/artifact_export.py" \
    --catalog "$HDFS/catalog" --coords "$HDFS_COORDS" --node-paths "$HDFS/node_paths" --out "$HDFS/bundle_stage"

  echo "== S6 조립 — 세 표를 내려 번들을 만들고 계약 검사"
  STAGE_LOCAL="$HOME/stage/bundle_stage"; rm -rf "$STAGE_LOCAL"; hdfs dfs -get "$HDFS/bundle_stage" "$STAGE_LOCAL"
  CANDIDATE="$HOME/stage/serving/v2.2-pca16-spark-candidate"; rm -rf "$CANDIDATE"
  python3 - "$HERE" "$STAGE_LOCAL" "$CANDIDATE" "$BUNDLE" "$OUT/spark_run_S5_${STAMP}_job.json" "$OUT/spark_run_S6_${STAMP}.json" "$STAMP" <<'PY'
import glob, io, json, os, sys
here, stage, candidate, bundle, s5_report, s6_evidence, stamp = sys.argv[1:8]
sys.path.insert(0, os.path.join(here, "jobs"))
import artifact_export as S6
s5 = json.load(io.open(s5_report, encoding="utf-8")) if os.path.exists(s5_report) else {}
catalog_parts = sorted(glob.glob(os.path.join(stage, "catalog", "*.parquet")))
manifest = S6.assemble_bundle(candidate, S6.single_parquet(os.path.join(stage, "coords")),
                              S6.single_parquet(os.path.join(stage, "node_paths")), bundle,
                              catalog_parts[0] if catalog_parts else "", s5.get("excluded", 0),
                              s5.get("rules_hash", ""), "v2.2-pca16-" + stamp)   # check_contract 의 버전 정규식에 맞춘다
compare = S6.compare_bundle(candidate, bundle)
doc = json.load(io.open(s6_evidence, encoding="utf-8"))
doc["assembled_bundle"] = candidate; doc["manifest_songs"] = manifest["songs"]; doc["compare_bundle"] = compare
json.dump(doc, io.open(s6_evidence, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
print(json.dumps(compare, ensure_ascii=False))
if not compare["pass"]: sys.exit("!! compare_bundle 불통과")
PY
  python3 "$ROOT/tests/check_contract.py" "$CANDIDATE" --strict
  echo "번들: $CANDIDATE (승격·CURRENT.json 교체는 사람이 한다)"
fi

echo
echo "완료. 증거: $OUT/spark_run_{${STAGES[*]// /,}}_$STAMP.json — 로컬로 가져와 커밋한다."
