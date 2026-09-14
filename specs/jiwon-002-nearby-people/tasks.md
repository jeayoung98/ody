# Tasks: 근처 사람 보기 (Nearby People)

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [contracts/nearby-rest.md](contracts/nearby-rest.md)

**Tests**: 포함. spec의 N-시나리오(N1~N23)와 조건①②를 검증한다. 순수 단위(Mockito)는 커밋, Redis/DB 통합은 로컬 전용(커밋 제외).

**Jira / Branch**:
- **T1** S15P21A405-309 · `backend/feat/S15P21A405-309-nearby-snapshot`
- **T2** S15P21A405-310 · `backend/feat/S15P21A405-310-nearby-delta` (309 머지 후)
- **T3** S15P21A405-311 · `backend/feat/S15P21A405-311-nearby-cleanup` (310 머지 후)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: T1(스냅샷 조회) / T2(구독+델타+닫기) / T3(이탈 정리)
- 경로: `backend/src/main/java/com/ssafy/backend/realtime/` = `RT/`, `.../resources/` = `RES/`, 테스트 = `RT-TEST/`

> **의존 순서**: T1 → T2 → T3 (지라 Blocks 링크와 동일). 앞 단위가 dev에 머지돼야 다음 브랜치를 딴다.
> **블로킹**: 이웃곡 어댑터 **B-3**(BE2) → T1은 `realtime-dev` 스텁으로 진행, 어댑터는 합의 후 교체.

---

## T1 — 근처 사람 스냅샷 조회 (S15P21A405-309)

**Goal**: `POST /realtime/nearby`가 근처 사람 목록을 한 번 반환(구독·델타 없음). N1~N6.
**Independent Test**: A·C 두 세션(스텁) — C가 A 앵커의 이웃곡을 들으면 A의 응답에 C가 뜬다.

### Tests
- [ ] T101 [P] [T1] `RT-TEST/nearby/NearbyServiceTests.java` — 앵커 없음→422(N2), 0명 곡 생략·자기 제외·앵커 distance:0(N1·N3), 이웃곡 실패→503(N4). Redis·포트 mock
- [ ] T102 [P] [T1] `RT-TEST/nearby/NearbyControllerTests.java` — MVC 슬라이스: 200 응답 형태, 422/503 매핑

### Implementation
- [ ] T103 [P] [T1] `RT/nearby/dto/` — `NearbySnapshot`(anchorMusicId, groups), `NearbyGroup`(musicId·title·artist·x·y·distance·users), `UserView`(nickname·imageUrl)
- [ ] T104 [P] [T1] `RT/nearby/port/NeighborPort.java` — `neighbors(musicId, k): List<Neighbor(musicId, distance)>` + `NeighborStubAdapter`(`@Profile("realtime-dev")`, 고정 결과)
- [ ] T105 [P] [T1] `RT/common/UserDisplayResolver.java` — email→{nickname,imageUrl}, `AuthMapper.findByEmail` 읽기 위임 + 상한 캐시. 배치 `resolveAll(emails)`
- [ ] T106 [T1] `RT/nearby/repository/NearbyRedisRepository.java` — `listeners(musicIds)` pipeline SMEMBERS (읽기만; 쓰기는 T2)
- [ ] T107 [T1] `RT/nearby/service/NearbyService.java` — `snapshot(email)`: 앵커 읽기(없으면 PRESENCE_NO_ANCHOR) → NeighborPort(실패 SERVICE_UNAVAILABLE) → listeners → 자기·0명 제외 → 메타·좌표(`MusicLocationPort`·`CoordinateMapper`)·`UserDisplayResolver` → 조립
- [ ] T108 [T1] `RT/nearby/controller/NearbyController.java` — `POST /realtime/nearby` (`@Profile("realtime")`), 공통 envelope

**Checkpoint**: N1~N6 통과(스텁). 데모(프로파일 off) 무영향. 커밋: 순수 단위만, 통합 제외.

---

## T2 — 실시간 갱신: 구독 + 델타 + 닫기 (S15P21A405-310)

**Goal**: 남이 곡 바꾸면 목록이 실시간 ENTER/MOVE/LEAVE. N10~N16.
**Independent Test**: A 패널 열림 + B가 이웃곡으로 변경 → A에 ENTER.

