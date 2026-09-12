---

description: "Task list for 004-journey-path (경로 탐색 게이트웨이)"
---

# Tasks: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Input**: Design documents from `specs/004-journey-path/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/music-journey.md](contracts/music-journey.md), [quickstart.md](quickstart.md)

**Tests**: 포함한다. spec SC-001과 [quickstart.md](quickstart.md) B·C절이 검증 시나리오를 명시하고,
헌법 III(완료 전 검증)과 CLAUDE.md §5(`./gradlew test`·`./gradlew build`)가 이를 요구한다.

**Organization**: spec.md의 US1~US4별로 묶는다.

> **rev.3 (2026-09-11) — Phase 1~7 과 Phase 8 을 다르게 읽는다.**
>
> Phase 1~7 은 **원격 파이썬 엔진이 경로를 산출한다는 전제**로 작성되어 완료됐고, 그 산출물
> (컨트롤러·DTO·조립·오류 매핑·테스트 39건)은 **정본 응답 계약이 그대로이므로 살아남는다.**
> 2026-09-11 팀 결정으로 산출 주체가 백엔드 인프로세스로 바뀌어(FR-017 개정) **Phase 8 만 재작성됐다.**
>
> 따라서 Phase 1~7 의 "축 통로·Viterbi를 Java로 옮기는 작업은 없다" 는 설명은 **rev.2 시점의 진술**이며
> 현재는 반대다 — Phase 9 가 정확히 그 작업이다. Phase 1~7 의 `[X]` 를 되돌리지 않는다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완 작업에 의존하지 않음)
- **[Story]**: US1~US4 (사용자 스토리 단계만)
- 파일 경로를 반드시 적는다

## Path Conventions

단일 Gradle backend. 모든 경로는 저장소 루트 기준.

- 운영 코드: `backend/src/main/java/com/ssafy/backend/`
- 테스트: `backend/src/test/java/com/ssafy/backend/music/` (기존 관례가 flat 이라 `journey/` 하위를 만들지 않았다)
- 여정 전용 운영 패키지: `.../music/journey/`

---

## Phase 1: Setup

**Purpose**: 신규 프로젝트 초기화가 아니다. master 구조·의존성이 이미 있으므로 설정 항목만 둔다.

- [X] T001 엔진 base URL·타임아웃 속성을 `backend/src/main/resources/application.yml`에 추가 (`ody.journey.engine.base-url`, `ody.journey.engine.timeout=2s`). 값은 환경별 `application-*.yml`에서 덮고, 시크릿·운영 호스트를 커밋하지 않는다 (research R8)
- [X] T002 기준선 확인 — `cd backend && ./gradlew test` 가 현재 통과하는지 먼저 확인해 신규 실패와 기존 실패를 구분한다

**Checkpoint**: 설정 자리와 기준선 확보.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: US1~US4 전부가 쓰는 계약·DTO·경계. 이 단계 없이는 어떤 스토리도 시작할 수 없다.

**⚠️ CRITICAL**: 여기까지 끝나야 사용자 스토리 작업이 시작된다.

- [X] T003 [P] `PATH_NOT_FOUND`(422, "두 곡을 연결하는 경로를 찾을 수 없습니다.") 상수를 `backend/src/main/java/com/ssafy/backend/common/MusicErrorCode.java`에 추가. 신규 enum 파일을 만들지 않는다 (research R7)
- [X] T004 [P] `JourneyStop` record 생성 — `@JsonUnwrapped MusicDetail` + `int step` — `backend/src/main/java/com/ssafy/backend/music/dto/JourneyStop.java` (research R6, 003 `NeighborTrack` 선례)
- [X] T005 [P] `JourneyResponse` record 생성 — `musicCnt`, `totalDuration`, `List<JourneyStop> path` — `backend/src/main/java/com/ssafy/backend/music/dto/JourneyResponse.java` (data-model §2)
- [X] T006 [P] `EnginePath` record 생성 — `reachable`, `stationMbids`, `progresses`, `endpointDist`, `far`, `nStations`, `mode`, `bundle` — `backend/src/main/java/com/ssafy/backend/music/journey/EnginePath.java` (data-model §3)
- [X] T007 [P] `JourneyPathFinder` port 인터페이스 생성 (`EnginePath find(String startMbid, String endMbid)`) — `backend/src/main/java/com/ssafy/backend/music/journey/JourneyPathFinder.java`. 계약을 javadoc에 적는다: 모드는 구현이 `axis` 고정, 경로 없음은 예외가 아니라 `reachable:false`, 엔진 부재·타임아웃은 예외 (contracts §②)
- [X] T008 [P] `JourneyTrackReader` port 인터페이스 생성 (`List<MusicDetail> findDetailsByMbids(List<String> mbids)`) — `backend/src/main/java/com/ssafy/backend/music/journey/JourneyTrackReader.java`. javadoc에 **순서 미보장·누락 시 결과에서 빠짐·최대 20건**을 명시 (contracts §③, research R4)
- [X] T009 `JourneyService` 골격 생성 — `Optional<JourneyPathFinder>`·`Optional<JourneyTrackReader>`·`MusicDetailReader` 주입, 어댑터 부재 시 기존 `MusicService` 패턴대로 미구현을 드러냄 — `backend/src/main/java/com/ssafy/backend/music/service/JourneyService.java` (research R2, FR-019)

