---

description: "Task list for 004-journey-path (경로 탐색 게이트웨이)"
---

# Tasks: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Input**: Design documents from `specs/004-journey-path/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/music-journey.md](contracts/music-journey.md), [quickstart.md](quickstart.md)

**Tests**: 포함한다. spec SC-001과 [quickstart.md](quickstart.md) B·C절이 검증 시나리오를 명시하고,
헌법 III(완료 전 검증)과 CLAUDE.md §5(`./gradlew test`·`./gradlew build`)가 이를 요구한다.

**Organization**: spec.md의 US1~US4별로 묶는다. 경로 산출 알고리즘은 BE4 엔진 소유이므로(D4, FR-017)
여기 있는 작업은 전부 **게이트웨이** 몫이다 — 축 통로·Viterbi를 Java로 옮기는 작업은 없다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완 작업에 의존하지 않음)
- **[Story]**: US1~US4 (사용자 스토리 단계만)
- 파일 경로를 반드시 적는다

## Path Conventions

단일 Gradle backend. 모든 경로는 저장소 루트 기준.

- 운영 코드: `backend/src/main/java/com/ssafy/backend/`
- 테스트: `backend/src/test/java/com/ssafy/backend/`
- 여정 전용 패키지: `.../music/journey/`

---

## Phase 1: Setup

**Purpose**: 신규 프로젝트 초기화가 아니다. master 구조·의존성이 이미 있으므로 설정 항목만 둔다.

- [ ] T001 엔진 base URL·타임아웃 속성을 `backend/src/main/resources/application.yml`에 추가 (`ody.journey.engine.base-url`, `ody.journey.engine.timeout=2s`). 값은 환경별 `application-*.yml`에서 덮고, 시크릿·운영 호스트를 커밋하지 않는다 (research R8)
- [ ] T002 기준선 확인 — `cd backend && ./gradlew test` 가 현재 통과하는지 먼저 확인해 신규 실패와 기존 실패를 구분한다

**Checkpoint**: 설정 자리와 기준선 확보.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1~US4 전부가 쓰는 계약·DTO·경계. 이 단계 없이는 어떤 스토리도 시작할 수 없다.

**⚠️ CRITICAL**: 여기까지 끝나야 사용자 스토리 작업이 시작된다.

- [ ] T003 [P] `PATH_NOT_FOUND`(422, "두 곡을 연결하는 경로를 찾을 수 없습니다.") 상수를 `backend/src/main/java/com/ssafy/backend/common/MusicErrorCode.java`에 추가. 신규 enum 파일을 만들지 않는다 (research R7)
- [ ] T004 [P] `JourneyStop` record 생성 — `@JsonUnwrapped MusicDetail` + `int step` — `backend/src/main/java/com/ssafy/backend/music/dto/JourneyStop.java` (research R6, 003 `NeighborTrack` 선례)
- [ ] T005 [P] `JourneyResponse` record 생성 — `musicCnt`, `totalDuration`, `List<JourneyStop> path` — `backend/src/main/java/com/ssafy/backend/music/dto/JourneyResponse.java` (data-model §2)
- [ ] T006 [P] `EnginePath` record 생성 — `reachable`, `stationMbids`, `progresses`, `endpointDist`, `far`, `nStations`, `mode`, `bundle` — `backend/src/main/java/com/ssafy/backend/music/journey/EnginePath.java` (data-model §3)
- [ ] T007 [P] `JourneyPathFinder` port 인터페이스 생성 (`EnginePath find(String startMbid, String endMbid)`) — `backend/src/main/java/com/ssafy/backend/music/journey/JourneyPathFinder.java`. 계약을 javadoc에 적는다: 모드는 구현이 `axis` 고정, 경로 없음은 예외가 아니라 `reachable:false`, 엔진 부재·타임아웃은 예외 (contracts §②)
- [ ] T008 [P] `JourneyTrackReader` port 인터페이스 생성 (`List<MusicDetail> findDetailsByMbids(List<String> mbids)`) — `backend/src/main/java/com/ssafy/backend/music/journey/JourneyTrackReader.java`. javadoc에 **순서 미보장·누락 시 결과에서 빠짐·최대 20건**을 명시 (contracts §③, research R4)
- [ ] T009 `JourneyService` 골격 생성 — `Optional<JourneyPathFinder>`·`Optional<JourneyTrackReader>`·`MusicDetailReader` 주입, 어댑터 부재 시 기존 `MusicService` 패턴대로 미구현을 드러냄 — `backend/src/main/java/com/ssafy/backend/music/service/JourneyService.java` (research R2, FR-019)

