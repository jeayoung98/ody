-- 별자리 작품 채점 — 기준 그림(few-shot)과 v6 루브릭 [S15P21A405-563]
-- artwork_001_tables.sql 이 적용된 DB 에 실행한다. 전부 트랜잭션 안에서 실행해도 된다(CONCURRENTLY 없음).
--
-- 왜: 2026-09-22 진단 6회(specs/009-constellation-artwork-ai/plan.md "변별력 진단").
--   말로 된 구간만 주면 gpt-4o 도 엉망 배치와 난수를 못 갈랐다. 점수가 붙은 기준 그림 4장을 먼저
--   보이자 갈렸다. 기준 그림은 별도 테이블이 아니라 artwork 행(is_anchor = true, 점수 고정)이다 —
--   좌표 저장과 렌더러를 그대로 쓰고, 리더보드·내 작품·회차당 1작품 검사에서만 뺀다.

-- 1) 기준 그림 표시 칼럼.
ALTER TABLE public.artwork ADD COLUMN IF NOT EXISTS is_anchor boolean NOT NULL DEFAULT false;

-- 2) 1회차 채점 기준 문장을 v6 로 교체한다. 그림 솜씨가 아니라 배치를 보게 하고, 빠진 부위별 상한과
--    "닫힌 형태 없으면 9 이하" 규칙을 못 박고, 기준 그림과 대조하라고 지시한다.
--    "구간 안에서 위치를 정하라" 는 넣지 않는다 — 진단 v4 에서 같은 그림에 다른 점수가 나온 원인이다.
UPDATE public.artwork_round
SET theme_prompt = '이 그림들은 음악 플레이리스트의 곡들을 점으로 찍고 순서대로 선으로 이은 별자리다.
배치가 고양이로 보이는지만 판단하라. 선의 굵기나 그림 솜씨는 평가 대상이 아니다.

점수 구간:
- 90~100: 설명 없이 한눈에 고양이다. 귀·머리·몸통·꼬리가 제자리에 있고 비율도 맞다
- 70~89: 고양이로 보인다. 네 부위가 다 있으나 비율이나 배치가 어색하다
- 50~69: 고양이라고 말해주면 그렇게 보인다. 부위 하나가 빠졌다
- 30~49: 부위 둘 이상이 빠졌거나, 부위는 있으나 서로 엉뚱한 자리라 고양이로 안 보인다
- 10~29: 부위 하나 정도만 고양이를 연상시킨다
- 0~9: 닫힌 형태가 하나도 없는 점 흩어짐이나 선 하나다

반드시 지킬 상한: 꼬리가 없으면 69 이하. 부위가 둘 이상 없으면 49 이하. 닫힌 형태가 없으면 9 이하.
부위가 다 있어도 서로 엉뚱한 자리면 49 이하.

먼저 기준 그림들과 그 점수를 본다. 그 다음 마지막 그림을 기준 그림과 비교해 채점한다.
기준 그림에서 꼬리가 어디 붙어 있는지, 머리가 몸통 어느 쪽에 있는지를 눈여겨보고, 마지막 그림에 같은 부위가 같은 자리에 있는지 하나씩 대조하라.
없는 것을 있다고 보지 마라. 애매하면 낮은 쪽을 준다.'
WHERE theme = '고양이';

-- 3) 기준 그림 4장. 좌표는 GmsScoreProbe 의 cat_full / cat_no_tail / cat_scrambled / scatter 다
--    (build/artwork-probe/anchors.sql 로 생성). music_id 0 은 실제 곡이 아니다 — 기준 그림은 좌표만 쓴다.
--    중복 실행해도 같은 제목의 기준이 있으면 넣지 않는다.
-- 기준 그림 cat_full (75점)
INSERT INTO public.artwork (id, round_id, email, title, layout_version, status, score, ai_comment, model, is_anchor, evaluated_at)
SELECT nextval('artwork_id_seq'), r.id, 'anchor@ody.system', '기준 cat_full', 'probe', 'SCORED', 75, NULL, 'fixed', true, now()
FROM public.artwork_round r WHERE r.theme = '고양이'
  AND NOT EXISTS (SELECT 1 FROM public.artwork a WHERE a.round_id = r.id AND a.is_anchor AND a.title = '기준 cat_full');
INSERT INTO public.artwork_point (artwork_id, position, music_id, x, y)
SELECT a.id, p.position, 0, p.x, p.y
FROM public.artwork a, (VALUES
  (0, -0.3000, 0.2000),
  (1, -0.5500, 0.0200),
  (2, -0.7600, 0.1400),
  (3, -0.8000, 0.4200),
  (4, -0.6800, 0.8000),
  (5, -0.5200, 0.5800),
  (6, -0.3600, 0.8000),
  (7, -0.2800, 0.4500),
  (8, -0.3000, 0.2000),
  (9, 0.0500, 0.2800),
  (10, 0.4500, 0.3000),
  (11, 0.6800, 0.1500),
  (12, 0.8800, 0.3500),
  (13, 0.8200, 0.6800),
  (14, 0.6800, -0.1800),
  (15, 0.2500, -0.3000),
  (16, -0.1200, -0.2200),
  (17, -0.3000, 0.0500)
) AS p(position, x, y)
WHERE a.is_anchor AND a.title = '기준 cat_full'
  AND NOT EXISTS (SELECT 1 FROM public.artwork_point q WHERE q.artwork_id = a.id);