### Tests
- [ ] T201 [P] [T2] `RT-TEST/nearby/NearbyDeltaServiceTests.java` — S_old/S_new 분류(N11), KNN 재호출 없음(N12), 본인 앵커 변경→재발급(N13)
- [ ] T202 [P] [T2] `RT-TEST/e2e/NearbyDeltaE2ETests.java` — 2세션 + 로컬 Redis: N10·N11·N13·N14 (스텁 프로파일)

### Implementation
- [ ] T203 [T2] `RT/nearby/repository/NearbyRedisRepository.java` 확장 — `nearby:subscribers` SADD/SREM, `nearby:meta` HSET/DEL
- [ ] T204 [T2] `RT/nearby/service/NearbyService` 확장 — 스냅샷에 **구독 등록 추가, 청취자 조회보다 먼저**(조건①). 앵커 변경 재발급 경로
- [ ] T205 [T2] `RT/nearby/service/NearbyDeltaService.java` — `RealtimeEventBus` 구독 → S_old/S_new → ENTER/MOVE/LEAVE 개인 큐 발송
- [ ] T206 [T2] `RT/nearby/controller/NearbyStompController.java` — `/app/nearby/close` (저장 목록으로 해제, 재계산 없음)
- [ ] T207 [T2] `RT/nearby/dto/NearbyDelta.java` — `{nickname, imageUrl, fromMusicId?, toMusicId?, x?, y?}`

**Checkpoint**: N10~N16 통과. 닫기 후 델타 0. 스냅샷 seq 이하 델타 폐기 확인.

---

## T3 — 이탈·만료 시 nearby 구독 정리 (S15P21A405-311)

**Goal**: 나가거나 만료된 사용자의 nearby 구독 청소(조건②). N20~N23.
**Independent Test**: A 패널 열림 → leave/만료 → A의 `nearby:subscribers` 항목 전부 소멸, 이후 델타 0.

### Tests
- [ ] T301 [P] [T3] `RT-TEST/nearby/NearbyCleanupRedisTest.java` — leave·sweep 후 subscribers·meta 잔여 0(N20·N21), 재접속 경쟁 시 새 세션 구독 보존(N23). 로컬 Redis 조건부

### Implementation
- [ ] T302 [T3] `RES/redis/presence-leave.lua` 수정 — 기존 정리에 더해 `nearby:meta:{email}` 곡 목록으로 `nearby:subscribers:*` SREM + `nearby:meta` DEL. epoch/score 방어 유지
- [ ] T303 [T3] `RT/presence/scheduler/PresenceSweepScheduler.java` 수정 — 만료 leave 경로에서 위 정리가 함께 돌도록 연결
- [ ] T304 [T3] `RT/presence/repository/PresenceRedisRepository.java` — leave/leaveExpired 시그니처에 nearby 정리 인자·호출 연결(필요 시)

**Checkpoint**: N20~N23 통과. 유령 델타 0. presence 코어 리뷰어(-75) 확인.

---

## Dependencies & Execution Order

- **T1(309)**: dev에서 브랜치. presence·listeners·MusicLocationPort·CoordinateMapper(완성) 소비. B-3는 스텁으로 우회
- **T2(310)**: T1 머지 후. `PositionChanged` 이벤트 버스(완성) 소비. 구독 쓰기 처음 도입
- **T3(311)**: T2 머지 후(구독이 있어야 정리 대상 존재). presence 코어 수정

## Parallel Opportunities

- T1 내부: dto(T103) ‖ NeighborPort+스텁(T104) ‖ UserDisplayResolver(T105) 병렬 → 그 위에 Repository(T106)·Service(T107)·Controller(T108) 순차
- 각 단위의 Tests는 구현과 병렬 작성(실패 상태로 시작)

## Notes

- 커밋 메시지에 `[S15P21A405-309/310/311]`. attribution 라인 넣지 않음
- Redis/DB 통합 테스트는 로컬 전용 — 커밋 제외(CI 무의존)
- 계약 정본: Notion `/realtime/nearby`(REST) · 📡 실시간 명세 §5.1(델타). 스펙과 어긋나면 계약을 먼저 고친다
