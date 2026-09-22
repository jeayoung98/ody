CREATE TABLE IF NOT EXISTS public.taste_analysis (
    email                   varchar(255) NOT NULL,
    analysis_date           date         NOT NULL,
    status                  varchar(16)  NOT NULL,
    requested_at            timestamptz  NOT NULL,
    lease_expires_at        timestamptz,
    completed_at            timestamptz,
    liked_set_hash          char(64),
    total_liked_count       int4,
    valid_music_count       int4,
    excluded_music_count    int4,
    report_level            varchar(16),
    bundle_version          varchar(128),
    reference_version       varchar(128),
    axis_label_version      varchar(128),
    analysis_policy_version varchar(64),
    prompt_version          varchar(64),
    model                   varchar(128),
    axis_stats              jsonb,
    findings                jsonb,
    summary                 text,
    narratives              jsonb,
    gms_response_id         varchar(255),
    failure_code            varchar(64),
    CONSTRAINT "PK_TASTE_ANALYSIS" PRIMARY KEY (email, analysis_date),
    CONSTRAINT "FK_user_TO_taste_analysis" FOREIGN KEY (email)
        REFERENCES public."user"(email) ON DELETE CASCADE,
    CONSTRAINT ck_taste_analysis_status CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
    CONSTRAINT ck_taste_analysis_counts CHECK (
        total_liked_count IS NULL OR
        (total_liked_count >= 0 AND valid_music_count >= 0 AND excluded_music_count >= 0
         AND total_liked_count = valid_music_count + excluded_music_count)),
    CONSTRAINT ck_taste_analysis_state CHECK (
        (status = 'PENDING'
         AND lease_expires_at IS NOT NULL
         AND lease_expires_at > requested_at
         AND completed_at IS NULL)
        OR
        (status = 'FAILED'
         AND lease_expires_at IS NULL
         AND completed_at IS NOT NULL
         AND failure_code IS NOT NULL)
        OR
        (status = 'SUCCESS'
         AND lease_expires_at IS NULL
         AND completed_at IS NOT NULL
         -- ROW IS NOT NULL은 아래 모든 필드가 채워졌는지 검사한다.
         AND ROW(liked_set_hash, total_liked_count, valid_music_count, excluded_music_count,
                 report_level, bundle_version, reference_version, axis_label_version,
                 analysis_policy_version, prompt_version, model,
                 axis_stats, findings, summary, narratives) IS NOT NULL
         AND failure_code IS NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_taste_analysis_active_user
    ON public.taste_analysis (email)
    WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS ix_taste_analysis_latest_success
    ON public.taste_analysis (email, completed_at DESC)
    WHERE status = 'SUCCESS';
