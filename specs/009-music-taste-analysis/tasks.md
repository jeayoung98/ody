---

description: "AI 기반 좋아요 음악 분포 및 취향 분석 리포트 구현 태스크"
---

# Tasks: AI 기반 좋아요 음악 분포 및 취향 분석 리포트

**Input**: Design documents from `/specs/009-music-taste-analysis/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/, quickstart.md

**Tests**: 명세와 quickstart가 통계 경계, 동시 요청, KST 자정, GMS 검증에 대한 자동 검증을 요구하므로 관련 테스트를 포함한다.

**Organization**: 태스크는 사용자 스토리별로 묶는다. Backend, Frontend, Data 파트는 저장소 소유권 규칙에 따라 별도 Jira 이슈·브랜치·MR에서 수행한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 선행 태스크가 끝난 뒤 다른 파일에서 병렬 진행 가능
- **[US1]–[US3]**: [spec.md](./spec.md)의 사용자 스토리
- 각 태스크 설명의 경로는 저장소 루트 기준

## Ownership gates

- 현재 브랜치 `backend/feat/S15P21A405-512-music-taste-analysis`에서는 Backend와 공통 명세 태스크만 수행한다.
- `(Data branch)` 태스크는 Data 담당자가 별도 Jira 이슈와 `data/<type>/<key>-<desc>` 브랜치에서 수행한다.
- `(Frontend branch)` 태스크는 Frontend 담당자가 별도 Jira 이슈와 `frontend/<type>/<key>-<desc>` 브랜치에서 수행한다.
- 개별 곡 좋아요가 S15P21A405-512 범위에 포함되는지 먼저 확인하고, 범위 밖이면 해당 Backend 작업도 별도 이슈·브랜치로 분리한다.
- ⚠️ **T001–T003 승인 게이트는 미완료 상태에서 Phase 2 이후 구현이 선행됐다.** 공개 동작은 승인 전까지 확정으로 취급하지 않는다. T002 중 Backend 몫(현재 구현된 endpoint·상태·오류 코드를 `docs/rules/BACKEND-NOTES.md` A-48~A-51, E-8~E-9로 공유)은 반영했고, Frontend 합의와 `docs/rules/FEATURES.md` 반영은 남아 있다.

## Phase 1: Setup and Contract Approval

**Purpose**: 구현 전에 팀 공통 명세와 파트 간 계약을 확정한다.

- [ ] T001 기획 담당자의 항목별 승인을 받아 신규 기능 ID·표본 정책·수동 생성 정책을 `docs/rules/FEATURES.md`에 반영한다
- [ ] T002 [P] Backend·Frontend 합의 후 endpoint·응답 상태·오류 코드·`error.details.nextAvailableAt` 계약을 `docs/rules/BACKEND-NOTES.md`와 `specs/009-music-taste-analysis/contracts/openapi.yaml`에 동기화한다
- [ ] T003 [P] (Data branch) 축 라벨 승인 상태와 기준 산출물 계보 계약을 `data/specs/14_axis_labels/spec.md`와 `specs/009-music-taste-analysis/contracts/taste-reference.schema.json`에 동기화한다
- [X] T004 [P] GMS base URL·model·timeout·reference resource 설정을 test profile 값과 함께 `backend/src/main/resources/application.yml`에 추가한다

**Checkpoint**: 기능, API, 데이터 산출물 계약이 승인되어 구현의 공개 동작이 고정됨

---

## Phase 2: Foundational Data and Backend Infrastructure

**Purpose**: 모든 사용자 스토리가 공유하는 기준 데이터, 오류 응답, 테스트 fixture를 준비한다.

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 사용자 스토리 구현을 시작하지 않는다.

### Data reference

- [ ] T005 [P] (Data branch) 16개 PC·101개 quantile·설명분산·라벨·계보를 검증하는 pytest를 `data/tests/test_taste_reference.py`에 작성하고 실패를 확인한다
- [ ] T006 (Data branch) 승인된 서빙 bundle에서 기준 JSON을 생성하는 스크립트를 `data/scripts/build_taste_reference.py`에 구현한다
- [ ] T007 (Data branch) 생성된 기준 산출물과 checksum을 `data/serving/v2.1-pca16/aux/taste-reference-v1.json`과 `data/serving/v2.1-pca16/manifest.json`에 반영하고 T005를 통과시킨다

### Backend foundation

- [X] T008 [P] 기준 JSON의 16축·PC 유일성·101개 quantile·단조성·유한값·bundle 호환성 검증 테스트를 `backend/src/test/java/com/ssafy/backend/taste/reference/TasteReferenceLoaderTests.java`에 작성하고 실패를 확인한다
- [X] T009 [P] `TASTE_INSUFFICIENT_SAMPLE`, `TASTE_DAILY_LIMIT`, `TASTE_ANALYSIS_IN_PROGRESS`, `TASTE_REFERENCE_UNAVAILABLE`를 `backend/src/main/java/com/ssafy/backend/common/TasteErrorCode.java`에 정의한다
- [X] T010 [P] 429 응답의 `nextAvailableAt`을 선택적으로 전달하도록 `backend/src/main/java/com/ssafy/backend/common/ErrorResponse.java`, `backend/src/main/java/com/ssafy/backend/common/ApiResponse.java`, `backend/src/main/java/com/ssafy/backend/common/GlobalExceptionHandler.java`를 계약과 호환되게 확장한다
- [X] T011 기준 산출물 모델과 기존 API를 중단하지 않고 취향 API만 unavailable로 표시하는 startup loader를 `backend/src/main/java/com/ssafy/backend/taste/reference/TasteReference.java`와 `backend/src/main/java/com/ssafy/backend/taste/reference/TasteReferenceLoader.java`에 구현한다
- [ ] T012 승인된 기준 산출물을 `backend/src/main/resources/taste/taste-reference-v1.json`에 배치하고 T008을 통과시킨다
- [X] T013 [P] 단위 테스트용 16축 기준 fixture와 좋아요 좌표 fixture를 `backend/src/test/resources/taste/taste-reference-fixture.json`과 `backend/src/test/java/com/ssafy/backend/taste/TasteFixtures.java`에 작성한다

**Checkpoint**: Backend가 승인된 좌표 기준만 읽고, 기준 오류를 취향 API 범위의 503으로 격리할 수 있음

---

## Phase 3: User Story 1 — 내 좋아요 음악의 분포 확인 (Priority: P1) 🎯 MVP

**Goal**: 사용자가 개별 곡에 좋아요를 표시하고, 현재 좋아요 전체의 16축 분포·상대 위치·제외 수를 AI 호출 없이 조회한다.

**Independent Test**: 위치가 알려진 곡 집합으로 좋아요 추가/취소 후 `GET /api/taste-analysis`을 호출해 총·유효·제외 수, 16축 통계, 8개 축 쌍에 사용할 점 좌표가 기대값과 일치하는지 확인한다.

### Tests for User Story 1

- [X] T014 [P] [US1] 개별 곡 좋아요의 추가·취소·반복 요청·없는 곡·본인 격리를 검증하는 서비스 테스트를 `backend/src/test/java/com/ssafy/backend/music/like/MusicLikeServiceTests.java`에 작성하고 실패를 확인한다
- [X] T015 [P] [US1] `POST /api/music/like`와 `GET /api/music/liked`의 인증·validation·envelope·최근 좋아요순 전체 목록 계약 테스트를 `backend/src/test/java/com/ssafy/backend/music/like/MusicLikeControllerTests.java`에 작성하고 실패를 확인한다
- [X] T016 [P] [US1] percentile 경계, five-number summary, IQR, 10-bin histogram, 동일값, 9/10/29/30개, NaN·차원 불일치 제외를 검증하는 테스트를 `backend/src/test/java/com/ssafy/backend/taste/analysis/TasteStatisticsCalculatorTests.java`에 작성하고 실패를 확인한다
- [X] T017 [P] [US1] 빈 좋아요·분포 전용·INITIAL·STANDARD 상태와 `GET /api/taste-analysis` 응답 계약을 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisQueryControllerTests.java`에 작성하고 실패를 확인한다

