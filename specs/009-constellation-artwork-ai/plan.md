# Implementation Plan: 별자리 작품 AI 평가와 회차 리더보드

**Branch**: `backend/feat/S15P21A405-548-constellation-ai-leaderboard` | **Date**: 2026-09-22 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-constellation-artwork-ai/spec.md`

## Summary

제출하면 **그 순간의 별자리(곡·순서·좌표)를 통째로 복사해** 작품 행으로 남기고, 스케줄러가 그 좌표로 PNG 를 그려 GMS(`gpt5.4 mini`)에 "회차 주제를 얼마나 닮았나"를 묻는다. 점수가 붙은 작품만 회차 리더보드에 점수 순으로 선다. 좋아요는 `playlist_like` 구조를 그대로 베낀다.

새로 만드는 것은 도메인 하나(`artwork`)와 외부 어댑터 하나(GMS)다. 나머지는 이미 있는 것을 쓴다.

| 필요한 것 | 새로 만드나 | 무엇을 쓰나 |
| --- | --- | --- |
| 2D 좌표 계산 | 아니오 | `ConstellationService.layout(musicIds)` 를 그대로 호출 |
| 좋아요 | 아니오(구조 복제) | `playlist_like` 의 복합 PK + 비정규화 `like_cnt` 패턴 |
| 외부 HTTP | 아니오 | `RestClient` + `SimpleClientHttpRequestFactory` (`VideoIdApiClient` 와 같은 모양) |
| 비동기 실행 | 아니오 | `@EnableScheduling`·`@EnableAsync` 가 `RealtimeTaskConfig` 에 이미 켜져 있다 |
| 이미지 렌더 | 예 | **JDK 표준** `java.awt.image.BufferedImage` + `javax.imageio.ImageIO`. 의존성 추가 없음 |
| 곡 정보 일괄 조회 | 아니오 | 플레이리스트 상세가 쓰는 배치 조회 경로 |

## Technical Context

**Language/Version**: Java 17 (`sourceCompatibility = '17'`)

**Primary Dependencies**: Spring Boot 4.1.1, `RestClient`, MyBatis 4.1.0. **추가 의존성 없음** — 이미지 인코딩은 JDK `ImageIO`(PNG 는 JDK 기본 제공 writer)

**Storage**: PostgreSQL. 신규 테이블 4개 + 시퀀스 3개. DDL 은 `backend/src/main/resources/db/artwork_001_tables.sql` 에 두고 **사람이 DBeaver 로 실행**(기존 관례)

**Testing**: JUnit 5 + Mockito + AssertJ. GMS 어댑터는 `MockRestServiceServer`. 렌더러는 픽셀이 아니라 **출력 바이트가 PNG 이고 좌표가 같으면 바이트가 같다**는 결정성으로 검증

**Target Platform**: Linux 서버(Docker) 위 Spring Boot 단일 백엔드. `java.awt` 사용에 **`-Djava.awt.headless=true` 필요**(Spring Boot 기본값이 true 지만 명시)

**Project Type**: 웹 서비스 (`backend/` + `frontend/`)

**Performance Goals**: 제출 API 는 LLM 을 기다리지 않는다(SC-001). 평가 지연 목표는 **정하지 않는다** — GMS 실측 전에 숫자를 인수 기준으로 삼지 않는다(헌법 IX)

**Constraints**: GMS 호출은 연결 3초·읽기 30초에서 끊는다(vision 응답은 검색 API 보다 느리다 — 실측 후 조정). 한 번에 평가하는 작품 수는 배치 상한으로 묶는다

**Scale/Scope**: 신규 패키지 `com.ssafy.backend.artwork`. 신규 파일 약 30개, 기존 파일 수정 0~1개(에러 코드 enum 은 신규 파일)

### GMS 호출 계약

저장소에 GMS 사용처가 없다(`grep -ri gms` 무결과). 아래는 **설정으로 빼는 값**이다.

| 설정 키 | 값 | 상태 |
| --- | --- | --- |
| `ody.artwork.gms.base-url` | `https://gms.ssafy.io/gmsapi/api.openai.com` | 확인 (GMS 문서) |
| `ody.artwork.gms.model` | `gpt-4o-mini` | 확인 (GMS 모델 목록). **정확한 id 문자열은 첫 호출로 검증** |
| `ody.artwork.gms.api-key` | 인증 키. `.env` 로만 주입, 저장소·로그 금지 (FR-016) | 발급 필요 |
| `ody.artwork.gms.timeout-read-ms` | 읽기 타임아웃. 잠정 30000 | 실측 후 확정 |

