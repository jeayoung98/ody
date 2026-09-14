# Implementation Plan: 근처 사람 보기 (Nearby People)

**Branch**: `backend/feat/S15P21A405-309-nearby-snapshot` | **Date**: 2026-09-14 | **Spec**: [spec.md](spec.md)
**Input**: spec.md(FR-N01~N23, N1~N23), `/realtime/nearby` API 계약, 📡 실시간 명세 §5.1(델타), presence Lua 실측(presence-play/join/leave).
**Status**: 설계 확정(REST 이관·조건①②). B-3(BE2 이웃곡 어댑터) 보류 → 스텁으로 착수. presence 코어(-75)는 소비/최소 확장(T3)만.

## Summary

내 재생곡(앵커)의 이웃곡 K개를 전역 `listeners:{musicId}`로 조회해 곡별 청취자 그룹으로 반환하는 **REST `POST /realtime/nearby`**(T1)와, 그때 등록한 곡 단위 구독 인덱스에 `PositionChanged`를 정방향 조회로 fanout하는 **소켓 델타**(T2), 그리고 이탈·만료 시 그 구독을 청소하는 **정리 경로**(T3)로 나눈다. 스냅샷은 REST, 갱신은 소켓 델타만. 근처는 레이어 무관 전역이며(만남 판정과 다름), REST 이관이 Redis 구조를 바꾸지 않는다(실측). 이웃곡은 BE2 포트를 인프로세스로 호출하되 B-3 전까지 스텁.

## Technical Context

**Language/Version**: Java 17 (Gradle release 17). **Primary Dependencies**: Spring Boot 4.1.1 — `starter-websocket`(STOMP SimpleBroker), `starter-data-redis`(Lettuce, `StringRedisTemplate`), `starter-webmvc`, `mybatis-spring-boot-starter`, `starter-security`(기존 `JwtTokenProvider`). 신규 의존성 없음(캐시는 `ConcurrentHashMap` 상한형).
**Storage**: Redis(단일, `noeviction`) — `listeners:*`(읽기), `nearby:subscribers:*`·`nearby:meta:*`(신규 쓰기), `presence:user:*`(앵커 읽기). PostgreSQL — 이 기능은 직접 쓰기 없음(BE2 이웃곡·BE1 user 읽기만).
**Testing**: JUnit 5 + Mockito(순수 단위) + 로컬 Redis 조건부 통합. 이웃곡은 `realtime-dev` 스텁. 통합 테스트는 로컬 전용(커밋 제외).
**Project Type**: 단일 Gradle Spring Boot 앱 안의 `realtime.nearby` 패키지.
**Performance Goals**: SC-N01 스냅샷 1초 이내, SC-N02 델타 반영 1초 이내(스텁·시연 규모).
**Constraints**: 클라이언트 좌표 금지, email payload 금지, 저장된 목록으로만 구독 해제, 구독 먼저→스냅샷(조건①), leave/sweep가 nearby 정리(조건②), 이웃곡 실패는 503(빈 목록 금지).
**Scale/Scope**: 곡 6,624,399 — 이웃곡은 요청 시 K개, 청취자는 곡별 pipeline. 동접 시연 규모. 인기 곡 fanout은 관측.

## Constitution Check

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족 | spec.md + `/realtime/nearby` 계약 정본. Clarifications 5건 확정 |
| II 계약 우선 | 충족 | `/realtime/nearby` API 페이지가 REST 계약 정본, 📡 실시간 §5.1이 델타 계약. FE2 전환 확인은 미완(정직하게 표기) |
| III 완료 전 검증 | 설계 충족 | N1~N23 → 스텁 e2e/단위 매핑(tasks.md). |
| IV 데이터 재현성 | 충족 | 이웃곡·좌표는 불변값 읽기만 |
| V 좌표 안정성 | 충족 | 유사도는 원시 pc(distance), 정규화는 표시용(x,y) |
| VIII 관측 | 부분 | 델타 지연·구독 수 지표 권장(FR 없음, 계획 항목) |
| IX 암묵 가정 금지 | 충족 | B-3 스텁을 "실측/합의 전"으로 드러냄, 조건①②를 명시 |
| X 아키텍처 경계 | 부분 보류 | BE2 `MusicDetailReader.findNeighbors` 포트 경유. 어댑터는 B-3 합의 전(스텁) |

## Project Structure

### Documentation (this feature)

```text
specs/jiwon-002-nearby-people/
├── spec.md                     # 기능 명세 (근처 사람, T1~T3)
├── plan.md                     # 이 문서
├── tasks.md                    # T1/T2/T3 태스크 (지라 309/310/311)
└── contracts/
    └── nearby-rest.md          # POST /realtime/nearby (Notion 계약 정본 참조 + 요약)
```

### Source Code (repository root)

`backend/src/main/java/com/ssafy/backend/realtime/`. **신규는 `nearby/`**, T3만 기존 presence 파일 수정.

