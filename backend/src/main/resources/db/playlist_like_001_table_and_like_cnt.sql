-- 플레이리스트 좋아요 [S15P21A405-442] — 이미 playlist 테이블이 있는 DB 에 실행한다.
--
-- 1) 누가 어떤 플레이리스트를 좋아요 했는지 기록한다.
--    PK 가 (playlist_id, email) 이라 같은 사람이 같은 플레이리스트에 두 번 들어갈 수 없다.
--    애플리케이션도 ON CONFLICT DO NOTHING 으로 막지만, 동시에 두 번 눌렸을 때 숫자가 두 번 오르지
--    않게 하는 최종 방어선은 이 PK 다.
CREATE TABLE IF NOT EXISTS public.playlist_like (
    playlist_id int8        NOT NULL,
    email       varchar(255) NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "PK_PLAYLIST_LIKE" PRIMARY KEY (playlist_id, email),
    CONSTRAINT "FK_playlist_TO_playlist_like_1" FOREIGN KEY (playlist_id)
        REFERENCES public.playlist(id) ON DELETE CASCADE
);

-- 2) "내가 좋아요한 플레이리스트" 를 email 로 찾기 위한 인덱스.
--    PK 는 playlist_id 로 시작해서 email 단독 조회에는 쓰이지 못한다.
--    CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없다. psql 로 한 줄씩 실행한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_playlist_like_email
    ON public.playlist_like (email, created_at DESC);

-- 3) like_cnt 를 NOT NULL DEFAULT 0 으로 바꾼다.
--    지금은 NULL 이 허용돼 증감할 때마다 COALESCE 가 필요하고, 화면에서도 null 과 0 을 구분해야 한다.
--    기존 NULL 을 먼저 0 으로 채운 뒤 제약을 건다 — 순서를 바꾸면 SET NOT NULL 이 실패한다.
UPDATE public.playlist SET like_cnt = 0 WHERE like_cnt IS NULL;

ALTER TABLE public.playlist ALTER COLUMN like_cnt SET DEFAULT 0;
ALTER TABLE public.playlist ALTER COLUMN like_cnt SET NOT NULL;

-- 4) 기록과 집계가 이미 어긋나 있다면 여기서 맞춘다(선택).
--    like_cnt 는 playlist_like 의 집계 사본이라 기존 값이 손으로 들어간 적이 있으면 다를 수 있다.
--    실행 전 아래로 차이를 먼저 확인한다.
--      SELECT p.id, p.like_cnt, count(l.email) AS actual
--        FROM playlist p LEFT JOIN playlist_like l ON l.playlist_id = p.id
--       GROUP BY p.id, p.like_cnt HAVING p.like_cnt <> count(l.email);
--
-- UPDATE public.playlist p
--    SET like_cnt = (SELECT count(*) FROM public.playlist_like l WHERE l.playlist_id = p.id);