**Checkpoint**: 계약·DTO 준비 완료. 컴파일 통과. 어댑터 없이도 빌드가 깨지지 않는다.

---

## Phase 3: User Story 1 - 두 곡 사이의 경로를 받는다 (Priority: P1) 🎯 MVP

**Goal**: 두 곡 ID로 출발→도착 순서 목록을 받고, 각 곡이 MusicDetail 필드와 좌표를 갖는다.

**Independent Test**: port 2개를 mock으로 두고 `GET /api/music/journey?start=10234&end=10877` 호출 →
`path[0]`이 출발곡(`step:0`), 마지막이 도착곡, `step` 연속, `musicCnt`·`totalDuration`이 `path`와 일치.

### Tests for User Story 1 ⚠️

> 구현 전에 작성하고 실패를 확인한다.

- [X] T010 [P] [US1] 조립 유닛 테스트 B1~B5 작성 — reader가 뒤섞인 순서로 반환해도 정거장 순서가 엔진 순서와 같고(I7), `step` 0부터 연속(I1), 양끝이 start·end(I2), `musicCnt == path.size()`(I3), `totalDuration` 합(I4) — `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java` (quickstart B)
- [X] T011 [P] [US1] null 허용·재생불가 유닛 테스트 B6~B7 작성 — `duration`이 null인 곡은 0으로 더하고, `youtubeUrl`이 null인 곡은 `path`에 남는다 — 같은 파일 `JourneyServiceTests.java`
- [X] T012 [P] [US1] 응답 계약 MockMvc 테스트 C1 작성 — 200·`success:true`·`error:null`, `path` 원소가 MusicDetail 필드 + `step`으로 평평하게 직렬화(`@JsonUnwrapped`) — `backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java` (@WebMvcTest 슬라이스 — research R9 정정, 아래 참조)

### Implementation for User Story 1

- [X] T013 [US1] `GET /api/music/journey` 핸들러 — **신규 `backend/src/main/java/com/ssafy/backend/music/controller/JourneyController.java`**. `@RequestParam @Min(1) long start`, `@RequestParam @Min(1) long end`, `ApiResponse.success(journeyService.getJourney(start, end))`. `mode`·`n`·detour 파라미터를 받지 않는다 (FR-023, contracts §①)
      - **설계 변경**: 처음에 `MusicController` 에 메서드를 추가했더니 그 컨트롤러의 기존 슬라이스 테스트 19건(major·search·detail)이 새 빈을 요구하며 깨졌다. 남의 기능 테스트 3개 파일을 고치는 대신 컨트롤러를 분리했다. URL·응답 계약은 동일하다
- [X] T014 [US1] 식별자 해석 구현 — `JourneyService`에서 `MusicDetailReader.findDetail(start)`·`findDetail(end)` 호출로 `MusicDetail` 2건을 얻고 그 `mbid`를 엔진 호출에 쓴다. **별도 `id→mbid` 조회를 만들지 않는다** (research R3, FR-022)
- [X] T015 [US1] 엔진 호출 연결 — `JourneyPathFinder.find(startMbid, endMbid)` 호출부를 `JourneyService`에 구현. 정거장 수·모드를 넘기지 않는다 (FR-011, FR-023)
- [X] T016 [US1] 정거장 상세 일괄 조회 — `JourneyTrackReader.findDetailsByMbids(stationMbids)` 1회 호출. 곡당 조회로 나누지 않는다(왕복 예산) (research R3)
- [X] T017 [US1] 순서 재조립 — 조회 결과를 `Map<String, MusicDetail>`로 만들고 **엔진 `stationMbids` 순서대로** 꺼낸다. SQL 순서에 의존하지 않는다 (research R4, I7)
- [X] T018 [US1] 최종 조립 — `[startDetail] + 정거장 + [endDetail]`로 `path`를 만들고 `step`을 0부터 연속 부여, `musicCnt = path.size()`, `totalDuration = Σ duration`(null은 0) (FR-005, FR-006, FR-021)
- [X] T019 [US1] T010~T012 통과 확인 — `cd backend && ./gradlew test`

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

- [X] T020 [P] [US2] 단조 위반 유닛 테스트 B11 작성 — 엔진 `progresses`가 단조가 아닐 때 **200 통과**하고 카운터가 1 증가 — `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java`
- [X] T021 [P] [US2] 중복 곡 검산 테스트 B12 작성 — 엔진이 같은 mbid를 2회 주면 500, 같은 곡이 두 번 나오는 응답을 내지 않는다(I6) — 같은 파일

### Implementation for User Story 2