### Backend implementation for User Story 1

- [X] T018 [P] [US1] `music_like` 테이블·복합 PK·사용자 최신순 index·사용자 탈퇴 및 곡 삭제 cascade를 `backend/src/main/resources/db/music_like_001_table.sql`에 정의한다
- [X] T019 [P] [US1] 좋아요 요청·응답·목록 DTO를 `backend/src/main/java/com/ssafy/backend/music/like/MusicLikeRequest.java`, `MusicLikeResponse.java`, `MusicLikeRow.java`, `LikedMusicItem.java`, `LikedMusicResponse.java`에 정의한다
- [X] T020 [US1] target-state insert/delete, 곡 존재 확인, 곡 정보 조인과 최근 좋아요순 전체 목록 SQL을 `backend/src/main/java/com/ssafy/backend/music/like/MusicLikeMapper.java`와 `backend/src/main/resources/mapper/music/MusicLikeMapper.xml`에 구현한다
- [X] T021 [US1] 멱등 좋아요 변경과 안정 정렬 목록 조회를 `backend/src/main/java/com/ssafy/backend/music/like/MusicLikeService.java`에 구현하고 T014를 통과시킨다
- [X] T022 [US1] 인증 주체만 사용하는 좋아요 endpoint를 `backend/src/main/java/com/ssafy/backend/music/like/MusicLikeController.java`에 구현하고 T015를 통과시킨다
- [X] T023 [P] [US1] 좋아요 곡의 제목·아티스트·16차원 좌표를 일괄 조회하고 invalid 좌표를 제외 집계할 수 있도록 `backend/src/main/java/com/ssafy/backend/taste/music/TasteMusicRow.java`, `TasteMusicMapper.java`, `backend/src/main/resources/mapper/music/TasteMusicMapper.xml`에 구현한다
- [X] T024 [US1] raw/percentile five-number summary와 histogram을 계산하는 순수 로직을 `backend/src/main/java/com/ssafy/backend/taste/analysis/TasteStatisticsCalculator.java`에 구현하고 T016을 통과시킨다
- [X] T025 [US1] 현재 snapshot의 count·eligibility·16축 통계·point를 조합하는 조회 서비스를 `backend/src/main/java/com/ssafy/backend/taste/service/TasteAnalysisQueryService.java`에 구현한다
- [X] T026 [US1] `GET /api/taste-analysis`과 공개 응답 record를 `backend/src/main/java/com/ssafy/backend/taste/controller/TasteAnalysisController.java`와 `backend/src/main/java/com/ssafy/backend/taste/dto/TasteAnalysisResponse.java`에 구현하고 T017을 통과시킨다

