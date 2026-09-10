#!/usr/bin/env bash
# 스펙 18 적재 2단계 — CSV 를 ody DB 에 COPY (Jira S15P21A405-209)
#
# 이 스크립트는 **아직 돌리지 않았다.** 두 가지가 사용자 결정 대기다:
#   1. HNSW 인덱스 드롭 여부 (BE 가 만든 music_location_hnsw_idx)
#   2. ody-postgres 컨테이너 자원 상향 (현재 메모리 1GB, maintenance_work_mem 64MB)
#
# 2026-09-10 실측 근거:
#   - music.csv 2.72 GB / 6,624,399행, neo4j_music.csv 1.43 GB
#   - 스펙 17 측정으로 HNSW 는 50만행 1,032초. 662만행이면 4~6시간 (자원 상향 전)
#   - 스펙 50 규칙: 662만 행 적재는 인덱스를 만들기 전에 한다
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

echo "== 3. COPY — 순서가 중요하다. genre 가 먼저여야 music_genre 의 genre_id 가 맞는다"
run_sql "COPY genre (id, name) FROM '/tmp/genre.csv' WITH (FORMAT csv, HEADER true);"
run_sql "COPY music (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt) FROM '/tmp/music.csv' WITH (FORMAT csv, HEADER true);"
run_sql "COPY music_genre (id, music_id, genre_id) FROM '/tmp/music_genre.csv' WITH (FORMAT csv, HEADER true);"

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

echo "== 7. HNSW 다시 만들기 — 자원 상향 후에 한다. 지금은 주석으로 둔다"
echo "   run_sql \"SET maintenance_work_mem='2GB'; CREATE INDEX music_location_hnsw_idx ON music USING hnsw (location vector_l2_ops);\""

echo "== 8. BE 에게 전달할 값"
run_sql "SELECT max(id) AS max_music_id, max(id) + 1 AS next_id_for_backend FROM music;"
echo "완료. 인덱스는 아직 없다. BE 는 그동안 정확 거리 질의(전체 스캔)로 붙을 수 있다."
