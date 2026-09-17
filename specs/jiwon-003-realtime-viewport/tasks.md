# Tasks: 실시간 뷰포트 사용자

**Input**: [spec.md](spec.md), [plan.md](plan.md), [data-model.md](data-model.md), [contract](contracts/realtime-viewport-websocket.md)  
**Rule**: 각 Jira checkpoint에서 반드시 멈춘다. 사용자 확인과 커밋 요청 없이 다음 Jira를 구현하지 않는다.

## Phase 0 — 구현 전 검토

- [x] T001 [SPEC] D1 `requestSeq` 도입을 사용자가 확정했다.
- [x] T002 [SPEC] D2 기본 셀 36개 초과 또는 사용자 20명 초과 시 CLUSTERED 전환을 사용자가 확정했다.
- [x] T003 [SPEC] D3 layer 2+ 셀 인원수 정확 집계를 사용자가 확정했다.
- [x] T004 [SPEC] D4 응답 식별자 email 노출을 사용자가 확정했다.
- [ ] T005 [SPEC] `contracts/frontend-layer-navigation.md`의 기존 boxes·prefetch·query cache와 viewport 연결 계약을 프론트 담당자와 확인한다.
- [ ] T006 [SPEC] `backend/src/main/java/com/ssafy/backend/realtime/presence/dto/ViewportRequest.java`의 layer 1 빈 ancestorBounds와 layer N의 N-1개 규칙을 확정한다.

**Checkpoint 0**: T001~T006을 사용자에게 검토받기 전 코드 작성 금지.

---

## S15P21A405-76 — 뷰포트 최초 스냅샷·개별 사용자 구독

### Phase 1 — 서베이 (코드 변경 없음)

- [ ] T010 [76] 현재 `PresenceRedisRepository`의 활성 곡·곡별 청취자 batch/pipeline 재사용 지점을 확인한다.
- [ ] T011 [76] `MusicDetailReader.findLocationsByIds`와 realtime `MusicLocationPort` 어댑터 연결 방식을 확인한다.
- [ ] T012 [76] `RealtimeEventType`, `RealtimeEnvelope`, `SimpleBrokerPublisher`의 snapshot 발송 형식을 확인한다.
- [ ] T013 [76] 기존 Redis Lua 로더와 통합 테스트의 실제 Redis 연결 방식을 확인한다.
- [ ] T014 [76] `origin/frontend/dev`의 `map-engine.ts`, `use-map-songs-query.ts`, BFF route를 기준으로 boxes·prefetch·cache·늦은 응답과 화면 안정화 시점을 확인한다. 현재 백엔드 브랜치의 오래된 프론트 스냅샷을 기준으로 판단하지 않는다.

### Phase 2 — 계약·기하

