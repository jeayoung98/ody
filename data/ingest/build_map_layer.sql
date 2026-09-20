-- 지도 레이어 질의용 인덱스와 대표 트랙 테이블 (스펙 16, Jira S15P21A405-210)
--
-- 2026-09-11 에 운영 DB(ody)에서 실제로 돌린 것이다. 멱등하다 — 두 번 돌려도 결과가 같다.
-- 2026-09-18 D20 으로 1레이어 표본을 **칸당 1곡 → 밀도 가중**으로 바꿨다(S15P21A405-466).
--
-- 2026-09-20 검증: 버려도 되는 postgres 17.11 컨테이너에 픽스처(칸 크기 1·6·66·1201·8000, 전부
-- 재생 불가인 칸 1개, 3칼럼 PK `map_sample_v2_pkey`, 고아 행 1건)를 심고 실제로 돌렸다.
--   칸별 k 가 1·2·4·11·20·2 로 계산과 일치 · 전부 재생 불가인 칸은 사라짐
--   PK 3칼럼 → 4칼럼 이관 성공 · 재실행 시 곡 ID 서명 동일(재현 가능) · kmax=3 으로 클리핑 확인
--   고아·재생불가·kmax 초과 전부 0건
-- ⚠️ **운영에서는 아직 안 돌렸다.** 실행 시간과 칸 중심 쏠림(19.6% 기대)은 미측정이다 —
--    픽스처가 작고 좌표 분포가 균등하지 않아 그 둘은 이 검증으로 확인되지 않는다.
--
-- 실행:
--   docker cp build_map_layer.sql ody-postgres:/tmp/
--   docker exec ody-postgres bash -lc 'psql -X -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/build_map_layer.sql'
--
-- 되돌리기: 이 파일의 직전 버전(칸당 1곡)을 받아 그대로 다시 돌리면 된다. 표본은 매번 새로 만든다.
--   git show HEAD~1:data/ingest/build_map_layer.sql > /tmp/build_map_layer_prev.sql
-- 단, PK 는 (layer,gx,gy,music_id) 로 남는다 — 칸당 1곡이면 어차피 유일하므로 동작에 지장 없다.
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

-- ## 테이블 이름은 psql 변수로 받는다 (재적재본 music_v2 용, Jira S15P21A405-381)
--   기본값:  music · map_sample · music_l1_gist · music_l2_gist
--   재적재본:
--     psql -v music_tbl=music_v2 -v sample_tbl=map_sample_v2 \
--          -v l1_idx=music_v2_l1_gist -v l2_idx=music_v2_l2_gist -f build_map_layer.sql
\if :{?music_tbl}
\else
  \set music_tbl music
\endif
\if :{?sample_tbl}
\else
  \set sample_tbl map_sample
\endif
\if :{?l1_idx}
\else
  \set l1_idx music_l1_gist
\endif
\if :{?l2_idx}
\else
  \set l2_idx music_l2_gist
\endif
-- 칸당 대표곡 수 상한 (2026-09-18 D20). 자세한 근거는 아래 "칸당 1곡 → 밀도 가중" 주석.
\if :{?kmax}
\else
  \set kmax 40
\endif

\timing on
SET maintenance_work_mem = '4GB';
SET max_parallel_maintenance_workers = 0;   -- 컨테이너 /dev/shm 이 64MB 라 병렬은 실패한다

-- 1) 레이어 평면 인덱스. 각 21초, 421 MB
CREATE INDEX IF NOT EXISTS :"l1_idx" ON :"music_tbl" USING gist
  (point((location::real[])[1], (location::real[])[2]));
CREATE INDEX IF NOT EXISTS :"l2_idx" ON :"music_tbl" USING gist
  (point((location::real[])[3], (location::real[])[4]));