### Frontend handoff for User Story 1

- [ ] T027 [P] [US1] (Frontend branch) 좋아요 음악·분포 API 타입과 endpoint/query key를 `frontend/src/types/music-like.ts`, `frontend/src/types/taste-analysis.ts`, `frontend/src/constants/api-endpoints.ts`, `frontend/src/constants/query-keys.ts`에 추가한다
- [ ] T028 [US1] (Frontend branch) 좋아요·분포 BFF route와 React Query hooks를 `frontend/src/app/api/music/like/route.ts`, `frontend/src/app/api/music/liked/route.ts`, `frontend/src/app/api/taste-analysis/route.ts`, `frontend/src/hooks/mutations/use-like-music-mutation.ts`, `frontend/src/hooks/queries/use-liked-music-query.ts`, `frontend/src/hooks/queries/use-taste-analysis-query.ts`에 구현한다
- [ ] T029 [P] [US1] (Frontend branch) 곡 상세 좋아요와 마이페이지 가상 플레이리스트를 기존 재생 큐의 `likedMusic` context로 연결하도록 `frontend/src/components/panels/song-detail/song-actions.tsx`, `frontend/src/components/panels/feed/feed-liked-music.tsx`, `frontend/src/stores/use-player-store.ts`, `frontend/src/components/player/player-bar.tsx`를 수정한다
- [ ] T030 [US1] (Frontend branch) 8개 PC 쌍 전환·점 tooltip·겹침 수·축별 상대 분포·표본 안내를 `frontend/src/components/panels/taste/taste-distribution-panel.tsx`과 `frontend/src/components/panels/taste/taste-axis-chart.tsx`에 구현한다