- [X] T022 [US2] 단조 증가 검사 추가 — `JourneyService`에서 엔진 `progresses` 수열이 단조인지 확인하고 위반 시 Micrometer 카운터 증가 + 로그. **응답을 막지 않는다** (FR-020)
- [X] T023 [US2] 엔진 구간 지연 계측 — Micrometer `Timer` `ody.journey.engine` 1개를 엔진 호출 구간에 두어 게이트웨이/엔진 예산을 분리 측정 (research R10, SC-002)
- [X] T024 [US2] 엔진 메타 구조화 로그 1줄 추가 — `far`, `endpoint_dist`, `n_stations`, `mode`, `bundle`, 단조 위반 여부. **곡 제목·사용자 식별자는 남기지 않는다.** `endpoint_dist`를 지표 태그로 쓰지 않는다(카디널리티) (research R10, FR-023, 헌법 VIII)

**Checkpoint**: 경로 품질이 지표·로그로 확인된다. 응답 본문은 변하지 않는다.

---

## Phase 5: User Story 3 - 먼 여정과 같은 곡 지정 (Priority: P2)

**Goal**: 경계 입력과 길이 상한을 안전하게 다룬다.

**Independent Test**: `start == end` → `musicCnt:1`·엔진 호출 0회. 엔진 정거장 20개 → `musicCnt` 22·축소 없음.

### Tests for User Story 3 ⚠️

- [X] T025 [P] [US3] `start == end` 테스트 C2 작성 — 200, `path` 1개(`step:0`), `musicCnt:1`, `totalDuration` = 그 곡 길이, **엔진 mock 호출 0회 검증** — `backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java` (quickstart C2, research R5)
- [X] T026 [P] [US3] 좌표 동일 2곡 경로 테스트 작성 — `start != end`이나 엔진이 정거장 0개를 주면 2곡 경로 200 — `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java` (FR-012)
- [X] T027 [P] [US3] 상한 테스트 B8~B9 작성 — 정거장 20개면 `musicCnt` 22·축소 없음·예외 없음, 정거장 29개(계약 위반 강제)면 500이고 부분 경로를 내지 않는다(I5) — 같은 파일

### Implementation for User Story 3

- [X] T028 [US3] `start == end` 단축 구현 — `JourneyService`에서 엔진 호출 **전에** 분기. `findDetail(start)` 1회로 응답을 만든다 (research R5, FR-012)
- [X] T029 [US3] 정거장 0개 처리 — 엔진이 중간 정거장을 주지 않으면 `[start, end]` 2곡 경로를 200으로 반환 (FR-012, FR-009 "중복 제거로 중간이 사라져도 200")
- [X] T030 [US3] 30곡 계약 가드 구현 — `path.size() > 30`이면 500. **축소 알고리즘을 만들지 않는다** — 엔진 상한이 20이라 이 경로는 발동하지 않는다 (FR-008, plan "처리 흐름" 6)
- [X] T031 [US3] T025~T027 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 경계 입력이 오류 없이 처리된다.

---

## Phase 6: User Story 4 - 실패 원인을 구분해 받는다 (Priority: P2)

**Goal**: 400·401·404·422·500을 호출자가 구분할 수 있다.

**Independent Test**: 6종 실패 상황을 각각 호출해 상태·코드가 [contracts §① 실패표](contracts/music-journey.md)와 일치.

### Tests for User Story 4 ⚠️

- [X] T032 [P] [US4] 검증·404 테스트 C3 일부 작성 — `start` 누락 / `start=0` / `start=abc` / `end` 누락 → 400 `INVALID_INPUT`, 없는 곡 → 404 `MUSIC_NOT_FOUND` — `backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java`
- [X] T033 [P] [US4] 422 vs 500 구분 테스트 C3 나머지 작성 — 엔진 `reachable:false` → 422 `PATH_NOT_FOUND`, **엔진 port 빈 부재 → 500**, **엔진 타임아웃·연결 실패 → 500**. 세 경우가 서로 다른 코드로 나오는지 확인 (clarify: 엔진 부재를 422로 내리지 않는다) — 같은 파일
- [X] T034 [P] [US4] 조회 누락 테스트 B10 작성 — reader가 요청한 mbid 중 1건을 반환하지 않으면 500이고 19곡 경로를 성공으로 내지 않는다 — `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java` (research R4)
- [X] T035 [P] [US4] 검증 순서 테스트 C4 작성 — `start=0`이고 엔진도 부재면 **400**이 먼저이고 엔진을 호출하지 않는다, 없는 곡이고 엔진도 부재면 **404**가 먼저 — `JourneyControllerTests.java`
- [X] T036 [P] [US4] 실패 본문 형태 테스트 작성 — 모든 실패가 `success:false`·`data:null`·`error:{code,message}` — 같은 파일

### Implementation for User Story 4

- [X] T037 [US4] 오류 매핑 구현 — `JourneyService`에서 곡 없음 → `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)`, 엔진 `reachable:false` → `CustomException(MusicErrorCode.PATH_NOT_FOUND)`, 엔진 예외·타임아웃·조립 실패 → `CustomException(GlobalErrorCode.INTERNAL_SERVER_ERROR)`. **부분 경로를 성공으로 반환하지 않는다** (FR-014, plan "오류 매핑")
- [X] T038 [US4] `/api/music/journey`가 `SecurityConfig` permitAll 목록에 없어 인증 대상임을 확인하고, 그 사실을 테스트나 주석으로 고정 — `backend/src/main/java/com/ssafy/backend/config/SecurityConfig.java` 는 **수정하지 않는다** (FR-015, quickstart C5)
- [X] T039 [US4] T032~T036 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: US1~US4 전부 port mock 기준으로 동작·검증된다.

