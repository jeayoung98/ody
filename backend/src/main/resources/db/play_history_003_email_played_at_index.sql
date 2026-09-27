-- 사용자별 마지막 재생곡 조회 인덱스 [S15P21A405-713] — 이미 play_history 가 있는 DB 에 실행한다.
--
-- GET /api/user/detail 이 WHERE email = ? ORDER BY played_at DESC, id DESC LIMIT 1 로 마지막 재생곡을 고른다.
-- (email, music_id) 인덱스(play_history_001)로는 그 사용자 기록을 다 읽고 정렬해야 한다 — 비용이 그 사용자의
-- 기록 수에 비례한다. 같은 순서의 인덱스가 있으면 맨 앞 한 줄만 읽는다. 실시간 첫 입장
-- (PlayHistoryMapper.findLatestMusicId)도 같은 쿼리라 함께 빨라진다.
--
-- CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없다. psql 로 한 줄씩 실행한다.
-- 되돌리기: DROP INDEX CONCURRENTLY IF EXISTS ix_play_history_email_played_at;
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_play_history_email_played_at
    ON play_history (email, played_at DESC, id DESC);
