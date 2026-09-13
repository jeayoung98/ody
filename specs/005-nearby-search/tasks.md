---

description: "Task list template for feature implementation"
---

# Tasks: 기준점 주변 곡 탐색 (Nearby Search)

**Input**: Design documents from `/specs/005-nearby-search/`

**Prerequisites**: [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/music-nearby.md](./contracts/music-nearby.md) · [quickstart.md](./quickstart.md)

**Branch**: `backend/feat/S15P21A405-59-nearby-endpoint` · **Jira**: S15P21A405-59

**Tests**: 포함한다. 헌법 III(완료 전 검증)이 요구하고, quickstart 가 검증 항목 44건을 이미 정의했다. 002·003·004 선례도 모두 테스트를 포함한다.

**Organization**: 사용자 스토리별로 묶어 각 스토리를 독립적으로 구현·검증할 수 있게 한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일이고 선행 작업이 끝나 병렬 가능
- **[Story]**: US1~US4. Setup·Foundational·Polish 에는 붙이지 않는다

## Path Conventions

`backend/src/main/java/com/ssafy/backend/music/` 아래를 `music/` 로 줄여 적는다.
테스트는 `backend/src/test/java/com/ssafy/backend/music/`.

---

## Phase 1: Setup

**Purpose**: 계약을 먼저 문서에 반영하고, 기준선이 초록인지 확인한다

- [ ] T001 기준선 확인 — `cd backend && ./gradlew test` 가 지금 통과하는지 먼저 돌려 신규 실패와 기존 실패를 구분한다
- [ ] T002 `docs/api-spec.md` 에 **§3.5 주변 탐색** 추가 — contracts/music-nearby.md §1~§4 를 §3.1~§3.4 의 서술 형식에 맞춰 옮긴다. 경로는 `/api/music/nearby`(잠정, D-NAME 협의 중)
- [ ] T003 `docs/api-spec.md` **§3.2 갱신** — 곡 상세의 `neighbors` 가 선정 규칙을 통과한 최대 10곡이 되고 `lowSimilarity` 가 추가된다는 사실 반영. **배포된 계약 변경이라 문서를 안 고치면 프론트가 옛 계약을 본다**
- [ ] T004 `backend/feat/S15P21A405-224-journey-inprocess-pathfinder` 브랜치가 살아 있는지 확인한다 — T005 가 `music/journey/` 를 건드리므로 동시 작업이면 충돌한다. 살아 있으면 그 세션과 순서를 맞춘다

**Checkpoint**: 계약이 문서에 있고, 충돌 위험이 확인됐다

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리가 쓰는 공용 조각. FR-023 이 요구하는 **단일 선정 계층의 자리**를 만든다

**⚠️ CRITICAL**: 이 단계가 끝나기 전에는 어떤 스토리도 시작할 수 없다

- [ ] T005 `SameRecording` 을 `music/journey/` 에서 `music/retrieval/` 로 옮기고 가시성을 public 으로 올린다. **동작을 바꾸지 않는다** — `key()`·`sameKey()` 본문 그대로. 003·005 가 써야 하는데 지금은 package-private 이다 (research R3)
- [ ] T006 `music/journey/LayerCandidates.java` 의 `SameRecording` import 경로를 고친다. **004 소유 파일이라 import 한 줄 외에는 손대지 않는다**
- [ ] T007 `cd backend && ./gradlew test` — T005·T006 이 004 테스트를 깨지 않았는지 확인. 여기서 깨지면 되돌리고 T004 로 돌아간다
- [ ] T008 [P] `music/retrieval/NeighborSelection.java` 골격 생성 — `select(candidates, queryVec, queryTrack, rules, limit)` 시그니처와 javadoc 만. 판정 본문은 US1·US3 에서 채운다 (data-model.md §4-2)
- [ ] T009 [P] `music/dto/NearbyCenter.java` 생성 — `Long id` · `String title` · `String artist` · `Location location`. 좌표 기준일 때 앞 셋이 null 이 될 수 있음을 javadoc 에 적는다 (data-model.md §2-1)
- [ ] T010 [P] `music/dto/NearbyResponse.java` 생성 — `NearbyCenter center` · `List<NeighborTrack> neighbors` · `boolean lowSimilarity`. `NeighborTrack` 은 **기존 것을 그대로 쓴다**(003 과 같은 타입이어야 한다)
- [ ] T011 `ServingRules` 가 주입 가능한지 확인한다 — `@ConfigurationProperties("ody.serving")` 이 이미 등록돼 있고 `tauDup`·`artistCap`·`tauFar`·길이 범위를 들고 있다. **새로 만들지 않는다**(D-RULES 해소)

