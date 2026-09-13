-- 탐색 설문 피드백 2차 [S15P21A405-292] — 이미 explore_feedback 이 있는 DB 에 실행한다.
-- 새 DB 는 explore_feedback.sql 하나로 같은 상태가 된다.
-- 1) anonymous_id: 1차 배포가 비로그인이라 user_email 이 전부 NULL. 브라우저 localStorage 의 UUID 로 사람을 구분한다.
--    응답 100건이 1명인지 10명인지 알아야 정밀도를 믿을 수 있다.
-- 2) 부정 응답(verdict=false)은 이유 칩 하나를 반드시 고른다(팀 결정 2026-09-13). CHECK 를 양방향으로 바꾼다.
ALTER TABLE explore_feedback ADD COLUMN IF NOT EXISTS anonymous_id uuid;
CREATE INDEX IF NOT EXISTS ix_explore_feedback_anon ON explore_feedback (anonymous_id);

ALTER TABLE explore_feedback DROP CONSTRAINT IF EXISTS ck_explore_feedback_reason_needs_negative;
ALTER TABLE explore_feedback ADD CONSTRAINT ck_explore_feedback_reason_iff_negative
    CHECK ((verdict = false) = (reason IS NOT NULL));
