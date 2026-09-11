# Tasks: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/](contracts/) · [quickstart.md](quickstart.md)

**Tests**: 포함. spec의 A-시나리오(32건)와 quickstart가 검증을 명시적으로 요구하고, 헌법 III(완료 전 검증)이 적용된다.

**Jira**: S15P21A405-74 · **Branch**: `backend/feat/S15P21A405-74-websocket-infra` (master에서 직접 커밋 금지 — CLAUDE.md §2)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: US1(재생=위치) / US2(화면 사용자) / US3(근처 사람) / US4(만남)
- **[BLOCKED: Q#/B#]**: spec Clarifications 또는 research 보류 항목에 막힘. **착수 금지**, 표시만
- 경로 기준: `backend/src/main/java/com/ssafy/backend/realtime/` = `RT/`, `backend/src/test/java/com/ssafy/backend/realtime/` = `RT-TEST/`, `backend/src/main/resources/` = `RES/`

> ⚠️ **현 상태(2026-09-10)**: `BackendApplicationTests.contextLoads`가 07:05 실행에서 실패(`FollowSessionStopMapper` 빈 없음). `RealtimeMapperScanConfig`가 이후 추가됐으나 **재실행 미검증**. T001이 첫 게이트다.
> 기존 스캐폴딩 57파일 중 `reaction/`·`follow/`는 이번 범위 밖(격리), `presence/`·`nearby/`는 재작성 대상(R-01).

---

## Phase 1: Setup

**Purpose**: 기동 확인, 브랜치, 설정 단일화, 구버전 스캐폴딩 정리

- [ ] T001 `cd backend && ./gradlew test --tests com.ssafy.backend.BackendApplicationTests` 재실행 — `RealtimeMapperScanConfig` 효과 확인. 실패하면 원인을 quickstart §0에 기록하고 중단
- [ ] T002 `backend/dev`에서 `backend/feat/S15P21A405-74-websocket-infra` 브랜치 생성, 스캐폴딩 untracked 파일과 `RealtimeMapperScanConfig` 첫 커밋 (`fix: realtime 매퍼 스캔 경로 추가 [S15P21A405-74]`). `Claude outputs/`는 제외
- [ ] T003 [P] `RT/config/RealtimeProperties.java` 신설 — `@ConfigurationProperties("realtime")` 레코드: presence(heartbeat/ttl/sweep/recount ms), nearby(neighborK), viewport(gridSize, clusterThresholdCells, markerCap, debounceMs, cellCountsIntervalMs), layers[{layer, axisX, axisY}], axisRange[{axis, min, max}]. 기존 `@Value` 산재 제거의 단일 진입점
- [ ] T004 [P] `RES/application-realtime.yml` 교체 — plan §설정 값(15/45/5/60s · K=10 · 16/36/64 · 250/5000ms · 레이어 8 배정 · 축 16 min/max **임의값 + "실측 전 — B-4" 주석** · grid/threshold "세트 변경" 주석). `realtime-dev` 프로파일 추가: `standalone` 상속 + Redis만(`DataSourceAutoConfiguration`·Neo4j 제외 유지)
- [ ] T005 [P] `RT/common/RealtimeEventType.java` 정본 §4로 교체 — `VIEWPORT_SNAPSHOT/ENTER/MOVE/LEAVE/CELL_COUNTS`, `NEARBY_SNAPSHOT/ENTER/MOVE/LEAVE`, `PRESENCE_ERROR`. 구버전 `PRESENCE_JOIN/MOVE/LEAVE`·`REACTION`·`FOLLOW_*` 제거 → `reaction/`·`follow/`가 컴파일 깨지므로 **T006과 동시 처리**
- [ ] T006 `reaction/`·`follow/` 격리 — 두 패키지의 `@Component/@Service/@Controller/@Repository/@Configuration` 클래스를 `@Profile("realtime-legacy")`로 감싸거나(빈 등록 제외, 컴파일 유지) 패키지째 `realtime/legacy/`로 이동. `StompSubscribeInterceptor`의 follow 토픽 검사 제거 → `/user/queue/**`만 허용. `RedisScriptConfig`의 `rateLimitScript`·`encounterDedupScript` 빈 제거, `RES/redis/rate-limit.lua`·`encounter-dedup.lua`·`presence-move.lua` 삭제
- [ ] T007 [P] `RT/common/RealtimeErrorCode.java` 신설 — `implements ErrorCode`, `PRESENCE_ERROR(422)`. WS 세부 코드 상수(`PRESENCE_NO_ANCHOR`, `PRESENCE_LOCATION_NULL`, `PRESENCE_LAYER_INVALID`, `PRESENCE_VIEWPORT_INVALID`, `PRESENCE_STALE`, `PRESENCE_NOT_CONNECTED`)는 같은 파일의 `WsCode` enum
- [ ] T008 [P] `RT/common/RealtimeErrorSender.java` 수정 — `send(email, WsCode, message)` 시그니처, `RealtimeEventType.PRESENCE_ERROR` 사용

**Checkpoint**: `./gradlew compileJava test` 통과. 기존 Music 테스트 회귀 없음.

---

## Phase 2: Foundational (모든 스토리의 전제)

**Purpose**: 순수 계산 · Redis 리포지토리 · 세션/seq · 이벤트 버스 · Lua 3종

### 순수 계산 (`RT/geometry/`) — 프레임워크 비의존, 병렬 가능

- [ ] T010 [P] `RT/geometry/LayerAxes.java` — `RealtimeProperties.layers`에서 `axesOf(layer): (axisX, axisY)`, 없는 layer → `Optional.empty`
- [ ] T011 [P] `RT/geometry/Normalizer.java` — `normalize(pc, axis)`: `(pc-min)/(max-min)`; `cell(xNorm)`: `Math.min((int) Math.floor(xNorm * grid), grid-1)` 후 `Math.max(0, ·)`. `(int)` 직접 캐스팅 금지 주석. 클램프 발생 시 카운터 훅(`Consumer<Integer axis>`)
- [ ] T012 [P] `RT/geometry/Viewport.java` — 레코드(layer, minX, maxX, minY, maxY, bounds[]) + `contains(x, y)`(양끝 포함) + `satisfiesBounds(double[16])`(모든 축 통과) + 검증(`min < max`, bounds 비어있지 않음)
- [ ] T013 [P] `RT/geometry/CellGrid.java` — `cellsFor(viewport, layerAxes, normalizer): Set<Cell>`, `fold(Map<Cell,Integer> counts, resolution): Map<Cell,Integer>`(x>>1, y>>1 합산), `foldUntil(counts, markerCap): (resolution, counts)`
- [ ] T014 [P] `RT/common/DeltaClassifier.java` — `classify(Set<String> old, Set<String> new): (leave, enter, move)`; old==new 키면 전원 move
- [ ] T015 [P] `RT-TEST/geometry/NormalizerTests.java`, `CellGridTests.java`, `ViewportTests.java`, `RT-TEST/common/DeltaClassifierTests.java` — quickstart §2 케이스 전부 (클램프 전 값 단언 포함)

### Redis 계층

- [ ] T016 `RES/redis/presence-play.lua` — research R-04 표 그대로. KEYS: listeners:{old}, listeners:{new}, active-song:cell:{L}:{ox}:{oy}, active-song:cell:{L}:{nx}:{ny}, cell:usercount:{L}, presence:user:{email}. ARGV: email, oldMusicId(or ""), newMusicId, layer, x, y, cellX, cellY, epoch. 검증 실패 → `{-1}`. 반환: 진입 직전 new 청취자 배열
- [ ] T017 [P] `RES/redis/presence-leave.lua` — presence 안에서 musicId·layer·셀 읽기 → epoch 비교 → listeners SREM / SCARD==0이면 cell SREM / usercount HINCRBY -1(≤0이면 HDEL) → presence DEL. 반환: `{musicId, layer, cellX, cellY}` 또는 `{}`(no-op)
- [ ] T018 [P] `RES/redis/usercount-recount.lua` — KEYS: cell:usercount:{L} + ARGV: 셀 키 목록(SCAN은 Java) → 곡별 SCARD 합 → 비교 → 불일치 필드 덮어쓰기 → 반환 불일치 수
- [ ] T019 `RT/config/RedisScriptConfig.java` 교체 — 3종 빈(`DefaultRedisScript<List>` 2, `<Long>` 1). 구버전 3빈 제거(T006 연동)
- [ ] T020 `RT/presence/repository/PresenceRedisRepository.java` 재작성 — 키 조립 전담: `presence:user:*`, `presence:expiry` ZSET(`touch(email, ttl)`, `expired(now)`), `listeners:*`(`members(musicIds)` pipeline), `active-song:cell:*`, `cell:usercount:*`(`counts(layer)` HGETALL). `applyPlay(...)`·`applyLeave(...)`·`recount(layer)` = Lua 호출. 구버전 `upsert/move/remove/findUserIdsByLayer` 삭제
- [ ] T021 [P] `RT/viewport/repository/ViewportRedisRepository.java` — `viewport:cell:*` SADD/SREM/SMEMBERS, `viewport:meta:{email}` HSET/HGETALL/DEL (bounds·cellKeys는 JSON 문자열)
- [ ] T022 [P] `RT/nearby/repository/NearbyRedisRepository.java` — `nearby:subscribers:*`, `nearby:meta:{email}`. 구버전 `EncounterRedisRepository` 삭제
- [ ] T023 `RT-TEST/presence/PresenceLuaIntegrationTests.java` — `@EnabledIf` 로컬 Redis(`realtime.test.redis=true` 시스템 프로퍼티) 조건부. quickstart §3의 play/leave/epoch/recount 케이스. 테스트 전후 `FLUSHDB`(테스트 전용 DB index 사용)

### 세션 · 발행 · 이벤트

- [ ] T024 `RT/session/WebSocketSessionRegistry.java` 확장 — `sessionEpoch` per email(`AtomicLong`), 세션별 `seq` `AtomicLong`, `nextSeq(email)`, `epochOf(email)`. 멀티탭 정책은 **[BLOCKED: 정책 미결]** — 현재 동작(다른 세션 있으면 presence 유지) 유지 + TODO
- [ ] T025 `RT/common/SimpleBrokerPublisher.java` 수정 — `publishToUser` 진입점에서 `registry.nextSeq(email)`로 봉투 `seq` 채움(R-07). `RealtimeEnvelope.of(type, payload)`의 seq 0 오버로드 제거
- [ ] T026 [P] `RT/common/RealtimeEventBus.java` + `InProcessEventBus.java` — `publish(PositionChanged)`, `subscribe(Consumer)`. `PositionChanged(email, epoch, layer, oldMusicId?, newMusicId?, oldCell?, newCell?, x?, y?)` 레코드. 다중화 교체점 주석
- [ ] T027 [P] `RT/common/UserDisplayResolver.java` — email → `(nickname, imageUrl)` 캐시(TTL 5분, 상한). 조회는 기존 `AuthMapper.findByEmail`(BE1 소유 — 읽기 호출만). 배치 `resolveAll(emails)`
- [ ] T028 [P] `RT/common/MusicLocationPort.java` — **BE3 측 어댑터 인터페이스**: `findLocation(id)`, `findLocations(ids)`. 구현 `MusicLocationStubAdapter`(`@Profile("realtime-dev")`, 고정 좌표 fixture) + `MusicLocationReaderAdapter`(BE2 `MusicLocationReader` 위임 — **[BLOCKED: B-3]** 인터페이스 합의 후). 프로세스 내 캐시(상한 100k) 포함
- [ ] T029 [P] `RT/common/RealtimeMetrics.java` — data-model §4 지표 9종 등록(`MeterRegistry`). email·토큰 태그 금지 주석

**Checkpoint**: T015·T023 통과(T023은 로컬 Redis 있을 때). 컨텍스트 로딩 통과. 이 시점에 사용자 스토리 병렬 착수 가능.

---

## Phase 3: User Story 1 — 재생한 곡이 곧 내 위치가 된다 (P1) 🎯 MVP

**Goal**: CONNECT → join → `/music/play` → 타인이 볼 수 있는 상태 → leave/expiry 정리. FR-001~025.

**Independent Test**: 단일 세션으로 A1~A13. 서버 측 Redis 상태와 REST 응답으로 완결.

### Tests

- [ ] T030 [P] [US1] `RT-TEST/presence/PlayDeclarationServiceTests.java` — no-op 분기(A5), location NULL(A6), source 검증(A7), old 불일치(A12) — Redis·매퍼 mock
- [ ] T031 [P] [US1] `RT-TEST/play/MusicPlayControllerTests.java` — MVC 슬라이스(`MusicControllerTests` 패턴: Security 제외, 서비스 mock): 200 응답 형태(A3), 400/404/422/403 매핑(A6·A7·A9)
- [ ] T032 [P] [US1] `RT-TEST/e2e/PresenceLifecycleE2ETests.java` — `WebSocketStompClient` 1세션 + 로컬 Redis 조건부: A1·A2·A10·A11·A13·A14(join 배치 — play_history 불변·meeting 불변 단언)

### Implementation

- [ ] T033 [P] [US1] `RT/play/dto/PlayRequest.java`(`@NotNull musicId`, `@Pattern MAP|JOURNEY|PLAYLIST|FOLLOW source`), `PlayResponse.java`, `PlayEndRequest.java`(`@NotNull playHistoryId`, `@Min(0) playedMs`)
- [ ] T034 [P] [US1] `RT/play/repository/PlayHistoryMapper.java` + `RES/mapper/realtime/PlayHistoryMapper.xml` — `insert(email, musicId, source)` → generated id, `updatePlayedMs(id, email, ms)` → affected rows, `findLatestMusicId(email)`. **[BLOCKED: B-2]** 실컬럼 확인 전 XML은 ERD 추정 컬럼으로 작성 + TODO
- [ ] T035 [US1] `RT/presence/service/PresenceLifecycleService.java` — `connect(email)`(epoch++, presence 생성, expiry ZADD), `heartbeat(email)`(ZADD XX), `join(email, layer, musicId)`(Q1 확정 — 배치·복원: `findLatestMusicId`와 대조 → 곡·location 검증 → `applyPlay(old=null)`, **INSERT·만남 없음**; 대조 방어는 FE2 확인 후 상수 토글), `leave(email, epoch)`(applyLeave → 메타 2종으로 구독 4종 해제 → `PositionChanged(old만)` 발행)
- [ ] T036 [US1] `RT/presence/service/PlayDeclarationService.java` — plan F2 순서 a~h. no-op 분기, `PRESENCE_STALE`, `MeetingRecorder` 호출은 US4 전까지 no-op 인터페이스(`MeetingRecorder`는 T060)
- [ ] T037 [US1] `RT/play/controller/MusicPlayController.java` — `POST /music/play`, `PATCH /music/play/end`(affected==0 → `FORBIDDEN`). `ApiResponse` 봉투. 경로 확정(Q2 해소) — `/play/end` 네이밍만 BE1 확인 후 상수 1곳 수정 여지
- [ ] T038 [US1] `RT/presence/controller/PresenceStompController.java` 재작성 — `join`·`heartbeat`·`leave`·`resync`(viewport/nearby 재발급은 US2/US3 후 연결). 검증 실패 → `RealtimeErrorSender`. 구버전 `MoveRequest`·`HeartbeatRequest(x,y)` 삭제
- [ ] T039 [US1] `RT/session/WebSocketSessionEventListener.java` 수정 — `onConnected` → `PresenceLifecycleService.connect`, `onDisconnect` → `leave(email, epoch)` (다른 세션 있으면 스킵 유지). `FollowTerminationService` 의존 제거(T006)
- [ ] T040 [US1] `RT/presence/scheduler/PresenceSweepScheduler.java` 재작성 — 5s `expired(now)` → 각 `leave`; 60s 레이어 순환 `recount(layer)` → 불일치 WARN + 지표. `ReactionRetentionScheduler` 격리 확인(T006)
- [ ] T041 [US1] `RT/presence/controller/PresenceQueryController.java` 삭제 또는 `GET /api/realtime/me` 로 축소(디버깅용, `ApiResponse` 봉투) — 구버전 `/layers/{id}/presence`는 계약에 없음
- [ ] T042 [US1] `docs/rules/BACKEND-NOTES.md`에 요청 항목 추가(공통 문서 — 관련 파트 수정 가능): `SecurityConfig` `/music/play*`·`/api/realtime/**` authenticated **[BE1]**, `play_history (email, played_at DESC)` 인덱스 **[BE1]**, Redis `noeviction` **[Infra]**, 정본 §0.5 `PRESENCE_ERROR` 추가 **[BE1]**

**Checkpoint**: A1~A13 중 Q1 의존(A13 join 복원) 제외 통과. `/music/play` 후 Redis에 listeners·cell·usercount·presence 정합. leave 후 잔여 키 0.

---

## Phase 4: User Story 2 — 내 화면 안에 있는 사람이 보인다 (P1)

**Goal**: viewport → INDIVIDUAL/CLUSTERED 스냅샷, 셀 구독, 델타, 레이어 이동. FR-050~064.

**Independent Test**: A(재생) + B(viewport) 2세션으로 A20~A30. 외부 의존 없음.

### Tests

- [ ] T050 [P] [US2] `RT-TEST/viewport/ViewportServiceTests.java` — 모드 판정(A20·A23), 사각형 밖 곡 제외(A21), bounds 필터(A22), 접기(A24), cellKeys 저장·해제(A27) — Redis mock
- [ ] T051 [P] [US2] `RT-TEST/viewport/ViewportDeltaServiceTests.java` — V_old/V_new 분류(A25), 수신자 사각형·bounds 검사(A26), 같은 셀 MOVE
- [ ] T052 [P] [US2] `RT-TEST/e2e/ViewportE2ETests.java` — 2세션 A20~A30 (quickstart §4)

### Implementation

- [ ] T053 [P] [US2] `RT/presence/dto/ViewportRequest.java`(→ `Viewport` 변환 + 검증), `RT/viewport/dto/ViewportSnapshot.java`(mode, groups | resolution+cells), `ViewportDelta.java`, `UserView.java(nickname, imageUrl)`, `CellCount.java`
- [ ] T054 [US2] `RT/viewport/service/ViewportService.java` — plan F3 1~6. 레이어 변경 감지(`viewport:meta.layer` ≠ 요청 layer) → 내 presence 셀 재계산(`applyPlay` old==new 레이어만 변경 → **T016 Lua가 레이어 변경 케이스를 지원하도록 ARGV oldLayer 추가**), 이전 구독 해제(저장 cellKeys) → 모드 판정 → 등록/미등록 → 스냅샷 조립(`filterVisible` 항등 — Q3 확정: MVP 전원 공개, 분기 지점만 확보)
- [ ] T055 [US2] `RT/viewport/service/ViewportDeltaService.java` — `RealtimeEventBus` 구독. plan F5 뷰포트 갈래. 수신자별 `viewport:meta` 사각형·bounds 검사(FR-058). `UserDisplayResolver`로 nickname/imageUrl
- [ ] T056 [US2] `RT/viewport/scheduler/CellCountsScheduler.java` — 5s: CLUSTERED 모드 사용자(`viewport:meta.mode=CLUSTERED`) 각각에 `VIEWPORT_CELL_COUNTS`(해당 레이어 HGETALL → 뷰포트 자름 → 접기). 사용자 목록은 `viewport:meta:*` SCAN 또는 별도 Set `viewport:clustered`(추가)
- [ ] T057 [US2] `PresenceStompController.viewport` 매핑 + `resync`에 viewport 스냅샷 재발급 연결
- [ ] T058 [US2] `PresenceLifecycleService.leave`에 `viewport:meta.cellKeys`로 `viewport:cell:*` 해제 연결(T035 확장)

**Checkpoint**: A20~A30 통과. CLUSTERED 전환 후 델타 0건. 레이어 이동 후 구레이어 셀에 잔여 0.

---

## Phase 5: User Story 3 — 나와 비슷한 음악을 듣는 사람이 보인다 (P1)

**Goal**: nearby/open → 이웃곡 K + 청취자 그룹 스냅샷, 곡 구독, 델타, close. FR-070~078.

**Independent Test**: `findNeighbors` 스텁(X→[Y,Z])으로 A·C 2세션 A40~A45.

### Tests

- [ ] T060 [P] [US3] `RT-TEST/nearby/NearbyServiceTests.java` — 앵커 없음(A41), 앵커 그룹 포함·자기 제외·0명 생략(A40), 구독 목록 저장·저장 목록으로 해제(A44)
- [ ] T061 [P] [US3] `RT-TEST/nearby/NearbyDeltaServiceTests.java` — S_old/S_new 분류(A42), 본인 앵커 변경 → 재발급(A43)
- [ ] T062 [P] [US3] `RT-TEST/e2e/NearbyE2ETests.java` — 2세션 A40~A45, `realtime-dev` 스텁 프로파일

### Implementation

- [ ] T063 [P] [US3] `RT/nearby/dto/NearbySnapshot.java`(anchorMusicId, groups[{musicId, title, artist, x, y, distance, users}]), `NearbyDelta.java`
- [ ] T064 [P] [US3] `RT/nearby/port/NeighborPort.java` — `neighbors(musicId, k): List<(musicId, distance)>` + 캐시(불변, FR-078). 구현 `MusicDetailReaderNeighborAdapter`(BE2 `MusicDetailReader.findNeighbors` 위임 — **[BLOCKED: B-3]** 어댑터 부재) + `NeighborStubAdapter`(`realtime-dev`)
- [ ] T065 [US3] `RT/nearby/service/NearbyService.java` 재작성 — plan F4. `open(email)`: 앵커 검증 → `NeighborPort` → 청취자 pipeline → 자기 제외·0명 제외 → 메타(좌표·title/artist via `MusicLocationPort`) → 스냅샷 → 구독 등록 + 메타 저장. `close(email)`: 저장 목록으로 해제. 구버전 `EncounterService`·`NearbyUserService`·`NearbyUserController` 삭제
- [ ] T066 [US3] `RT/nearby/service/NearbyDeltaService.java` — `RealtimeEventBus` 구독. S_old/S_new 분류 → 개인 큐. 변경 주체가 `nearby:meta`를 갖고 있으면(패널 열림) `open` 재실행(FR-076)
- [ ] T067 [US3] `RT/nearby/controller/NearbyStompController.java` — `/nearby/open`·`/nearby/close`. `resync`에 nearby 스냅샷 재발급 연결
- [ ] T068 [US3] `PresenceLifecycleService.leave`에 `nearby:meta.musicIds`로 `nearby:subscribers:*` 해제 연결(T035 확장)

**Checkpoint**: A40~A45 통과(스텁). B-3 해소 후 스텁 제거 → 실데이터 재검증.

---

## Phase 6: User Story 4 — 같은 곡을 함께 들은 횟수가 쌓인다 (P2)

**Goal**: 진입 순간 기존 청취자 전원과 `meeting` UPSERT, 비동기 배치. FR-080~085.

**Independent Test**: A·B 2세션 + DB로 A50~A54.

### Tests

- [ ] T070 [P] [US4] `RT-TEST/meeting/MeetingPairTests.java` — 사전순·자기 제외(A50·FR-081)
- [ ] T071 [P] [US4] `RT-TEST/meeting/MeetingRecorderTests.java` — 배치 1문 호출, 빈 목록 no-op, no-op 재선언 시 미호출(A51), 1,000명 fixture 배치 크기 지표(A54)
- [ ] T072 [P] [US4] `RT-TEST/e2e/MeetingE2ETests.java` — A50·A52·A53 DB 단언(H2 `MODE=PostgreSQL` — `ON CONFLICT` 호환 확인, 안 되면 Postgres 조건부)

### Implementation

- [ ] T073 [P] [US4] `RT/meeting/MeetingPair.java` — `of(a, b): Optional<(user1, user2)>` 사전순, 동일이면 empty
- [ ] T074 [P] [US4] `RT/meeting/repository/MeetingMapper.java` + `RES/mapper/realtime/MeetingMapper.xml` — `upsertAll(List<MeetingPair>)`: `INSERT ... VALUES (...) ON CONFLICT (user1, user2) DO UPDATE SET cnt = meeting.cnt + 1`. **[BLOCKED: B-2]** UNIQUE 확인 전 TODO
- [ ] T075 [US4] `RT/meeting/service/MeetingRecorder.java` — **별도 빈** `@Async recordAsync(email, listenersBefore)`: 쌍 생성 → `upsertAll` 1문 → `realtime.meeting.batch.size` 지표. `PlayDeclarationService`(T036)의 no-op 인터페이스를 이 빈으로 교체
- [ ] T076 [US4] `RT/config/RealtimeAsyncConfig.java`에 실시간 전용 `Executor` 빈(큐 상한·거부 정책 로그) — 만남 폭발 시 브로드캐스트 스레드 보호

**Checkpoint**: A50~A54 통과. `/music/play` 지연이 만남 건수와 무관함을 지표로 확인.

---

## Phase 7: Polish & Cross-Cutting

- [ ] T080 [P] `contracts/websocket/destinations.md`·`events.md`·`recovery.md`를 `specs/004-realtime-presence-nearby/contracts/realtime-websocket.md` 내용으로 교체 — FE1·FE2 리뷰 체크박스는 **미완 유지**. 반응·따라가기 항목은 "이후 단계" 절로 이동
- [ ] T081 [P] `docs/rules/FEATURES.md` 하단 "변경 제안" 절에 RT-01~90 ID 신설 제안 + 기존 ID 대응표(spec §대응표) 추가 — **본문 표는 수정하지 않음**(기획 확인 후)
- [ ] T082 [P] `docs/rules/BACKEND-NOTES.md`에 정본 충돌 4건 기록 — A-7↔`/music/play`+`/play/end`(Q2), A-3/A-4 REST↔WS(FE 알림), RT-90↔요구사항 §6(Q3), `PRESENCE_ERROR` 에러표
- [ ] T083 `infra/local/docker-compose.yml` redis command에 `--maxmemory-policy noeviction` — **Infra 소유, 요청 문단으로만**(직접 수정 금지)
- [ ] T084 [P] `RT-TEST/e2e/EmailLeakScanTests.java` — E2E 수신 프레임 전체 JSON을 `@` 정규식 스캔(SC-008)
- [ ] T085 `RealtimeMetrics` 9종이 `/actuator/prometheus`에 노출되는지 확인 + `realtime.normalize.clamped` 비율 기록(B-4 신호)
- [ ] T086 quickstart.md §0~§5 실행 → 결과를 통과·실패·미실행으로 표에 기록. 미실행 사유(Q/B) 명시
- [ ] T087 스캐폴딩 기록 갱신 — Claude Project `claude/Realtime_스캐폴딩_적용기록.md`에 "09-10 정본 반영으로 presence/nearby 재작성, reaction/follow 격리" 추가

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 → T002 → {T003, T004, T005+T006, T007, T008}. T005·T006은 함께(컴파일 연쇄)
- **Foundational (Phase 2)**: Setup 후. `geometry/`(T010~T015)와 Redis 계층(T016~T023), 세션·이벤트(T024~T029)는 서로 독립 — 병렬
- **US1 (Phase 3)**: Phase 2 전부. US2·US3·US4의 전제(위치가 있어야 볼 것이 있다)
- **US2 (Phase 4)**: US1 T035·T036 + Phase 2. US3와 독립
- **US3 (Phase 5)**: US1 T035·T036 + T028·T064 스텁. US2와 독립
- **US4 (Phase 6)**: US1 T036(Lua 반환값). US2·US3와 독립
- **Polish (Phase 7)**: 원하는 스토리 완료 후

### BLOCKED 태스크 요약

| 태스크 | 막힘 | 착수 가능 대안 |
| --- | --- | --- |
| T024 멀티탭 | 정책 미결 | 현재 동작 유지 + TODO |
| T028 어댑터, T064 어댑터 | B-3 | 스텁으로 개발, 어댑터는 인터페이스 합의 후 |
| T034, T074 XML | B-2 | ERD 추정 컬럼 + TODO, 실컬럼 확인 후 수정 |

### Parallel Opportunities

- Phase 2: `geometry/` 5파일 + 테스트(T010~T015) ‖ Lua 3종(T016~T018) ‖ 리포지토리 3종(T020~T022) ‖ 세션·버스·리졸버·포트·지표(T024~T029)
- Phase 3~6: 각 스토리의 Tests(T030~T032, T050~T052, T060~T062, T070~T072)는 구현과 병렬 작성 가능(실패 상태로 시작)
- US2 ‖ US3 ‖ US4: US1 완료 후 세 스토리 동시 진행 가능(단일 개발자면 US2 → US3 → US4 순)

---

## Implementation Strategy

### MVP First (US1)

1. Phase 1 → T001 게이트 통과가 절대 선행
2. Phase 2 — `geometry/` 단위 테스트가 첫 녹색
3. Phase 3 — `/music/play` → Redis 정합 → leave 잔여 0. **여기까지가 "실시간이 살아 있다"의 증명**
4. STOP: quickstart §3 Redis 통합 + §4 A1~A12 실행

### Incremental Delivery

- US1 + US2 = 시연 가능한 최소 단위("지도에 사람이 보인다"). B-3(BE2 이웃곡) 없이 완결
- US3 = 스텁으로 먼저, B-3 해소 시 어댑터 교체만
- US4 = DB 스키마(B-2) 확인 즉시

### 스토리별 태스크 수

| 스토리 | 태스크 | 테스트 | 합계 |
| --- | --- | --- | --- |
| Setup | 8 | — | 8 |
| Foundational | 18 | 2 | 20 (T015·T023) |
| US1 | 10 | 3 | 13 |
| US2 | 6 | 3 | 9 |
| US3 | 6 | 3 | 9 |
| US4 | 4 | 3 | 7 |
| Polish | 7 | 1 | 8 (T084 포함) |
| **합계** | | | **74** |

## Notes

- 모든 커밋 메시지에 `[S15P21A405-74]`. `master`·`backend/dev` 직접 push 금지
- 남의 파트 파일(`SecurityConfig`, `build.gradle`, `docker-compose.yml`, `MusicDetailReader` 어댑터)은 **요청 문단**으로만 — T042·T082·T083
- 명세와 다르게 구현하게 되는 순간(Assumptions가 틀렸을 때) 조용히 고치지 않고 spec Clarifications를 먼저 갱신
- 저장소 문서와 Notion이 충돌하면 **Notion 우선**(2026-09-10 확정) — 단 충돌을 발견하면 저장소 문서를 조용히 두지 않고 T082에 기록
