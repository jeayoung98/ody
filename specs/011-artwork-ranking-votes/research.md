# Research: 작품 리더보드 순위(AI + 좋아요)와 회차당 좋아요 3표

**Date**: 2026-09-23 · **Spec**: [spec.md](./spec.md)

## R1. K 와 표 한도를 어디에 두나

- **Decision**: `artwork_round` 에 칸 두 개 — `vote_limit int NOT NULL DEFAULT 3`, `ai_weight numeric NOT NULL DEFAULT 5`. 바꿀 때는 DB `UPDATE`.
- **Rationale**: spec FR-002 "배포 없이". `@Value` 설정은 배포는 아니어도 **재시작**이 필요하다. 회차 행은 이미 사람이 DB 로 넣고, 주제 프롬프트도 `UPDATE` 로 고친다(009 NEXT §5-1 "배포 불필요") — 같은 관례다. FE 도 "규칙 값은 회차마다 바뀔 수 있어 프론트에 박지 않는다"(A-62) 고 했다. 회차별 값이면 다음 회차에 K 를 바꿔도 지난 회차 순위가 안 흔들린다.
- **Alternatives**: `application.yml` + env — 재시작 필요, 모든 회차에 한 값. 별도 설정 테이블 — 값 두 개에 테이블 하나는 과함.

## R2. 순위 계산

- **Decision**: 리더보드 SQL 에서 계산한다. 회차 `ai_weight` 를 파라미터로 넘겨 `rank_score = like_cnt + score * #{aiWeight} / 100.0`, `ORDER BY rank_score DESC, score DESC, created_at ASC`. 저장하지 않는다.
- **Rationale**: `like_cnt` 는 이미 비정규화 사본(563)이고 `score` 는 채점 뒤 고정이다. 저장하면 좋아요·K 변경마다 갱신해야 한다. 회차당 작품이 수백 개 수준이라 정렬 비용은 무시할 만하다.
- `ponytail:` 작품이 수만 개가 되면 `(round_id, rank_score)` 표현식 인덱스. 지금은 불필요.

## R3. 회차당 3표 — 경합

- **Decision**: `changeLike`(이미 `@Transactional`) 에서 좋아요를 **누를 때만** `SELECT pg_advisory_xact_lock(hashtext(email || ':' || round_id))` 를 잡고, 그 회차 작품에 준 좋아요 수를 센 뒤 한도 미만이면 INSERT.
- **Rationale**: 같은 사용자가 동시에 4번 누르면 READ COMMITTED 에서 넷 다 "2개" 를 보고 통과할 수 있다(FR-010·SC-002). 사용자×회차 단위 advisory lock 은 한 줄이고, 다른 사용자끼리는 막지 않는다. 트랜잭션이 끝나면 자동 해제.
- **Alternatives**: 사용자별 표 카운터 행 + `FOR UPDATE` — 테이블·동기화가 늘어난다. `SERIALIZABLE` — 재시도 로직 필요. 조건부 INSERT 한 문장 — READ COMMITTED 에서 경합을 못 막는다.

## R4. 표 세기와 돌려받기

- **Decision**: 쓴 표 = `artwork_like` ⋈ `artwork` 중 `round_id = 그 회차 AND l.email = 나 AND a.email <> 나` 의 수 — 배포 전 자기 작품에 눌러 둔 좋아요는 세지 않는다(analyze E1). 새 테이블 없음.
- **Rationale**: 거두면 행이 지워지고, 재출품·삭제는 FK CASCADE 로 좋아요가 지워진다 — 표 반납(FR-007)이 저절로 된다. 기존 초과분(배포 전 4개 이상)도 그대로 세어져 한도 밑으로 내려갈 때까지 새 좋아요가 막힌다(spec 가정).

## R5. 닫힌 회차·내 작품

- **Decision**: 작품의 `round_id` 가 `findOpenRound()` 의 id 와 다르면 `ARTWORK_ROUND_CLOSED`(409, 기존 코드 재사용). 작품 주인이면 `ARTWORK_VOTE_SELF`(400, 신규). 한도면 `ARTWORK_VOTE_LIMIT`(409, 신규).
- **Rationale**: FE 가 제안한 이름(`CONTEST_VOTE_SELF`·`CONTEST_VOTE_LIMIT`)과 뜻을 맞추되 접두는 도메인(`ARTWORK_`)을 따른다. 좋아요 **거두기**도 닫힌 회차면 막는다(끝난 순위 고정).
- 검사 순서: 존재·권한(기존) → 내 작품 → 닫힌 회차 → (누를 때만) 락·한도.

## R6. 리더보드의 곡·좌표

- **Decision**: `ArtworkSummary` 에 `points: [{musicId, title, artist, x, y}]` 를 붙인다. 페이지 작품 id 로 `artwork_point` 한 번(`WHERE artwork_id IN (...)`), 곡 이름은 `MusicDetailReader.findSummariesByIds` 한 번(PK 일괄, 598 과 같은 경로).
- **Rationale**: FE 갤러리·순위 카드가 썸네일(좌표)과 곡 이름을 그린다. 지금 리더보드는 `musicCnt` 뿐이라 FE 가 카드마다 상세를 부르게 된다(N+1). 상세 응답의 기존 `musics` 는 지워진 곡이 빠지는 별도 배열이라 `points` 와 순번이 어긋날 수 있다 — 상세에도 같은 원소(`tracks`)를 더한다. 곡 상세는 이미 읽으므로 조립만 추가된다(analyze U1).
- 요소 모양이 598 `DrawTrack` 과 같아 616 에서 하나로 합쳤다 — `/draw` 응답도 `ArtworkTrack` 을 쓴다(JSON 모양 동일).

## R7. 닫힌 모양 렌더

- **Decision**: `ArtworkRenderer.render(points, closed)` 오버로드. 기존 `render(points)` 는 `closed=false` 로 위임(기준 그림 경로 불변). 채점 서비스는 `artwork.closed` 를 넘긴다.
- **Rationale**: 기준 그림(anchor)은 열린 모양으로 채점된 기존 값이라 그대로 둔다. 같은 입력 → 같은 바이트(563 테스트)는 유지.
