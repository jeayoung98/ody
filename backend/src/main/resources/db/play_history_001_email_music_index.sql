-- 사용자별 재생 곡 수 조회 인덱스 [S15P21A405-430] — 이미 play_history 가 있는 DB 에 실행한다.
--
-- GET /api/user/detail 이 COUNT(DISTINCT music_id) WHERE email = ? 로 재생한 곡 수를 센다.
-- 인덱스가 없으면 로그가 쌓일수록 전체 테이블을 훑어 느려진다. (email, music_id) 순서라면
-- 그 사용자 구간만 index only scan 으로 읽고 바로 distinct 를 센다 — 비용이 전체 로그 양이 아니라
-- 그 사용자의 기록 수에 비례한다.
--
-- CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없다. psql 로 한 줄씩 실행한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_play_history_email_music
    ON play_history (email, music_id);
