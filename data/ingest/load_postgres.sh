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
# 사용법 (master 아니라 app-node 에서):
#   scp -i ~/.ssh/J15A405T.pem music.csv genre.csv music_genre.csv ubuntu@j15a405.p.ssafy.io:/tmp/ingest/
#   bash load_postgres.sh /tmp/ingest
set -euo pipefail

CSV_DIR="${1:?CSV 디렉터리를 주세요}"
CONTAINER="${ODY_PG_CONTAINER:-ody-postgres}"
EXPECT_MUSIC=6624399
EXPECT_GENRE=29
EXPECT_LINKS=71285

run_sql() { docker exec -i "$CONTAINER" bash -lc "psql -v ON_ERROR_STOP=1 -U \$POSTGRES_USER -d \$POSTGRES_DB -q -c \"$1\""; }

echo "== 0. 적재 전 상태"
run_sql "SELECT 'music' AS t, count(*) FROM music UNION ALL SELECT 'genre', count(*) FROM genre UNION ALL SELECT 'music_genre', count(*) FROM music_genre;"

echo "== 1. CSV 를 컨테이너로"
for f in music.csv genre.csv music_genre.csv; do
  docker cp "$CSV_DIR/$f" "$CONTAINER:/tmp/$f"
done

echo "== 2. HNSW 인덱스 드롭 (적재 후 다시 만든다)"
run_sql "DROP INDEX IF EXISTS music_location_hnsw_idx;"

echo "== 3. COPY — SQL 을 파일로 만들어 psql -f 로 넣는다(따옴표 중첩 회피)"
docker exec -i "$CONTAINER" bash -lc "cat > /tmp/copy.sql" <<'SQL'
\timing on
COPY genre (id, name) FROM '/tmp/genre.csv' WITH (FORMAT csv, HEADER true);
-- title 이 빈 문자열인 곡이 3,977개 있다. FORCE_NOT_NULL 이 없으면 NULL 로 들어가 NOT NULL 위반이다.
COPY music (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt)
  FROM '/tmp/music.csv' WITH (FORMAT csv, HEADER true, FORCE_NOT_NULL (title));
COPY music_genre (id, music_id, genre_id) FROM '/tmp/music_genre.csv' WITH (FORMAT csv, HEADER true);
SQL
docker exec -i "$CONTAINER" bash -lc 'psql -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/copy.sql'

echo "== 4. 행 수 검증 (스펙 18 AC1·AC5)"
run_sql "DO \\\$\\\$ DECLARE m bigint; g bigint; l bigint; BEGIN
  SELECT count(*) INTO m FROM music; SELECT count(*) INTO g FROM genre; SELECT count(*) INTO l FROM music_genre;
  IF m <> $EXPECT_MUSIC THEN RAISE EXCEPTION 'music % != %', m, $EXPECT_MUSIC; END IF;
  IF g <> $EXPECT_GENRE THEN RAISE EXCEPTION 'genre % != %', g, $EXPECT_GENRE; END IF;
  IF l <> $EXPECT_LINKS THEN RAISE EXCEPTION 'music_genre % != %', l, $EXPECT_LINKS; END IF;
END \\\$\\\$;"

echo "== 5. 비어 있어야 하는 세 컬럼 (스펙 18 AC4)"
run_sql "SELECT count(*) AS must_be_zero FROM music WHERE release_year IS NOT NULL OR album IS NOT NULL OR youtube_url IS NOT NULL;"

echo "== 6. 좌표 차원과 표본"
run_sql "SELECT vector_dims(location) AS dims, count(*) FROM music WHERE location IS NOT NULL GROUP BY 1;"

echo "== 7. HNSW 다시 만들기 — 병렬을 끄지 않으면 /dev/shm 64MB 에 걸려 실패한다"
docker exec -i "$CONTAINER" bash -lc "cat > /tmp/hnsw.sql" <<'SQL'
\timing on
SET maintenance_work_mem = '2GB';
SET max_parallel_maintenance_workers = 0;
CREATE INDEX music_location_hnsw_idx ON music USING hnsw (location vector_l2_ops);
SQL
docker exec -i "$CONTAINER" bash -lc 'psql -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/hnsw.sql'

echo "== 8. BE 에게 전달할 값"
run_sql "SELECT max(id) AS max_music_id, max(id) + 1 AS next_id_for_backend FROM music;"
echo "완료. HNSW 빌드는 시간이 걸린다. 그동안에도 BE 는 정확 거리 질의(전체 스캔)로 붙을 수 있다."
