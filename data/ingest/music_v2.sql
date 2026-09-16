-- music_v2 재적재 테이블 DDL (스펙 18, Jira S15P21A405-381)
--
-- 왜 새 테이블인가
--   제외 규칙 v5(S15P21A405-382)로 곡이 662만 → 469만으로 줄면 build_csv 가 부여하는
--   id(mbid 오름차순 1..N, D13)가 **전부 밀린다**. 기존 music 을 UPDATE 조인으로 덮어쓸 수 없고,
--   BE 의 playlist_item 이 music 을 FK 로 참조해 TRUNCATE 도 막힌다(2026-09-13 실측).
--   그래서 빈 테이블에 새로 적재하고, 컷오버는 검증이 끝난 뒤 따로 정한다.
--
-- 실행 (운영 DB 는 사람이 DBeaver 로 실행한다. Claude 는 SSH·psql 접근이 없다)
--   DBeaver 에서 이 파일을 열어 ody DB 에 실행하거나,
--   docker cp music_v2.sql ody-postgres:/tmp/ && docker exec ody-postgres bash -lc \
--     'psql -X -v ON_ERROR_STOP=1 -U $POSTGRES_USER -d $POSTGRES_DB -f /tmp/music_v2.sql'
--
-- 멱등하다. 두 번 돌려도 결과가 같다. 인덱스는 여기서 만들지 않는다 —
-- COPY 전에 인덱스가 있으면 적재가 느려진다. 인덱스는 ingest/load_postgres.sh 가 적재 뒤 만든다.

\timing on

-- 1) music_v2 — 컬럼·타입은 현재 music 과 같다(2026-09-13 album_mbid 추가분 포함).
--    id 에 IDENTITY·시퀀스를 두지 않는다. 값은 우리가 넣는다(D13).
CREATE TABLE IF NOT EXISTS music_v2 (
  id           BIGINT        PRIMARY KEY,
  mbid         VARCHAR(64)   NOT NULL,
  title        VARCHAR(200)  NOT NULL,
  artist       VARCHAR(500),
  release_year SMALLINT,
  bpm          NUMERIC(5,1),
  duration     INTEGER,
  album        VARCHAR(200),
  youtube_url  TEXT,
  location     VECTOR(16),
  play_cnt     INTEGER       NOT NULL DEFAULT 0,
  youtube_cnt  INTEGER       NOT NULL DEFAULT 0,
  album_mbid   VARCHAR(36)
);
COMMENT ON TABLE music_v2 IS '제외 규칙 v5 재적재본. 컷오버 전까지 music 과 병행한다';
COMMENT ON COLUMN music_v2.location IS 'PCA-16 지도 좌표(D7). 지역이 아니다. 거리는 L2';
COMMENT ON COLUMN music_v2.album_mbid IS '커버 아트 키. coverartarchive.org/release/{album_mbid}/front-250';

-- 2) music_genre_v2 — music_id 가 새 id 체계를 가리키므로 링크 테이블도 새로 만든다.
--    genre 는 코드 29개 그대로라 기존 테이블을 재사용한다(아래 4번 검증 참조).
CREATE TABLE IF NOT EXISTS music_genre_v2 (
  id       BIGINT PRIMARY KEY,
  music_id BIGINT NOT NULL,
  genre_id BIGINT NOT NULL
);
COMMENT ON TABLE music_genre_v2 IS 'music_v2.id 기준 곡-장르 링크. 곡의 99% 는 장르가 없다(정상)';

-- 3) 적재 전 상태 — 둘 다 0행이어야 COPY 경로로 간다
SELECT 'music_v2' AS t, count(*) FROM music_v2
UNION ALL SELECT 'music_genre_v2', count(*) FROM music_genre_v2;

-- 4) genre 재사용이 안전한지 확인한다
--    build_csv 는 `genre.csv` 의 id 를 "적재 대상 곡에 등장하는 코드를 정렬해 1부터" 로 매긴다.
--    v5 제외로 어떤 코드가 통째로 사라지면 그 뒤 코드의 id 가 전부 밀리고,
--    기존 genre 테이블과 어긋난 채 music_genre_v2 가 들어간다.
--    그래서 적재 직전에 genre.csv 와 이 결과를 대조한다(load_postgres.sh 도 같은 검사를 한다).
SELECT count(*) AS genre_rows, min(id) AS id_min, max(id) AS id_max FROM genre;
SELECT id, name FROM genre ORDER BY id;