-- 기준 그림 cat_no_tail (55점)
INSERT INTO public.artwork (id, round_id, email, title, layout_version, status, score, ai_comment, model, is_anchor, evaluated_at)
SELECT nextval('artwork_id_seq'), r.id, 'anchor@ody.system', '기준 cat_no_tail', 'probe', 'SCORED', 55, NULL, 'fixed', true, now()
FROM public.artwork_round r WHERE r.theme = '고양이'
  AND NOT EXISTS (SELECT 1 FROM public.artwork a WHERE a.round_id = r.id AND a.is_anchor AND a.title = '기준 cat_no_tail');
INSERT INTO public.artwork_point (artwork_id, position, music_id, x, y)
SELECT a.id, p.position, 0, p.x, p.y
FROM public.artwork a, (VALUES
  (0, -0.3000, 0.2000),
  (1, -0.5500, 0.0200),
  (2, -0.7600, 0.1400),
  (3, -0.8000, 0.4200),
  (4, -0.6800, 0.8000),
  (5, -0.5200, 0.5800),
  (6, -0.3600, 0.8000),
  (7, -0.2800, 0.4500),
  (8, -0.3000, 0.2000),
  (9, 0.0500, 0.2800),
  (10, 0.4500, 0.3000),
  (11, 0.6800, 0.1500),
  (12, 0.6800, -0.1800),
  (13, 0.2500, -0.3000),
  (14, -0.1200, -0.2200),
  (15, -0.3000, 0.0500)
) AS p(position, x, y)
WHERE a.is_anchor AND a.title = '기준 cat_no_tail'
  AND NOT EXISTS (SELECT 1 FROM public.artwork_point q WHERE q.artwork_id = a.id);

-- 기준 그림 cat_scrambled (35점)
INSERT INTO public.artwork (id, round_id, email, title, layout_version, status, score, ai_comment, model, is_anchor, evaluated_at)
SELECT nextval('artwork_id_seq'), r.id, 'anchor@ody.system', '기준 cat_scrambled', 'probe', 'SCORED', 35, NULL, 'fixed', true, now()
FROM public.artwork_round r WHERE r.theme = '고양이'
  AND NOT EXISTS (SELECT 1 FROM public.artwork a WHERE a.round_id = r.id AND a.is_anchor AND a.title = '기준 cat_scrambled');
INSERT INTO public.artwork_point (artwork_id, position, music_id, x, y)
SELECT a.id, p.position, 0, p.x, p.y
FROM public.artwork a, (VALUES
  (0, 0.7500, -0.5500),
  (1, 0.5000, -0.7300),
  (2, 0.2900, -0.6100),
  (3, 0.2500, -0.3300),
  (4, 0.3700, 0.0500),
  (5, 0.5300, -0.1700),
  (6, 0.6900, 0.0500),
  (7, 0.7700, -0.3000),
  (8, 0.7500, -0.5500),
  (9, -0.5000, 0.7300),
  (10, -0.1000, 0.7500),
  (11, 0.1300, 0.6000),
  (12, 0.1300, 0.2700),
  (13, -0.3000, 0.1500),
  (14, -0.6700, 0.2300),
  (15, -0.8500, 0.5000),
  (16, -0.8500, -0.5500),
  (17, -0.7000, -0.9000)
) AS p(position, x, y)
WHERE a.is_anchor AND a.title = '기준 cat_scrambled'
  AND NOT EXISTS (SELECT 1 FROM public.artwork_point q WHERE q.artwork_id = a.id);

-- 기준 그림 scatter (5점)
INSERT INTO public.artwork (id, round_id, email, title, layout_version, status, score, ai_comment, model, is_anchor, evaluated_at)
SELECT nextval('artwork_id_seq'), r.id, 'anchor@ody.system', '기준 scatter', 'probe', 'SCORED', 5, NULL, 'fixed', true, now()
FROM public.artwork_round r WHERE r.theme = '고양이'
  AND NOT EXISTS (SELECT 1 FROM public.artwork a WHERE a.round_id = r.id AND a.is_anchor AND a.title = '기준 scatter');
INSERT INTO public.artwork_point (artwork_id, position, music_id, x, y)
SELECT a.id, p.position, 0, p.x, p.y
FROM public.artwork a, (VALUES
  (0, 0.4551, 0.3664),
  (1, -0.3826, -0.4458),
  (2, 0.3311, 0.8067),
  (3, -0.2624, -0.4485),
  (4, -0.0727, 0.5658),
  (5, 0.8387, -0.1270),
  (6, 0.4998, -0.2269),
  (7, -0.6452, 0.1887),
  (8, -0.5805, 0.6519),
  (9, -0.6556, 0.1749),
  (10, 0.5026, 0.1421),
  (11, 0.1600, 0.5050)
) AS p(position, x, y)
WHERE a.is_anchor AND a.title = '기준 scatter'
  AND NOT EXISTS (SELECT 1 FROM public.artwork_point q WHERE q.artwork_id = a.id);

-- 4) 확인. 기준 4행, 좌표 계 18+16+18+12 = 64 행, 루브릭 교체됨.
SELECT
  (SELECT count(*) FROM public.artwork WHERE is_anchor) AS anchors,
  (SELECT count(*) FROM public.artwork_point p JOIN public.artwork a ON a.id = p.artwork_id WHERE a.is_anchor) AS anchor_points,
  (SELECT position('기준 그림들과' in theme_prompt) > 0 FROM public.artwork_round WHERE theme = '고양이') AS rubric_v6;