-- 2) 1레이어 첫 화면 대표 트랙
--
-- 첫 화면은 사용자 입력과 무관하게 늘 같다. 그래서 미리 계산한다.
-- 실시간 격자 집계는 662만 행을 전부 읽어 20,941 ms 걸린다.
-- 깊은 레이어는 사용자가 어디로 들어왔는지에 따라 영역이 매번 달라 미리 계산할 수 없다.
-- 대신 이미 좁혀져 있어서 실시간으로 82~145 ms 다.
--
-- ## 칸당 1곡 → 밀도 가중 (2026-09-18 D20, Jira S15P21A405-466)
--
-- 예전에는 칸(2.0 단위)마다 **중심에 가장 가까운** 트랙 하나였다. 두 가지가 문제였다.
--
--   1. 칸 중심 최근접이라 점이 칸 한복판에 박힌다. 실측으로 점의 81.8% 가 칸 중심 0.25칸 안에
--      들어와 **바둑판**이 보였다. 무작위로 바꾸면 19.4% 로 떨어진다(균등분포 기대 19.6%).
--   2. 칸당 1곡이라 칸 사이 밀도 차가 통째로 지워진다. 실측 cnt 분위는
--      1 / 6 / 66 / 1,201 / 86,651 / 98,660 으로 편차가 다섯 자릿수다.
--
-- 그래서 칸당 k = min(round(cbrt(n)), :kmax) 곡을 담고, 칸 안에서는 md5(id::text) 무작위로 고른다.
-- n 은 그 칸의 **재생 가능한** 곡 수다. 계수·바닥 보정은 없다(이분 탐색 결과 계수가 1.002 로 수렴).
--
-- 밀도 **정비례** 샘플링은 기각했다 — 칸의 63~69% 가 사라지는데 그 칸들이 담은 곡은 0.85% 뿐이다.
-- cbrt 는 칸을 하나도 잃지 않으면서 밀도를 반영한다.
--
-- 격자 간격 2.0 은 유지한다. 0.75 로 줄이는 안은 바둑판도 밀도도 고치지 못해 철회했다.
--
-- 2026-09-18 운영 실집계 기준 예상: 850칸 → 7,272곡 (칸당 1곡일 때의 8.6배).
-- :kmax 상한은 사실상 무의미하다 — cnt 최대가 98,660 이라 cbrt 최대가 46.2 뿐이고,
-- 상한 40 이면 7,272곡 / 상한 없으면 7,343곡으로 71곡(1.0%) 차이다. 폭주 방지용으로만 둔다.
--
-- ⚠️ 전제: :"music_tbl" 에 is_unplayable(boolean NOT NULL DEFAULT false) 이 있어야 한다.
--    재생 불가 판정의 정본이 video_id = 'none' 표시값에서 이 플래그로 옮겨갔다(S15P21A405-454).
--    music_v2 등 재적재본에 이 칼럼이 없으면 여기서 실패한다 — 먼저 칼럼을 맞춘다.
--
-- 제목·아티스트를 같이 넣어 music 조인을 없앤다(322 ms → 0.4 ms).
CREATE TABLE IF NOT EXISTS :"sample_tbl" (
  layer    smallint     NOT NULL,
  gx       smallint     NOT NULL,
  gy       smallint     NOT NULL,
  music_id bigint       NOT NULL,
  x        real         NOT NULL,
  y        real         NOT NULL,
  title    varchar(200),
  artist   varchar(500),
  cnt      integer      NOT NULL DEFAULT 0,   -- 그 칸에 든 곡 수(재생 불가 포함)
  PRIMARY KEY (layer, gx, gy, music_id)
);
ALTER TABLE :"sample_tbl" ADD COLUMN IF NOT EXISTS cnt integer NOT NULL DEFAULT 0;

-- 이미 만들어져 있는 테이블의 PK 를 (layer,gx,gy) → (layer,gx,gy,music_id) 로 옮긴다.
-- 멱등하다. 이미 4칼럼이면 아무것도 하지 않는다.
--
-- ⚠️ 제약 이름을 추측하지 않는다. 운영 map_sample 의 PK 이름은 테이블명과 다른 map_sample_v2_pkey 다
--    (S15P21A405-381 재적재본에서 rename 되며 남은 흔적). pg_constraint 에서 찾아 쓴다.
--
-- ⚠️ DO $$ ... $$ 를 쓰지 않는다. psql 은 **달러 인용 블록 안에서 :변수를 치환하지 않는다** —
--    :'sample_tbl' 이 글자 그대로 남아 실패한다. 질의로 DDL 을 만들어 \gexec 로 실행한다.

-- (a) 3칼럼 PK 가 있으면 떼어낸다. 없으면 0행이라 아무것도 실행되지 않는다.
SELECT format('ALTER TABLE %s DROP CONSTRAINT %I', conrelid::regclass, conname)
FROM pg_constraint
WHERE conrelid = :'sample_tbl'::regclass
  AND contype = 'p'
  AND array_length(conkey, 1) = 3
\gexec