경로 `/v1/chat/completions` 는 어댑터가 갖는다 — base URL 에 넣지 않는다(`VideoIdApiClient` 가 base URL 과 `/videoid` 를 나눠 갖는 것과 같다).

**모델 선택 근거**: GMS 모델 목록에서 **이미지 입력이 명시된 것** 중 가장 싸다(2 Credit). "구조화된 출력 포함" 이라 `{score, comment}` JSON 강제가 되어 파싱 실패 경로가 줄어든다.

| 후보 | Credit | 이미지 입력 |
| --- | --- | --- |
| **`gpt-4o-mini`** | **2** | 명시 — "텍스트 및 이미지 입력 지원, 구조화된 출력 포함" |
| `gemini-3.5-flash` | 18 | 명시 — 멀티모달 |
| `gpt-4o` | 20 | 명시 — 텍스트·이미지·오디오 |
| `gpt-5.4-mini` | 14 | **없음** — 목록 설명에 멀티모달 언급 없음. 탈락 |

점수에 변별력이 없으면(전부 비슷한 값) `gpt-4o` 나 `gemini-3.5-flash` 로 올린다. 모델 id 가 설정값이라 **환경변수 교체 + 컨테이너 재시작**으로 끝나고 재배포가 필요 없다.

**비용 상한**: 회차당 1작품 + 재시도 3회 = 사용자당 최대 4회. 100명 기준 800 Credit.

**요청 형태 가정**: OpenAI 호환 `POST /v1/chat/completions`, 이미지 입력은 `content` 배열의 `image_url` 파트에 `data:image/png;base64,...`. 인증 헤더는 `Authorization: Bearer <key>` 로 가정한다. **프록시가 이미지 파트를 통과시키는지, 헤더 형식이 맞는지는 첫 호출로 확인한다**(tasks T000b). 틀리면 어댑터 한 클래스(`GmsEvaluationClient`)만 바뀐다 — 포트 인터페이스(`ArtworkEvaluationPort`)가 그 경계다.

**응답 파싱**: 모델에게 JSON 한 개만 답하라고 지시한다.

```json
{ "score": 0-100 정수, "comment": "한국어 한 줄" }
```

파싱 실패·`score` 범위 밖·`comment` 없음은 **전부 실패**로 본다(FR-006, spec US3-5). 모델이 뱉은 값을 검증 없이 쓰지 않는다.

## Constitution Check

*GATE: Phase 0 전 통과. 설계 후 재확인 — 동일.*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I. 명세 우선 | **조건부** | 이 기능은 FEATURES.md 에 없다. 스펙을 먼저 썼지만 **기획 확인 전에는 구현 착수 불가**다(spec "기능 명세와의 관계") |
| II. 계약 우선 | 통과 | API 계약을 아래 §API 계약 에 고정하고 프론트에 먼저 전달한다 |
| III. 완료 전 검증 | 통과 예정 | 스냅샷 불변·실패 처리·정렬·좋아요 멱등을 테스트로 고정. `./gradlew test` 통과가 완료 조건 |
| V. 좌표 안정성 | 통과 | 좌표를 다시 계산하지 않고 `ConstellationService` 가 낸 값을 **복사만** 한다. 작품은 `layout_version` 을 함께 기록해 어떤 baseline 의 모양인지 남긴다 |
| VII. 실험 격리 | 통과 | 모델 id·프롬프트를 작품 행에 기록해 어떤 모델이 준 점수인지 구분 가능하게 한다 |
| VIII. 관측 가능성 | 통과 | 아래 "확인할 지표" |
| IX. 암묵적 가정 금지 | 통과 | GMS 계약을 **미확인으로 표시**했다. 회차당 1작품 정책도 기획 확인 대상으로 남겼다 |
| X. 아키텍처 경계 | 통과 | 변경은 `backend/` 안. `frontend/`·`data/` 는 읽기만. 좌표는 `music` 도메인의 공개 서비스로만 얻는다 |