---

## Phase 7: Polish & Cross-Cutting

- [X] T040 순수 조회 검증 (I8) — 전 시나리오에서 저장소 쓰기 호출이 0건인지 mock 상호작용으로 확인 — `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java` (FR-018)
- [X] T041 엔진 메타 비노출 검증 (I9) — 응답 JSON에 `far`·`endpoint_dist`·`mode`·`n_stations`·`bundle`·`reachable` 키가 하나도 없는지 MockMvc로 확인 — `JourneyControllerTests.java` (FR-023, quickstart C1)
- [X] T042 최소 검증선 실행 — `cd backend && ./gradlew test` 와 `cd backend && ./gradlew build` 둘 다 통과 (CLAUDE.md §5, quickstart A)
- [X] T043 [P] quickstart A~C 결과를 통과·실패·**미실행**으로 구분해 기록. **D절(통합)은 선행조건 미충족으로 미실행**이라고 명시하고 "3초 이내 확인"이라고 쓰지 않는다 (헌법 III, quickstart "보고 형식")

**Checkpoint**: 게이트웨이 완결. 어댑터 2개만 대기.

### 실행 결과 (2026-09-10)

| 항목 | 결과 |
| --- | --- |
| `./gradlew test` | **통과** — 76 tests, 0 failed, 0 skipped |
| `./gradlew build` | **통과** |
| 신규 테스트 | JourneyServiceTests 23건 + JourneyControllerTests 16건 = **39건 전부 통과** |
| 기존 테스트 | 37건 전부 통과 (T013 설계 변경 전 19건이 깨졌다가 복구) |
| quickstart A·B·C | 통과 |
| quickstart D (통합) | **미실행** — B-Engine·곡 테이블 미충족. 종단 3초는 측정하지 않았다 |

**research R9 정정**: "standalone MockMvc" 로 적었으나 실제 관례는 `@WebMvcTest` + SecurityConfig·
JwtAuthenticationFilter 제외 + 매퍼 `@MockitoBean` 이다(003 선례). 그 패턴을 따랐고 동작한다.

---

## Phase 8: rev.2 잔여 태스크 정리 (원격 엔진 전제)

**Purpose**: rev.2 의 Phase 8 은 원격 파이썬 엔진 호출을 전제한 대기 목록이었다. 2026-09-11 결정으로
그 중 둘은 **만들 대상이 없어졌다**. 폐기 기록을 남기는 이유는 나중에 "왜 안 했나" 를 다시 묻지 않기 위함이다.

- [~] ~~T044 [B-Engine] `JourneyEngineClient` 구현 — `RestClient` 로 BE4 엔진 호출, 타임아웃 2초~~
  → ❌ **폐기 (rev.3)**. 호출할 원격 엔진이 없다. 대체: **T049~T056** (인프로세스 산출)
- [x] T045 `JourneyTrackMapper` MyBatis 어댑터 + 매퍼 XML — 정거장 상세 일괄 조회. **선행**: 곡 테이블에 정수 `id` PK + `mbid` UNIQUE + 16차원 좌표 필요 (data-model §5). **rev.3 참고**: 식별자를 `mbid` 로 둘지 `id` 로 바꿀지는 D-ID2 로 미뤘으므로 **rev.2 계약(mbid IN 조회) 그대로 구현한다**

  **[2026-09-12] 완료** — `JourneyTrackReaderAdapter` + `MusicDetailMapper.findByMbids`. 별도 매퍼를 두지 않고 기존 `MusicDetailMapper` 에 `mbid IN` 조회를 더했다 — 같은 테이블·같은 컬럼이라 매퍼를 나누면 `locationColumns` 조각이 두 벌이 된다.

  **[2026-09-12] 전 경로 확인** (`fullServicePathAssemblesResponse`, 실 DB 5쌍): 서비스 계층까지 태워
  응답 조립을 검증했다 — `musicCnt == path.length`, `step` 0부터 연속, 양 끝이 출발·도착곡, 좌표·제목
  채워짐, 곡 중복 0, `totalDuration` 합계 일치. 5쌍 전부 통과했고 정거장 15~20개(`musicCnt` 17~22),
  `monotonic=true` 5/5 였다.

  **이게 없으면 API 가 동작하지 않는다.** `JourneyService.hydrate()` 가 port 를 `orElseThrow` 로 꺼내므로, 산출이 다 붙어도 **중간 정거장이 있는 모든 요청이 500** 이었다. 측정 하네스는 산출기만 직접 불러서 이 구멍을 덮고 있었다 — 벤치가 통과한다고 API 가 도는 것이 아니다.
