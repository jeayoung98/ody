# Implementation Plan: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Branch**: `backend/feat/S15P21A405-74-websocket-infra` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)
**Input**: spec.md(FR-001~090, A1~A54), research.md(R-01~R-13, B-1~B-7), Notion 정본 3종, 기존 realtime 스캐폴딩 실측.
**Status**: 조건부 설계. Q1~Q3 해소(2026-09-10), B-2~B-7 보류(B-1은 잔여 확인만). 보류에 독립적인 구간은 착수 가능(§처리 흐름·tasks.md 참조).

## Summary

"곡 = 위치"를 원칙으로, `POST /music/play`가 유일한 위치 이동 원본이 되어 Redis의 곡 청취자 Set·레이어별 셀 인덱스·셀 인원수를
Lua 한 번으로 원자 갱신하고, 변경 이벤트를 두 종류의 구독 인덱스(뷰포트 셀·근처 곡)에 정방향 조회로 fanout한다.
클라이언트는 원시 pc값만 보내고 정규화·셀 변환·좌표 계산은 서버만 한다. 만남은 같은 레이어·같은 곡의 기존 청취자와 비동기로 기록하며 동일 쌍은 3분 안에 한 번만 센다.
기존 스캐폴딩의 config/common/session 계층은 재사용하고 presence/nearby는 정본 모델로 재작성한다(R-01). 반응·따라가기는 범위 밖.

## Technical Context

**Language/Version**: Java 17 (`build.gradle` `sourceCompatibility = '17'`, `options.release = 17`). 로컬 IDE JDK는 26으로 잡혀 있었으나 Gradle이 release 17로 컴파일한다.
**Primary Dependencies**: Spring Boot 4.1.1 — `starter-websocket`(STOMP, SimpleBroker), `starter-data-redis`(Lettuce, `StringRedisTemplate`), `starter-jdbc` + `mybatis-spring-boot-starter 4.1.0`, `starter-security` + `jjwt 0.12.6`(기존 `JwtTokenProvider` 재사용), `starter-validation`, `starter-actuator` + Prometheus. 신규 의존성 추가 없음(캐시는 `ConcurrentHashMap` 상한형으로 시작, Caffeine은 B-6에서 BE1과).
**Storage**: Redis 7.4(단일, `noeviction` 필수 — FR-025) — presence·인덱스·구독·seq 외 전부. PostgreSQL 17 + pgvector — `music.location VECTOR(16)`, `"user"`, `play_history`, `meeting`. Neo4j는 이 기능 미사용.
**Testing**: JUnit 5 + Spring Boot Test(webmvc-test). Testcontainers 없음(B-6) → 로컬 Redis 조건부 통합 테스트(R-12). 컨텍스트 로딩 테스트 `BackendApplicationTests`가 첫 게이트.
**Target Platform**: Linux 컨테이너(Dockerfile, `app.jar`), HTTP/WS 8080, SockJS fallback. 데스크톱 브라우저 우선.
**Project Type**: 단일 Gradle Spring Boot 앱 안의 `realtime` 모듈(패키지). 별도 서비스 아님.
**Performance Goals**: SC-001 재생→타인 화면 반영 1초 이내, SC-002 이탈→사라짐 1초 이내(정상 종료), SC-003 45~50초(비정상). 백분위·동접 목표는 미정(헌법 VERIFICATION_PLAN TODO) — 임의로 정하지 않고 지표(FR-090)를 먼저 남긴다.
**Constraints**: 클라이언트 좌표 금지, Lua 안 부동소수 금지, 브로드캐스트 경로에 DB 쓰기 금지, email payload 금지, 격자·임계 세트 변경, 저장된 목록으로만 구독 해제, CLUSTERED에서 델타 차단.
**Scale/Scope**: 곡 6,624,399(v2.1-pca16) — 좌표는 요청 시 1건씩 조회·캐시, 전체 적재 없음. 동접은 시연 규모(수십)로 시작하되 인기 곡 fanout·만남 폭발은 지표로 관측(RT-50). 레이어 8, 셀 256/레이어.

## Constitution Check