```text
backend/src/main/java/com/ssafy/backend/realtime/
├── nearby/                                   # [신규] RT-10·11
│   ├── controller/NearbyController.java      #   [T1] POST /realtime/nearby (REST, @Profile("realtime"))
│   ├── controller/NearbyStompController.java #   [T2] /app/nearby/close
│   ├── service/NearbyService.java            #   [T1→T2] 앵커→이웃곡→청취자→그룹→(구독 등록)
│   ├── service/NearbyDeltaService.java       #   [T2] PositionChanged 구독 → S_old/S_new → 개인 큐
│   ├── repository/NearbyRedisRepository.java #   [T1 읽기 → T2 쓰기] listeners 읽기 / subscribers·meta
│   ├── port/NeighborPort.java                #   [T1] findNeighbors(musicId, k)
│   ├── port/NeighborStubAdapter.java         #   [T1] @Profile("realtime-dev") 고정 결과
│   └── dto/ (NearbySnapshot, NearbyGroup, UserView, NearbyDelta)
├── common/
│   └── UserDisplayResolver.java              #   [T1 신규] email→{nickname,imageUrl} 캐시 (AuthMapper 읽기)
├── presence/repository/PresenceRedisRepository.java   # [T3 수정] leave 시 nearby 정리 연결점
├── presence/scheduler/PresenceSweepScheduler.java     # [T3 수정] sweep 시 nearby 정리 연결
└── (소비: presence:user.musicId, listeners:*, PositionChanged, MusicLocationPort, CoordinateMapper)

backend/src/main/resources/redis/
└── presence-leave.lua                        # [T3 수정] nearby:meta 기준 nearby:subscribers 해제 추가
```

**Structure Decision**: 근처 사람은 자체 패키지 `nearby/`에 두고, presence 코어(-75 소유)는 T3에서 최소 확장만 한다. Redis 키 조립은 `NearbyRedisRepository`에만. `NeighborPort`로 BE2 의존을 인터페이스 뒤로 숨겨 스텁으로 개발한다. `NearbyController`는 REST(`/realtime/nearby`), 델타·close는 STOMP.

## 처리 흐름

### F1. `POST /realtime/nearby` — 스냅샷 (T1) + 구독 등록 (T2)

1. `NearbyController` — Bearer → Principal(email). body 없음.
2. `NearbyService.open(email)`:
   a. `presence:user:{email}.musicId`(앵커) 읽기 → 없으면 `PRESENCE_NO_ANCHOR`(422).
   b. `NeighborPort.neighbors(anchor, K)` → [anchor] + K곡. 지연·실패 → `SERVICE_UNAVAILABLE`(503).
   c. **[T2, 조건①] 구독 먼저** — `nearby:subscribers:{곡}` SADD ×(K+1) + `nearby:meta:{email}` 저장.
   d. 곡별 `listeners:{곡}` SMEMBERS(pipeline) → 자기 제외 → 0명 곡 제외.
   e. 곡 메타·좌표(`MusicLocationPort`) + 좌표 투영(`CoordinateMapper`, 현재 레이어) + `UserDisplayResolver`로 nickname/imageUrl.
   f. 공통 envelope `{anchorMusicId, groups}` 반환.
   > T1에서는 (c) 구독 등록을 뺀다(조회 전용). T2에서 (c)를 넣되 (d)보다 앞에 둔다.

### F2. 위치 변경 fanout — 델타 (T2)

`RealtimeEventBus` 구독 `NearbyDeltaService.onPositionChanged`:
- `S_old = SMEMBERS nearby:subscribers:{oldMusic}`, `S_new = ... {newMusic}`.
- `S_old − S_new` → LEAVE, `S_new − S_old` → ENTER, 교집합 → MOVE.
- 각 수신자 `/user/queue/presence`로 `NEARBY_*{nickname, imageUrl, fromMusicId?, toMusicId?, x?, y?}`.
- 변경 주체가 근처 패널을 열어둔 상태면 앵커 변경 → F1 재실행(FR-N13).
- 이탈은 old만 있는 PositionChanged로 통일.

### F3. `/app/nearby/close` (T2)

- `nearby:meta:{email}`의 곡 목록으로 `nearby:subscribers:*` SREM, `nearby:meta` DEL. 재계산 없음.

### F4. 이탈·만료 정리 (T3)

- `presence-leave.lua`: 기존 정리(listeners/cell/usercount/presence)에 더해, `nearby:meta:{email}`의 곡 목록으로 `nearby:subscribers:*` SREM + `nearby:meta` DEL 추가. epoch/score 방어는 기존 로직 유지.
- `PresenceSweepScheduler`: 만료 대상 leave 경로에서 위 정리가 함께 돌도록 연결.

## 보류 항목과 진행 조건

| 지금 착수 가능 | 확정 후 착수 |
| --- | --- |
| T1 전체(스텁으로) — 컨트롤러·NearbyService·NearbyRedisRepository(읽기)·UserDisplayResolver·NeighborStub | 이웃곡 실호출(B-3, BE2 어댑터 합의) — 스텁 교체만 |
| T2 전체 — 구독 쓰기·NearbyDeltaService·close·앵커변경 재발급 | FE2의 REST 전환(소켓 open→REST) 확인 |
| T3 전체 — presence-leave.lua·sweep 확장 | — (presence 코어 리뷰어 확인) |

## Complexity Tracking

| 항목 | 이유 | 대안을 택하지 않은 이유 |
| --- | --- | --- |
| 구독 인덱스(곡별) + 메타 | 정방향 조회로 KNN 재호출·역조회 제거, 저장 목록으로 해제 | 브로커 토픽 구독은 bounds·모드 강제 불가 |
| 구독 먼저→스냅샷(조건①) | REST 스냅샷과 WS 델타 사이 누락 방지 | 스냅샷 먼저면 그 사이 변동 유실, seq 조율로도 REST/WS 경계 애매 |
| T3 분리(presence Lua 수정) | -75 소유 영역이라 리뷰 성격이 다름 | T2에 합치면 단위가 커지고 리뷰어가 갈림 |
