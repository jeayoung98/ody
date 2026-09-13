-- 탐색 설문 피드백 [S15P21A405-289]
-- 주변 탐색(nearby)·범위 탐색(journey)에서 곡 하나가 끝날 때 받는 응답. row 1개 = 곡 1개 재생.
-- 거리·bpm 차이는 저장하지 않는다 — music.location(vector 16)·music.bpm 을 조인해 분석 시 계산한다.
-- 좌표는 minor 버전에서 바꾸지 않으므로(계약 AC3) 이 표는 후처리 규칙·여정 파라미터 조정 근거로만 쓴다.
CREATE TABLE IF NOT EXISTS explore_feedback (
    id               bigserial PRIMARY KEY,
    session_id       uuid        NOT NULL,                       -- 탐색 1회. 결과 목록 로드 시 FE 가 생성
    mode             text        NOT NULL CHECK (mode IN ('nearby', 'journey')),
    rank             smallint    NOT NULL CHECK (rank BETWEEN 1 AND 50), -- nearby: 이웃 순위 1.. / journey: path step 1..
    anchor_music_id  bigint      NOT NULL REFERENCES music(id),  -- nearby: 기준곡 / journey: 출발곡
    target_music_id  bigint      REFERENCES music(id),           -- journey: 도착곡
    prev_music_id    bigint      REFERENCES music(id),           -- journey: 앞 역 (1역은 출발곡)
    music_id         bigint      NOT NULL REFERENCES music(id),  -- 평가 대상 곡
    verdict          boolean,                                    -- true 비슷·자연스러움 / false 아님 / NULL 무응답
    reason           text        CHECK (reason IN ('dup', 'mood', 'tempo', 'spoken')),
    listened_sec     smallint    CHECK (listened_sec >= 0),
    skipped          boolean     NOT NULL DEFAULT false,
    user_email       varchar(255),                               -- 비로그인 NULL. 탈퇴해도 응답은 남긴다(FK 없음)
    bundle           text        NOT NULL,                       -- ody.serving.bundle (v2.1-pca16)
    rules            text        NOT NULL,                       -- 응답 시점 후처리 임계값 스냅샷 (dup=..,cap=..,far=..)
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT uq_explore_feedback_session_rank UNIQUE (session_id, rank),
    CONSTRAINT ck_explore_feedback_reason_needs_negative CHECK (reason IS NULL OR verdict = false)
);

CREATE INDEX IF NOT EXISTS ix_explore_feedback_mode_bundle_created ON explore_feedback (mode, bundle, created_at);
CREATE INDEX IF NOT EXISTS ix_explore_feedback_anchor ON explore_feedback (anchor_music_id);