| 원칙 | 설계 전 → 설계 후 | 판단 및 근거 |
| --- | --- | --- |
| I 명세 우선 | 보류 → 부분 충족 | spec.md Draft, Q1~Q3 해소. Notion 정본 우선 원칙과 Q1 해석은 사용자(BE3) 확정이며 팀 승인 기록은 없음(APPROVAL_PROCESS TODO) |
| II 계약 우선 | 미충족 → 부분 충족 | `contracts/` 3종 작성. 기존 `contracts/websocket/` 3문서는 09-07 구버전 — 이번 설계로 **교체 대상**. FE1·FE2 리뷰 체크박스는 미완 상태로 유지(정직하게) |
| III 완료 전 검증 | 계획 필요 → 설계 충족/실행 미검증 | quickstart.md에 A1~A54 → 검사 매핑, 통과·실패·미실행 구분. `contextLoads` 재실행이 첫 검증 |
| IV 데이터 재현성 | 해당 → 충족 | 좌표는 v2.1-pca16 고정값을 읽기만 함. 정규화 상수는 yml에 버전·출처 주석 필수(B-4) |
| V 좌표 안정성 | 적용 → 설계 충족 | 재생·요청 경로에서 모델 재계산 없음. 정규화는 표시용, 유사도는 원시값(FR-078) |
| VI 탐색 일관성 | 적용 → 설계 충족 | 누적 bounds를 후보 필터에 그대로 적용(FR-053) — 사용자 제약을 확장·폐기하지 않음 |
| VII 실험 격리 | 해당 없음 → 해당 없음 | 서빙 기준선만 읽음 |
| VIII 관측 가능성 | 방법 필요 → 설계 충족/미검증 | FR-090 지표 5종, Micrometer로 기존 Prometheus 노출. email·토큰 제외(FR-040) |
| IX 암묵적 가정 금지 | 적용 → 충족 | Q1~Q3는 가정을 명시하고 `[협의 필요]` 표기. B-4 임의 상수는 "실측 전"으로 드러냄 |
| X 아키텍처 경계 | 부분 보류 → 부분 보류 | BE2 포트(`MusicDetailReader`) 경유 결정(R-02·R-03). 경량 좌표 포트는 **제안** 단계 — BE2 합의 전 |

미해결 게이트를 통과로 표시하지 않는다. Q1~Q3 확정으로 join·컨트롤러 경로·비공개 분기 전부 착수 가능. 잔여는 B-2~B-7(ERD·BE2 포트·상수·FE payload·Testcontainers·다중화).

## Project Structure

### Documentation (this feature)

```text
specs/004-realtime-presence-nearby/
├── spec.md                          # 기능 명세 (Q1~Q3 미결)
├── plan.md                          # 이 문서
├── research.md                      # R-01~R-13 결정, B-1~B-7 보류
├── data-model.md                    # Redis 키 설계 + DB 테이블 대응
├── quickstart.md                    # 검증 절차 (A → 검사 매핑)
├── contracts/
│   ├── realtime-websocket.md        # STOMP destination·payload 정본 (기존 contracts/websocket/ 교체 초안)
│   ├── music-play.md                # POST /music/play · PATCH /music/play/end
│   └── music-neighbors.md           # BE2 이웃곡 포트/REST 계약 (BE3 소비자 관점)
├── checklists/requirements.md
└── tasks.md                         # $speckit-tasks 산출물
```

### Source Code (repository root)

기존 루트 `backend/src/main/java/com/ssafy/backend/realtime/`. **유지/재작성/격리** 구분은 R-01. 아래는 목표 구조이며 신규 파일명은 설계 제안이다.

