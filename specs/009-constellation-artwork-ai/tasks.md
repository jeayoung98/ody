---
description: "Task list for 별자리 작품 AI 평가와 회차 리더보드"
---

# Tasks: 별자리 작품 AI 평가와 회차 리더보드

**Input**: Design documents from `/specs/009-constellation-artwork-ai/`

**Prerequisites**: spec.md, plan.md

**Tests**: 명세가 스냅샷 불변(FR-003)·실패 처리(FR-006)·정렬(FR-008)·멱등(FR-011)을 요구한다(헌법 III). 테스트 과제를 포함한다.

> **설계는 S15P21A405-548, 구현은 S15P21A405-563** (브랜치 `backend/feat/S15P21A405-563-artwork-ai`).
>
> 2026-09-22 기준 코드는 다 들어갔고 `./gradlew test`(924건)·`./gradlew build` 가 통과한다.
> 운영 DB 의 DDL 도 적용했다(2026-09-22, 사람이 DBeaver 로 실행).
> 남은 것은 **T000a(기획 승인)** 과 **T000c(Credit 확인)** 이다. 둘 다 코드 작업이 아니다.
>
> 구현하며 합친 것: T007 은 T008 의 `ArtworkMapper` 하나로, T023·T024 는 `ArtworkService` 안으로 넣었다.
> 네 테이블이 늘 함께 움직이는 하나의 집합체라 매퍼·서비스를 쪼갤 이유가 없었다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 의존 없음)
- **[Story]**: US1(제출·채점) / US2(리더보드·좋아요) / US3(실패·재시도)

## Path Conventions

`backend/src/main/java/com/ssafy/backend/artwork/…`, 테스트는 `backend/src/test/java/…`

---

## Phase 0: 착수 전 확인 (사람이 한다 — 코드 아님)

**Purpose**: 지어낸 가정 위에 코드를 쌓지 않는다 (헌법 IX)

- [ ] T000a 기획 확인 — (a) FEATURES.md 에 이 기능 항목 신설, (b) `SOCIAL-12` 와의 관계 정리(좋아요 순 vs AI 점수 순), (c) **회차당 1작품·교체 시 점수 소멸** 정책 승인. spec "기능 명세와의 관계" 참조
- [X] T000b GMS 실물 확인 — **완료 (2026-09-22)**. 배포 호스트에서 1×1 PNG 를 `image_url` data URI 로 실어 호출: `HTTP 200`, 0.85s, `model=gpt-4o-mini-2024-07-18`, 인증은 `Authorization: Bearer`. **프록시가 이미지 파트를 통과시킨다** — 설계 변경 없음. 값은 `/etc/ody/backend.env` 에 있다. 결과는 plan.md "실호출 확인" 에 기록
- [ ] T000c 이미지 토큰 비용 확인 — 1×1 짜리에 `prompt_tokens` 가 **8,521** 붙었다. GMS Credit 이 **호출당 정액(2)** 인지 토큰 비례인지 확인한다. 토큰 비례면 (a) `"detail":"low"` 적용, (b) 렌더 해상도 축소, (c) 모델 재선택 중에서 고른다. 확인 방법: GMS 대시보드에서 위 호출 1건의 Credit 차감량을 본다

**⚠️ T000a·T000b 없이 진행하면 명세에 없는 기능을 미확인 외부 계약 위에 구현하는 것이다**

---

## Phase 1: Setup (저장 계층)

- [X] T001 DDL 작성 — `backend/src/main/resources/db/artwork_001_tables.sql`. plan.md "데이터 모델" 의 테이블 4개·시퀀스 3개·인덱스 4개. `CREATE INDEX CONCURRENTLY` 는 트랜잭션 밖에서 한 줄씩 실행하도록 주석으로 안내(`playlist_like_001` 과 같은 방식)
- [X] T002 DDL 실행 — **사람이 DBeaver 로 실행한다**(운영 쓰기). 실행 뒤 `SELECT count(*) FROM artwork_round, artwork, artwork_point, artwork_like` 가 모두 0으로 성립하는지 확인
- [X] T003 1회차 행 삽입 — `artwork_round(theme='고양이', theme_prompt=…, starts_at, ends_at)`. `theme_prompt` 는 "이 별자리 그림이 고양이를 얼마나 닮았는지 0~100 으로 채점하고 한국어 한 줄 평을 달아라" 취지. **사람이 실행**

---

## Phase 2: Foundational (모든 스토리의 선행)