**Checkpoint**: AI와 `taste_analysis` 저장 없이도 개별 좋아요와 현재 분포 조회가 독립 동작함

---

## Phase 4: User Story 2 — 근거를 갖춘 AI 취향 리포트 읽기 (Priority: P1)

**Goal**: 유효 곡 10개 이상에서 Backend가 검증 finding을 만들고 GMS가 한줄 요약과 최대 3개 설명을 작성하며, 실패 시 동일 근거의 fallback을 제공한다.

**Independent Test**: synthetic axis statistics와 검증 라벨을 입력하여 선택된 finding, GMS 최소 payload, strict output 검증, INITIAL/ STANDARD 문구와 fallback이 수치·축 방향에 모순되지 않는지 확인한다.

### Tests for User Story 2

- [X] T031 [P] [US2] 편향·일관된 편향·다양성·양봉·균형·미검증 라벨·안정 정렬을 검증하는 테스트를 `backend/src/test/java/com/ssafy/backend/taste/analysis/TasteFindingSelectorTests.java`에 작성하고 실패를 확인한다
- [X] T032 [P] [US2] 허용 finding만 사용하는 fallback과 INITIAL 잠정 안내를 검증하는 테스트를 `backend/src/test/java/com/ssafy/backend/taste/analysis/TasteFallbackRendererTests.java`에 작성하고 실패를 확인한다
- [X] T033 [P] [US2] 로컬 JDK `HttpServer`로 GMS endpoint·Bearer header·`store=false`·개인정보 미전송·strict schema·timeout·HTTP 오류·refusal·잘못된 JSON·unknown finding을 검증하는 테스트를 `backend/src/test/java/com/ssafy/backend/taste/gms/GmsTasteClientTests.java`에 작성하고 실패를 확인한다
- [X] T034 [P] [US2] 10곡 미만 422, 정상 GENERATED, GMS 실패 FALLBACK과 quota 미차감을 검증하는 서비스 테스트를 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisGenerationServiceTests.java`에 작성하고 실패를 확인한다
- [X] T035 [P] [US2] `POST /api/taste-analysis`의 인증·INITIAL·STANDARD·GENERATED·FALLBACK envelope 계약을 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisGenerationControllerTests.java`에 작성하고 실패를 확인한다

### Backend implementation for User Story 2

- [X] T036 [P] [US2] `taste_analysis` 상태·snapshot·version·결과 컬럼, latest-success index, 사용자 탈퇴 cascade를 `backend/src/main/resources/db/taste_analysis_001_table.sql`에 정의한다
- [X] T037 [P] [US2] finding type·direction·evidence value objects를 `backend/src/main/java/com/ssafy/backend/taste/analysis/TasteFinding.java`에 정의한다
- [X] T038 [US2] `taste-v1` 임계값과 최대 3개 안정 정렬을 `backend/src/main/java/com/ssafy/backend/taste/analysis/TasteFindingSelector.java`에 구현하고 T031을 통과시킨다
- [X] T039 [P] [US2] 통계 기반 한국어 기본 설명을 `backend/src/main/java/com/ssafy/backend/taste/analysis/TasteFallbackRenderer.java`에 구현하고 T032를 통과시킨다
- [X] T040 [P] [US2] `contracts/gms-output.schema.json`을 `backend/src/main/resources/taste/taste-gms-output-v1.json`에 반영하고 최소 Map 요청·`GmsTasteOutput` 응답·output allowlist 및 axisPhrase 검증을 `backend/src/main/java/com/ssafy/backend/taste/gms/GmsTasteClient.java`, `GmsTasteOutput.java`, `GmsTasteOutputValidator.java`에 구현한다
- [X] T041 [US2] 자동 재시도 없는 비스트리밍 OpenAI Responses 호출과 실패 분류를 `backend/src/main/java/com/ssafy/backend/taste/gms/GmsTasteClient.java`에 구현하고 T033을 통과시킨다
- [X] T042 [P] [US2] 분석 row 저장·최신 성공 조회 mapper를 `backend/src/main/java/com/ssafy/backend/taste/mapper/TasteAnalysisMapper.java`와 `backend/src/main/resources/mapper/taste/TasteAnalysisMapper.xml`에 구현한다
- [X] T043 [US2] snapshot → statistics → finding → GMS/fallback → 저장 흐름을 `backend/src/main/java/com/ssafy/backend/taste/service/TasteAnalysisGenerationService.java`에 구현하고 T034를 통과시킨다
- [X] T044 [US2] `POST /api/taste-analysis`을 `backend/src/main/java/com/ssafy/backend/taste/controller/TasteAnalysisController.java`에 추가하고 T035를 통과시킨다