```text
backend/src/main/java/com/ssafy/backend/realtime/
├── config/                                  # [유지] 6파일
│   ├── WebSocketConfig.java                 #   /ws · /app · /user · SimpleBroker · 인터셉터 체인
│   ├── StompAuthChannelInterceptor.java     #   CONNECT JWT → Principal(email). 로그 금지
│   ├── StompSubscribeInterceptor.java       #   [수정] follow 토픽 검사 → 이번 범위에선 /user/queue만 허용하도록 축소
│   ├── RedisScriptConfig.java               #   [수정] 3종 Lua 빈 교체 (presence-play / presence-leave / usercount-recount)
│   ├── RealtimeAsyncConfig.java             #   @EnableScheduling/@EnableAsync
│   ├── RealtimeMapperScanConfig.java        #   realtime 매퍼 스캔 (09-10 추가, 기동 필수)
│   └── RealtimeProperties.java              #   [신규] @ConfigurationProperties("realtime") — yml 상수 단일 진입점
├── common/                                  # [유지+추가]
│   ├── RealtimePublisher.java / SimpleBrokerPublisher.java   # 발행 단일화 (다중화 교체점). publishToUser에서 seq 발급
│   ├── RealtimeEnvelope.java · RealtimeEventType.java        # [수정] 타입 목록을 정본 §4로 교체
│   ├── RealtimeErrorSender.java             #   PRESENCE_ERROR 회신
│   ├── RealtimeErrorCode.java               #   [신규] implements ErrorCode — PRESENCE_ERROR(422)
│   └── RealtimeEventBus.java                #   [신규] 위치 변경 이벤트 인터페이스 (인프로세스 구현, 다중화 시 Pub/Sub)
├── session/                                 # [유지+확장]
│   ├── WebSocketSessionRegistry.java        #   sessionId↔email, sessionEpoch, 세션별 seq AtomicLong
│   └── WebSocketSessionEventListener.java   #   onClose → PresenceLifecycleService.leave
├── geometry/                                # [신규] 순수 계산 — 프레임워크 비의존
│   ├── LayerAxes.java                       #   레이어 l → PC(2l-1), PC(2l); yml 배정표 로드
│   ├── Normalizer.java                      #   (pc-min)/(max-min), floor 클램프 셀
│   ├── Viewport.java                        #   사각형 + 누적 bounds 포함 판정
│   └── CellGrid.java                        #   셀 범위 산출, 반감 병합
├── presence/                                # [재작성]
│   ├── controller/PresenceStompController.java   # join · heartbeat · leave · viewport · resync
│   ├── dto/ (JoinRequest, ViewportRequest, PresenceSnapshot 등)
│   ├── repository/PresenceRedisRepository.java   # presence:user · presence:expiry ZSET · listeners · active-song:cell · cell:usercount — 키 조립은 여기만
│   ├── service/PresenceLifecycleService.java     # CONNECT 생성 · join 복원(Q1) · heartbeat · leave/expiry 정리
│   ├── service/PlayDeclarationService.java       # /music/play 오케스트레이션: 좌표 계산 → Lua → play_history → EventBus → 만남
│   └── scheduler/PresenceSweepScheduler.java     # 5s 만료 정리 + 60s 인원수 재검증(레이어 순환)
├── viewport/                                # [신규] RT-20~23
│   ├── service/ViewportService.java         #   스냅샷 조립, 모드 판정, 구독 등록/해제(cellKeys)
│   ├── service/ViewportDeltaService.java    #   V_old/V_new 차집합 → 사각형·bounds 검사 → 발송
│   └── repository/ViewportRedisRepository.java   # viewport:cell:* · viewport:meta:*
├── nearby/                                  # [재작성] RT-10·11
│   ├── controller/NearbyStompController.java     # open · close
│   ├── service/NearbyService.java                # 앵커 → MusicDetailReader.findNeighbors → 청취자 붙임 → 구독 등록
│   ├── service/NearbyDeltaService.java           # S_old/S_new 차집합 → 개인 큐
│   └── repository/NearbyRedisRepository.java     # nearby:subscribers:* · nearby:meta:*
├── meeting/                                 # [신규] RT-50 (기존 nearby/EncounterService 대체)
│   ├── service/MeetingRecorder.java         #   @Async 별도 빈, 배치 UPSERT
│   └── repository/MeetingMapper.java        #   MyBatis
├── play/                                    # [신규] REST
│   ├── controller/MusicPlayController.java  #   POST /music/play · PATCH /music/play/end
│   ├── dto/ (PlayRequest, PlayResponse, PlayEndRequest)
│   └── repository/PlayHistoryMapper.java    #   insert(played_ms=0) · updatePlayedMs(소유자 검증)
├── reaction/  follow/                       # [격리] 이번 범위 밖. 삭제하지 않되 이 계획에서 수정하지 않음
└── (삭제 대상) nearby/EncounterService·EncounterRedisRepository·EncounterMapper, presence/dto/MoveRequest, redis/presence-move.lua·encounter-dedup.lua

backend/src/main/resources/
├── application-realtime.yml                 # [교체] 15/45/5s · K=10 · grid=16 · threshold=36 · markerCap=64 · debounce=250 · 축 배정·min/max(실측 전)
├── redis/presence-play.lua · presence-leave.lua · usercount-recount.lua   # [신규]
└── mapper/realtime/PlayHistoryMapper.xml · MeetingMapper.xml               # [신규]

backend/src/test/java/com/ssafy/backend/realtime/
├── geometry/  (순수 단위)   viewport/  nearby/  presence/  (서비스 단위 + Redis 조건부 통합)
└── e2e/RealtimeStompScenarioTests.java (2세션 STOMP, 로컬 Redis 조건부)

contracts/websocket/                         # [교체 예정] destinations.md · events.md · recovery.md → specs/004/contracts/realtime-websocket.md 내용으로 갱신 (FE 리뷰 후)
```