- [ ] T020 [P] [76] `backend/src/main/java/com/ssafy/backend/realtime/presence/dto/ViewportRequest.java`에 `requestSeq`, raw current rectangle, `LayerBound` 기반 ancestorBounds와 검증 제약을 추가한다.
- [ ] T021 [P] [76] `backend/src/main/java/com/ssafy/backend/realtime/geometry/Viewport.java`의 validate·contains·satisfiesBounds를 구현한다.
- [ ] T022 [P] [76] `backend/src/main/java/com/ssafy/backend/realtime/geometry/CellGrid.java`의 cellsFor를 구현한다.
- [ ] T023 [P] [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/geometry/ViewportTests.java`에 raw 범위 정규화, layer 1 빈 bounds, layer N의 N-1개, 경계 포함 테스트를 작성한다.
- [ ] T024 [P] [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/geometry/CellGridTests.java`에 셀 경계·clamp 테스트를 작성한다.

### Phase 3 — 구독 저장소

- [ ] T030 [76] `backend/src/main/resources/redis/viewport-subscription-replace.lua`를 추가해 epoch/requestSeq 검사와 셀 구독 교체를 원자 처리한다.
- [ ] T031 [76] `backend/src/main/java/com/ssafy/backend/realtime/viewport/repository/ViewportRedisRepository.java`를 추가해 replace·meta·candidate read를 제공한다.
- [ ] T032 [P] [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/repository/ViewportRedisRepositoryTests.java`에서 Lua key/arg 전달과 stale 결과를 검증한다.
- [ ] T033 [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/integration/ViewportSubscriptionRedisIntegrationTests.java`에서 실제 SREM·SADD·meta 교체·epoch/requestSeq를 검증한다.

### Phase 4 — 개별 스냅샷

- [ ] T040 [P] [76] `backend/src/main/java/com/ssafy/backend/realtime/viewport/dto/ViewportSnapshot.java`와 사용자·곡 그룹 DTO를 추가한다. INDIVIDUAL은 최대 20명이며 overflow 절단 응답을 두지 않는다.
- [ ] T041 [76] `backend/src/main/java/com/ssafy/backend/realtime/port/MusicLocationPort.java`에 batch 조회를 추가하고 기존 어댑터에서 `MusicDetailReader.findLocationsByIds`로 위임한다.
- [ ] T042 [76] `backend/src/main/java/com/ssafy/backend/realtime/viewport/service/ViewportService.java`의 INDIVIDUAL 경로를 구현한다: 36셀 이하는 구독 먼저, 후보 곡, 좌표 batch, current rectangle+ancestorBounds 정확 필터, 청취자 pipeline, 자기 제외를 수행하고 36셀·20명 초과는 일부 목록 없이 CLUSTERED 필요 상태를 반환한다.
- [ ] T043 [76] `backend/src/main/java/com/ssafy/backend/realtime/event/RealtimeEventType.java`에 `VIEWPORT_SNAPSHOT`을 추가한다.
- [ ] T044 [76] `backend/src/main/java/com/ssafy/backend/realtime/presence/controller/PresenceStompController.java`의 viewport를 ViewportService에 연결하고 검증 오류를 개인 오류 큐로 보낸다.
- [ ] T045 [P] [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/service/ViewportServiceTests.java`에 V1~V6·V8~V10, 20명 초과 시 일부 INDIVIDUAL을 발행하지 않는 결정, DB/Redis 호출 횟수를 검증한다.
- [ ] T046 [76] `backend/src/test/java/com/ssafy/backend/realtime/viewport/ViewportRealtimeContextTests.java`에서 `test,realtime` 빈 구성을 검증한다.

**Checkpoint 76**: compileJava, T023·T024·T032·T033·T045·T046, 전체 관련 테스트 결과와 변경 파일·메서드를 사용자에게 보고한다. 사용자 확인과 커밋 후에만 141로 이동한다.

---

## S15P21A405-141 — 셀 뭉침·주기 인원수 갱신

### Phase 5 — 서베이 (코드 변경 없음)

- [ ] T049 [141] `PresenceRedisRepository.java`, `CellGrid.java`, 프론트 셀 마커 타입을 읽어 `cell:usercount` 재사용 범위·기본 셀 수·응답 좌표 형식을 확인한다.

### Phase 6 — 뭉침 계산

- [ ] T050 [P] [141] `backend/src/main/java/com/ssafy/backend/realtime/geometry/CellGrid.java`의 foldUntil을 구현한다.
- [ ] T051 [P] [141] `backend/src/test/java/com/ssafy/backend/realtime/viewport/geometry/CellGridTests.java`에 16→8→4 합계 보존·마커 상한 테스트를 추가한다.
- [ ] T052 [P] [141] `backend/src/main/java/com/ssafy/backend/realtime/viewport/dto/ViewportCellCounts.java`를 추가한다.
- [ ] T053 [P] [141] `RealtimeProperties.java`와 `application-realtime.yml`에 `individual-user-cap=20`을 추가하고 grid·셀 임계값·사용자 상한·마커 상한·주기 값의 시작 시 검증을 추가한다.

### Phase 7 — 정확 인원수

- [ ] T060 [141] `ViewportRedisRepository.java`에 layer 1 셀 인원수 read와 clustered 사용자/meta batch read를 추가한다.
- [ ] T061 [141] `ViewportService.java`에 CLUSTERED 최초 스냅샷을 추가한다: layer 1 fast path, layer 2+ bounds exact path.
- [x] T062 [141] `viewport-subscription-replace.lua`에 INDIVIDUAL↔CLUSTERED 인덱스 전환을 추가한다.
- [ ] T063 [P] [141] `ViewportServiceTests.java`에 V7·V20~V24, 사용자 20명 초과 CLUSTERED 전환, 다른 ancestor branch 제외 테스트를 추가한다.
- [ ] T064 [141] `ViewportSubscriptionRedisIntegrationTests.java`에 두 모드 전환 후 잔여 인덱스 0을 검증한다.

### Phase 8 — 주기 갱신

- [ ] T070 [141] `backend/src/main/java/com/ssafy/backend/realtime/viewport/scheduler/ViewportCellCountsScheduler.java`를 추가해 5초마다 clustered 화면을 갱신한다.
- [ ] T071 [141] `RealtimeEventType.java`에 `VIEWPORT_CELL_COUNTS`를 추가한다.
- [ ] T072 [P] [141] `backend/src/test/java/com/ssafy/backend/realtime/viewport/scheduler/ViewportCellCountsSchedulerTests.java`에서 grouped read, stale meta 제외, 0셀 제외를 검증한다.
- [ ] T073 [141] `application-realtime.yml`과 `RealtimeProperties`의 `cell-counts-interval-ms=5000`, `debounce-ms=250`, `individual-user-cap=20` 연결을 확인한다.

**Checkpoint 141**: V20~V26, 실제 Redis 모드 전환, scheduler 단위 테스트, realtime context 부팅을 보고한다. 사용자 확인과 커밋 후에만 77로 이동한다.

---

## S15P21A405-77 — 뷰포트 실시간 델타·종료·재연결

### Phase 9 — 서베이 (코드 변경 없음)

- [ ] T079 [77] `PositionChanged.java`, 모든 publish 지점, `PresenceLifecycleService.java`, presence leave Lua, disconnect·expiry, `resync()` placeholder를 읽어 변경 경계를 확정한다.

### Phase 10 — 이벤트 입력 보강

- [ ] T080 [77] `backend/src/main/java/com/ssafy/backend/realtime/event/PositionChanged.java`를 old/new layer와 델타 정확 필터에 필요한 좌표 계약으로 변경한다.
- [ ] T081 [77] `backend/src/main/java/com/ssafy/backend/realtime/presence/service/PresenceLifecycleService.java`가 최초 join뿐 아니라 레이어 이동 join에도 PositionChanged를 발행하게 한다.
- [ ] T082 [77] music play 서비스의 기존 PositionChanged 생성 지점을 새 계약에 맞추되 재생·만남·history 로직은 바꾸지 않는다.
- [ ] T083 [P] [77] presence/play 기존 테스트에 최초 진입·곡 이동·레이어 이동·이탈 event 필드를 검증한다.

### Phase 11 — 실시간 델타

- [ ] T090 [P] [77] `backend/src/main/java/com/ssafy/backend/realtime/viewport/dto/ViewportDelta.java`에 대상 화면 requestSeq와 사용자 변경 필드를 추가한다.
- [ ] T091 [77] `backend/src/main/java/com/ssafy/backend/realtime/viewport/service/ViewportDeltaService.java`를 추가하고 `@PostConstruct`에서 RealtimeEventBus를 구독한다.
- [ ] T092 [77] 델타 서비스에 old/new 셀 후보, 수신자 meta batch, 실제 old/new 화면 포함 판정, ENTER/MOVE/LEAVE 분류를 구현한다.
- [ ] T093 [77] 표시 정보·좌표·동승자 수를 이벤트당 한 번만 얻어 수신자별 중복 조회를 제거한다.
- [ ] T094 [77] `RealtimeEventType.java`에 `VIEWPORT_ENTER`, `VIEWPORT_MOVE`, `VIEWPORT_LEAVE`를 추가한다.
- [ ] T095 [P] [77] `backend/src/test/java/com/ssafy/backend/realtime/viewport/service/ViewportDeltaServiceTests.java`에 V40~V44·V50, 같은 셀 이동, requestSeq, query count를 검증한다.

### Phase 12 — 종료·이탈 정리

- [ ] T100 [P] [77] `backend/src/main/java/com/ssafy/backend/realtime/viewport/dto/ViewportCloseRequest.java`를 추가한다.
- [ ] T101 [77] `backend/src/main/resources/redis/viewport-subscription-close.lua`를 추가해 저장된 meta 기준 정리와 현재 epoch·최신 requestSeq 일치 검사를 수행한다.
- [ ] T102 [77] `ViewportRedisRepository.java`에 close를 연결한다.
- [ ] T103 [77] `PresenceStompController.java`에 `/presence/viewport/close`를 추가한다.
- [ ] T104 [77] `backend/src/main/resources/redis/presence-leave.lua`에 viewport cell·clustered·meta 정리를 기존 epoch 보호 안에서 추가한다.
- [ ] T105 [P] [77] repository 단위 테스트와 실제 Redis 통합 테스트에서 V45·V46·V48을 검증한다.

### Phase 13 — 재연결·전체 검증

- [ ] T110 [77] `PresenceStompController.resync()`의 빈 TODO를 제거한다. 서버 자동 복원 대신 STALE 오류와 명시적 재전송 계약을 코드 주석·프론트 문서에 맞춘다.
- [ ] T111 [P] [77] `backend/src/test/java/com/ssafy/backend/realtime/viewport/ViewportTwoSessionScenarioTests.java`에 ENTER→MOVE→LEAVE→close→reconnect 흐름을 작성한다.
- [ ] T112 [77] realtime profile 전체 부팅과 full test/build를 실행한다.
- [ ] T113 [77] realtime profile 없는 데모 부팅으로 영향 없음을 확인한다.
- [ ] T114 [77] `specs/jiwon-003-realtime-viewport/quickstart.md` 결과 표를 실제 결과로 갱신한다.
- [ ] T115 [77] 프론트 담당자에게 `contracts/frontend-layer-navigation.md`와 `contracts/realtime-viewport-websocket.md`를 전달하고 실제 layer·boxes 변경→화면 안정화→join→viewport, 늦은 응답 갱신, D1, layer 변환, 재연결 순서를 확인받는다.
- [ ] T116 [77] `ViewportService.java`, `ViewportDeltaService.java`, `ViewportCellCountsScheduler.java`에 처리 시간·모드·후보 수·발송 수·stale 거부 관측값을 추가하고 email·토큰·원시 좌표를 기록하지 않는다.
- [ ] T117 [P] [77] `backend/src/test/java/com/ssafy/backend/realtime/viewport/ViewportObservabilityTests.java`에서 관측 필드와 개인정보 제외를 검증하고 `quickstart.md`에 로컬 확인 결과를 기록한다.

**Checkpoint 77**: 전체 변경 파일·메서드, 검증 결과, 데모 영향, 남은 다중 인스턴스 위험을 사용자에게 보고한다. 사용자 확인 후에만 커밋·push·MR을 진행한다.

## Dependencies

- T001~T006 → 모든 구현
- 76 완료 → 141, 77
- 141 완료 → 77의 CLUSTERED 델타 제외 동작 검증
- T080~T083 → T091~T095
- T101~T104 → reconnect/old epoch 시나리오

## Scope Guards

- frontend 코드는 수정하지 않고 계약과 요청사항만 전달한다.
- 프론트의 레이어별 major 조회는 이미 구현되어 있다. 이번 범위는 기존 boxes를 viewport에 연결하며 곡 조회 흐름을 다시 만들지 않는다.
- music·auth 소유 파일은 읽기만 하고 realtime Port/Adapter에서 사용한다.
- 따라가기·동승 기능은 구현하지 않는다. riderCount Port의 0 fallback을 유지한다.
- nearby 기능 코드는 이벤트 계약 변경에 필요한 컴파일 수정 외에는 손대지 않는다.
- 사용자가 단계 완료를 확인하기 전 다음 Phase/Jira로 넘어가지 않는다.