### Frontend handoff for User Story 2

- [ ] T045 [P] [US2] (Frontend branch) 수동 생성 mutation과 cache 갱신을 `frontend/src/hooks/mutations/use-generate-taste-analysis-mutation.ts`에 구현한다
- [ ] T046 [US2] (Frontend branch) 분석 버튼·한줄 요약·최대 3개 근거·AI 생성 표시·INITIAL 안내를 `frontend/src/components/panels/taste/taste-report.tsx`에 구현한다
- [ ] T047 [US2] (Frontend branch) 분포와 리포트를 같은 snapshot 상태로 조합하는 화면을 `frontend/src/components/panels/taste/taste-panel.tsx`과 `frontend/src/components/panels/right-panel.tsx`에 연결한다

**Checkpoint**: GMS 정상/실패와 관계없이 같은 통계 근거의 사용자 리포트를 독립 검증할 수 있음

---

## Phase 5: User Story 3 — 변경된 취향과 생성 실패 구분 (Priority: P2)

**Goal**: 동일 결과 재사용, 변경 후 stale, 성공만 KST 일일 차감, 동시 생성 배제, 마지막 성공 시각 보존을 제공한다.

**Independent Test**: 고정 Clock과 동시 요청 barrier로 동일 입력 재사용, 좋아요 변경, 실패 재시도, 23:59:59/00:00:00, 만료 lease, 자정을 넘긴 PENDING을 재현해 상태와 시각을 확인한다.

### Tests for User Story 3

- [X] T048 [P] [US3] 정렬된 전체 좋아요 music ID와 `analysisVersion`의 SHA-256 안정성·변경 감지를 `backend/src/test/java/com/ssafy/backend/taste/analysis/TasteSnapshotHasherTests.java`에 작성하고 실패를 확인한다
- [X] T049 [P] [US3] PENDING/SUCCESS/FAILED claim, partial unique PENDING, FAILED 재시도, lease 만료 회수를 검증하는 mapper 테스트를 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisClaimMapperTests.java`에 작성하고 실패를 확인한다
  - ⚠️ 현재 테스트는 SQL/XML **문자열 계약 수준**이다. 실제 PostgreSQL에서 partial unique index·동시 claim·lease 회수를 실행하지 않았다(저장소에 Testcontainers 없음). 실 DB 검증은 Data/DB 파트 몫이며 `validation.md` §2에 미검증으로 남겨 뒀다.
- [X] T050 [P] [US3] 같은 입력 REUSED, 변경 입력 당일 429, 생성 중 좋아요 변경의 즉시 stale, 동시 요청 409, 실패 재시도, KST 자정, 마지막 갱신 시각 보존을 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisLifecycleTests.java`에 작성하고 실패를 확인한다
- [X] T051 [P] [US3] GET의 FRESH/STALE/IN_PROGRESS와 409/429 `nextAvailableAt` 계약을 `backend/src/test/java/com/ssafy/backend/taste/TasteAnalysisStateControllerTests.java`에 작성하고 실패를 확인한다

### Backend implementation for User Story 3

