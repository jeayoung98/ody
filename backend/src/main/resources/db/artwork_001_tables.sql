-- 별자리 작품 AI 평가·회차 리더보드 [S15P21A405-563]
-- 설계: specs/009-constellation-artwork-ai/plan.md "데이터 모델"
--
-- 실행 순서대로 적었다. CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로
-- 맨 아래 블록만 psql·DBeaver 에서 한 줄씩 따로 실행한다.

-- 1) 회차. 주제 하나와 기간 하나. 리더보드의 단위다.
--    행은 사람이 넣는다 — 자동 생성 스케줄러는 이번 범위가 아니다.
CREATE SEQUENCE IF NOT EXISTS public.artwork_round_id_seq;

CREATE TABLE IF NOT EXISTS public.artwork_round (
    id           int8         NOT NULL,
    theme        varchar(50)  NOT NULL,
    -- AI 에게 그대로 넘기는 채점 기준 문장. 회차마다 다르고, 코드 배포 없이 여기서 고친다.
    theme_prompt text         NOT NULL,
    starts_at    timestamptz  NOT NULL,
    ends_at      timestamptz  NOT NULL,
    created_at   timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT "PK_ARTWORK_ROUND" PRIMARY KEY (id)
);

-- 2) 작품 = 제출 시점 스냅샷 + 평가 결과.
--    playlist_id 에 FK 를 걸지 않는 것은 의도다 — 원본 플레이리스트가 지워져도 작품은 남아야 한다.
--    score 가 NULL 허용인 것도 의도다. 평가 실패를 0 점으로 저장하면 "못생겼다"는 뜻이 되고
--    리더보드 바닥에 실패가 쌓인다.
CREATE SEQUENCE IF NOT EXISTS public.artwork_id_seq;

CREATE TABLE IF NOT EXISTS public.artwork (
    id             int8         NOT NULL,
    round_id       int8         NOT NULL,
    email          varchar(255) NOT NULL,
    playlist_id    int8         NULL,
    title          varchar(100) NOT NULL,
    layout_version varchar(50)  NOT NULL,
    status         varchar(20)  NOT NULL,
    score          int4         NULL,
    ai_comment     text         NULL,
    model          varchar(100) NULL,
    attempt_cnt    int4         NOT NULL DEFAULT 0,
    fail_reason    varchar(200) NULL,
    like_cnt       int4         NOT NULL DEFAULT 0,
    evaluated_at   timestamptz  NULL,
    created_at     timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT "PK_ARTWORK" PRIMARY KEY (id),
    CONSTRAINT "FK_artwork_round_TO_artwork_1" FOREIGN KEY (round_id)
        REFERENCES public.artwork_round(id),
    CONSTRAINT "CK_ARTWORK_STATUS" CHECK (status IN ('PENDING', 'SCORED', 'FAILED')),
    CONSTRAINT "CK_ARTWORK_SCORE" CHECK (score IS NULL OR (score >= 0 AND score <= 100)),
    -- 회차당 1작품. 같은 사람이 동시에 두 번 제출해도 여기서 막힌다.
    CONSTRAINT "UQ_ARTWORK_ROUND_EMAIL" UNIQUE (round_id, email)
);

-- 3) 스냅샷 좌표. 작품당 2~30행. playlist_item 과 같은 모양.
--    music_id 에 FK 를 걸지 않는다 — 곡 행이 사라져도 그림은 그대로 보여야 한다.
CREATE TABLE IF NOT EXISTS public.artwork_point (
    artwork_id int8   NOT NULL,
    position   int4   NOT NULL,
    music_id   int8   NOT NULL,
    x          float8 NOT NULL,
    y          float8 NOT NULL,
    CONSTRAINT "PK_ARTWORK_POINT" PRIMARY KEY (artwork_id, position),
    CONSTRAINT "FK_artwork_TO_artwork_point_1" FOREIGN KEY (artwork_id)
        REFERENCES public.artwork(id) ON DELETE CASCADE
);