**Structure Decision**: 정본이 기능을 "presence(접속·재생·정리) / viewport(화면 사용자) / nearby(근처 사람) / meeting(만남)"으로 나누므로 패키지도 그 경계를 따른다. Redis 키 조립은 각 `*RedisRepository`에만 두고(스캐폴딩 원칙 유지), 순수 계산은 `geometry/`로 분리해 프레임워크 없이 테스트한다. REST `/music/play`는 `music/` 패키지(BE2 소유)가 아니라 `realtime/play/`에 둔다 — 컨트롤러 경로는 `/music`이지만 소유는 BE3이며, BE2 `MusicController`와 클래스가 다르므로 매핑 충돌은 없다(경로 충돌 검토는 tasks T0xx).

## 처리 흐름

### F1. CONNECT → join (RT-01, Q1 확정 — 배치·복원)

1. `StompAuthChannelInterceptor`가 Bearer 검증 → Principal = email. 실패 시 예외로 연결 거부(재시도 없음은 FE 몫).
2. `SessionConnectedEvent` → `WebSocketSessionRegistry.register(sessionId, email)` + `sessionEpoch` 증가.
3. `PresenceLifecycleService.connect(email, epoch)` → `presence:user:{email}` HSET(epoch, playingMusicId=null) + `presence:expiry` ZADD(now+45s). **비노출 상태**.
4. `/app/presence/join {requestSeq, layer, musicId}` → 현재 소켓 epoch 확인 → 최초 join이면 요청 곡, 현재 곡이 있으면 서버 현재 곡 선택 → 좌표 계산 → `presence-join.lua` 실행 → `PRESENCE_JOINED` 전송. 실패는 요청 순번과 함께 개인 오류 큐로 전송한다. **play_history INSERT·만남 판정 없음**.
5. 클라이언트가 이어서 `viewport`·`nearby/open`을 보내면 F3·F4.

### F2. `POST /music/play` (RT-02 · RT-50)

1. `MusicPlayController` — `@Valid` `{musicId, source∈{MAP,JOURNEY,PLAYLIST,FOLLOW}}`, Principal(email). 위반 → `VALIDATION_ERROR` 400.
2. `PlayDeclarationService.play(email, musicId, source)`:
   a. 곡 좌표 조회(R-03 포트, 캐시) → 없으면 `MUSIC_NOT_FOUND` 404, `location` NULL → `PRESENCE_ERROR` 422.
   b. presence 읽기: 현재 `layer`, `playingMusicId`(old). old == new면 **no-op 분기** → play_history INSERT만 하고 응답.
   c. `LayerAxes`·`Normalizer`로 (x, y, cellX, cellY) 계산 — Lua 밖.
   d. `presence-play.lua`(old, new, oldCell, newCell, 좌표, epoch) → 반환: 진입 직전 new 청취자 목록. 반환 -1(old 불일치) → `PRESENCE_ERROR` (Sweep 경쟁).
   e. `PlayHistoryMapper.insert(email, musicId, source, played_ms=0)` → `playHistoryId`.
   f. `RealtimeEventBus.publish(PositionChanged{email, oldMusic, newMusic, layer, oldCell, newCell, x, y})` → F5.
   g. `MeetingRecorder.recordAsync(email, listenersBefore)` — `@Async`, 별도 빈.
   h. 응답 `ApiResponse.success({playHistoryId, musicId, layer, x, y, cellX, cellY})`.