- [x] T046 `MusicDetailReader` 어댑터 — **[2026-09-12] `MusicDetailReaderAdapter` 가 `backend/dev` 에 이미 머지됨.** 좌표(16축)를 채우는지 확인만 하면 된다 — 002·003·005 와 공유. 이 기능은 `findDetail(id)` 만 쓴다. **rev.3: 좌표(16차원)가 응답에 필요하므로 이 어댑터가 좌표를 채워야 한다** — 산출의 축 좌표계가 출발·도착 좌표에서 시작한다 — **확인 완료**: `MusicDetailReaderAdapter.findDetail` 이 `locationColumns` 로 pc1~pc16 을 채운다.
- [x] T047 [T045+T046+T053] quickstart D1~D7 실행 — **[2026-09-12] D-DATA 해소로 착수 가능.** 수용 기준은 핸드오프 §4.9 의 AC-J1~J6 를 함께 쓴다(무작위 40쌍 전부 reachable · 단조 증가 · 인접 역 거리 ≥ 1.6624 · 아티스트 4곡 이상 0건 · **p95 ≤ 2초** · far 쌍의 역 10~20개) — **rev.3: 측정 구간을 "엔진 / 게이트웨이" 가 아니라 "층 조회 / DP / 조립" 으로 나눈다.** 최악 케이스(층 재질의 상한 + 규칙 재산출 상한 소진)를 반드시 포함한다 — **타임아웃이 없어져 이 값이 곧 지연 상한이다** (SC-002, FR-025, B-Latency)

  **[2026-09-12] 운영 DB 실측 결과** (`JourneyBenchmarkIT`, pairs=40, seed=42, SSH 터널 경유):

  | 기준 | 값 | 판정 |
  | --- | --- | --- |
  | AC-J1 경로 없음 | 0 / 40 | ✅ |
  | AC-J2 진행도 역행 | 0 | ✅ |
  | AC-J3 인접 역 거리 ≥ 1.6624 | 위반 0 | ✅ |
  | AC-J4 아티스트 상한·중복 | 위반 0 | ✅ |
  | AC-J5 지연 p50 / p95 / max | 734 / 1147 / 1479 ms | ✅ (예산 2000ms) |
  | AC-J6 far 쌍 | 34 / 40 | — |
  | 인접 역 거리 median (SC-005 입력) | 2.822 | ✅ 아래 SC-005 |

  측정값은 **SSH 터널 왕복을 포함한 상한**이다. 운영은 앱과 DB 가 같은 호스트라 더 짧다.
  측정 구간은 `AxisJourneyPathFinder.find()` 뿐이며 게이트웨이(상세 조회 2회 + 응답 조립)는 빠져 있다.
  **B-Latency 최악 케이스** (`worstCaseLatencyStaysWithinBudget`): 무작위 표본으로는 이 조합이
  안 나오므로(후보가 넉넉해 첫 질의에서 끝난다) 조회 결과를 `MIN_LAYER` 미만으로 깎아 층마다
  재질의 상한을 강제 소진시킨다 — DB 에 나가는 질의는 실제 그대로다.

  | 재질의 상한 | 층당 질의 | 최악 지연 p50 / max | 종단 3초 예산 |
  | --- | --- | --- | --- |
  | 2 (기존) | 200 → 400 → 800 | 3137 / **3887** ms | ❌ 초과 |
  | **1 (채택)** | 200 → 400 | 1535 / **1824** ms | ✅ |

  3차 시도(limit 800, `ef_search` 800)가 앞의 둘을 합친 것보다 비싼데, **끄고 나서 품질 지표가
  전부 동일했다** — median 2.822, AC-J1~J4 위반 0, SC-005 40/40 승 모두 그대로다. 200개를 훑어
  30개를 못 채운 지점은 주변에 곡이 실제로 희박한 곳이라 4배를 더 훑어도 필터를 통과하는 곡이
  늘지 않는다. 비용만 두 배였다. `LayerCandidates.MAX_RETRY = 1`.

  **SC-005** (`axisStationsAreCloserThanLinear`, 같은 40쌍을 두 모드로):

  | 모드 | 인접 역 거리 median p50 | p95 |
  | --- | --- | --- |
  | `axis` | **2.822** | 4.054 |
  | `linear` | 3.530 | 4.884 |

  쌍별로도 **40 / 40 전부** `axis` 가 더 촘촘하다. 데이터 파트 기준선(2.949 대 3.430, R10)과 일치한다.
  두 모드 비교는 운영 요청 경로가 아니라 이 검증 경로에서만 돈다(FR-010).
- [~] ~~T048 [인프라] 엔진 base URL 실제 값을 배포 환경별로 주입~~
  → ❌ **폐기 (rev.3)**. 주입할 URL 이 없다. 대체: **T057** (`application.yml` 의 엔진 속성 제거)

---

## Phase 9: 인프로세스 경로 산출 (rev.3 신규)

**Purpose**: 경로 산출을 백엔드 프로세스 안에서 수행한다(FR-017 개정). **방식은 데이터 파트가 정의한
`axis` 그대로이고 실행 위치만 옮긴다** — 알고리즘을 새로 설계하는 작업이 아니다.

**⚠️ 착수 가능 여부가 태스크마다 다르다 — 이것이 이 Phase 의 핵심이다.**

