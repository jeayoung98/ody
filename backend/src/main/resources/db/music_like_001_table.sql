-- 개별 곡 좋아요. 분석과 마이페이지 가상 플레이리스트의 단일 원천이다.
CREATE TABLE IF NOT EXISTS public.music_like (
    email      varchar(255) NOT NULL,
    music_id   int8         NOT NULL,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT "PK_MUSIC_LIKE" PRIMARY KEY (email, music_id),
    CONSTRAINT "FK_user_TO_music_like" FOREIGN KEY (email)
        REFERENCES public."user"(email) ON DELETE CASCADE,
    CONSTRAINT "FK_music_TO_music_like" FOREIGN KEY (music_id)
        REFERENCES public.music(id) ON DELETE CASCADE
);

-- 같은 시각에도 music_id로 순서를 고정한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_music_like_email_created
    ON public.music_like (email, created_at DESC, music_id DESC);