**Checkpoint**: 공용 계층의 자리와 응답 타입이 있다. 스토리 구현 시작 가능

---

## Phase 3: User Story 1 - 기준점 주변 곡 받기 (Priority: P1) 🎯 MVP

**Goal**: 곡 id 로 기준점을 주면 기준점 정보와 가까운 곡 최대 10곡을 거리와 함께 받는다

**Independent Test**: 조회 port mock 이 후보를 반환할 때 응답이 기준점과 이웃 목록을 함께 담고 이웃이 거리 오름차순인지 검증한다 (quickstart C1)

### Tests for User Story 1 ⚠️

- [ ] T012 [P] [US1] `NeighborSelectionTests` 생성 — quickstart **B1**(자기 제외) · **B12**(거리 동률 시 id 오름차순) · **B13**(입력 순서를 뒤섞어도 결과 동일) · **B14**(기준점이 좌표면 자기 제외 판정 미적용) — `music/NeighborSelectionTests.java`
- [ ] T013 [P] [US1] `NearbyServiceTests` 생성 — quickstart **C1**(곡 기준 정상) · **C7**(저장소 쓰기 호출 0건) · **C8**(후보 조회 limit 이 40 이고 선정 조건이 조회에 넘어가지 않음) — `music/NearbyServiceTests.java`
- [ ] T014 [P] [US1] `NearbyControllerTests` 생성 — quickstart **D1**(200·success:true·error:null·neighbors[].distance 존재). `@WebMvcTest(MusicController.class)` + 매퍼 `@MockitoBean`(003 선례) — `music/NearbyControllerTests.java`

### Implementation for User Story 1

- [ ] T015 [US1] `NeighborSelection.select` 에 **최소 판정** 구현 — 자기 자신 제외(FR-006) 후 거리 오름차순으로 limit 개까지, 마지막에 (distance, id) 안정 정렬(FR-008). 중복·아티스트·길이 규칙은 US3 에서 얹는다 — `music/retrieval/NeighborSelection.java`
- [ ] T016 [US1] `music/service/NearbyService.java` 생성 — `Optional<NearestTrackReader>`·`MusicDetailReader`·`ServingRules` 주입. 어댑터 부재 시 미구현을 드러낸다(기존 `MusicService` 패턴)
- [ ] T017 [US1] 기준점 해석 구현 — 곡 id 로 좌표를 읽는다. **좌표를 서브쿼리로 넘기지 않고 값으로 바인드**한다(research R10 함정). 없는 곡 처리는 US4 에서 — `music/service/NearbyService.java`
- [ ] T018 [US1] 후보 조회 연결 — `NearestTrackReader.findNearest(vec, 40)`. **선정 조건을 조회에 넣지 않는다** — pgvector 가 WHERE 를 인덱스 뒤에 적용해 LIMIT 보다 적게 준다 — `music/service/NearbyService.java`
- [ ] T019 [US1] 상세 채우기 — **확정된 10곡에만** 앨범·장르를 조인하고 `youtubeUrl` 을 생성한다. 후보 40 전체에 조인하지 않는다 (research R5) — `music/service/NearbyService.java`
- [ ] T020 [US1] 응답 조립 — center + neighbors 로 `NearbyResponse` 를 만든다. `lowSimilarity` 는 US3 에서 채우고 지금은 false 고정 — `music/service/NearbyService.java`
- [ ] T021 [US1] `GET /api/music/nearby` 핸들러 추가 — `@RequestParam @Min(1) long id` — `music/controller/MusicController.java`
- [ ] T022 [US1] T012~T014 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 곡 id 로 주변 곡 10곡을 받을 수 있다. **여기까지가 MVP**