### F3. `/app/presence/viewport` (RT-20~23)

1. 검증: layer 존재, min<max, bounds 필수 → 위반 `PRESENCE_ERROR` 개인 큐.
2. `layer`가 `viewport:meta`의 이전 layer와 다르면 **레이어 이동**: 내 presence 셀을 새 레이어 축으로 재계산해 `presence-play.lua`(old==new musicId, 레이어만 변경) — 셀 인덱스·인원수가 레이어 간 이동.
3. `CellGrid.cellsFor(viewport)` → 셀 집합 S, |S| ≤ 36 → INDIVIDUAL / 초과 → CLUSTERED.
4. 이전 구독 해제(`viewport:meta.cellKeys`) → INDIVIDUAL이면 S 각 `viewport:cell:*` SADD + meta 저장(cellKeys, 사각형, bounds, mode).
5. INDIVIDUAL: S의 `active-song:cell:*` SUNION → 곡 좌표(캐시) → **사각형 안** 곡만 → 곡별 `listeners:*` SMEMBERS(pipeline) → 각 사용자 presence의 좌표에 **누적 bounds** 적용 → 자기 제외 → `filterVisible`(항등) → nickname/imageUrl 조회(캐시) → `VIEWPORT_SNAPSHOT{mode: INDIVIDUAL, groups}`.
6. CLUSTERED: `cell:usercount:{layer}` HGETALL → S로 자름 → 마커 > 64면 반감 반복 → `VIEWPORT_SNAPSHOT{mode: CLUSTERED, resolution, cells}`. 구독 없음. 이후 `VIEWPORT_CELL_COUNTS` 주기 발송(주기는 yml, 초기 5s).

### F4. `/app/nearby/open` · `close` (RT-10·11)

1. presence `playingMusicId` null → `PRESENCE_ERROR`.
2. `MusicDetailReader.findNeighbors(anchor, K)` (R-02) → [anchor] + K곡.
3. 곡별 `listeners:*` SMEMBERS(pipeline) → 자기 제외 → 0명 곡 제외 → 곡 메타(캐시) → `NEARBY_SNAPSHOT`.
4. `nearby:subscribers:{musicId}` SADD ×(K+1) + `nearby:meta:{email}`(anchor, musicIds) 저장.
5. `close` → meta의 musicIds로 SREM, meta DEL. 재계산 없음.

### F5. 위치 변경 fanout (RT-11 · RT-22)

`RealtimeEventBus` 구독자 2개:
- `ViewportDeltaService.onPositionChanged`: `V_old = SMEMBERS viewport:cell:{L}:{oldCell}`, `V_new = ... {newCell}` → 차집합/교집합 → 각 수신자 `viewport:meta` 사각형·bounds에 새 좌표 검사 → 통과자에게 `VIEWPORT_ENTER/MOVE/LEAVE` 개인 큐. 같은 셀이면 MOVE만.
- `NearbyDeltaService.onPositionChanged`: `S_old = SMEMBERS nearby:subscribers:{oldMusic}`, `S_new = ... {newMusic}` → 차집합/교집합 → `NEARBY_ENTER/MOVE/LEAVE`. 변경 주체 본인이 근처 패널을 열어둔 상태면 앵커 변경 → F4 재실행(FR-076).
- 이탈(F6)은 old만 있고 new가 없는 PositionChanged로 통일.

### F6. leave / onClose / expiry (RT-05)

1. `/app/presence/leave` 또는 `SessionDisconnectEvent`(멀티탭: registry에 다른 세션 있으면 스킵 — 정책 보류) 또는 Sweep(`ZRANGEBYSCORE presence:expiry -inf now`).
2. `presence-leave.lua`(email, epoch) — 스크립트 **안에서** playingMusicId·셀을 읽어 listeners SREM / 마지막이면 cell 제거 / usercount −1 / presence·expiry DEL. epoch 불일치(새 세션이 이미 갱신)면 no-op.
3. `viewport:meta.cellKeys`로 `viewport:cell:*` SREM, `nearby:meta.musicIds`로 `nearby:subscribers:*` SREM, meta 2종 DEL.
4. `RealtimeEventBus.publish(PositionChanged{old만})` → F5 LEAVE.