**Checkpoint**: 계약·DTO 준비 완료. 컴파일 통과. 어댑터 없이도 빌드가 깨지지 않는다.

---

## Phase 3: User Story 1 - 두 곡 사이의 경로를 받는다 (Priority: P1) 🎯 MVP

**Goal**: 두 곡 ID로 출발→도착 순서 목록을 받고, 각 곡이 MusicDetail 필드와 좌표를 갖는다.

**Independent Test**: port 2개를 mock으로 두고 `GET /music/journey?start=10234&end=10877` 호출 →
`path[0]`이 출발곡(`step:0`), 마지막이 도착곡, `step` 연속, `musicCnt`·`totalDuration`이 `path`와 일치.

### Tests for User Story 1 ⚠️

> 구현 전에 작성하고 실패를 확인한다.

- [ ] T010 [P] [US1] 조립 유닛 테스트 B1~B5 작성 — reader가 뒤섞인 순서로 반환해도 정거장 순서가 엔진 순서와 같고(I7), `step` 0부터 연속(I1), 양끝이 start·end(I2), `musicCnt == path.size()`(I3), `totalDuration` 합(I4) — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyServiceTests.java` (quickstart B)
- [ ] T011 [P] [US1] null 허용·재생불가 유닛 테스트 B6~B7 작성 — `duration`이 null인 곡은 0으로 더하고, `youtubeUrl`이 null인 곡은 `path`에 남는다 — 같은 파일 `JourneyServiceTests.java`
- [ ] T012 [P] [US1] 응답 계약 MockMvc 테스트 C1 작성 — 200·`success:true`·`error:null`, `path` 원소가 MusicDetail 필드 + `step`으로 평평하게 직렬화(`@JsonUnwrapped`) — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyControllerTests.java` (standalone MockMvc, research R9)

### Implementation for User Story 1

- [ ] T013 [US1] `GET /music/journey` 핸들러를 `backend/src/main/java/com/ssafy/backend/music/controller/MusicController.java`에 추가 — `@RequestParam @Min(1) long start`, `@RequestParam @Min(1) long end`, `ApiResponse.success(journeyService.getJourney(start, end))` 반환. `mode`·`n`·detour 파라미터를 받지 않는다 (FR-023, contracts §①)
- [ ] T014 [US1] 식별자 해석 구현 — `JourneyService`에서 `MusicDetailReader.findDetail(start)`·`findDetail(end)` 호출로 `MusicDetail` 2건을 얻고 그 `mbid`를 엔진 호출에 쓴다. **별도 `id→mbid` 조회를 만들지 않는다** (research R3, FR-022)
- [ ] T015 [US1] 엔진 호출 연결 — `JourneyPathFinder.find(startMbid, endMbid)` 호출부를 `JourneyService`에 구현. 정거장 수·모드를 넘기지 않는다 (FR-011, FR-023)
- [ ] T016 [US1] 정거장 상세 일괄 조회 — `JourneyTrackReader.findDetailsByMbids(stationMbids)` 1회 호출. 곡당 조회로 나누지 않는다(왕복 예산) (research R3)
- [ ] T017 [US1] 순서 재조립 — 조회 결과를 `Map<String, MusicDetail>`로 만들고 **엔진 `stationMbids` 순서대로** 꺼낸다. SQL 순서에 의존하지 않는다 (research R4, I7)
- [ ] T018 [US1] 최종 조립 — `[startDetail] + 정거장 + [endDetail]`로 `path`를 만들고 `step`을 0부터 연속 부여, `musicCnt = path.size()`, `totalDuration = Σ duration`(null은 0) (FR-005, FR-006, FR-021)
- [ ] T019 [US1] T010~T012 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 정상 경로가 정본 §3.3 형태로 나온다. US1만으로 "두 곡을 잇는 플레이리스트"가 성립한다.