**확인할 지표**:
- `artwork` 상태별 행 수 — `PENDING` 이 계속 쌓이면 평가 루프가 죽은 것이다
- GMS 호출 수·실패 수·소요 시간 (로그. 새 미터는 실측 뒤에 정한다)
- 로그에 API 키·이미지 base64 를 찍지 않는다 (FR-016, 헌법 VIII)

## 데이터 모델

### 테이블

```sql
-- 회차. 행은 사람이 넣는다(자동 생성 스케줄러는 범위 밖).
artwork_round
  id           int8 PK        -- artwork_round_id_seq
  theme        varchar(50)    NOT NULL   -- '고양이'
  theme_prompt text           NOT NULL   -- AI 에게 줄 기준 문장. 회차마다 다르다
  starts_at    timestamptz    NOT NULL
  ends_at      timestamptz    NOT NULL
  created_at   timestamptz    NOT NULL DEFAULT now()

-- 작품 = 제출 시점 스냅샷 + 평가 결과.
artwork
  id             int8 PK      -- artwork_id_seq
  round_id       int8         NOT NULL  FK artwork_round(id)
  email          varchar(255) NOT NULL              -- 제출자
  playlist_id    int8         NULL                  -- 출처 기록용. FK 아님(원본이 지워져도 남는다, FR-004)
  title          varchar(100) NOT NULL              -- 제출 시점 플레이리스트 이름 복사
  layout_version varchar(50)  NOT NULL              -- 어떤 좌표 baseline 의 모양인지 (헌법 V)
  status         varchar(20)  NOT NULL              -- PENDING | SCORED | FAILED
  score          int4         NULL                  -- 0~100. 실패는 NULL 이지 0 이 아니다 (FR-006)
  ai_comment     text         NULL
  model          varchar(100) NULL                  -- 점수를 준 모델 id (헌법 VII)
  attempt_cnt    int4         NOT NULL DEFAULT 0    -- 상한 3 (FR-007)
  fail_reason    varchar(200) NULL                  -- 사람이 읽을 요약. 키·본문 금지
  like_cnt       int4         NOT NULL DEFAULT 0    -- artwork_like 의 집계 사본
  evaluated_at   timestamptz  NULL
  created_at     timestamptz  NOT NULL DEFAULT now()
  CONSTRAINT UQ_ARTWORK_ROUND_EMAIL UNIQUE (round_id, email)   -- 회차당 1작품 (SC-005)

-- 스냅샷 좌표. 작품당 2~30행. playlist_item 과 같은 모양.
artwork_point
  artwork_id int8       NOT NULL  FK artwork(id) ON DELETE CASCADE
  position   int4       NOT NULL  -- 0부터. 제출 시점 곡 순서
  music_id   int8       NOT NULL  -- FK 아님: 곡이 지워져도 그림은 남는다
  x          float8     NOT NULL  -- -1 ~ 1
  y          float8     NOT NULL
  PRIMARY KEY (artwork_id, position)

-- 좋아요. playlist_like 를 그대로 베꼈다.
artwork_like
  artwork_id int8         NOT NULL  FK artwork(id) ON DELETE CASCADE
  email      varchar(255) NOT NULL
  created_at timestamptz  NOT NULL DEFAULT now()
  PRIMARY KEY (artwork_id, email)     -- 동시 클릭에도 1 만 오른다 (SC-006)
```