**Purpose**: 도메인 타입·에러 코드·좌표 스냅샷 — 세 스토리가 전부 이것을 쓴다

- [X] T004 [P] `ArtworkErrorCode` 추가 — `ARTWORK_NOT_FOUND`·`ARTWORK_ROUND_CLOSED`·`ARTWORK_NOT_FAILED`·`ARTWORK_RETRY_EXHAUSTED`, `backend/src/main/java/com/ssafy/backend/common/ArtworkErrorCode.java`
- [X] T005 [P] 상태 enum `ArtworkStatus` (`PENDING`·`SCORED`·`FAILED`), `artwork/ArtworkStatus.java`
- [X] T006 [P] Row·DTO record 작성 — `ArtworkRow`·`ArtworkPointRow`·`ArtworkRoundRow`, `artwork/dto/`
- [X] T007 `ArtworkRoundMapper` + XML — 열린 회차 1건 조회, id 로 조회
- [X] T008 `ArtworkMapper` + XML — insert(시퀀스 `selectKey`, `playlist` 와 같은 방식)·findById·findByRoundAndEmail·deleteById·좌표 일괄 insert·좌표 조회

**Checkpoint**: 작품을 저장하고 읽을 수단이 생겼다

---

## Phase 3: User Story 1 — 제출과 채점 (P1) 🎯 MVP

**Goal**: 플레이리스트를 제출하면 스냅샷이 남고 잠시 뒤 점수가 붙는다

**Independent Test**: 곡 10개 플레이리스트 제출 → 즉시 `PENDING` → 잠시 뒤 `SCORED` → 원본을 고쳐도 작품 불변

- [X] T009 [US1] `ArtworkService.submit` — 소유자 확인, 곡 수 2~30 검사, `ConstellationService.layout` 호출, (같은 회차 기존 작품 삭제 →) `artwork` + `artwork_point` 저장. **한 트랜잭션**
- [X] T010 [US1] `ArtworkController` 생성 + `POST /api/artwork/submit` (201), `GET /api/artwork/round/current`
- [X] T011 [P] [US1] `ArtworkRenderer` — `List<ArtworkPointRow>` → 512×512 PNG byte[]. `BufferedImage` + `ImageIO`. 글자·난수·시간 사용 금지
- [X] T012 [P] [US1] `ArtworkEvaluationPort` 인터페이스 — `Optional<Evaluation> evaluate(byte[] pngBytes, String themePrompt)`
- [X] T013 [US1] `GmsEvaluationClient` — `RestClient` 어댑터(`VideoIdApiClient` 와 같은 모양, 타임아웃 명시). 응답 JSON 파싱 + `score` 0~100·`comment` 비어있지 않음 검증. 실패는 `Optional.empty()`
- [X] T014 [US1] `ArtworkEvaluationService` — 작품 1건 평가: 좌표 로드 → 렌더 → 포트 호출 → 결과 반영(`UPDATE` 0행이면 조용히 끝, spec Edge Cases)
- [X] T015 [US1] `ArtworkEvaluationScheduler` — `@Scheduled(fixedDelayString="${ody.artwork.evaluation.interval-ms:5000}")`, `PENDING` 을 배치 크기만큼 `FOR UPDATE SKIP LOCKED` 로 집어 T014 호출
- [X] T016 [US1] `application.yml` 에 `ody.artwork.*` 기본값 추가. **키는 `.env` 에서 온다** — yml 에 값을 적지 않는다 (FR-016)
- [X] T017 [US1] `GET /api/artwork/detail` + `GET /api/artwork/mine` — 곡 정보는 기존 배치 조회 경로 재사용(곡당 1회 조회 금지)

### 테스트 (US1)

- [X] T018 [P] [US1] `ArtworkServiceTest` — 남의 플레이리스트 403, 곡 1개/31개 400, 제출 뒤 원본 변경이 작품에 반영되지 않음(FR-003), 원본 삭제해도 작품 유지(FR-004)
- [X] T019 [P] [US1] `ArtworkRendererTest` — 같은 좌표면 **바이트가 동일**, 출력이 PNG 시그니처로 시작, 좌표 -1~1 이 이미지 경계를 넘지 않음
- [X] T020 [P] [US1] `GmsEvaluationClientTest` — `MockRestServiceServer` 로 정상 응답/JSON 아님/`score` 범위 밖/5xx/타임아웃 5가지

**Checkpoint**: 제출하고 점수를 받는다. 여기까지가 MVP

---

## Phase 4: User Story 2 — 리더보드와 좋아요 (P1)