-- (b) PK 가 없으면 4칼럼으로 만든다. 이미 4칼럼이면 0행이라 건너뛴다.
SELECT format('ALTER TABLE %s ADD PRIMARY KEY (layer, gx, gy, music_id)', :'sample_tbl'::regclass)
WHERE NOT EXISTS (
  SELECT 1 FROM pg_constraint
  WHERE conrelid = :'sample_tbl'::regclass AND contype = 'p'
)
\gexec

COMMENT ON TABLE :"sample_tbl" IS '레이어 첫 화면용 격자 대표 트랙. 칸마다 밀도 가중 k = min(round(cbrt(재생가능 곡수)), 40) 개, 칸 안은 무작위';
COMMENT ON COLUMN :"sample_tbl".gx IS 'floor(x / 2.0). 셀 크기 2.0. 칸 범위는 [gx*2.0, gx*2.0+2.0)';
COMMENT ON COLUMN :"sample_tbl".cnt IS '그 칸에 든 곡 수. 칸마다 편차가 크다(1 ~ 수십만). FE 가 점 크기와 LIMIT 판단에 쓴다';

-- ⚠️ 통계부터 갱신한다. is_unplayable 은 2026-09-18 에 추가·백필됐는데(S15P21A405-454)
--    운영 last_analyze 는 2026-09-17 이라 **이 칼럼의 통계가 아예 없다**(pg_stats 에 행이 없다).
--    그러면 플래너가 boolean 기본 선택도 50% 를 써서 후보를 2,348,587행으로 본다 — 실제 약 468만의 절반이다.
--    아래 정렬이 그 절반 크기로 계획돼 work_mem 배분이 어긋난다. EXPLAIN 으로 확인한 실제 오차다.
--    S15P21A405-305(인덱스 만들고 ANALYZE 안 해서 플랜 오선택)와 같은 부류다.
ANALYZE :"music_tbl";

DELETE FROM :"sample_tbl" WHERE layer = 1;

-- 후보는 재생 가능한 곡뿐이다. 여기서 한 번 거르므로 **백엔드가 응답 단계에서 다시 거르면 안 된다** —
-- map_sample 은 칸별 대표곡이라 응답에서 거르면 칸이 통째로 사라진다.
-- music 에 실재하는 행만 담기므로 조인 고아도 생기지 않는다(예전 표본에 9건 있었다).
WITH cand AS (
  SELECT id, title, artist,
         (location::real[])[1] AS pc1,
         (location::real[])[2] AS pc2,
         floor((location::real[])[1] / 2.0)::smallint AS gx,
         floor((location::real[])[2] / 2.0)::smallint AS gy
  FROM :"music_tbl"
  WHERE NOT is_unplayable
),
quota AS (
  -- 칸마다 몇 곡을 담을지. n 은 재생 가능한 곡 수다(아래 cnt 와 다르다 — cnt 는 전체 곡 수).
  SELECT gx, gy, least(round(cbrt(count(*)))::int, :kmax) AS k
  FROM cand GROUP BY gx, gy
),
ranked AS (
  -- 칸 안에서는 무작위. 중심 최근접을 쓰면 점이 칸 한복판에 박혀 바둑판이 보인다.
  -- md5 라서 재실행해도 같은 곡이 뽑힌다(재현 가능, AC).
  --
  -- 이 window 함수가 이 스크립트에서 제일 비싼 단계다. 칸별 상위 k 를 뽑는 연산자가 postgres 에
  -- 없어서, 입력 전체를 (gx, gy, md5) 로 한 번 정렬해야 row_number 를 매길 수 있다.
  -- 운영 EXPLAIN 기준 총비용 3,802,616 중 정렬이 3,371,546 (약 89%) 이다.
  -- 칸마다 LATERAL 로 나눠 뽑는 대안은 (gx,gy) 표현식 인덱스가 없어 850번 스캔이 되므로 더 나쁘다.
  -- **빌드 때 한 번 치르는 비용이고 서빙 경로에는 정렬이 없다** — 조회는 이 표를 그냥 읽는다.
  SELECT c.*, row_number() OVER (PARTITION BY c.gx, c.gy ORDER BY md5(c.id::text)) AS rn
  FROM cand c
)
INSERT INTO :"sample_tbl" (layer, gx, gy, music_id, x, y, title, artist)
SELECT 1, r.gx, r.gy, r.id, r.pc1, r.pc2, r.title, r.artist
FROM ranked r
JOIN quota q ON q.gx = r.gx AND q.gy = r.gy
WHERE r.rn <= q.k;