### 인덱스

```sql
-- 리더보드 정렬 그대로. WHERE status='SCORED' 부분 인덱스로 PENDING·FAILED 를 빼 둔다.
CREATE INDEX ix_artwork_leaderboard ON artwork (round_id, score DESC, like_cnt DESC, created_at ASC)
  WHERE status = 'SCORED';

-- 평가 대상 뽑기.
CREATE INDEX ix_artwork_pending ON artwork (created_at) WHERE status = 'PENDING';

-- 내 작품 목록.
CREATE INDEX ix_artwork_email ON artwork (email, created_at DESC);

-- "내가 좋아요한 작품" — playlist_like 와 같은 이유(PK 가 artwork_id 로 시작한다).
CREATE INDEX ix_artwork_like_email ON artwork_like (email, created_at DESC);
```

### 왜 좌표를 저장하나 (곡 id 만 두고 다시 계산하지 않는 이유)

같은 곡 집합이면 같은 좌표가 나오므로(헌법 V) 곡 id 만 저장해도 그림을 복원할 수 있다. 그래도 저장하는 이유:
**점수는 그 그림에 매겨진 것**이다. 좌표 baseline 이 바뀌면 곡 id 만 든 작품은 모양이 조용히 달라지고, 옛 점수가 새 그림에 붙는다. 작품당 최대 30행이라 비용은 무시할 수 있다.

## API 계약

전부 `ApiResponse{success,data,error}` 봉투. 인증은 기존과 같이 Bearer.

| 메서드 | 경로 | 인증 | 설명 |
| --- | --- | --- | --- |
| `GET` | `/api/artwork/round/current` | 불필요 | 열린 회차. 없으면 `data: null` |
| `POST` | `/api/artwork/submit` | 필요 | 플레이리스트를 작품으로 제출 |
| `GET` | `/api/artwork/leaderboard` | 선택 | 회차 리더보드 (`SCORED` 만) |
| `GET` | `/api/artwork/detail` | 선택 | 작품 상세 |
| `GET` | `/api/artwork/mine` | 필요 | 내 작품(모든 상태) |
| `POST` | `/api/artwork/like` | 필요 | 좋아요 목표 상태 변경 |
| `POST` | `/api/artwork/retry/{artworkId}` | 필요 | 실패 작품 재평가 |
| `DELETE` | `/api/artwork/{artworkId}` | 필요 | 작품 삭제 |

인증 "선택" 은 비로그인도 볼 수 있다는 뜻이며, 로그인 상태면 `likedByMe` 가 채워진다.

### `POST /api/artwork/submit`

```jsonc
// 요청
{ "playlistId": 12 }            // roundId 는 받지 않는다 — 항상 "지금 열린 회차"다

// 201
{ "success": true, "data": { "artworkId": 501, "status": "PENDING" }, "error": null }
```

| 상황 | 상태 | code |
| --- | --- | --- |
| 열린 회차 없음 | 409 | `ARTWORK_ROUND_CLOSED` |
| 남의 플레이리스트 | 403 | `FORBIDDEN` |
| 곡 수 2 미만 / 30 초과 | 400 | `INVALID_INPUT` |
| 없는 플레이리스트 | 404 | `PLAYLIST_NOT_FOUND` (기존 코드 재사용) |
| 곡 좌표를 못 만듦 | 404 | `MUSIC_NOT_FOUND` (배치 API 규칙 그대로) |

**같은 회차 재제출은 오류가 아니다.** 기존 작품을 지우고 새로 만든다(점수·좋아요 소멸, spec Clarifications).

### `GET /api/artwork/leaderboard?roundId={id}&page={n}&size={m}`

`roundId` 생략 시 열린 회차. `size` 기본 20·최대 50.