-- 4) 좋아요. playlist_like 를 그대로 베꼈다.
--    PK 가 (artwork_id, email) 이라 같은 사람이 두 번 들어갈 수 없다. 애플리케이션도
--    ON CONFLICT DO NOTHING 으로 막지만, 동시에 두 번 눌렸을 때 like_cnt 가 두 번 오르지
--    않게 하는 최종 방어선은 이 PK 다.
CREATE TABLE IF NOT EXISTS public.artwork_like (
    artwork_id int8         NOT NULL,
    email      varchar(255) NOT NULL,
    created_at timestamptz  NOT NULL DEFAULT now(),
    CONSTRAINT "PK_ARTWORK_LIKE" PRIMARY KEY (artwork_id, email),
    CONSTRAINT "FK_artwork_TO_artwork_like_1" FOREIGN KEY (artwork_id)
        REFERENCES public.artwork(id) ON DELETE CASCADE
);

-- 5) 1회차. theme_prompt 는 AI 에게 그대로 넘어가는 문장이다.
--    재는 것은 "그림 솜씨" 가 아니라 "이 배치가 고양이로 보이느냐" 다 — 점의 위치는 곡의 좌표라
--    사용자가 선을 다듬을 수 없다. 숫자마다 말로 된 앵커를 박아 두어야 제출자마다 다른 잣대로
--    채점되지 않는다. 부위 체크리스트 합산은 쓰지 않는다: 부위가 다 있어도 엉뚱한 자리면 고양이가 아니다.
INSERT INTO public.artwork_round (id, theme, theme_prompt, starts_at, ends_at)
SELECT nextval('artwork_round_id_seq'),
       '고양이',
       '이 그림은 음악 플레이리스트의 곡들을 점으로 찍고 순서대로 선으로 이은 별자리다.
이 배치가 고양이로 보이는지만 판단하라. 선의 굵기나 그림 솜씨는 평가 대상이 아니다.

아래 기준에 맞춰 0~100 정수로 채점한다.
- 90~100: 설명 없이 한눈에 고양이다. 귀·머리·몸통·꼬리가 제자리에 있고 비율도 맞다
- 70~89: 고양이로 보인다. 부위는 다 있으나 비율이나 배치가 어색하다
- 50~69: 고양이라고 말해주면 그렇게 보인다. 부위 하나가 빠졌거나 자리가 틀렸다
- 30~49: 동물 같긴 하나 고양이로 집어 말하기 어렵다
- 10~29: 부위 하나 정도만 고양이를 연상시킨다
- 0~9: 고양이와 무관한 배치다

부위가 다 있어도 서로 엉뚱한 자리에 있어 한눈에 고양이로 안 보이면 50 아래다.
없는 것을 있다고 보지 마라. 애매하면 낮은 쪽을 준다.',
       now(),
       now() + interval '7 days'
WHERE NOT EXISTS (SELECT 1 FROM public.artwork_round);

-- ---------------------------------------------------------------------------
-- 아래는 트랜잭션 밖에서 한 줄씩 실행한다 (CONCURRENTLY).
-- ---------------------------------------------------------------------------

-- 리더보드 정렬 그대로. 부분 인덱스라 PENDING·FAILED 행은 들어가지 않는다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artwork_leaderboard
    ON public.artwork (round_id, score DESC, like_cnt DESC, created_at ASC)
    WHERE status = 'SCORED';

-- 평가 대상 뽑기. 스케줄러가 매 주기 도는 쿼리다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artwork_pending
    ON public.artwork (created_at)
    WHERE status = 'PENDING';

-- 내 작품 목록.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artwork_email
    ON public.artwork (email, created_at DESC);

-- "내가 좋아요한 작품" 용. PK 가 artwork_id 로 시작해서 email 단독 조회에는 쓰이지 못한다.
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_artwork_like_email
    ON public.artwork_like (email, created_at DESC);
