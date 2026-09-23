# Tasks: 작품 리더보드 순위(AI + 좋아요)와 회차당 좋아요 3표

**Input**: `specs/011-artwork-ranking-votes/` — [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [contracts/artwork-api-delta.md](./contracts/artwork-api-delta.md) · [data-model.md](./data-model.md)

**Jira**: S15P21A405-616 · **Branch**: `backend/feat/S15P21A405-616-artwork-ranking-vote-limit`

**Tests**: 포함 — 헌법 III. SC-002·005 와 규칙 분기는 단위 테스트, 순위 정렬(SC-001·003)은 SQL 이라 T005 리뷰 + T030 운영 확인으로 검증한다(analyze C1).

경로 약어: `A = backend/src/main/java/com/ssafy/backend/artwork`, `M = backend/src/main/resources/mapper/artwork/ArtworkMapper.xml`, `T = backend/src/test/java/com/ssafy/backend/artwork`

## Phase 1: Setup

- [ ] T001 `backend/src/main/resources/db/artwork_003_ranking_votes.sql` 신규 — data-model.md 의 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 3줄(`artwork_round.vote_limit int4 NOT NULL DEFAULT 3`, `artwork_round.ai_weight numeric NOT NULL DEFAULT 5`, `artwork.closed boolean NOT NULL DEFAULT false`)과 머리 주석(운영 수동 적용·배포 전·롤백 DROP COLUMN 3줄). `artwork_001_tables.sql` 머리 주석 형식을 따른다

## Phase 2: Foundational (모든 스토리 공통 — 칸 읽기)

- [ ] T002 `A/dto/ArtworkRoundRow.java` 에 `int voteLimit`, `double aiWeight` 추가. `M` 의 `findOpenRound`·`findRoundById` SELECT 에 `vote_limit, ai_weight` 추가
- [ ] T003 `A/dto/ArtworkRow.java` 에 `boolean closed` 추가. `M` 의 `<sql id="artworkColumns">` 에 `closed` 추가
- [ ] T004 `./gradlew test --tests 'com.ssafy.backend.artwork.*'` — 기존 테스트가 그대로 통과(칸 추가만으로 동작 불변)

**Checkpoint**: 새 칸을 읽을 수 있고 기존 동작 불변

## Phase 3: User Story 1 — 좋아요가 순위를 움직인다 (P1) 🎯 MVP

**Goal**: 리더보드가 `like_cnt + score × ai_weight / 100` 내림차순이고 항목에 `rankScore` 가 있다.

**Independent Test**: 매퍼 목이 돌려준 순서를 서비스가 보존하고 `rankScore`·`rank` 를 싣는지 + SQL 정렬식 리뷰. (정렬 자체는 SQL 이라 단위 테스트는 조립·필드 검증, 정렬식은 T005 에서 문자열 그대로 고정)

- [ ] T005 [US1] `M` 의 `findLeaderboard` 를 바꾼다: SELECT 에 `(a.like_cnt + a.score * r.ai_weight / 100.0) AS rank_score` (회차 `artwork_round r` 조인 또는 `#{aiWeight}` 파라미터 — 파라미터 방식이 조인 없이 단순하므로 `#{aiWeight}` 로), `ORDER BY rank_score DESC, a.score DESC, a.created_at ASC`. `A/mapper/ArtworkMapper.java` `findLeaderboard` 시그니처에 `double aiWeight` 추가
- [ ] T006 [US1] `A/dto/ArtworkSummaryRow.java` 에 `double rankScore`, `A/dto/ArtworkSummary.java` 에 `Double rankScore`(리더보드만 값, `findMine` 은 null) 추가
- [ ] T007 [US1] `A/service/ArtworkService.java` `getLeaderboard` 가 `round.getAiWeight()` 를 매퍼에 넘기고 `toSummary` 가 `rankScore` 를 싣게 한다. 클래스·메서드 javadoc 의 "점수 → 좋아요 → 먼저 제출" 문구를 새 정렬로 고친다. `A/controller/ArtworkController.java` 리더보드 `@Operation`·javadoc 문구도
- [ ] T008 [US1] `T/ArtworkServiceTests.java` 에 추가: (a) 리더보드가 매퍼에 회차 `aiWeight` 를 넘긴다, (b) 항목 `rankScore` 가 행 값 그대로이고 `rank` 가 offset+순번, (c) `findMine` 항목의 `rankScore` 는 null

**Checkpoint**: 리더보드 순위 규칙 적용 — 단독 배포해도 의미 있음

## Phase 4: User Story 2 — 회차당 3표 (P1)

**Goal**: 좋아요에 내 작품 금지·닫힌 회차 차단·회차 한도(경합 안전), 회차 응답에 `voteLimit`·`myVotesLeft`.

**Independent Test**: 목 매퍼로 4번째 누름 거절·거둔 뒤 성공·내 작품 거절·닫힌 회차 거절·이미 누른 작품 재요청 시 한도 검사 없음, 락 쿼리가 누를 때만 호출.

- [ ] T009 [P] [US2] `backend/src/main/java/com/ssafy/backend/common/ArtworkErrorCode.java` 에 `ARTWORK_VOTE_LIMIT(HttpStatus.CONFLICT, "ARTWORK_VOTE_LIMIT", "이번 회차 좋아요를 모두 썼습니다.")`, `ARTWORK_VOTE_SELF(HttpStatus.BAD_REQUEST, "ARTWORK_VOTE_SELF", "내 작품에는 좋아요를 줄 수 없습니다.")`
- [ ] T010 [P] [US2] `M` + `A/mapper/ArtworkMapper.java` 에 두 쿼리: `lockVotes(email, roundId)` = `SELECT pg_advisory_xact_lock(hashtext(#{email} || ':' || #{roundId}))`(주석: 사용자×회차 단위, 트랜잭션 끝에 해제, research R3), `countVotesInRound(email, roundId)` = `SELECT count(*) FROM artwork_like l JOIN artwork a ON a.id = l.artwork_id WHERE a.round_id = #{roundId} AND l.email = #{email} AND a.email &lt;&gt; #{email}` — 배포 전 자기 작품에 눌러 둔 좋아요는 세지 않는다(analyze E1). 두 쿼리 모두 주석에 "PostgreSQL 전용 — H2 로컬 실행에서는 좋아요 불가"
- [ ] T011 [US2] `A/service/ArtworkService.java` `changeLike` 에 검사 추가 (research R5 순서): 기존 존재·권한 → `artwork.getEmail().equals(email)` 이면 `ARTWORK_VOTE_SELF` → `findOpenRound()` 가 null 이거나 id 가 `artwork.getRoundId()` 와 다르면 `ARTWORK_ROUND_CLOSED` → `liked && !existsLike` 일 때만 `lockVotes` 후 `countVotesInRound >= round.getVoteLimit()` 이면 `ARTWORK_VOTE_LIMIT`. 로그에 `votesUsed` 추가. 기존 "내 작품은 미채점이어도 누를 수 있음" 분기는 내 작품 금지로 대체된다(주석 정리)
- [ ] T012 [US2] `A/dto/ArtworkRound.java` 에 `int voteLimit`, `Integer myVotesLeft` 추가. `A/service/ArtworkService.java` 의 `findOpenRound()` 를 `findOpenRound(String requesterEmail)` 로 바꿔 로그인이면 `max(0, voteLimit − countVotesInRound)`, 비로그인이면 null. `toRound` 호출처(리더보드 응답의 round)도 같은 값을 싣는다(`getLeaderboard` 에 이미 email 이 있다)
- [ ] T013 [US2] `A/controller/ArtworkController.java` `currentRound(Authentication)` 로 바꿔 `emailOrNull` 전달. `@Operation` 설명에 voteLimit·myVotesLeft
- [ ] T014 [US2] `T/ArtworkServiceTests.java` 에 추가: 3표 쓴 뒤 4번째 → `ARTWORK_VOTE_LIMIT` 이고 insertLike 미호출, 거두기(`liked=false`)는 한도·락 없이 성공, 내 작품 → `ARTWORK_VOTE_SELF`, 작품 회차 ≠ 열린 회차 → `ARTWORK_ROUND_CLOSED`(누르기·거두기 둘 다), 이미 누른 작품에 `liked=true` 재요청 → `lockVotes`·`countVotesInRound` 미호출, 새로 누를 때 `lockVotes` 가 `countVotesInRound` 보다 먼저 호출(InOrder), 회차 조회 `myVotesLeft` = 한도−사용(로그인)·null(비로그인)·음수 방지(사용 4 → 0)

**Checkpoint**: 표 규칙 완성 — US1 과 함께 기획 결정 전부 반영

## Phase 5: User Story 3 — 닫힌 모양을 출품한다 (P2)

**Goal**: 출품 `closed` 선택값 → 스냅샷 → 채점 그림 닫는 선 → 응답 노출.

**Independent Test**: 렌더러에 닫힘 true → 마지막→첫 점 선 픽셀이 칠해지고 false 는 기존 바이트와 동일. submit 이 closed 를 행에 넣음.

- [ ] T015 [P] [US3] `A/render/ArtworkRenderer.java` 에 `render(List<ArtworkPointRow> points, boolean closed)` 추가 — 기존 선 루프 뒤 `closed && points.size() > 2` 면 마지막→첫 점 `drawLine`. 기존 `render(points)` 는 `render(points, false)` 위임
- [ ] T016 [P] [US3] `T/ArtworkRendererTests.java` 에 추가: 닫힘 true 이미지에서 마지막·첫 점 중간 픽셀이 흰색, false 이미지에선 검은색. 기존 `render(points)` 바이트가 `render(points, false)` 와 같다
- [ ] T017 [US3] `A/dto/ArtworkSubmitRequest.java` 에 `Boolean closed`(선택, 검증 없음). `A/service/ArtworkService.java` `submit(playlistId, closed, email)` 이 `Boolean.TRUE.equals(closed)` 를 `ArtworkRow` 에 담고, `M` `insertArtwork` 에 `closed` 칸. `A/controller/ArtworkController.java` submit 이 `request.closed()` 전달
- [ ] T018 [US3] `A/service/ArtworkEvaluationService.java` 가 `renderer.render(points, artwork.isClosed())` 로 호출(기준 그림 경로 `loadAnchors` 는 기존 `render(points)` 그대로)
- [ ] T019 [US3] `A/dto/ArtworkDetailResponse.java`·`A/dto/ArtworkSummary.java`(+`ArtworkSummaryRow`)에 `boolean closed` 추가, `M` 의 `findLeaderboard`·`findMine` SELECT 에 `a.closed`, `ArtworkService` 조립부 반영
- [ ] T020 [US3] `T/ArtworkServiceTests.java`·`T/ArtworkEvaluationServiceTests.java` 에 추가: submit closed=true/null → 행 closed true/false, 채점이 `render(points, true)` 호출, 상세·리더보드 응답에 closed

**Checkpoint**: 닫힌 모양 출품 end-to-end

## Phase 6: User Story 4 — 리더보드 곡 목록 (P3)

**Goal**: 리더보드 항목에 `points: [{musicId, title, artist, x, y}]`(페이지당 좌표 1회·곡 이름 1회), 상세에 같은 원소의 `tracks`.

**Independent Test**: 항목 2개 페이지 → `findPointsByArtworkIds` 1회, `findSummariesByIds` 1회, 항목별 points 순서가 position 순, 곡 이름이 채워짐.

- [ ] T021 [P] [US4] `A/dto/ArtworkTrack.java` 신규 record `(long musicId, String title, String artist, double x, double y)` — javadoc 에 "598 `DrawTrack` 과 같은 모양, 두 브랜치 머지 후 하나로" `ponytail:` 주석
- [ ] T022 [P] [US4] `M` + `A/mapper/ArtworkMapper.java` 에 `findPointsByArtworkIds(List<Long> artworkIds)` — `SELECT artwork_id, position, music_id, x, y FROM artwork_point WHERE artwork_id IN (...) ORDER BY artwork_id, position` (`<foreach>`). `ArtworkPointRow` 에 `artworkId` 가 없으면 추가
- [ ] T023 [US4] `A/dto/ArtworkSummary.java` 에 `List<ArtworkTrack> points`(리더보드만, `findMine` 은 빈 목록). `A/service/ArtworkService.java` `getLeaderboard` 에서 페이지 작품 id 로 T022 1회, 곡 id 모아 `musicDetailReader.findSummariesByIds` 1회(어댑터 없으면 이름 null), 항목별 조립. 빈 페이지면 두 조회 모두 생략
- [ ] T024 [US4] `A/dto/ArtworkDetailResponse.java` 에 `List<ArtworkTrack> tracks` 추가 — `ArtworkService.getDetail` 이 이미 읽은 곡 상세(`loadMusicDetails`)를 musicId 로 짝지어 좌표 순서대로 조립(지워진 곡은 이름 null, 원소는 유지). 기존 `points`·`musics` 는 그대로(analyze U1)
- [ ] T025 [US4] `T/ArtworkServiceTests.java` 에 추가: 리더보드 항목 2개 → 두 조회 각 1회, points 순서·이름, 빈 페이지 → 조회 0회. 상세 `tracks` 가 좌표 순서·이름을 갖고, 곡이 지워진 자리도 원소가 남는다

**Checkpoint**: FE 갤러리·순위 카드가 추가 호출 없이 그려짐

## Phase 7: Polish & Cross-Cutting

- [ ] T026 `docs/rules/BACKEND-NOTES.md` 에 `### 6-9. 작품 순위·좋아요 3표·닫힌 모양 (S15P21A405-616)` — `contracts/artwork-api-delta.md` 요약(바뀐 정렬, 새 필드, 새 에러 2개, FE 목→실제 매핑표), "K·한도는 회차 행 UPDATE 로 조정" 명시. §6 본문 리더보드 정렬 문구를 새 규칙으로 고친다
- [ ] T027 `docs/rules/FEATURES.md` 변경 제안 #36(콘테스트)에 "순위 = 좋아요 + AI×K/100(K=5, 회차별), 좋아요 회차당 3표·내 작품 금지, 채점은 비동기(즉시 심사 미채택) — 기획(효정) 결정 2026-09-23, S15P21A405-616" 덧붙임
- [ ] T028 `cd backend && ./gradlew test && ./gradlew build` — 결과 XML 로 실패 0 확인
- [ ] T029 노션 「결정 통보 · 물음」에 FE(윤주하 · FE Exploration) 통보 1건: 콘테스트 목 → `/api/artwork/*` 매핑표·즉시 심사 미채택·새 에러 코드. 기존 598 FE 요청(정유진)과의 중복 정리 메모 포함. 올린 뒤 fetch 로 되읽기 — **담당·유형은 올리기 전에 사용자에게 확인**
- [ ] T030 (배포 전, 사람) 운영 DB 에 `artwork_003_ranking_votes.sql` 적용 → (배포) → [quickstart.md](./quickstart.md) 운영 확인 추가 확인(analyze C1·C2): 한 작품에 좋아요 1개 전후로 그 작품 `rankScore` 만 +1, 좋아요 0 인 작품끼리는 AI 점수 순, 좋아요 준 작품이 재출품되면 내 `myVotesLeft` +1

## Dependencies

```text
T001 → T002, T003 → T004
T004 → US1 (T005 → T006 → T007 → T008)
T004 → US2 (T009, T010 → T011 → T012 → T013 → T014)
T004 → US3 (T015, T016 · T017 → T018 → T019 → T020)
T004 → US4 (T021, T022 → T023 → T024)
{US1..US4} → T026, T027 → T028 → T029 → T030
```

같은 파일(`ArtworkService.java`·`ArtworkMapper.xml`·`ArtworkServiceTests.java`)을 여러 스토리가 건드리므로 **스토리는 순서대로** 진행한다(US1 → US2 → US3 → US4). [P] 는 스토리 안에서 다른 파일끼리만.

## Parallel Example

```text
US2: T009 ArtworkErrorCode · T010 매퍼 쿼리 → T011
US3: T015 렌더러 · T016 렌더러 테스트 동시 → T017
US4: T021 ArtworkTrack · T022 매퍼 쿼리 동시 → T023
```

## Implementation Strategy

1. **MVP = Phase 1~4 (US1 + US2)**: 기획 결정(순위·3표) 전부. 여기서 끊어 배포해도 된다.
2. US3(closed)·US4(리더보드 곡 목록)는 FE 콘테스트 연동용 — FE 교체 일정에 맞춰.
3. DDL(T001)은 첫 배포 전에 운영 적용 — 기본값이 있어 먼저 넣어도 무해.
4. 커밋: Setup+Foundational / US1 / US2 / US3 / US4 / 문서. MR 은 `backend/dev` 하나.
