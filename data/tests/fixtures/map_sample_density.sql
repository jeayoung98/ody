-- build_map_layer.sql 의 1레이어 밀도 가중 배분을 실제 postgres 에서 검증하는 픽스처.
-- Jira S15P21A405-466. 2026-09-20 작성.
--
-- 왜 픽스처가 따로 필요한가 — tests/test_map_layer.py 는 DB 없이 도는 검사라 SQL 본문을
-- 문자열로만 본다. 칸당 k 가 실제로 맞게 나오는지, PK 이관이 도는지는 DB 가 있어야 안다.
--
-- ## 실행
--   docker run -d --name map-verify -e POSTGRES_PASSWORD=v -e POSTGRES_USER=verify \
--     -e POSTGRES_DB=verify postgres:17.11-bookworm
--   docker cp tests/fixtures/map_sample_density.sql map-verify:/tmp/f.sql
--   docker cp ingest/build_map_layer.sql            map-verify:/tmp/b.sql
--   docker exec map-verify psql -X -v ON_ERROR_STOP=1 -U verify -d verify -f /tmp/f.sql
--   docker exec map-verify psql -X -v ON_ERROR_STOP=1 -U verify -d verify -f /tmp/b.sql
--   docker rm -f map-verify
--
--   (git bash 에서는 MSYS_NO_PATHCONV=1 을 붙여야 /tmp 경로가 안 망가진다)
--
-- ## 운영과 같은 함정을 일부러 심는다
--   (1) map_sample 이 3칼럼 PK 이고, 이름이 테이블명과 어긋나는 map_sample_v2_pkey 다
--       (S15P21A405-381 재적재본 rename 흔적). 제약 이름을 <테이블>_pkey 로 추측하면 틀린다.
--   (2) map_sample 이 music 에 없는 곡(고아)을 가리킨다. 운영에 2026-09-18 기준 9건 있었다.
--   (3) 칸 하나는 곡이 전부 재생 불가다. 그 칸은 대표가 없어 통째로 빠져야 한다.
--
-- ## pgvector 는 쓰지 않는다
-- 운영 music.location 은 vector(16) 이지만 여기서는 real[] 로 둔다.
-- build_map_layer.sql 의 location::real[] 가 무연산 캐스트가 되어 그대로 돈다.
--
-- ## 기대 결과 (kmax 기본 40)
--   INSERT 0 40      — 칸별 k = 1, 2, 4, 11, 20, 2
--   cells 6          — 7번 칸(전부 재생 불가)은 사라진다
--   PK              map_sample_v2_pkey (3칼럼) -> (layer, gx, gy, music_id)
--   orphan_rows 0 / unplayable_rows 0 / over_kmax_cells 0
--   songs_covered 9382  — music 전체 9,392 가 아니다. 7번 칸의 10곡은 대표가 없어 빠진다
--
--   -v kmax=3 으로 주면 k = 1, 2, 3, 3, 3, 2 = INSERT 0 14
--
--   두 번 돌리면 뽑힌 곡 ID 가 같아야 한다(md5 정렬이라 재현 가능):
--     SELECT md5(string_agg(music_id::text, ',' ORDER BY gx, music_id))
--     FROM map_sample WHERE layer = 1;

CREATE ROLE ody_read;

CREATE TABLE music (
  id            bigint PRIMARY KEY,
  title         varchar(200),
  artist        varchar(500),
  location      real[] NOT NULL,
  is_unplayable boolean NOT NULL DEFAULT false
);

-- gx = g 인 칸에 n 곡을 넣는다. 그중 앞 unplayable 곡은 재생 불가로 표시한다.
-- 좌표는 칸 안 [g*2, g*2+2) 에 흩뿌린다. gy 는 0 으로 고정한다.
CREATE FUNCTION seed_cell(g int, n int, unplayable int) RETURNS void AS $fn$
  INSERT INTO music (id, title, artist, location, is_unplayable)
  SELECT (g::bigint * 1000000) + i,
         'title ' || g || '-' || i,
         'artist ' || g,
         ARRAY[
           (g * 2.0 + (i % 199) / 199.0 * 2.0)::real,
           (0 * 2.0 + (i % 97)  / 97.0  * 2.0)::real,
           0,0,0,0,0,0,0,0,0,0,0,0,0,0
         ]::real[],
         i <= unplayable
  FROM generate_series(1, n) AS i;
$fn$ LANGUAGE sql;

--        gx    n  재생불가      재생가능 n  cbrt      기대 k
SELECT seed_cell(1,    1,   0);  --        1   1.00  ->  1
SELECT seed_cell(2,    6,   0);  --        6   1.82  ->  2
SELECT seed_cell(3,   66,   0);  --       66   4.04  ->  4
SELECT seed_cell(4, 1201,   0);  --     1201  10.63  -> 11
SELECT seed_cell(5, 8000,   0);  --     8000  20.00  -> 20
SELECT seed_cell(6,  108, 100);  --        8   2.00  ->  2   (cnt 는 108, 전체 곡 수)
SELECT seed_cell(7,   10,  10);  --        0         ->  칸이 사라진다
--                                                      합계 40행 / 6칸

-- 예전 형태의 map_sample: 3칼럼 PK, 이름은 map_sample_v2_pkey
CREATE TABLE map_sample (
  layer    smallint     NOT NULL,
  gx       smallint     NOT NULL,
  gy       smallint     NOT NULL,
  music_id bigint       NOT NULL,
  x        real         NOT NULL,
  y        real         NOT NULL,
  title    varchar(200),
  artist   varchar(500),
  cnt      integer      NOT NULL DEFAULT 0,
  CONSTRAINT map_sample_v2_pkey PRIMARY KEY (layer, gx, gy)
);

-- 칸당 1곡(옛 결과) + 고아 1건. 스크립트가 지우고 다시 만들어야 한다.
INSERT INTO map_sample (layer, gx, gy, music_id, x, y, title, artist, cnt) VALUES
  (1, 1, 0, 1000001,   3.0,  1.0, 'old',    'old',    1),
  (1, 9, 0, 999999999, 19.0, 1.0, 'orphan', 'orphan', 1);