| 구분 | 태스크 | 지금 착수 |
| --- | --- | --- |
| 계약·경계·javadoc | T049 · T050(경계만) · T051 · T052 | ✅ **가능** |
| 산출 알고리즘 (저장소를 모른다) | T053 · T055 · T056 · T057 | ✅ **가능** — 합성 좌표로 구현·검증 |
| 산출 검증 | T058 ~ T062 | ✅ **가능** — 실 DB 불필요 |
| 기존 테스트·설정 정리 | T063 ~ T066 | ✅ 가능 |
| 층 후보 조회 어댑터 | T054 | ✅ **가능 (2026-09-12 해소)** — `music_location_hnsw_idx` 존재, SQL 은 핸드오프 §4.3 |
| 임계값 실 로딩 | T050 의 실 구현 | ✅ **가능 (2026-09-12 해소)** — 출처 `postprocess_rules.json` 확정, 값은 핸드오프 §2 |
| 지연 실측 | T047 (Phase 8) | ✅ **완료** 2026-09-12 — p95 1653ms (터널 포함 상한). AC-J1~J5 전부 통과 |

산출이 층 후보 조회 경계 뒤에 있기 때문에 이렇게 갈린다(plan "세 층으로 자른다").

**[2026-09-12 갱신] 차단이 전부 풀렸다.** 데이터 파트 전달본(`data/docs/BE_ALGORITHM_HANDOFF.md`,
`origin/data/docs/S15P21A405-217-be-search-journey-handoff`)이 저장소 실물·임계값 출처·SQL·DP 의사코드·
파라미터·수용 기준을 모두 제공했다. 위 표의 ⛔ 세 줄이 ✅ 로 바뀐 근거다. 그래도 **조회 어댑터를 목으로
채워 운영 코드에 남기지는 않는다**(FR-019) — 이제 목이 필요 없으니 실제 어댑터를 쓴다.

### 계약·경계

- [X] T049 [P] **층 후보 조회 port 인터페이스** 생성 — `backend/src/main/java/com/ssafy/backend/music/journey/` 아래. 계약: **지점 좌표(16차원)를 값으로 받고** 근처 후보 N개를 거리와 함께 돌려준다. javadoc 에 세 가지를 명시한다 — (a) **필터를 조회에 넣지 않는다**(넣으면 요청보다 적게 돌아온다) (b) **기준점을 조회 안에서 계산하지 않는다**(근사 인덱스가 쓰이지 않고 조용히 틀린다) (c) 근사이므로 순서가 흔들릴 수 있어 **호출자가 안정 정렬한다**(FR-013). 005 의 이웃 조회와 같은 port 로 묶을 수 있는지 함께 판단한다 (D-005)
- [X] T050 [P] **규칙 정의 로딩 경계** 생성 — 같은 녹음 컷·아티스트 상한·길이 범위·원거리 임계값과 번들 버전을 읽는 경계(FR-024). **값을 Java 상수로 박지 않는다.** **[2026-09-12] 출처가 확정됐다** — `data/serving/v2.1-pca16/postprocess_rules.json` 이 유일 출처이고 값은 핸드오프 §2 표에 있다(`tau_dup` 1.6624 · `artist_cap` 3 · `tau_far` 4.912 · `length_range_s` 30~1200 · `hub_penalty` OFF · far 10.7 · λ 2.0). 따라서 **경계 정의 + 실 로딩까지 이 태스크에서 한다.** 설정으로 빼 번들 교체 때 함께 바꾼다. 거리는 전부 L2 — 코사인·내적으로 바꾸면 임계값이 전부 무의미해진다
- [X] T051 `JourneyPathFinder` **서명 변경 + javadoc 개정** — javadoc 의 "산출 방식과 파라미터는 이 인터페이스 뒤에 있고 **게이트웨이가 Java로 재구현하지 않는다**(FR-017)"·"엔진 부재·타임아웃은 예외로 던진다"·"어댑터는 BE4 가 `retrieval/api.py` 를 구현한 뒤" 가 **모두 틀려졌다**. 경로 없음이 예외가 아니라 `reachable:false` 라는 계약은 유지한다 (422/500 구분 때문).

  **⚠️ 서명을 바꿔야 한다 — 2026-09-11 구현 착수 중 발견.** 현재 `EnginePath find(String startMbid, String endMbid)` 는 **출발·도착 좌표를 전달하지 못한다.** 원격 엔진은 mbid 로 자기 번들에서 좌표를 찾았지만, 인프로세스 산출은 축 좌표계를 만들려면 A·B 의 16차원 좌표가 필요하고, 같은 녹음 필터에는 A·B 의 아티스트·제목도 필요하다.

  좌표를 산출 안에서 다시 조회하면 **산출이 저장소를 알게 되어** plan 의 세 층 경계가 깨지고, 합성 좌표 검증(SC-003·SC-004·SC-006)이 D-DATA 에 묶인다 — 이 경계가 존재하는 이유가 사라진다.

  호출부(`JourneyService`)는 404 판정을 위해 **이미 `MusicDetail` 두 건을 들고 있다.** 따라서 `EnginePath find(MusicDetail start, MusicDetail end)` 로 바꾸고 추가 조회를 만들지 않는다.

  **영향 범위**: `JourneyService.callEngine` 1곳 + `JourneyServiceTests` 의 `pathFinder.find(...)` 스텁 10곳. 전부 기계적 치환이며 **조립·오류 매핑 단언은 그대로다**. `JourneyControllerTests` 는 서비스를 목으로 두므로 영향 없다