- [X] T052 [P] [US3] user별 PENDING partial unique index를 `backend/src/main/resources/db/taste_analysis_001_table.sql`에 추가한다. 사용자별 lease 회수도 이 index를 사용한다.
- [X] T053 [P] [US3] canonical ID/version 직렬화와 SHA-256을 `backend/src/main/java/com/ssafy/backend/taste/analysis/TasteSnapshotHasher.java`에 구현하고 T048을 통과시킨다
- [X] T054 [US3] 조건부 claim·FAILED 재시도·lease 회수·SUCCESS terminal SQL을 `backend/src/main/resources/mapper/taste/TasteAnalysisMapper.xml`에 구현하고 T049를 통과시킨다
- [X] T055 [US3] `Clock`과 `ZoneId.of("Asia/Seoul")`로 REUSED/429/409/재시도 상태 전이를 `backend/src/main/java/com/ssafy/backend/taste/service/TasteAnalysisGenerationService.java`에 구현하고 T050을 통과시킨다
- [X] T056 [US3] 최신 성공 snapshot 비교와 `fresh`·`lastRefreshedAt` 조합을 `backend/src/main/java/com/ssafy/backend/taste/service/TasteAnalysisQueryService.java`에 구현하고 T051을 통과시킨다

### Frontend handoff for User Story 3

- [ ] T057 [P] [US3] (Frontend branch) EMPTY/DISTRIBUTION_ONLY/READY/IN_PROGRESS/FRESH/STALE/FALLBACK과 GENERATED/REUSED 상태 문구를 `frontend/src/components/panels/taste/taste-status.tsx`에 구현한다
- [ ] T058 [US3] (Frontend branch) 마지막 성공 갱신 시각·다음 KST 생성 가능 시각·실패 재시도·반복 클릭 방지를 `frontend/src/components/panels/taste/taste-panel.tsx`에 연결한다

**Checkpoint**: 생성 이력과 현재 좋아요가 달라도 사용자가 최신성, 실패, 제한, 진행 상태를 구분할 수 있음

---

## Phase 6: Polish and Cross-Cutting Verification

**Purpose**: 보안, 관측성, 문서 정합성, 성능과 전체 회귀를 검증한다.

- [X] T059 [P] outcome별 counter와 GMS latency timer를 `backend/src/main/java/com/ssafy/backend/taste/service/TasteAnalysisGenerationService.java`에 추가하고 이메일·key·곡 ID 목록·payload가 metric/log에 포함되지 않도록 검증한다
- [X] T060 [P] GMS key·payload redaction과 외부 호출 timeout 회귀 테스트를 `backend/src/test/java/com/ssafy/backend/taste/gms/GmsTasteSecurityTests.java`에 추가한다
- [X] T061 `specs/009-music-taste-analysis/quickstart.md`의 9/10/29/30곡, REUSED, stale 429, FALLBACK 시나리오를 실행하고 통과·실패·미실행 결과를 `specs/009-music-taste-analysis/validation.md`에 기록한다
- [X] T062 Backend 전체 `./gradlew test`와 `./gradlew build` 결과를 `specs/009-music-taste-analysis/validation.md`에 기록한다
- [ ] T063 [P] (Data branch) `pytest` 기준 산출물 검증 결과와 lineage/checksum을 `data/docs/HANDOVER.md`에 기록한다
- [ ] T064 [P] (Frontend branch) `npm run lint`, `npm test`, `npm run build` 결과와 상태별 수동 확인을 `specs/009-music-taste-analysis/validation.md`에 기록한다
- [ ] T065 유효 곡 10~1,000개·동시 사용자 10명에서 분포/기존 리포트 p95 3초와 신규 생성 결과/fallback p95 30초를 측정하고 `specs/009-music-taste-analysis/validation.md`에 GMS 실패율과 별도로 기록한다
- [ ] T066 승인된 최종 API·ERD를 `docs/rules/FEATURES.md`와 `docs/rules/BACKEND-NOTES.md`에 동기화한다
- [ ] T067 (Infra branch) GMS 환경변수·secret 주입·배포 순서·rollback 절차를 `docs/infra/DEPLOYMENT.md`와 `docs/infra/SECURITY.md`에 반영한다

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1**: 즉시 시작할 수 있으나 T001–T003 승인이 구현 gate다.
- **Phase 2**: Phase 1 계약 승인 후 시작하며 모든 사용자 스토리를 차단한다.
- **Phase 3 / US1**: Phase 2 완료 후 시작한다. Backend MVP는 T014–T026이다.
- **Phase 4 / US2**: Phase 2 완료 후 synthetic statistics로 T031–T042를 병렬 개발할 수 있으나 실제 endpoint 조합 T043–T044는 US1의 T024–T026에 의존한다.
- **Phase 5 / US3**: 저장 lifecycle이 필요하므로 US2의 T036, T042–T044 완료 후 시작한다.
- **Phase 6**: 배포 대상 스토리가 모두 완료된 후 수행한다.

