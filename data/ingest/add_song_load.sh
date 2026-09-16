#!/usr/bin/env bash
# 신곡 JSON 하나(또는 여럿) → 좌표 계산 → INSERT SQL → 실행 → 검증까지 한 번에.
# (Jira S15P21A405-376 의 add_song.py 를 감싸고, 테이블 이름은 S15P21A405-381 규약을 따른다)
#
#   bash ingest/add_song_load.sh song.json                 # SQL 만 만들고 멈춘다(기본)
#   ODY_APPLY=1 bash ingest/add_song_load.sh song.json     # DB 에 실제로 넣는다
#   ODY_MUSIC_TABLE=music_v2 ODY_APPLY=1 bash ingest/add_song_load.sh a.json b.json
#
# 전곡 파이프라인과 **같은 함수**를 쓴다(규칙 3, 재학습 없음):
#   extract_270 → serving_transform(skew·delta_f·impute·scaler·clip·PCA-16) → build_csv.music_row
# S5 제외 규칙 중 행 하나로 판정되는 것(R1·R3·R7·R10·R11·R13·R16·R17)은 add_song.py 가 검사하고
# 걸리면 중단한다. 전곡 파이프라인이 자를 곡을 단건으로 밀어 넣지 않기 위해서다.
#
# 하지 않는 것: genre·music_genre 링크, Neo4j 노드, map_sample 갱신.
# HNSW·GiST 인덱스는 INSERT 가 알아서 갱신한다 — 재빌드가 필요 없다.
set -euo pipefail

[ "$#" -ge 1 ] || { echo "사용: [ODY_APPLY=1] bash ingest/add_song_load.sh <lowlevel.json> [...]" >&2; exit 2; }

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(dirname "$HERE")"
PYTHON="${ODY_PYTHON:-$ROOT/.venv/Scripts/python.exe}"
[ -x "$PYTHON" ] || PYTHON="${ODY_PYTHON:-python3}"
CONTAINER="${ODY_PG_CONTAINER:-ody-postgres}"
MUSIC_TABLE="${ODY_MUSIC_TABLE:-music}"
STAMP="$(date +%Y%m%d_%H%M%S)"
OUT_DIR="${ODY_OUT_DIR:-$ROOT/output}"
SQL_LOCAL="$OUT_DIR/add_song_$STAMP.sql"
REPORT="$OUT_DIR/add_song_$STAMP.json"
mkdir -p "$OUT_DIR"

echo "== 1. 좌표 계산과 INSERT SQL 생성 ($MUSIC_TABLE)"
"$PYTHON" "$HERE/add_song.py" "$@" --out "$SQL_LOCAL" --table "$MUSIC_TABLE" | tee "$REPORT"

echo
echo "== 2. 만들어진 SQL"
sed -n '1,40p' "$SQL_LOCAL"

if [ "${ODY_APPLY:-0}" != "1" ]; then
  echo
  echo "SQL 만 만들었다: $SQL_LOCAL"
  echo "DB 에 넣으려면 ODY_APPLY=1 을 주고 다시 실행하거나, 이 파일을 DBeaver 에서 실행한다."
  exit 0
fi

echo
echo "== 3. DB 에 실행 — 컨테이너 $CONTAINER"
# SQL 은 파일로 옮겨 psql -f 로 넣는다. inline psql -c 는 따옴표 중첩으로 깨진 이력이 있다(2026-09-10).
REMOTE_SQL="/tmp/add_song_$STAMP.sql"      # 이전 실행 파일이 다른 소유자로 남으면 Permission denied 가 난다
docker cp "$SQL_LOCAL" "$CONTAINER:$REMOTE_SQL"
docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -f $REMOTE_SQL"

echo
echo "== 4. 검증 — 넣은 mbid 를 DB 에서 다시 읽는다"
MBIDS=$("$PYTHON" -c "
import io, json, sys
report = json.load(io.open(sys.argv[1], encoding='utf-8'))
print(','.join(\"'\" + s['mbid'] + \"'\" for s in report['songs']))
" "$REPORT")
docker exec -i "$CONTAINER" bash -lc "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"
  SELECT id, mbid, title, artist, release_year, album, album_mbid, bpm, duration,
         vector_dims(location) AS dims
  FROM $MUSIC_TABLE WHERE mbid IN ($MBIDS);\""

echo
echo "완료. SQL $SQL_LOCAL · 리포트 $REPORT"
echo "INSERT 는 mbid 가 이미 있으면 아무것도 넣지 않는다(멱등). 같은 JSON 을 두 번 돌려도 안전하다."