---

## Phase 4: User Story 2 - 이웃 곡으로 연속 건너가기 (Priority: P1)

**Goal**: 받은 이웃 곡을 새 기준점으로 삼아 탐색을 이어갈 수 있다

**Independent Test**: 곡 A 로 받은 이웃 중 곡 B 를 기준점으로 다시 요청했을 때 기준점이 B 이고 세션 상태 없이 동작하는지 검증한다

### Tests for User Story 2 ⚠️

- [ ] T023 [P] [US2] 연속 탐색 테스트 추가 — 곡 A 응답의 이웃 B 를 기준점으로 재요청하면 center 가 B 이고, 서버가 이전 요청 이력에 의존하지 않는다(FR-010) — `music/NearbyServiceTests.java`
- [ ] T024 [P] [US2] 경로 무관 결정성 테스트 — B 에서 A 로 돌아왔을 때 처음 A 로 받은 것과 동일한 목록·순서(FR-008) — `music/NearbyServiceTests.java`

### Implementation for User Story 2

- [ ] T025 [US2] 무상태 확인 — `NearbyService` 에 요청 간 상태를 두는 필드가 없는지 점검하고 그 사실을 테스트로 고정한다. **새 코드가 없을 가능성이 높다** — US1 구현이 이미 무상태면 T023·T024 통과로 끝난다 — `music/service/NearbyService.java`

**Checkpoint**: 이웃을 눌러 계속 걸어다닐 수 있다

---

## Phase 5: User Story 3 - 쓸모 있는 10곡을 받는다 (Priority: P2)

**Goal**: 같은 녹음·아티스트 도배 없이 서로 다른 10곡을 받고, 주변이 희박하면 그 사실을 안내받는다

**Independent Test**: 후보에 같은 녹음 3건과 한 아티스트 곡 5건을 섞었을 때 같은 녹음이 1건만 남고 그 아티스트가 상한 이하로 줄어드는지 검증한다

### Tests for User Story 3 ⚠️

- [ ] T026 [P] [US3] 중복 녹음 테스트 — quickstart **B2**(거리 tauDup 미만) · **B3**(기준점과 같은 키) · **B4**(이미 담은 이웃과 같은 키) · **B9**(제목이 빈 곡 2건은 서로 같다고 보지 않는다) — `music/NeighborSelectionTests.java`
- [ ] T027 [P] [US3] 아티스트 상한 테스트 — quickstart **B5**(같은 아티스트 5건 → artistCap 까지) · **B6**(대소문자·공백만 다른 아티스트명도 같은 아티스트로 센다) · **B6-1**(아티스트가 빈 문자열인 후보 5건은 상한에 걸리지 않고 전부 통과) — `music/NeighborSelectionTests.java`
- [ ] T028 [P] [US3] 길이 규칙 테스트 — quickstart **B7**(29초·1201초 제외) · **B8**(duration 이 null 이면 통과) — `music/NeighborSelectionTests.java`
- [ ] T029 [P] [US3] 부족·빈 결과 테스트 — quickstart **B10**(3건만 통과하면 3곡) · **B11**(0건이면 빈 목록, 오류 아님) — `music/NeighborSelectionTests.java`
- [ ] T030 [P] [US3] `lowSimilarity` 테스트 — quickstart **C3**(마지막 이웃 거리가 tauFar 초과 → true, 결과는 그대로) · **C4**(이웃 0곡 → 빈 배열 + true) — `music/NearbyServiceTests.java`

### Implementation for User Story 3

