-- 주간 랭킹 [S15P21A405-448] — 이미 play_history·music_report 가 있는 DB 에 실행한다.
--
-- 1) 곡별 최초 청취자 기록.
--    music_id 가 PK 라 곡당 한 줄뿐이고, 그 줄을 만든 사람이 발견자다.
--    재생할 때마다 INSERT ... ON CONFLICT DO NOTHING 으로 넣으므로 두 번째부터는 조용히 무시된다.
--    동시에 두 사람이 같은 곡을 처음 재생해도 PK 가 한 명만 남긴다.
CREATE TABLE IF NOT EXISTS public.music_discovery (
    music_id      int8        NOT NULL,
    email         varchar(255) NOT NULL,
    discovered_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "PK_MUSIC_DISCOVERY" PRIMARY KEY (music_id)
);

-- 2) 과거 재생 기록으로 채운다 (백필).
--    곡마다 가장 이른 재생 한 줄을 골라 넣는다. 같은 시각이 둘이면 play_history.id 가 작은 쪽이다.
--    이미 들어 있는 곡은 건드리지 않으므로 여러 번 실행해도 안전하다.
--    ⚠️ 이 문장은 play_history 전체를 훑는다. 서비스 중이라면 한가한 시간에 한 번만 실행한다.
INSERT INTO public.music_discovery (music_id, email, discovered_at)
SELECT DISTINCT ON (music_id) music_id, email, played_at
  FROM public.play_history
 WHERE email IS NOT NULL
 ORDER BY music_id, played_at, id
ON CONFLICT (music_id) DO NOTHING;

-- 3) 주간 집계 구간 인덱스.
--    세 랭킹 모두 "이번 주" 로 범위를 자른 뒤 email 로 묶는다. 시각 컬럼에 인덱스가 없으면
--    주마다 테이블 전체를 훑게 되고, 로그가 쌓일수록 느려진다.
--    CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없다. psql 로 한 줄씩 실행한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_music_discovery_discovered_at
    ON public.music_discovery (discovered_at, email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_play_history_played_at
    ON public.play_history (played_at, email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_music_report_created_at
    ON public.music_report (created_at, user_email);

-- 검증: 백필이 끝난 뒤 곡 수가 맞는지 본다. 두 값이 같아야 한다.
--   SELECT (SELECT count(DISTINCT music_id) FROM play_history WHERE email IS NOT NULL) AS played_musics,
--          (SELECT count(*) FROM music_discovery) AS discovered;