- [X] T052 [P] `EnginePath` javadoc 개정 — "BE4 데이터 엔진의 경로 응답"·"`bundle` 은 로그 전용, 대조하지 않는다" 재서술. **`bundle` 을 어디서 읽을지 미확정임을 javadoc 에 남긴다**(D-RULES). `progressMonotonic()` 의 뜻이 "남이 준 값 검증" 에서 "자기 산출물 자기 검증" 으로 바뀐 것도 적는다(FR-020)

### 산출 구현 (합성 좌표로 검증 — D-DATA 무관)

- [X] T053 **축 좌표계 + 역 수 + 층 지점 계산** — `L = ‖B − A‖`, 진행도 `p`, 축 이탈 `r`, 역 수 `L ≤ 10.7 → 10` / 초과 시 `clamp(round(10 + (L − 10.7)), 10, 20)`, 층 지점 `c_k = A + k/(n+1)·(B − A)`. **`L == 0` 은 2곡 경로로 끊는다**(FR-012 — 기존 `JourneyService` 의 `start == end` 분기와는 다른 경우다). 먼 곡을 거절하지 않는다
- [X] T054 **층 후보 조회 어댑터** — T049 port 의 MyBatis 구현. **[2026-09-12] 선행 충족** — `music`(6,624,399행) · `location vector(16)` · `music_location_hnsw_idx`(L2). SQL 은 핸드오프 §4.3 그대로:

      ```sql
      SELECT id, mbid, title, artist, duration, location
      FROM music ORDER BY location <-> :ck LIMIT 200
      ```

      ⚠️ **지점 좌표를 바인드 파라미터로 넘긴다. 서브쿼리로 계산하지 않는다** — `InitPlan` 으로 들어가 HNSW 를 못 쓰고 실측 recall 0.0000 이 나왔다(거리 0 인 자기 자신 대신 23.3 짜리가 1위). 오류가 아니라 조용히 틀린다.
      ⚠️ **후처리 조건을 SQL 에 넣지 않는다** — pgvector 0.7.0 은 필터를 걸면 `LIMIT` 보다 적게 반환한다. 그래서 200개를 뽑아 앱에서 거른다(T055)
- [X] T055 **후보 선별** — 조회 결과에서 앱 단 필터: 진행도 `p ≤ 0` 또는 `p ≥ 1` 버림 / 출발·도착 및 그와 같은 녹음 버림 / 길이 범위 밖 버림(임계값은 T050 경계에서). **남은 후보가 30 미만이면 그 층만 재질의(상한 2회)**. 확정 시 **(거리, 식별자) 안정 정렬**(FR-013) — 동률에서 순서를 미정의로 남기지 않는다
- [X] T056 **Viterbi DP + 규칙 재산출 루프** — `cost[k][v] = min_u(cost[k−1][u] + step(u,v)²) + 2.0·r(v)²`, 단 `step(u,v) ≥ 같은 녹음 컷` 인 `u` 만(제자리걸음 차단). 마지막에 B 로 한 번 더 전이하고 역추적. 규칙 검사 후 위반이면 고쳐서 재실행(**상한 8회**) — 같은 녹음 중복은 그 곡만 후보 제외, **아티스트 상한 초과는 그 아티스트 전체에 큰 벌점**(행 하나만 막으면 수렴하지 않는다). 전 층이 비면 `reachable:false`, **상한 안에 규칙을 지킨 경로를 못 얻으면 예외 → 500**(규칙 위반 경로를 성공으로 내지 않는다, FR-009·FR-025)
- [X] T057 `linear` 폴백 모드 — 지점마다 독립 최근접 1개. **요청 파라미터로 승격하지 않는다**(FR-023, 헌법 VII). 비교·이식 검증용이며 진행도 역행은 이 모드의 알려진 성질이다(같은 40쌍에서 21건)

### 테스트 (합성 좌표 — 지금 가능)

- [X] T058 [P] **진행도 단조 증가 테스트** (SC-003) — 합성 좌표로 산출한 경로의 진행도가 순서대로 증가한다. `axis` 에서 위반이 나오면 **산출 구현의 결함**이다(FR-020). `linear` 는 이 테스트 대상이 아니다
- [X] T059 [P] **규칙 수렴 테스트** (SC-004) — 같은 아티스트가 몰린 합성 구역에서 아티스트 전체 벌점 재산출이 상한을 지킨 경로로 **수렴한다**. 같은 녹음 중복이 결과에 남지 않는다. **행 단위 차단만으로는 수렴하지 않는다는 것도 함께 확인한다** — 이것이 벌점 방식을 택한 이유다
- [X] T060 [P] **결정성 테스트** (SC-006, FR-013) — **동률 거리 후보를 포함한** 합성 입력으로 반복 산출해 동일 경로. 안정 정렬을 빼면 깨지는 케이스여야 한다(빼도 통과하면 테스트가 의미 없다)
- [X] T061 [P] **역 수 테스트** (FR-011) — `L` 이 10.7 전후, clamp 하한·상한 경계. 먼 입력이 거절되지 않고 역만 늘어난다
- [X] T062 [P] **`L == 0` 테스트** (FR-012) — 서로 다른 곡이 같은 좌표면 2곡 경로를 200 으로. `start == end` 분기와 구분된다

