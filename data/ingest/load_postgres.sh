#!/usr/bin/env bash
# 스펙 18 적재 2단계 — CSV 를 ody DB 에 COPY (Jira S15P21A405-209)
#
# 2026-09-10 에 실제로 돌려서 성공한 절차다. 실측:
#   - CSV 전송 2.72 GB → app-node 9분 18초
#   - COPY music 6,624,399행 66초, music_genre 71,285행 0.12초, genre 29행 2ms
#   - music 테이블 1,518 MB, DB 전체 1,532 MB
#   - 컨테이너 자원은 재시작 없이 올렸다: docker update --memory 4g --cpus 2 ody-postgres
#
# 처음 두 번은 실패했다. 원인과 해결을 그대로 남긴다:
#   1. inline psql -c 의 따옴표 중첩 → 경로가 큰따옴표로 나가 syntax error.
#      해결: SQL 을 파일로 쓰고 psql -f 로 실행한다.
#   2. title 이 빈 문자열인 곡 3,977개 → COPY 가 NULL 로 넣어 NOT NULL 위반.
#      해결: FORCE_NOT_NULL (title). 빈 문자열을 그대로 넣는다.
#   3. HNSW 병렬 빌드가 /dev/shm 64MB 를 넘겨 "could not resize shared memory segment".
#      해결: SET max_parallel_maintenance_workers = 0. shm-size 를 늘리려면 컨테이너 재생성이 필요하다.
#
# 2026-09-11 에 배운 것 둘:
#   4. 특징은 work/v2_feats 와 work/v2_feats_pilot 두 곳에 나뉘어 있다(D16).
#      한쪽만 읽으면 786,903행이 빠진다. build_csv.py 가 이제 둘 다 읽는다.
#   5. 적재가 끝난 뒤 컬럼 하나를 고치려고 733k 행을 UPDATE 하면 HNSW·GiST 유지 비용이 지배해
#      30분이 지나도 안 끝난다. 인덱스를 내리고 UPDATE 한 뒤 다시 만드는 편이 빠르다
#      (UPDATE 2분 + GiST 21초 x2 + HNSW 65분). **처음부터 CSV 를 맞게 만드는 것이 가장 싸다.**
#
# 사용법 (master 아니라 app-node 에서):
#   scp -i ~/.ssh/J15A405T.pem music.csv genre.csv music_genre.csv ubuntu@j15a405.p.ssafy.io:/tmp/ingest/
#   bash load_postgres.sh /tmp/ingest
#
# 재적재본을 새 테이블에 넣을 때 (스펙 18, Jira S15P21A405-381):
#   먼저 ingest/music_v2.sql 로 테이블을 만들고,
#   ODY_MUSIC_TABLE=music_v2 ODY_LINK_TABLE=music_genre_v2 \
#   ODY_EXPECT_MUSIC=<리포트의 music_rows> ODY_EXPECT_LINKS=<리포트의 music_genre_rows> \
#     bash load_postgres.sh /tmp/ingest
#   기대 행 수는 build_csv.py 리포트(output/db_ingest_csv_<날짜>.json)의 값을 그대로 넣는다.
set -euo pipefail

CSV_DIR="${1:?CSV 디렉터리를 주세요}"
CONTAINER="${ODY_PG_CONTAINER:-ody-postgres}"

# 테이블 이름과 기대 행 수는 밖에서 준다. 기본값은 지금 운영 중인 이름이다.
MUSIC_TABLE="${ODY_MUSIC_TABLE:-music}"
GENRE_TABLE="${ODY_GENRE_TABLE:-genre}"
LINK_TABLE="${ODY_LINK_TABLE:-music_genre}"
EXPECT_MUSIC="${ODY_EXPECT_MUSIC:-6624399}"
EXPECT_GENRE="${ODY_EXPECT_GENRE:-29}"
EXPECT_LINKS="${ODY_EXPECT_LINKS:-71285}"
HNSW_INDEX="${MUSIC_TABLE}_location_hnsw_idx"
L1_INDEX="${MUSIC_TABLE}_l1_gist"
L2_INDEX="${MUSIC_TABLE}_l2_gist"

run_sql() { docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -q -c \"$1\""; }
psql_value() { docker exec -i "$CONTAINER" bash -lc "psql -tA -U \$POSTGRES_USER -d \$POSTGRES_DB -c \"$1\"" | tr -d '\r'; }