### User story dependencies

- **US1 (P1)**: Foundation만 의존하며 AI 없이 독립 배포 가능한 MVP다.
- **US2 (P1)**: finding/GMS 어댑터는 독립 테스트 가능하고, 실제 생성은 US1 통계 snapshot에 의존한다.
- **US3 (P2)**: US1 snapshot과 US2 저장/생성 흐름에 의존한다.

### Within each user story

- 테스트 태스크를 먼저 작성하고 실패를 확인한다.
- migration/DTO와 독립 순수 로직은 병렬 진행한다.
- mapper 다음 service, service 다음 controller/BFF 순서로 연결한다.
- Backend 계약이 고정된 뒤 Frontend 파트가 타입과 화면을 연결한다.

## Parallel Opportunities

- T002–T004는 담당 파트가 달라 병렬 진행 가능하다.
- T005와 T008–T010은 Data/Backend에서 병렬 진행 가능하다.
- US1의 T014–T017 테스트와 T018–T019 모델 작업은 서로 다른 파일에서 병렬 가능하다.
- US2의 finding(T031, T037–T039), GMS(T033, T040–T041), persistence(T036, T042)는 세 작업줄로 병렬 가능하다.
- US3의 hash(T048, T053), claim(T049, T052, T054), API 상태 계약(T051)은 병렬 준비 가능하다.
- Frontend handoff는 승인된 OpenAPI를 기준으로 별도 브랜치에서 Backend와 병렬 진행할 수 있다.

## Parallel Examples

### User Story 1

```text
Task T014: MusicLikeService tests
Task T015: MusicLikeController contract tests
Task T016: TasteStatisticsCalculator tests
Task T017: TasteAnalysis GET contract tests
```

### User Story 2

```text
Finding track: T031 → T037 → T038, with T032 → T039
GMS track: T033 → T040 → T041
Persistence track: T036 → T042
```

### User Story 3

```text
Hash track: T048 → T053
Claim track: T049 → T052 → T054
State contract track: T051, then integrate through T055–T056
```

## Implementation Strategy

### MVP first

1. Phase 1 계약 승인
2. Phase 2 기준 산출물과 Backend loader
3. Phase 3의 Backend T014–T026
4. 개별 좋아요와 AI 없는 분포 조회를 독립 검증
5. Frontend 별도 브랜치에서 T027–T030 연결

### Incremental delivery

1. **US1**: 개별 좋아요 + 분포
2. **US2**: deterministic finding + GMS/fallback
3. **US3**: 재사용 + 최신성 + 일일 제한 + 동시성
4. **Polish**: 관측성, 보안, 성능, 파트 문서 동기화

## Notes

- `[P]`는 파일 충돌과 미완료 의존성이 없는 경우에만 표시했다.
- 실제 Jira key는 JAM으로 확인하거나 생성하며 임의로 만들지 않는다.
- Data/Frontend 태스크를 현재 Backend 브랜치에 커밋하지 않는다.
- GMS key와 요청/응답 원문을 코드, 테스트 출력, 로그, 문서에 남기지 않는다.
- 각 태스크 또는 논리적 묶음마다 Jira key를 포함한 저장소 커밋 규칙을 따른다.