```jsonc
{ "success": true, "data": {
  "round": { "roundId": 1, "theme": "고양이", "startsAt": "...", "endsAt": "..." },
  "items": [
    { "artworkId": 501, "rank": 1, "title": "밤산책", "ownerEmail": "a@b.c",
      "score": 87, "aiComment": "귀 두 개와 꼬리가 또렷하다.",
      "likeCnt": 12, "likedByMe": false, "musicCnt": 14, "createdAt": "..." }
  ],
  "page": 0, "size": 20, "totalCnt": 137 } , "error": null }
```

`rank` 는 서버가 정렬 순서대로 매긴다(동점도 다른 등수 — 정렬 키가 3단이라 순서가 확정된다).

### `GET /api/artwork/detail?artworkId={id}`

```jsonc
{ "success": true, "data": {
  "artworkId": 501, "roundId": 1, "theme": "고양이",
  "title": "밤산책", "ownerEmail": "a@b.c", "mine": false,
  "status": "SCORED", "score": 87, "aiComment": "...",
  "likeCnt": 12, "likedByMe": false,
  "points": [ { "musicId": 900, "x": -0.42, "y": 0.13 } ],     // 제출 순서
  "musics": [ { "musicId": 900, "title": "...", "artist": "..." } ],  // points 와 같은 순서
  "createdAt": "...", "evaluatedAt": "..." }, "error": null }
```

- `status` 가 `PENDING`·`FAILED` 인 작품은 **소유자에게만** 200 이고, 남에게는 `404 ARTWORK_NOT_FOUND` 다 (FR-009). 존재 여부를 흘리지 않으려고 403 이 아니라 404 를 쓴다.
- `FAILED` 는 `score`·`aiComment` 가 `null` 이고 `failReason` 이 함께 온다.

### `POST /api/artwork/like`

```jsonc
{ "artworkId": 501, "liked": true }
// 200
{ "success": true, "data": { "artworkId": 501, "liked": true, "likeCnt": 13 }, "error": null }
```

`PlaylistController#changeLike` 와 같은 규칙 — 토글이 아니라 목표 상태라 반복해도 결과가 같다.

### `POST /api/artwork/retry/{artworkId}` · `DELETE /api/artwork/{artworkId}`

둘 다 소유자만. 재평가는 `FAILED` 에서만 가능하고 `attempt_cnt >= 3` 이면 거부한다.

### 신규 에러 코드 — `ArtworkErrorCode`

| code | HTTP | 언제 |
| --- | --- | --- |
| `ARTWORK_NOT_FOUND` | 404 | 없는 작품, 또는 남의 미채점 작품 |
| `ARTWORK_ROUND_CLOSED` | 409 | 열린 회차가 없다 |
| `ARTWORK_NOT_FAILED` | 409 | 실패가 아닌 작품에 재평가 요청 |
| `ARTWORK_RETRY_EXHAUSTED` | 409 | 재시도 3회 소진 |

`FORBIDDEN`·`INVALID_INPUT`·`NOT_FOUND` 는 `GlobalErrorCode` 를, `PLAYLIST_NOT_FOUND` 는 `PlaylistErrorCode` 를 그대로 쓴다. **프론트 `src/types/api.ts` 에 위 4개를 추가해야 한다.**

## 평가 흐름

제출은 행만 만들고 끝난다. 평가는 스케줄러가 한다.

```text
POST /submit
  └ 트랜잭션: (기존 작품 삭제) → artwork INSERT(PENDING) → artwork_point INSERT
  └ 201 반환. 여기서 GMS 를 부르지 않는다 (FR-013)

ArtworkEvaluationScheduler  @Scheduled(fixedDelay)
  └ PENDING 을 N건 집는다  (SELECT ... WHERE status='PENDING' ORDER BY created_at LIMIT N FOR UPDATE SKIP LOCKED)
  └ ArtworkRenderer      : artwork_point → BufferedImage → PNG bytes
  └ ArtworkEvaluationPort: PNG + theme_prompt → {score, comment}   (구현체 GmsEvaluationClient)
  └ 성공: status=SCORED, score, ai_comment, model, evaluated_at, attempt_cnt+1
     실패: status=FAILED, fail_reason, attempt_cnt+1   (score 는 건드리지 않는다 = NULL 유지)
  └ 작품 행이 이미 지워졌으면 아무것도 쓰지 않는다 (UPDATE 가 0행이면 끝)
```