### F7. Sweep (5s) + 인원수 재검증 (60s)

- 5s: F6 3~4단계를 만료 대상 전원에 대해. 정리 건수 지표.
- 60s(레이어 순환, 8레이어 → 8분에 1회전): `active-song:cell:{L}:*` SCAN → 곡별 SCARD 합 → `cell:usercount:{L}`와 비교 → 불일치 덮어쓰기 + WARN 로그 + 지표.

## 설정 (`application-realtime.yml` 교체안)

```yaml
realtime:
  presence:   { heartbeat-interval-ms: 15000, ttl-ms: 45000, sweep-interval-ms: 5000, recount-interval-ms: 60000 }
  nearby:     { neighbor-k: 10 }
  viewport:   { grid-size: 16, cluster-threshold-cells: 36, marker-cap: 64, debounce-ms: 250, cell-counts-interval-ms: 5000 }
  layers:     # 실측 전 임의값 — B-4. 레이어 l = PC(2l-1), PC(2l)
    - { layer: 1, axisX: 1, axisY: 2 }
    # ... 8까지
  axis-range: # 축별 전역 min/max — 실측 전 임의값 — B-4
    - { axis: 1, min: -10.0, max: 10.0 }
    # ... 16까지
```

`grid-size`와 `cluster-threshold-cells`는 같은 블록에 두고 주석으로 "세트 변경"을 명시한다(FR-032).

## 보류 항목과 진행 조건

research.md B-1~B-7 참조. 착수 가능/불가 요약:

| 지금 착수 가능 (보류에 독립) | 확정 후 착수 |
| --- | --- |
| `geometry/` 순수 계산 + 단위 테스트 · join 배치·복원(Q1 확정) | join `musicId` 대조 방어 수용 여부(FE2) — 분기 1곳 |
| Lua 3종 + 로컬 Redis 통합 테스트 | `/music/play/end` 네이밍 최종(BE1) — 경로 자체는 확정 |
| `RealtimeProperties`·yml 교체(임의 상수 명시) · `/music/play` 컨트롤러 · `filterVisible` 항등 | — |
| `PresenceRedisRepository`·`ViewportRedisRepository`·`NearbyRedisRepository` | `PlayHistoryMapper.xml`·`MeetingMapper.xml` 컬럼(B-2) |
| `ViewportService`·`ViewportDeltaService`·`CellGrid` 반감 | `NearbyService`의 `findNeighbors` 실호출(B-3 — mock으로 개발은 가능) |
| `RealtimeEventBus` 인프로세스 구현 | 축 배정·min/max 실측값(B-4) |
| `RealtimeEventType` 정본 교체, `RealtimeErrorCode` | `contracts/websocket/` 확정(B-5) |
| `StompSubscribeInterceptor` 축소, reaction/follow 격리 | Testcontainers(B-6), 다중화(B-7) |

## Complexity Tracking

| 항목 | 이유 | 더 단순한 대안을 택하지 않은 이유 |
| --- | --- | --- |
| Lua 3종 | 조건 분기("마지막 청취자면 곡 제거")가 있는 다키 원자 갱신 | MULTI/EXEC는 조건 분기 불가, WATCH는 인기 곡에서 재시도 폭주(R-04) |
| 구독 인덱스 2종 + 메타 2종 | 정방향 조회로 KNN 재호출·역조회 제거, 저장된 목록으로 해제 | 브로커 토픽 구독은 bounds 검사·모드 전환 강제 불가(R-05) |
| `RealtimeEventBus` 추상화 | 다중화 시 Pub/Sub 교체점 | 없으면 fanout 서비스 2개가 `PlayDeclarationService`에 직접 결합돼 교체 지점이 흩어짐(R-09) |
| `presence:expiry` ZSET | 키 TTL은 만료를 관측 못 해 인덱스 유령 발생 | keyspace notification은 유실 시 복구 경로 없음(R-08) |

추가 서비스·DB·메시지 브로커·캐시 라이브러리를 확정하지 않는다. 미해결 게이트를 예외로 면제하지 않는다.
