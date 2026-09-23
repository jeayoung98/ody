-- 사용자별 발견 곡 수 조회 인덱스 [S15P21A405-597] — music_discovery_001 을 적용한 DB 에 실행한다.
--
-- GET /api/user/detail 이 COUNT(*) WHERE email = ? 로 발견한 곡 수를 센다.
-- PK(music_id) 와 (discovered_at, email) 인덱스는 email 로 시작하지 않아 이 조건에 쓰이지 않고,
-- 그대로 두면 상세 조회마다 테이블 전체를 훑는다. email 이 앞이면 그 사용자 구간만 index only scan 으로
-- 읽는다 — 비용이 전체 곡 수가 아니라 그 사람이 발견한 곡 수에 비례한다.
-- discovered_at 을 뒤에 둔 것은 이후 "발견한 곡 목록"을 최신순으로 읽을 때 같은 인덱스를 쓰기 위해서다.
--
-- CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없다. psql 로 한 줄씩 실행한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_music_discovery_email
    ON public.music_discovery (email, discovered_at);