### 기존 테스트·설정 정리

- [X] T063 `JourneyServiceTests` 의 **엔진 부재·타임아웃 테스트 재작성** (rev.2 T033) — "엔진 port 빈 부재 → 500"·"엔진 타임아웃·연결 실패 → 500" 세 분기 중 **`reachable:false` → 422 만 그대로 남는다.** 나머지는 **층 후보 조회 어댑터 부재 → 500**·**재산출 상한 소진 → 500** 으로 바꾼다. **조립·오류 매핑·경계 입력 테스트는 건드리지 않는다** (응답 계약이 그대로이므로 그대로 통과해야 한다)
- [X] T064 관측 구간 재정의 (rev.2 T023) — `ody.journey.engine` Timer 하나가 원격 홉을 재던 것이므로 **층 조회 / DP / 조립 세 구간으로 나눈다**. 재산출 횟수도 남긴다. 지표 이름 변경은 대시보드에 영향이 있으니 기존 이름 유지 여부를 함께 판단한다
- [X] T065 `application.yml` 의 `ody.journey.engine.base-url`·`timeout` **제거** (rev.2 T001 되돌림) — 쓰이지 않는 설정을 남기면 다음 사람이 원격 엔진이 있다고 읽는다
- [X] T066 `contracts/music-journey.md` §② (원격 엔진 계약) 무효 표시 + **층 후보 조회 계약으로 대체**. 정본 §3.3 API 계약(§①)은 **바뀌지 않는다** — 이 전환의 성질이 그렇다

**Checkpoint**: T049~T053·T055~T063 까지면 **산출이 합성 좌표로 돌고 검증된다.**
실 데이터가 필요한 것은 T054(조회 어댑터)·T047(지연 실측)·SC-005(median 비교)뿐이다.

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
- **Phase 8**: rev.2 잔여 정리. T045·T046·T047 은 D-DATA 대기, T044·T048 은 폐기
- **Phase 9 (rev.3)**: Phase 2 계약 위에 얹힌다. **T049~T053·T055~T063 은 지금 착수 가능** — 산출이
  층 후보 조회 경계 뒤에 있어 실 DB 를 요구하지 않는다. T054 만 D-DATA 대기, T050 의 실 로딩만 D-RULES 대기.
  순서: T049~T052(계약·javadoc) → T053(축 좌표계) → T055(후보 선별) → T056(DP·규칙 루프) → T058~T062(검증) → T063~T066(정리)

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
Task: "검증·404 테스트 C3 in backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java"
Task: "422 vs 500 구분 테스트 in backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java"
Task: "조회 누락 테스트 B10 in backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java"
Task: "검증 순서 테스트 C4 in backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java"
Task: "실패 본문 형태 테스트 in backend/src/test/java/com/ssafy/backend/music/JourneyControllerTests.java"
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

- ~~**경로 산출을 Java로 재구현하는 작업은 이 목록에 없다.**~~ → **rev.3 반전**: Phase 9 가 정확히 그 작업이다(FR-017 개정). 단 **방식은 데이터 파트 정의를 따르고 새로 설계하지 않는다** — 실행 위치만 옮긴다
- **임계값을 코드에 하드코딩하지 않는다** (FR-024) — 산출 주체가 백엔드로 와도 그대로다. 오히려 이제 하드코딩할 유혹이 생기므로 T050 경계를 먼저 만든다
- 정본 §3.3 응답에 필드를 추가하지 않는다 (FR-023). `mode`·`linear` 를 요청 파라미터로 승격하지 않는다
- **조회 어댑터를 임시 구현·목 좌표로 채우지 않는다** (FR-019). **산출 알고리즘은 이 금지에 걸리지 않는다** — 조회 경계 뒤에 있어 합성 좌표로 검증하는 것이 목 데이터를 운영 코드에 남기는 것과 다르다
- **Phase 1~7 의 `[X]` 를 되돌리지 않는다** — 조립·오류 매핑·DTO·테스트는 응답 계약이 같아 그대로 유효하다
- **`JourneyPathFinder` 서명은 바뀐다** (T051). rev.3 문서 작업 중에는 "인터페이스를 그대로 살린다" 고 적었으나 구현 착수에서 좌표 전달이 불가능함이 드러났다. 경계 자체는 살아남고 **파라미터 타입만** 바뀐다
- 커밋은 작업 단위 또는 논리 묶음마다. 커밋 메시지에 rev.3 작업은 `[S15P21A405-224]`, rev.2 작업은 `[S15P21A405-61]`
- 검증 보고는 통과·실패·미실행을 구분한다 (헌법 III). **"산출 구현했다" 와 "실 데이터로 돌려봤다" 를 섞지 않는다**