# 신곡 증분(S15P21A405-600) — ODY_APPEND=1. 기존 행·id·인덱스를 건드리지 않고 music.csv 의 새 곡만 더한다.
#   - 이미 있는 mbid 는 건너뛴다. 같은 CSV 를 두 번 넣어도 행이 늘지 않는다.
#   - 새로 들어갈 행의 id 가 전부 현재 MAX(id) 보다 커야 한다. 아니면 S7 을 --id-start MAX(id)+1 로 다시 돌린다.
#     그 사이 BE 나 add_song.py 가 곡을 넣었으면 여기서 걸린다(잠금 안에서 검사한다).
#   - HNSW·GiST 는 INSERT 가 갱신한다. 재빌드하지 않는다. genre·music_genre·map_sample 은 범위 밖이다.
if [ "${ODY_APPEND:-0}" = "1" ]; then
  echo "== A. 증분 적재 — $MUSIC_TABLE 에 새 곡만 INSERT"
  docker cp "$CSV_DIR/music.csv" "$CONTAINER:/tmp/music.csv"
  APPEND_SQL="/tmp/append_$(date +%s).sql"   # 이전 실행 파일과 소유자가 다르면 덮어쓰기가 막힌다. 매번 새 이름.
  docker exec -i "$CONTAINER" bash -lc "cat > $APPEND_SQL" <<SQL
\timing on
BEGIN;
LOCK TABLE $MUSIC_TABLE IN SHARE ROW EXCLUSIVE MODE;
CREATE TEMP TABLE music_stage (LIKE $MUSIC_TABLE INCLUDING DEFAULTS) ON COMMIT DROP;
COPY music_stage (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid)
  FROM '/tmp/music.csv' WITH (FORMAT csv, HEADER true, FORCE_NOT_NULL (title));
DELETE FROM music_stage s USING $MUSIC_TABLE m WHERE m.mbid = s.mbid;
DO \$\$ DECLARE lo bigint; hi bigint; n bigint; BEGIN
  SELECT min(id), count(*) INTO lo, n FROM music_stage;
  SELECT coalesce(max(id), 0) INTO hi FROM $MUSIC_TABLE;
  RAISE NOTICE 'new rows %, stage min id %, table max id %', n, lo, hi;
  IF n > 0 AND lo <= hi THEN
    RAISE EXCEPTION 'stage min id % <= $MUSIC_TABLE max id %. S7 을 --id-start % 로 다시 돌린다', lo, hi, hi + 1;
  END IF;
END \$\$;
INSERT INTO $MUSIC_TABLE (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid)
  SELECT id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid
  FROM music_stage;
COMMIT;
SQL
  docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -f $APPEND_SQL"
  run_sql "SELECT count(*) AS rows, max(id) AS id_max FROM $MUSIC_TABLE;"
  echo "완료. 지도 대표곡(map_sample)에는 build_map_layer.sql 을 다시 돌리기 전까지 나오지 않는다."
  exit 0
fi

echo "== 0. 적재 전 상태 ($MUSIC_TABLE · $GENRE_TABLE · $LINK_TABLE)"
run_sql "SELECT '$MUSIC_TABLE' AS t, count(*) FROM $MUSIC_TABLE UNION ALL SELECT '$GENRE_TABLE', count(*) FROM $GENRE_TABLE UNION ALL SELECT '$LINK_TABLE', count(*) FROM $LINK_TABLE;"

# 재적재(D17) — 이 스크립트의 본 경로는 빈 테이블에 COPY 한다. 행이 있으면 중복 적재가 되므로 멈춘다.
# 다시 채우려면 사람이 ODY_ALLOW_RELOAD=1 을 주고 실행한다. 그때는 TRUNCATE 가 아니라 **UPDATE 조인**이다:
#   - BE 의 playlist_item 이 music 을 FK 로 참조해서 TRUNCATE 가 막힌다(2026-09-13 실측). CASCADE 는 플레이리스트를 지운다.
#   - CSV 를 임시 테이블에 COPY 하고 id 로 조인해 album·release_year·album_mbid·bpm 네 컬럼만 덧씌운다.
#     기존 행·play_cnt·youtube_cnt·BE 가 추가한 곡·genre·music_genre 는 그대로다. id 는 mbid 순이라 CSV 와 DB 가 같다(D13).
#   - UPDATE 중 인덱스 유지 비용을 피하려고 HNSW·GiST 를 내리고 GiST 는 바로 다시 만든다(각 21초). HNSW 는 7단계에서.
#   - location 은 바꾸지 않는다. map_sample 도 그대로다.
#   ⚠️ 제외 규칙이 바뀌어 곡 수가 달라졌으면 이 경로를 쓰면 안 된다. id 가 전부 밀려 다른 곡에 값이 들어간다.
#      그때는 새 테이블(music_v2)에 빈 상태로 COPY 한다.
EXISTING=$(psql_value "SELECT count(*) FROM $MUSIC_TABLE;" | tr -d '[:space:]')
RELOAD=0
if [ "${EXISTING:-0}" != "0" ]; then
  if [ "${ODY_ALLOW_RELOAD:-0}" != "1" ]; then
    echo "!! $MUSIC_TABLE 에 ${EXISTING} 행이 있다. 재적재면 ODY_ALLOW_RELOAD=1 bash load_postgres.sh <dir> 로 다시 실행한다. 중단." >&2
    exit 1
  fi
  RELOAD=1
  echo "== 0b. 재적재 모드 — $MUSIC_TABLE ${EXISTING}행에 UPDATE 조인 (album·release_year·album_mbid·bpm). $GENRE_TABLE·$LINK_TABLE 는 건드리지 않는다"
  docker cp "$CSV_DIR/music.csv" "$CONTAINER:/tmp/music.csv"
  RELOAD_SQL="/tmp/reload_$(date +%s).sql"   # 컨테이너 /tmp 에 남은 이전 파일과 소유자가 다르면 덮어쓰기가 막힌다. 매번 새 이름.
  docker exec -i "$CONTAINER" bash -lc "cat > $RELOAD_SQL" <<SQL
