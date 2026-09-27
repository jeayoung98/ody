-- 별자리 작품 순위(AI + 좋아요)·회차당 좋아요 한도·닫힌 모양 [S15P21A405-616]
-- artwork_002_anchors.sql 이 적용된 DB 에 실행한다. 트랜잭션 안에서 실행해도 된다.
-- **배포 전에** 적용한다 — 전부 기본값이 있어 기존 코드는 새 칼럼을 모른 채 그대로 동작한다.
--
-- 왜: specs/011-artwork-ranking-votes. 순위 점수 = 좋아요 수 + AI 점수 / 100 × ai_weight.
--   K(ai_weight)와 표 한도는 회차마다 바꿀 수 있게 회차 행에 둔다 — 설정 파일이면 바꿀 때 재시작이 필요하다.
--   바꿀 때: UPDATE artwork_round SET ai_weight = 10 WHERE id = <회차>;  (배포·재시작 없음)
--
-- 롤백 (새 코드를 먼저 내린 뒤):
--   ALTER TABLE public.artwork       DROP COLUMN IF EXISTS closed;
--   ALTER TABLE public.artwork_round DROP COLUMN IF EXISTS ai_weight;
--   ALTER TABLE public.artwork_round DROP COLUMN IF EXISTS vote_limit;

-- 1) 회차별 규칙 값. 기본: 좋아요 3표, AI 만점 = 좋아요 5개.
ALTER TABLE public.artwork_round ADD COLUMN IF NOT EXISTS vote_limit int4    NOT NULL DEFAULT 3;
ALTER TABLE public.artwork_round ADD COLUMN IF NOT EXISTS ai_weight  numeric NOT NULL DEFAULT 5;

-- 2) 닫힌 모양(마지막 곡 → 첫 곡을 잇는다). 출품 스냅샷이라 이후 바뀌지 않는다.
ALTER TABLE public.artwork ADD COLUMN IF NOT EXISTS closed boolean NOT NULL DEFAULT false;
