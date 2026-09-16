-- 탐색 설문 피드백 3차 [S15P21A405-346] — 이미 explore_feedback 이 있는 DB 에 실행한다.
-- 같은 사람(user_email 또는 anonymous_id)이 같은 문항에 두 번 답하지 못하게 저장 전에 조회하고,
-- GET /api/feedback/answered 로 답한 문항을 돌려준다. 둘 다 user_email 로도 찾으므로 인덱스를 추가한다.
-- anonymous_id 인덱스(ix_explore_feedback_anon)는 2차에 이미 있다.
CREATE INDEX IF NOT EXISTS ix_explore_feedback_user_email ON explore_feedback (user_email);