- [ ] T031 [US3] `NeighborSelection` 에 **중복 녹음 판정** 추가 — dist < rules.tauDup / 기준점과 같은 키 / 이미 담은 이웃과 같은 키. 키는 `SameRecording.key()` 를 쓰고 **null 키는 서로 같지 않다** — `music/retrieval/NeighborSelection.java`
- [ ] T032 [US3] **아티스트 상한** 추가 — 정규화한 아티스트명으로 세어 rules.artistCap 이상이면 건너뛰고 다음 후보를 본다. **자리를 비우지 않는다.** **아티스트가 빈 문자열이면 카운트하지 않고 통과시킨다**(FR-019, 2026-09-13 clarify) — 빈 문자열을 한 덩어리로 세면 무관한 곡 14,862건이 자리 3개를 나눠 갖는다. 004 의 비용 패널티 방식을 쓰지 않는다(research R8) — `music/retrieval/NeighborSelection.java`
- [ ] T033 [US3] **길이 규칙** 추가 — `rules.lengthAllowed(duration)` 위임 — `music/retrieval/NeighborSelection.java`
- [ ] T034 [US3] `lowSimilarity` 판정 구현 — 마지막 이웃 거리가 rules.tauFar 초과면 true. **이웃이 0곡이면 true** — `music/service/NearbyService.java`
- [ ] T035 [US3] T026~T030 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 목록이 쓸 만해졌다

---

## Phase 6: User Story 4 - 실패를 정상 결과와 구분 (Priority: P2)

**Goal**: 기준점 없음 · 요청 오류 · 내부 실패 · 빈 결과를 호출자가 구분할 수 있다

**Independent Test**: 각 상황에서 서로 다른 코드가 나오고 실패 본문이 공통 구조를 따르는지 검증한다

### Tests for User Story 4 ⚠️

- [ ] T036 [P] [US4] 검증·404 테스트 — quickstart **D4**(id=0·id=abc) → 400 INVALID_INPUT, 없는 곡 → 404 MUSIC_NOT_FOUND(C5) — `music/NearbyControllerTests.java`
- [ ] T037 [P] [US4] 실패 본문 구조 테스트 — quickstart **D6**(모든 실패가 success:false·data:null·error 구조) — `music/NearbyControllerTests.java`
- [ ] T038 [P] [US4] 부분 결과 금지 테스트 — quickstart **C6**(조회 port 부재 → 예외 → 500, 일부만 채운 목록을 성공으로 내지 않는다) — `music/NearbyServiceTests.java`

### Implementation for User Story 4

- [ ] T039 [US4] 오류 매핑 구현 — 없는 곡 → `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)`, 검증 실패는 기존 `GlobalExceptionHandler` 매핑에 맡긴다. **`GlobalExceptionHandler` 를 고치지 않는다**(BE1 소유) — `music/service/NearbyService.java`
- [ ] T040 [US4] `/api/music/nearby` 가 인증 대상임을 주석으로 고정한다. **`SecurityConfig` 는 수정하지 않는다** — 현재 permitAll 은 S15P21A405-33 의 의도된 임시 상태다(research R6) — `music/controller/MusicController.java`
- [ ] T041 [US4] T036~T038 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 네 스토리 모두 독립 동작. **주변 탐색 API 완결**

---

## Phase 7: 곡 상세(003) 통일 — FR-023 · 003 FR-014 · SC-006

**Purpose**: 같은 곡에 대해 곡 상세와 주변 탐색이 **같은 10곡**을 주게 한다. 이 기능의 본체이고 **배포된 API 의 동작을 바꾼다**

**⚠️ 선행**: Phase 5 완료 (선정 규칙이 있어야 옮겨 붙일 수 있다)

