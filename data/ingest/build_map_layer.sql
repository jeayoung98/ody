-- 지도 레이어 질의용 인덱스와 대표 트랙 테이블 (스펙 16, Jira S15P21A405-210)
--
-- 2026-09-11 에 운영 DB(ody)에서 실제로 돌린 것이다. 멱등하다 — 두 번 돌려도 결과가 같다.
--
-- 실행:
--   docker cp build_map_layer.sql ody-postgres:/tmp/
--   docker exec ody-postgres bash -lc 'psql -X -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/build_map_layer.sql'
--
-- ## 레이어는 좌표 쌍이다
--   1레이어 (pc1,pc2) · 2레이어 (pc3,pc4) · ... · 8레이어 (pc15,pc16)
-- 사용자가 하나를 고르면 그 근처를 다음 레이어 평면으로 보여주는 드릴다운이다.
--
-- ## 왜 표현식 인덱스인가
-- music.location 은 vector(16) 하나다. HNSW 는 16차원 전체 L2 거리용이라 "1·2번째 성분만"
-- 보는 사각 범위 질의에는 쓰이지 않는다(실측 95 ms 병렬 Seq Scan).
-- pc1..pc16 을 real 컬럼으로 복제하면 424 MB 가 더 든다. 대신 표현식 GiST 를 쓴다.
-- vector→real[] 캐스트와 point() 가 둘 다 IMMUTABLE 이라 가능하다(pg_proc.provolatile = 'i').
--
-- 같은 인덱스가 둘을 처리한다:
--   사각 범위   point(...) <@ box(...)
--   평면 최근접 ORDER BY point(...) <-> point(x, y)     ← KNN GiST, 0.24 ms
--
-- ## 인덱스를 더 만든다고 빨라지지 않는다
-- 사각 범위 조건 두 개에 GiST 를 둘 다 쓰게 하면 플래너가 BitmapAnd 로 묶어
-- 145 ms → 355 ms 로 **느려진다**(큰 비트맵 두 개 AND 비용 > 후보 축소 이득).
-- 2레이어 이후 조건은 BETWEEN(heap 필터)으로 쓴다. music_l2_gist 는 평면 최근접 전용이다.

\timing on
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 0;   -- 컨테이너 /dev/shm 이 64MB 라 병렬은 실패한다

-- 1) 레이어 평면 인덱스. 각 21초, 421 MB
CREATE INDEX IF NOT EXISTS music_l1_gist ON music USING gist
  (point((location::real[])[1], (location::real[])[2]));
CREATE INDEX IF NOT EXISTS music_l2_gist ON music USING gist
  (point((location::real[])[3], (location::real[])[4]));

-- 2) 1레이어 첫 화면 대표 트랙
--
-- 첫 화면은 사용자 입력과 무관하게 늘 같다. 그래서 미리 계산한다.
-- 실시간 격자 집계는 662만 행을 전부 읽어 20,941 ms 걸린다.
-- 깊은 레이어는 사용자가 어디로 들어왔는지에 따라 영역이 매번 달라 미리 계산할 수 없다.
-- 대신 이미 좁혀져 있어서 실시간으로 82~145 ms 다.
--
-- 칸(2.0 단위)마다 **중심에 가장 가까운** 트랙 하나. 점수순으로 뽑으면 한쪽에 뭉친다.
-- 제목·아티스트를 같이 넣어 music 조인을 없앤다(322 ms → 0.4 ms).
CREATE TABLE IF NOT EXISTS map_sample (
  layer    smallint     NOT NULL,
  gx       smallint     NOT NULL,
  gy       smallint     NOT NULL,
  music_id bigint       NOT NULL,
  x        real         NOT NULL,
  y        real         NOT NULL,
  title    varchar(200),
  artist   varchar(500),
  PRIMARY KEY (layer, gx, gy)
);
COMMENT ON TABLE map_sample IS '레이어 첫 화면용 격자 대표 트랙. 칸마다 중심에 가장 가까운 1개';
COMMENT ON COLUMN map_sample.gx IS 'floor(x / 2.0). 셀 크기 2.0';

DELETE FROM map_sample WHERE layer = 1;
INSERT INTO map_sample (layer, gx, gy, music_id, x, y, title, artist)
SELECT DISTINCT ON (gx, gy) 1, gx, gy, id, pc1, pc2, title, artist
FROM (
  SELECT id, title, artist,
         (location::real[])[1] AS pc1,
         (location::real[])[2] AS pc2,
         floor((location::real[])[1] / 2.0)::smallint AS gx,
         floor((location::real[])[2] / 2.0)::smallint AS gy
  FROM music
) s
ORDER BY gx, gy, ((pc1 - (gx * 2.0 + 1.0)) ^ 2 + (pc2 - (gy * 2.0 + 1.0)) ^ 2), id;

GRANT SELECT ON map_sample TO ody_read;

-- 3) 검증
SELECT count(*) AS sample_rows, min(gx) AS gx_min, max(gx) AS gx_max,
       min(gy) AS gy_min, max(gy) AS gy_max FROM map_sample WHERE layer = 1;
SELECT pg_size_pretty(pg_total_relation_size('map_sample')) AS sample_size,
       pg_size_pretty(pg_relation_size('music_l1_gist'))   AS l1_size,
       pg_size_pretty(pg_relation_size('music_l2_gist'))   AS l2_size;