-- 칸마다 곡 수. 대표만 주면 FE 가 "이 칸에 몇 곡인지" 를 알 수 없다.
-- ⚠️ cnt 는 **전체** 곡 수다(재생 불가 포함). k 를 정할 때 쓴 재생 가능 곡 수와 다르다 —
--    FE 계약("그 칸에 든 곡 수")을 바꾸지 않으려고 의도적으로 그대로 둔다. 실측 차이는 564곡뿐이다.
-- ⚠️ 이제 한 칸에 여러 행이 있으므로 같은 cnt 가 그 행들에 중복 저장된다.
--    정규화하려면 칸 테이블을 분리해야 하는데 850칸 × 평균 8.6행이라 중복 비용이 무시할 만하다.
UPDATE :"sample_tbl" s SET cnt = c.n
FROM (
  SELECT floor((location::real[])[1] / 2.0)::smallint AS gx,
         floor((location::real[])[2] / 2.0)::smallint AS gy,
         count(*) AS n
  FROM :"music_tbl" GROUP BY 1, 2
) c
WHERE s.layer = 1 AND s.gx = c.gx AND s.gy = c.gy;

GRANT SELECT ON :"sample_tbl" TO ody_read;

-- 3) 검증
--
-- 기준선(2026-09-18 운영 실집계, 칸당 1곡일 때): 850칸 / sum(cnt) 4,694,202.
-- 밀도 가중 후 기대: sample_rows 약 7,272, cells 850(줄면 안 된다).
--
-- ⚠️ songs_covered 는 총 곡 수와 정확히 같지 않을 수 있다. 칸 안의 곡이 **전부 재생 불가**면
--    그 칸은 대표가 없어 통째로 빠지고, 그 칸의 곡 수도 합계에서 사라진다.
--    운영은 재생 불가가 564곡뿐이라 그런 칸이 생길 가능성이 낮지만, 줄었다면 이 이유부터 본다.
SELECT count(*)                      AS sample_rows,
       count(DISTINCT (gx, gy))      AS cells,
       round(count(*)::numeric
             / nullif(count(DISTINCT (gx, gy)), 0), 2) AS rows_per_cell,
       min(gx) AS gx_min, max(gx) AS gx_max,
       min(gy) AS gy_min, max(gy) AS gy_max
FROM :"sample_tbl" WHERE layer = 1;

-- cnt 는 칸 단위 값이라 행마다 세면 중복된다. 칸으로 접어서 센다.
SELECT sum(cnt) AS songs_covered, min(cnt) AS cnt_min, max(cnt) AS cnt_max
FROM (SELECT DISTINCT gx, gy, cnt FROM :"sample_tbl" WHERE layer = 1) d;

-- AC 검증 3종. 셋 다 0 이어야 한다.
SELECT
  (SELECT count(*) FROM :"sample_tbl" s
     LEFT JOIN :"music_tbl" m ON m.id = s.music_id
    WHERE s.layer = 1 AND m.id IS NULL)              AS orphan_rows,
  (SELECT count(*) FROM :"sample_tbl" s
     JOIN :"music_tbl" m ON m.id = s.music_id
    WHERE s.layer = 1 AND m.is_unplayable)           AS unplayable_rows,
  (SELECT count(*) FROM (
     SELECT gx, gy FROM :"sample_tbl" WHERE layer = 1
     GROUP BY gx, gy HAVING count(*) > :kmax) x)     AS over_kmax_cells;

-- 칸 중심 쏠림. 칸 중심 0.25칸(=0.5 단위) 이내 점 비율.
-- 중심 최근접이던 시절 81.8% → 무작위로 바꾸면 균등분포 기대치 19.6% 근처여야 한다.
SELECT round(100.0 * avg(CASE WHEN abs(x - (gx * 2.0 + 1.0)) <= 0.5
                              AND abs(y - (gy * 2.0 + 1.0)) <= 0.5
                         THEN 1 ELSE 0 END), 1) AS center_pct
FROM :"sample_tbl" WHERE layer = 1;
SELECT pg_size_pretty(pg_total_relation_size(:'sample_tbl')) AS sample_size,
       pg_size_pretty(pg_relation_size(:'l1_idx'))          AS l1_size,
       pg_size_pretty(pg_relation_size(:'l2_idx'))          AS l2_size;