- [ ] T042 [P] 두 진입점 일치 테스트 — quickstart **E1**(같은 조회 mock 위에서 곡 상세의 neighbors 와 주변 탐색의 neighbors 가 곡 집합·순서까지 동일) — `music/MusicDetailServiceTests.java`
- [ ] T043 [P] 003 `lowSimilarity` 테스트 — quickstart **E2**(곡 상세 응답에도 필드가 있고 값이 주변 탐색과 같다) — `music/MusicDetailControllerTests.java`
- [ ] T044 `MusicDetailResponse` 에 `lowSimilarity` 필드 추가 — `music/dto/MusicDetailResponse.java`
- [ ] T045 `MusicDetailReaderAdapter.findNeighbors` 를 **공용 계층으로 교체** — 좌표 읽기 → `NearestTrackReader.findNearest(vec, 40)` → `NeighborSelection.select(...)` → 확정 10곡에만 상세 조인. 자체 SQL 로 자르지 않는다 — `music/detail/MusicDetailReaderAdapter.java`
- [ ] T046 `MusicDetailMapper.findNearest` 제거 — T045 로 호출부가 사라진다. 매퍼 XML 의 대응 구문도 함께 정리 — `music/mapper/MusicDetailMapper.java` · `backend/src/main/resources/mapper/music/MusicDetailMapper.xml`
- [ ] T047 기존 003 테스트를 통일된 기대값으로 수정 — 최근접 10곡을 그대로 자른다고 전제한 단언이 있으면 선정 규칙 기준으로 고친다. **커버리지를 지우지 않는다** — `music/MusicDetailServiceTests.java` · `music/MusicDetailControllerTests.java`
- [ ] T048 T042~T043 통과 + 기존 003 테스트 전부 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 두 화면의 가까운 곡 목록이 같아졌다

---

## Phase 8: 좌표 기준 입력 (FR-002 B안) — ⏸ FE 답변 대기

**Purpose**: 지도의 빈 지점을 기준점으로 삼는 경로. **FE 가 필요 없다고 하면 이 Phase 를 통째로 삭제한다**

**⚠️ 착수 전 확인**: 노션 물음 「주변 탐색 기준점 — 곡 id 만 vs 좌표도」 답변. 근거가 Jira 설명 한 줄뿐이고 FEATURES MAP-10 의 진입 경로는 전부 곡 기준이다

- [ ] T049 [P] 좌표 기준 테스트 — quickstart **C2**(center.id·title·artist 가 null, location 은 받은 좌표 그대로) — `music/NearbyServiceTests.java`
- [ ] T050 [P] 배타 검증 테스트 — quickstart **D2**(둘 다 줌) · **D3**(둘 다 안 줌) · **D5**(pc1~pc15 만 줌) → 400 INVALID_INPUT — `music/NearbyControllerTests.java`
- [ ] T051 컨트롤러에 `pc1`~`pc16` 파라미터와 배타 검증 추가 — id 와 좌표 중 정확히 하나. **서버가 우선순위를 정해 하나를 고르지 않는다**(FR-011) — `music/controller/MusicController.java`
- [ ] T052 좌표 기준 분기 구현 — 받은 좌표를 **보정 없이** 질의 좌표로 쓰고, queryTrack 을 null 로 넘겨 자기 제외·기준점 키 판정을 건너뛴다 — `music/service/NearbyService.java`
- [ ] T053 T049~T050 통과 확인 — `cd backend && ./gradlew test`

**Checkpoint**: 지도 빈 공간에서도 탐색이 시작된다

---

## Phase 9: Polish & Cross-Cutting Concerns