\timing on
SET maintenance_work_mem = '2GB';
SET max_parallel_maintenance_workers = 0;
CREATE TEMP TABLE music_stage (LIKE $MUSIC_TABLE INCLUDING DEFAULTS);
COPY music_stage (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid)
  FROM '/tmp/music.csv' WITH (FORMAT csv, HEADER true, FORCE_NOT_NULL (title));
SELECT count(*) AS stage_rows FROM music_stage;
DROP INDEX IF EXISTS $HNSW_INDEX;
DROP INDEX IF EXISTS $L1_INDEX;
DROP INDEX IF EXISTS $L2_INDEX;
UPDATE $MUSIC_TABLE m
   SET album = s.album, release_year = s.release_year, album_mbid = s.album_mbid, bpm = s.bpm
  FROM music_stage s
 WHERE m.id = s.id AND m.mbid = s.mbid;
CREATE INDEX $L1_INDEX ON $MUSIC_TABLE USING gist (point((location::real[])[1], (location::real[])[2]));
CREATE INDEX $L2_INDEX ON $MUSIC_TABLE USING gist (point((location::real[])[3], (location::real[])[4]));
VACUUM ANALYZE $MUSIC_TABLE;
SQL
  docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -f $RELOAD_SQL"
fi

if [ "$RELOAD" = "0" ]; then
echo "== 1. CSV 를 컨테이너로"
for f in music.csv genre.csv music_genre.csv; do
  docker cp "$CSV_DIR/$f" "$CONTAINER:/tmp/$f"
done

echo "== 1b. genre 대조 — build_csv 의 genre.csv 와 DB 의 $GENRE_TABLE 이 같아야 한다"
# build_csv 는 '적재 대상 곡에 등장하는 코드를 정렬해 1부터' 로 genre id 를 매긴다. 제외 규칙이 바뀌어
# 코드 하나가 통째로 사라지면 그 뒤 id 가 전부 밀리고, 곡-장르 링크가 조용히 어긋난 채 들어간다.
DB_GENRE=$(psql_value "SELECT id || ',' || name FROM $GENRE_TABLE ORDER BY id;")
CSV_GENRE=$(tail -n +2 "$CSV_DIR/genre.csv" | tr -d '\r')
if [ -n "$DB_GENRE" ] && [ "$DB_GENRE" != "$CSV_GENRE" ]; then
  echo "!! genre.csv 와 $GENRE_TABLE 의 (id,name) 이 다르다. 링크가 어긋난다 — 장르도 새 테이블에 적재해야 한다. 중단." >&2
  diff <(echo "$DB_GENRE") <(echo "$CSV_GENRE") | head -20 >&2
  exit 1
fi

echo "== 2. HNSW 인덱스 드롭 (적재 후 다시 만든다)"
run_sql "DROP INDEX IF EXISTS $HNSW_INDEX;"

echo "== 3. COPY — SQL 을 파일로 만들어 psql -f 로 넣는다(따옴표 중첩 회피)"
COPY_SQL="/tmp/copy_$(date +%s).sql"   # 이전 실행 파일이 다른 소유자로 남으면 Permission denied 가 난다(2026-09-13)
docker exec -i "$CONTAINER" bash -lc "cat > $COPY_SQL" <<SQL
\timing on
COPY $GENRE_TABLE (id, name) FROM '/tmp/genre.csv' WITH (FORMAT csv, HEADER true);
-- title 이 빈 문자열인 곡이 3,977개 있다. FORCE_NOT_NULL 이 없으면 NULL 로 들어가 NOT NULL 위반이다.
-- album_mbid 는 BE 가 2026-09-13 에 추가한 컬럼(D17). 없으면 먼저: ALTER TABLE $MUSIC_TABLE ADD COLUMN album_mbid VARCHAR(36);
COPY $MUSIC_TABLE (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid)
  FROM '/tmp/music.csv' WITH (FORMAT csv, HEADER true, FORCE_NOT_NULL (title));
