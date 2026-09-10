-- 지도 레이어 질의 모음 (스펙 16, Jira S15P21A405-210)
-- 2026-09-11 실측값을 주석에 적었다. Backend 는 이 형태를 그대로 쓰면 된다.
-- 근거: output/map_layer_bench_2026-09-11.json

-- ============================================================
-- 1레이어 첫 화면 — 0.4 ms
-- ============================================================
-- 미리 계산한 1,094행만 읽는다. music 조인 없음.
SELECT music_id, x, y, title, artist
FROM map_sample
WHERE layer = 1;

-- ============================================================
-- 2레이어 — 82 ms
-- (pc1,pc2) 근처를 필터하고 화면은 (pc3,pc4) 로 그린다
-- ============================================================
SELECT id, (location::real[])[3] AS x, (location::real[])[4] AS y
FROM music
WHERE point((location::real[])[1], (location::real[])[2])
      <@ box(point(:x1, :y1), point(:x2, :y2))
LIMIT 1000;

-- ============================================================
-- 3레이어 이후 — 145 ms
-- 누적 필터. 두 번째 조건부터는 BETWEEN 으로 쓴다
-- ============================================================
-- ⚠️ point(...) <@ box(...) 를 두 번 쓰면 플래너가 BitmapAnd 로 묶어 355 ms 로 느려진다.
--    선택도 높은 1레이어 인덱스 하나 + heap 필터가 2.4배 빠르다.
SELECT id, (location::real[])[5] AS x, (location::real[])[6] AS y
FROM music
WHERE point((location::real[])[1], (location::real[])[2])
      <@ box(point(:x1, :y1), point(:x2, :y2))
  AND (location::real[])[3] BETWEEN :x3_min AND :x3_max
  AND (location::real[])[4] BETWEEN :y4_min AND :y4_max
LIMIT 1000;

-- ============================================================
-- 화면에서 가까운 트랙 (레이어 평면) — 0.24 ms
-- ============================================================
SELECT id FROM music
ORDER BY point((location::real[])[1], (location::real[])[2]) <-> point(:x, :y)
LIMIT 20;

-- 2레이어 평면은 music_l2_gist 가 받는다
SELECT id FROM music
ORDER BY point((location::real[])[3], (location::real[])[4]) <-> point(:x, :y)
LIMIT 20;

-- ============================================================
-- 음악적으로 닮은 트랙 (16차원 전체) — 13.9 ms
-- ============================================================
-- ⚠️ 질의 벡터를 서브쿼리로 넘기면 조용히 틀린 답이 나온다.
--    ORDER BY location <-> (SELECT location FROM music WHERE id = :id)  ← 금지
--    실행계획에서 InitPlan 으로 들어가 HNSW 가 값을 제대로 쓰지 못한다. recall 0.0000.
--    좌표를 먼저 읽어 바인드 파라미터로 넘긴다. recall 0.9995.
-- 1) 좌표를 읽는다
SELECT location FROM music WHERE id = :id;
-- 2) 그 값을 파라미터로 넘긴다
SELECT id, title, artist, location <-> :qvec AS dist
FROM music
WHERE id <> :id
ORDER BY location <-> :qvec
LIMIT 10;

-- ============================================================
-- 임의 영역의 대표 트랙을 실시간 격자로 (깊은 레이어용)
-- ============================================================
-- 필터가 이미 좁혀 놓았을 때만 쓴다. 전 영역에 쓰면 20,941 ms 다.
SELECT DISTINCT ON (gx, gy) id, x, y
FROM (
  SELECT id,
         (location::real[])[3] AS x, (location::real[])[4] AS y,
         floor((location::real[])[3] / :cell) AS gx,
         floor((location::real[])[4] / :cell) AS gy
  FROM music
  WHERE point((location::real[])[1], (location::real[])[2])
        <@ box(point(:x1, :y1), point(:x2, :y2))
) s
ORDER BY gx, gy, ((x - (gx * :cell + :cell / 2)) ^ 2 + (y - (gy * :cell + :cell / 2)) ^ 2)
LIMIT 1000;