- [ ] T054 [P] 관측 지표 추가 — 조회 구간과 선정·조립 구간을 나눈 Timer, 그리고 **규칙 통과 10곡 미달 카운터**(SC-008). 실측 기준값이 700곡 중 0건이므로 **0 이 아니면 후보 40 을 재검토한다**. 로그에 곡 제목·사용자 식별자를 남기지 않고 거리를 지표 태그로 쓰지 않는다 — `music/service/NearbyService.java`
- [ ] T055 [P] `BACKEND-NOTES.md` A-6 정리 — `/api/map/nearby/{musicId}` 는 좌표 기준을 표현할 수 없어 폐기 대상임을 표시하고 `/api/music/nearby` 로 대체됨을 적는다 — `docs/rules/BACKEND-NOTES.md`
- [ ] T056 최소 검증선 — `cd backend && ./gradlew test` 와 `./gradlew build` 둘 다 통과 (CLAUDE.md §5)
- [ ] T057 quickstart A~E 결과를 **통과·실패·미실행**으로 구분해 기록한다. **F(실 DB 통합)는 로컬 pgvector 미구성이면 미실행이라고 적는다** — 재보지 않은 지연을 통과로 쓰지 않는다(헌법 III) — `specs/005-nearby-search/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 Setup**: 의존 없음. T002·T003 은 구현 전에 끝나야 한다(헌법 II 계약 우선)
- **Phase 2 Foundational**: Setup 후. **모든 스토리를 차단한다.** T005~T007 은 004 코드를 건드리므로 T004 확인이 선행
- **Phase 3 US1 (P1)**: Foundational 후 — **MVP**
- **Phase 4 US2 (P1)**: US1 후. 조립 결과를 재사용한다
- **Phase 5 US3 (P2)**: US1 후. `NeighborSelection` 에 판정을 얹는다
- **Phase 6 US4 (P2)**: US1 후. US3 와 독립이라 병렬 가능
- **Phase 7 003 통일**: **US3 후** — 규칙이 있어야 옮겨 붙는다
- **Phase 8 좌표 기준**: US1 후. **FE 답변 대기 — 통째로 삭제 가능한 단위로 격리했다**
- **Phase 9 Polish**: Phase 7 후

### 스토리 독립성

US1 이 뼈대(기준점 해석 → 후보 → 선정 → 조립)를 만들고 US2·US3·US4 가 그 위에 얹힌다. 엔드포인트 1개에 서비스 1개라 스토리를 완전 병렬로 나눌 경계는 없다. 다만 **US3(선정 규칙)와 US4(오류)는 서로 독립**이라 동시에 진행할 수 있다.

### Parallel Opportunities

- **Phase 2**: T008·T009·T010 (서로 다른 새 파일)
- **Phase 3**: T012·T013·T014 (서로 다른 테스트 파일)
- **Phase 5**: T026~T029 는 같은 파일이라 순차, T030 은 다른 파일이라 병렬
- **Phase 5 ↔ Phase 6**: US3 와 US4 동시 진행 가능
- **Phase 7**: T042·T043
- **Phase 9**: T054·T055

---

## Implementation Strategy

### MVP (Phase 1~3, T001~T022)

곡 id 로 주변 곡 10곡을 받는 것까지. **선정 규칙 없이도 화면이 붙는다** — 프론트가 먼저 연동을 시작할 수 있다.

### 증분 전달

1. **MVP** — 곡 기준 주변 탐색 (US1)
2. **+연속 탐색** — 이웃을 눌러 걸어다니기 (US2). 대개 추가 코드 없이 검증만
3. **+쓸 만한 목록** — 중복·도배 제거, 유사도 낮음 (US3)
4. **+오류 구분** — 빈 결과와 장애를 구분 (US4)
5. **+003 통일** — 두 화면의 목록 일치 (Phase 7). **여기가 이 기능의 본체다**
6. **+좌표 기준** — FE 가 필요하다고 답하면 (Phase 8)

### 되돌릴 지점

- **Phase 7 이 실패하면** — `MusicDetailReaderAdapter` 변경만 되돌린다. 주변 탐색(Phase 3~6)은 그대로 살아 있다
- **Phase 8 이 불필요하면** — T049~T053 과 `NeighborSelection` 의 queryTrack null 분기를 함께 지운다

### 착수 전 확인할 것

| 항목 | 상태 | 막는가 |
| --- | --- | --- |
| D-NAME (nearby vs neighbors) | 협의 중 | 아니오 — 이름만 바뀌면 T002·T021 한 줄 |
| D-CENTER-B (좌표 기준) | FE 답변 대기 | 아니오 — Phase 8 로 격리 |
| D-FIELD (album·genres 적재) | BE4 답변 대기 | 아니오 — 코드는 안 바뀐다 |
| D-AUTH (무인증) | BE1 결정 | 아니오 — 건드리지 않기로 함 |

**넷 다 구현을 막지 않는다.**