COPY $LINK_TABLE (id, music_id, genre_id) FROM '/tmp/music_genre.csv' WITH (FORMAT csv, HEADER true);
SQL
docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -f $COPY_SQL"

echo "== 4. 행 수 검증 (스펙 18 AC1·AC5) — 기대 $EXPECT_MUSIC · $EXPECT_GENRE · $EXPECT_LINKS"
run_sql "DO \\\$\\\$ DECLARE m bigint; g bigint; l bigint; BEGIN
  SELECT count(*) INTO m FROM $MUSIC_TABLE; SELECT count(*) INTO g FROM $GENRE_TABLE; SELECT count(*) INTO l FROM $LINK_TABLE;
  IF m <> $EXPECT_MUSIC THEN RAISE EXCEPTION '$MUSIC_TABLE % != %', m, $EXPECT_MUSIC; END IF;
  IF g <> $EXPECT_GENRE THEN RAISE EXCEPTION '$GENRE_TABLE % != %', g, $EXPECT_GENRE; END IF;
  IF l <> $EXPECT_LINKS THEN RAISE EXCEPTION '$LINK_TABLE % != %', l, $EXPECT_LINKS; END IF;
END \\\$\\\$;"

echo "== 4b. id 연속성과 고아 링크 (D13)"
run_sql "SELECT min(id) AS id_min, max(id) AS id_max, count(*) AS rows,
                count(DISTINCT mbid) AS distinct_mbid FROM $MUSIC_TABLE;"
run_sql "SELECT count(*) AS orphan_links_must_be_zero
         FROM $LINK_TABLE l LEFT JOIN $MUSIC_TABLE m ON m.id = l.music_id WHERE m.id IS NULL;"

fi   # RELOAD=0 (빈 테이블 COPY 경로) 끝. 아래 검증은 두 경로 공통.

echo "== 5. 채워진 컬럼 (스펙 18 AC4, D17) — 커버리지 비율은 album 99.3% · release_year 96.4% · album_mbid 69.0% 근처여야 한다"
run_sql "SELECT count(*) FILTER (WHERE album IS NOT NULL AND album <> '') AS album_filled,
                count(*) FILTER (WHERE release_year IS NOT NULL) AS release_year_filled,
                count(*) FILTER (WHERE album_mbid IS NOT NULL) AS album_mbid_filled,
                count(*) FILTER (WHERE bpm IS NULL) AS bpm_null,
                count(*) FILTER (WHERE youtube_url IS NOT NULL) AS youtube_url_must_be_zero
         FROM $MUSIC_TABLE;"
run_sql "SELECT album, release_year, album_mbid FROM $MUSIC_TABLE WHERE mbid = '0e11c0fd-a1da-4b88-a438-7ef55c5809ec';"   # Pink Floyd - Time: The Dark Side of the Moon | 1973

echo "== 6. 좌표 차원과 표본"
run_sql "SELECT vector_dims(location) AS dims, count(*) FROM $MUSIC_TABLE WHERE location IS NOT NULL GROUP BY 1;"

echo "== 7. HNSW 다시 만들기 — 병렬을 끄지 않으면 /dev/shm 64MB 에 걸려 실패한다"
HNSW_SQL="/tmp/hnsw_$(date +%s).sql"   # 지난 실행 파일이 다른 유저 소유로 남아 Permission denied 가 났다(2026-09-13). 매번 새 이름.
docker exec -i "$CONTAINER" bash -lc "cat > $HNSW_SQL" <<SQL
\timing on
-- 6GB: 2GB 로는 275만 튜플에서 그래프가 메모리를 넘쳐 디스크 경로로 떨어진다(2026-09-10). 컨테이너 8GB 전제. 662만 행 65분 실측(2026-09-11)은 6GB 값이다.
SET maintenance_work_mem = '6GB';
SET max_parallel_maintenance_workers = 0;
CREATE INDEX $HNSW_INDEX ON $MUSIC_TABLE USING hnsw (location vector_l2_ops);
SQL
docker exec -i "$CONTAINER" bash -lc "psql -U \$POSTGRES_USER -d \$POSTGRES_DB -f $HNSW_SQL"

echo "== 8. BE 에게 전달할 값"
run_sql "SELECT max(id) AS max_music_id, max(id) + 1 AS next_id_for_backend FROM $MUSIC_TABLE;"
echo "완료. HNSW 빌드는 시간이 걸린다. 그동안에도 BE 는 정확 거리 질의(전체 스캔)로 붙을 수 있다."
echo "지도 레이어 인덱스와 대표 트랙은 따로다: ODY_MUSIC_TABLE=$MUSIC_TABLE 로 ingest/build_map_layer.sql 을 돌린다."