**`@Async` 대신 스케줄러를 쓰는 이유**: `@Async` 는 코드가 더 짧지만 서버가 재시작하면 진행 중이던 `PENDING` 이 영영 멈춘다. 스케줄러는 같은 코드로 최초 평가·재시도·재시작 복구를 모두 덮는다. `FOR UPDATE SKIP LOCKED` 로 인스턴스가 늘어도 같은 작품을 두 번 평가하지 않는다.

`@EnableScheduling`·`@EnableAsync` 는 `RealtimeTaskConfig` 에 이미 있다 — 설정 추가 없음.

### 이미지 렌더 (`ArtworkRenderer`)

- 512×512 PNG, 검은 배경, 점은 흰 원, 이웃한 `position` 끼리 흰 선으로 잇는다(프론트 별자리와 같은 규칙: 여정·플리 모두 순서대로 연결 — PATH-01).
- `x`·`y` 는 -1~1 → 여백 8% 를 남기고 픽셀로 매핑. `y` 는 위가 양수이므로 뒤집는다.
- **같은 좌표 입력이면 같은 바이트**가 나와야 한다(테스트로 고정). 시간·난수·글꼴을 쓰지 않는다 — 글자를 그리지 않으므로 서버 글꼴에 의존하지 않는다.
- `java.awt` 는 headless 로 동작한다. 컨테이너 실행에 `-Djava.awt.headless=true` 를 명시한다.

## Project Structure

```text
backend/src/main/java/com/ssafy/backend/artwork/
├── controller/ArtworkController.java
├── dto/            (요청·응답 record — submit / leaderboard / detail / like / round)
├── mapper/ArtworkMapper.java          ArtworkRoundMapper.java     ArtworkLikeMapper.java
├── service/ArtworkService.java        ArtworkLikeService.java     ArtworkEvaluationService.java
├── scheduler/ArtworkEvaluationScheduler.java
├── render/ArtworkRenderer.java
└── evaluation/ArtworkEvaluationPort.java   GmsEvaluationClient.java   GmsChatResponse.java

backend/src/main/java/com/ssafy/backend/common/ArtworkErrorCode.java
backend/src/main/resources/mapper/artwork/*.xml
backend/src/main/resources/db/artwork_001_tables.sql
```

`music/`(좌표)·`playlist/`(소유권 확인)는 **읽기만** 한다 — 각 도메인의 공개 서비스 메서드로만 부른다(헌법 X).

## 위험과 대응

| 위험 | 대응 |
| --- | --- |
| GMS 계약 가정이 틀리다 | 어댑터 한 클래스로 격리(`ArtworkEvaluationPort`). 구현 전 실물 호출 1회로 확인 |
| 모델이 매번 다른 점수를 준다 | 같은 작품을 다시 평가하지 않는다(성공하면 끝). 재평가는 실패 때만 |
| `PENDING` 적체 | 상태별 행 수를 본다. 스케줄러 배치 크기·주기는 설정값 |
| 이미지가 LLM 이 읽기엔 너무 성기다 | 점 크기·선 두께를 설정으로 빼고 실측으로 조정. 프롬프트도 회차 행(`theme_prompt`)에 있어 코드 배포 없이 고친다 |
| 비용 | 회차당 1작품 + 재시도 3회 = 사용자당 최대 4회 |

## 검증

```bash
cd backend
./gradlew test
./gradlew build
```

DDL 은 사람이 DBeaver 로 실행한다. 실행 전후로 `SELECT count(*) FROM artwork` 가 성립하는지 확인한다.