**Goal**: 점수 순으로 겨루고 남의 작품에 좋아요를 누른다

**Independent Test**: 점수가 다른 작품 여럿의 순서 확인, 좋아요 2회 연속 요청에도 수가 1만 오름

- [X] T021 [US2] `ArtworkMapper` 리더보드 쿼리 — `WHERE round_id=? AND status='SCORED' ORDER BY score DESC, like_cnt DESC, created_at ASC` + 페이지네이션 + 전체 건수
- [X] T022 [US2] `GET /api/artwork/leaderboard` — `roundId` 생략 시 열린 회차, `size` 기본 20·최대 50, `rank` 서버 계산
- [X] T023 [P] [US2] `ArtworkLikeMapper` + XML — `INSERT … ON CONFLICT DO NOTHING` / `DELETE`, 영향 행 수로만 `like_cnt` 증감(`playlist_like` 와 같은 방식)
- [X] T024 [US2] `ArtworkLikeService` + `POST /api/artwork/like` — 목표 상태 방식
- [X] T025 [US2] 상세·리더보드에 `likedByMe` 채우기 — 비로그인이면 `false`
- [X] T026 [US2] `DELETE /api/artwork/{artworkId}` — 소유자만. 좌표·좋아요는 `ON DELETE CASCADE`

### 테스트 (US2)

- [X] T027 [P] [US2] 정렬 테스트 — 동점 2건의 `likeCnt` 역전, 그것도 같으면 먼저 제출한 순(FR-008)
- [X] T028 [P] [US2] 노출 테스트 — `PENDING`·`FAILED` 가 리더보드와 남의 상세(404)에 안 보임(FR-009)
- [X] T029 [P] [US2] 좋아요 멱등 테스트 — 같은 요청 2회에 `like_cnt` 가 1만 오름, 해제 2회에 음수로 안 감(FR-011)

**Checkpoint**: 기능이 사회적으로 성립한다

---

## Phase 5: User Story 3 — 실패와 재시도 (P2)

**Goal**: 외부 호출 실패가 0점으로 굳지 않는다

**Independent Test**: GMS 를 죽인 채 제출 → `FAILED`(score NULL) → 리더보드에 없음 → 재시도로 복구

- [X] T030 [US3] `POST /api/artwork/retry/{artworkId}` — 소유자만, `FAILED` 만, `attempt_cnt >= 3` 이면 `ARTWORK_RETRY_EXHAUSTED`. 통과하면 `status=PENDING` 으로 되돌린다
- [X] T031 [US3] `fail_reason` 기록 규칙 — 사람이 읽을 짧은 요약만. **응답 본문·API 키·base64 금지** (FR-016)
- [X] T032 [P] [US3] 실패 경로 테스트 — 포트가 빈 값을 주면 `status=FAILED`·`score IS NULL`(0 아님)·`attempt_cnt` 증가 (FR-006)
- [X] T033 [P] [US3] 재시도 테스트 — 소유자 아님 403, `SCORED` 에 재시도 409, 3회 소진 409

---

## Phase 6: 마무리

- [X] T034 프론트 전달 — `docs/rules/BACKEND-NOTES.md` 에 엔드포인트 8개·신규 에러 코드 4개·**제출이 `PENDING` 이라 재조회가 필요하다**는 점을 적고 프론트에 알린다 (CLAUDE.md §3)
- [ ] T035 인프라 전달 — GMS base URL·API 키 환경변수, `-Djava.awt.headless=true` 명시를 인프라에 요청
- [ ] T036 관측 — `PENDING` 행 수와 GMS 실패 로그를 확인하는 방법을 plan.md "확인할 지표" 대로 점검. 새 미터는 실측 뒤에 정한다
- [X] T037 `./gradlew test` · `./gradlew build` 통과 확인

---

## 의존 관계

```text
T000a·T000b (사람)
   └ T001 → T002 → T003
        └ T004~T008 (Foundational)
             ├ US1: T009~T020            ← MVP. 여기까지만 해도 값이 있다
             ├ US2: T021~T029            ← US1 의 작품 행이 있어야 한다
             └ US3: T030~T033            ← US1 의 평가 경로가 있어야 한다
                  └ T034~T037
```

`[P]` 끼리는 같이 해도 된다 — 서로 다른 파일이다.

## 범위 밖 (이 목록에 없는 것)

1-a(점 찍어 플레이리스트), 회차 자동 생성 스케줄러, 작품 비공개·신고·댓글, 실시간 순위 알림.
