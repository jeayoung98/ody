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
-- album_mbid 는 BE 가 2026-09-13 에 추가한 컬럼(D17). 없으면 먼저: ALTER TABLE music ADD COLUMN album_mbid VARCHAR(36);
COPY music (id, mbid, title, artist, release_year, bpm, duration, album, youtube_url, location, play_cnt, youtube_cnt, album_mbid)
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

echo "== 5. 채워진 컬럼 (스펙 18 AC4, D17) — 기대 album ≈ 6,580,000 · release_year ≈ 6,384,000 · album_mbid ≈ 4,568,000 · bpm NULL 0 · youtube_url 0"
run_sql "SELECT count(*) FILTER (WHERE album IS NOT NULL AND album <> '') AS album_filled,
                count(*) FILTER (WHERE release_year IS NOT NULL) AS release_year_filled,
                count(*) FILTER (WHERE album_mbid IS NOT NULL) AS album_mbid_filled,
                count(*) FILTER (WHERE bpm IS NULL) AS bpm_null,
                count(*) FILTER (WHERE youtube_url IS NOT NULL) AS youtube_url_must_be_zero
         FROM music;"
run_sql "SELECT album, release_year, album_mbid FROM music WHERE mbid = '0e11c0fd-a1da-4b88-a438-7ef55c5809ec';"   # Pink Floyd - Time: The Dark Side of the Moon | 1973

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