---

## Phase 4: User Story 2 - 앞으로만 가고 낙차가 고른 경로 (Priority: P1)

**Goal**: 경로 품질을 관측 가능하게 한다.

**⚠️ 경계**: 단조 증가·인접 역 거리·후처리 규칙은 **BE4 엔진이 보장하고 BE4 벤치마크가 측정한다**
(`tests/bench_journey.py`, 40쌍 실측: 단조 위반 0, median p50 2.949). 게이트웨이는 **다시 계산하지 않고**
위반을 세어 기록만 한다 (research R10, FR-020). 축 통로·Viterbi를 Java로 옮기는 작업은 여기에 없다.

**Independent Test**: 엔진 mock이 단조가 아닌 `progresses`를 주면 요청은 200으로 통과하고
카운터·로그에만 남는지 확인.

### Tests for User Story 2 ⚠️

- [ ] T020 [P] [US2] 단조 위반 유닛 테스트 B11 작성 — 엔진 `progresses`가 단조가 아닐 때 **200 통과**하고 카운터가 1 증가 — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyServiceTests.java`
- [ ] T021 [P] [US2] 중복 곡 검산 테스트 B12 작성 — 엔진이 같은 mbid를 2회 주면 500, 같은 곡이 두 번 나오는 응답을 내지 않는다(I6) — 같은 파일

### Implementation for User Story 2

- [ ] T022 [US2] 단조 증가 검사 추가 — `JourneyService`에서 엔진 `progresses` 수열이 단조인지 확인하고 위반 시 Micrometer 카운터 증가 + 로그. **응답을 막지 않는다** (FR-020)
- [ ] T023 [US2] 엔진 구간 지연 계측 — Micrometer `Timer` `ody.journey.engine` 1개를 엔진 호출 구간에 두어 게이트웨이/엔진 예산을 분리 측정 (research R10, SC-002)
- [ ] T024 [US2] 엔진 메타 구조화 로그 1줄 추가 — `far`, `endpoint_dist`, `n_stations`, `mode`, `bundle`, 단조 위반 여부. **곡 제목·사용자 식별자는 남기지 않는다.** `endpoint_dist`를 지표 태그로 쓰지 않는다(카디널리티) (research R10, FR-023, 헌법 VIII)

**Checkpoint**: 경로 품질이 지표·로그로 확인된다. 응답 본문은 변하지 않는다.

---

## Phase 5: User Story 3 - 먼 여정과 같은 곡 지정 (Priority: P2)

**Goal**: 경계 입력과 길이 상한을 안전하게 다룬다.

**Independent Test**: `start == end` → `musicCnt:1`·엔진 호출 0회. 엔진 정거장 20개 → `musicCnt` 22·축소 없음.

### Tests for User Story 3 ⚠️

- [ ] T025 [P] [US3] `start == end` 테스트 C2 작성 — 200, `path` 1개(`step:0`), `musicCnt:1`, `totalDuration` = 그 곡 길이, **엔진 mock 호출 0회 검증** — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyControllerTests.java` (quickstart C2, research R5)
- [ ] T026 [P] [US3] 좌표 동일 2곡 경로 테스트 작성 — `start != end`이나 엔진이 정거장 0개를 주면 2곡 경로 200 — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyServiceTests.java` (FR-012)
- [ ] T027 [P] [US3] 상한 테스트 B8~B9 작성 — 정거장 20개면 `musicCnt` 22·축소 없음·예외 없음, 정거장 29개(계약 위반 강제)면 500이고 부분 경로를 내지 않는다(I5) — 같은 파일

### Implementation for User Story 3

- [ ] T028 [US3] `start == end` 단축 구현 — `JourneyService`에서 엔진 호출 **전에** 분기. `findDetail(start)` 1회로 응답을 만든다 (research R5, FR-012)
- [ ] T029 [US3] 정거장 0개 처리 — 엔진이 중간 정거장을 주지 않으면 `[start, end]` 2곡 경로를 200으로 반환 (FR-012, FR-009 "중복 제거로 중간이 사라져도 200")
- [ ] T030 [US3] 30곡 계약 가드 구현 — `path.size() > 30`이면 500. **축소 알고리즘을 만들지 않는다** — 엔진 상한이 20이라 이 경로는 발동하지 않는다 (FR-008, plan "처리 흐름" 6)
- [ ] T031 [US3] T025~T027 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 경계 입력이 오류 없이 처리된다.

---

## Phase 6: User Story 4 - 실패 원인을 구분해 받는다 (Priority: P2)

**Goal**: 400·401·404·422·500을 호출자가 구분할 수 있다.

**Independent Test**: 6종 실패 상황을 각각 호출해 상태·코드가 [contracts §① 실패표](contracts/music-journey.md)와 일치.

### Tests for User Story 4 ⚠️

- [ ] T032 [P] [US4] 검증·404 테스트 C3 일부 작성 — `start` 누락 / `start=0` / `start=abc` / `end` 누락 → 400 `INVALID_INPUT`, 없는 곡 → 404 `MUSIC_NOT_FOUND` — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyControllerTests.java`
- [ ] T033 [P] [US4] 422 vs 500 구분 테스트 C3 나머지 작성 — 엔진 `reachable:false` → 422 `PATH_NOT_FOUND`, **엔진 port 빈 부재 → 500**, **엔진 타임아웃·연결 실패 → 500**. 세 경우가 서로 다른 코드로 나오는지 확인 (clarify: 엔진 부재를 422로 내리지 않는다) — 같은 파일
- [ ] T034 [P] [US4] 조회 누락 테스트 B10 작성 — reader가 요청한 mbid 중 1건을 반환하지 않으면 500이고 19곡 경로를 성공으로 내지 않는다 — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyServiceTests.java` (research R4)
- [ ] T035 [P] [US4] 검증 순서 테스트 C4 작성 — `start=0`이고 엔진도 부재면 **400**이 먼저이고 엔진을 호출하지 않는다, 없는 곡이고 엔진도 부재면 **404**가 먼저 — `JourneyControllerTests.java`
- [ ] T036 [P] [US4] 실패 본문 형태 테스트 작성 — 모든 실패가 `success:false`·`data:null`·`error:{code,message}` — 같은 파일

### Implementation for User Story 4

- [ ] T037 [US4] 오류 매핑 구현 — `JourneyService`에서 곡 없음 → `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)`, 엔진 `reachable:false` → `CustomException(MusicErrorCode.PATH_NOT_FOUND)`, 엔진 예외·타임아웃·조립 실패 → `CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR)`. **부분 경로를 성공으로 반환하지 않는다** (FR-014, plan "오류 매핑")
- [ ] T038 [US4] `/music/journey`가 `SecurityConfig` permitAll 목록에 없어 인증 대상임을 확인하고, 그 사실을 테스트나 주석으로 고정 — `backend/src/main/java/com/ssafy/backend/config/SecurityConfig.java` 는 **수정하지 않는다** (FR-015, quickstart C5)
- [ ] T039 [US4] T032~T036 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: US1~US4 전부 port mock 기준으로 동작·검증된다.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T040 순수 조회 검증 (I8) — 전 시나리오에서 저장소 쓰기 호출이 0건인지 mock 상호작용으로 확인 — `backend/src/test/java/com/ssafy/backend/music/journey/JourneyServiceTests.java` (FR-018)
- [ ] T041 엔진 메타 비노출 검증 (I9) — 응답 JSON에 `far`·`endpoint_dist`·`mode`·`n_stations`·`bundle`·`reachable` 키가 하나도 없는지 MockMvc로 확인 — `JourneyControllerTests.java` (FR-023, quickstart C1)
- [ ] T042 최소 검증선 실행 — `cd backend && ./gradlew test` 와 `cd backend && ./gradlew build` 둘 다 통과 (CLAUDE.md §5, quickstart A)
- [ ] T043 [P] quickstart A~C 결과를 통과·실패·**미실행**으로 구분해 기록. **D절(통합)은 선행조건 미충족으로 미실행**이라고 명시하고 "3초 이내 확인"이라고 쓰지 않는다 (헌법 III, quickstart "보고 형식")

**Checkpoint**: 게이트웨이 완결. 어댑터 2개만 대기.

---

## Phase 8: 선행조건 대기 (⛔ 지금 착수 불가)

**Purpose**: 남의 파트 산출물이 있어야 시작되는 작업. 여기 도달하기 전에 착수하면 임시 스키마·목 어댑터를
운영 코드에 남기게 된다 — FR-017·FR-019가 금지한다.

- [ ] T044 ⛔ [B-Engine] `JourneyEngineClient` 구현 — `RestClient`로 BE4 엔진 호출, 타임아웃 2초·**재시도 없음**, `reachable:false`와 예외를 구분해 반환 — `backend/src/main/java/com/ssafy/backend/music/journey/JourneyEngineClient.java`. **선행**: BE4가 엔진 엔드포인트를 구현하고 `stations`에 `mbid`를 포함해야 한다 (contracts §② 요청 1·2)
- [ ] T045 ⛔ [곡 테이블] `JourneyTrackMapper` MyBatis 어댑터 + `backend/src/main/resources/mapper/` 매퍼 XML 구현 — mbid IN 조회. **선행**: BE 곡 테이블에 정수 `id` PK + `mbid` UNIQUE + `pc1`~`pc16`(`real`) 필요 (data-model §5, contracts §② 요청 5)
- [ ] T046 ⛔ [곡 테이블] `MusicDetailReader` 어댑터 — 002·003과 공유하는 B-D 항목. 이 기능은 `findDetail(id)`만 쓴다
- [ ] T047 ⛔ [T044+T045] quickstart D1~D7 실행 — 특히 **D2 종단 p95 ≤ 3초**를 엔진 구간·게이트웨이 구간 분리해 측정하고 기록. 단조 증가·인접 역 거리 median은 여기서 재측정하지 않는다(BE4 소유)
- [ ] T048 ⛔ [인프라] 엔진 base URL 실제 값을 배포 환경별로 주입 — 배포 형태(같은 호스트 / 컨테이너 네트워크)는 인프라 소유이므로 요청한다 (research "미해결")

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 의존 없음
- **Phase 2 Foundational**: Setup 후. **모든 사용자 스토리를 차단한다**
- **Phase 3 US1 (P1)**: Foundational 후. 다른 스토리에 의존하지 않는다 — **MVP**
- **Phase 4 US2 (P1)**: Foundational 후. 정상 경로가 있어야 품질을 관측할 수 있어 실질적으로 **US1 뒤**
- **Phase 5 US3 (P2)**: Foundational 후. 조립 로직(T018)을 쓰므로 **US1 뒤**
- **Phase 6 US4 (P2)**: Foundational 후. T037이 모든 분기를 덮으므로 **US1·US3 뒤**가 효율적
- **Phase 7 Polish**: US1~US4 후
- **Phase 8**: 타 파트 산출물 도착 후. 앞 단계와 무관하게 대기

### 스토리 독립성 (실제)

US1이 조립의 뼈대(T014~T018)를 만들고 US2·US3·US4가 그 위에 얹힌다. 템플릿의 "스토리 완전 병렬"은
이 기능에 해당하지 않는다 — 엔드포인트 1개에 서비스 1개라 병렬로 나눌 경계가 없다. 대신 **각 스토리는
독립적으로 테스트 가능**하다(스토리별 테스트 파일 분리 없이 시나리오 단위로 검증).

### Within Each User Story

- 테스트를 먼저 쓰고 실패를 확인한다
- DTO·port(Phase 2) → 서비스 → 컨트롤러 → 관측
- 스토리 완료 후 다음 우선순위로

### Parallel Opportunities

- **T003~T008** (Phase 2): 6개 전부 다른 신규 파일 → 병렬 가능. T009는 T006~T008에 의존
- **T010~T012** (US1 테스트): 2개 파일 → 병렬 가능
- **T020~T021** (US2 테스트): 같은 파일이지만 다른 메서드 → 병렬 가능
- **T025~T027** (US3 테스트): 병렬 가능
- **T032~T036** (US4 테스트): 5개 전부 병렬 가능
- **구현 작업 T013~T018, T028~T030, T037**: 같은 두 파일(`JourneyService`, `MusicController`)을 고치므로 **직렬**

---

## Parallel Example: Phase 2 Foundational

```bash
# 신규 파일 6개를 동시에:
Task: "PATH_NOT_FOUND 상수 추가 in backend/.../common/MusicErrorCode.java"
Task: "JourneyStop record in backend/.../music/dto/JourneyStop.java"
Task: "JourneyResponse record in backend/.../music/dto/JourneyResponse.java"
Task: "EnginePath record in backend/.../music/journey/EnginePath.java"
Task: "JourneyPathFinder port in backend/.../music/journey/JourneyPathFinder.java"
Task: "JourneyTrackReader port in backend/.../music/journey/JourneyTrackReader.java"
```

## Parallel Example: US4 테스트

```bash
Task: "검증·404 테스트 C3 in .../JourneyControllerTests.java"
Task: "422 vs 500 구분 테스트 in .../JourneyControllerTests.java"
Task: "조회 누락 테스트 B10 in .../JourneyServiceTests.java"
Task: "검증 순서 테스트 C4 in .../JourneyControllerTests.java"
Task: "실패 본문 형태 테스트 in .../JourneyControllerTests.java"
```

---

## Implementation Strategy

### MVP (US1만)

1. Phase 1 Setup → Phase 2 Foundational
2. Phase 3 US1
3. **멈추고 검증**: quickstart B1~B7·C1
4. 정상 경로가 정본 §3.3 형태로 나오면 MVP 성립. 단 **엔진·DB 어댑터 없이 mock 기준**임을 명시

### 증분 전달

1. Setup + Foundational → 계약 준비
2. US1 → 정상 경로 (MVP)
3. US2 → 품질 관측 (응답 불변)
4. US3 → 경계 안전
5. US4 → 실패 구분 → **게이트웨이 완결**
6. Phase 8 → 타 파트 도착 후 통합

### 이 기능을 여러 명이 나눌 수 있는가

권하지 않는다. 엔드포인트 1개·서비스 1개이고 구현 작업이 같은 두 파일을 고친다.
Phase 2의 신규 파일 6개와 각 스토리의 테스트만 병렬 가치가 있다.

---

## Notes

- **경로 산출을 Java로 재구현하는 작업은 이 목록에 없다.** 축 통로·Viterbi·후처리·완화 단계는 BE4 엔진 소유(D4, FR-017)
- 후처리 임계값(`artist_cap` 3, `tau_dup` 1.6624)을 게이트웨이 코드에 하드코딩하지 않는다 (FR-009)
- 정본 §3.3 응답에 필드를 추가하지 않는다 (FR-023)
- Phase 8 이전에 어댑터를 임시 구현으로 채우지 않는다 (FR-019)
- 커밋은 작업 단위 또는 논리 묶음마다. 커밋 메시지에 `[S15P21A405-61]` 포함
- 검증 보고는 통과·실패·미실행을 구분한다 (헌법 III)
