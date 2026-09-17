# Research: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Spec**: [spec.md](spec.md) | **Date**: 2026-09-10 | **Phase**: 0

각 항목은 **Decision / Rationale / Alternatives** 형식. 근거는 저장소 실측(코드·설정·빌드 산출물)과 Notion 정본이다.
"결정"은 이 계획 안에서의 설계 선택이며, 정본·계약·경계에 걸리는 것은 R-xx 끝에 **[협의 필요: 상대]** 를 붙였다.

## R-01. 기존 realtime 스캐폴딩(2026-09-09)과 정본(2026-09-10)의 관계

**Decision**: 스캐폴딩의 `config/`·`common/`·`session/`(13파일)은 **재사용**, `presence/`·`nearby/`는 **정본 기준으로 재작성**, `reaction/`·`follow/`(29파일)은 **이번 범위 밖으로 격리**(삭제하지 않되 컴포넌트 스캔에서 제외하거나 그대로 두고 손대지 않음).

**Rationale**: 스캐폴딩은 09-07 설계개요(좌표를 클라이언트가 보내는 모델, heartbeat 25s/TTL 60s, 24h 중복 방지, 레이어 SET presence) 기준이다. 현재 정책은 "곡 = 위치", 15/45/5s, 3분 만남 쿨다운, 곡 청취자 Set + 셀 인덱스로 바뀌었다. 아래 표의 차이는 리팩터가 아니라 모델 교체 수준이다.

| 항목 | 스캐폴딩 (09-07 설계) | 정본 (09-10 Notion) |
| --- | --- | --- |
| 위치 원본 | 클라이언트가 `x, y` 전송 (`MoveRequest`) | 서버가 `music.location`으로 계산, 클라이언트 좌표 금지 |
| presence 인덱스 | `presence:layer:{layerId}` SET | 곡 청취자 Set + `active-song:cell:{layer}:{x}:{y}` + `cell:usercount:{layer}` |
| 하트비트/TTL/Sweep | 25s / 60s / 30s | 15s / 45s / 5s |
| 만남 | `encounter-dedup.lua` SETNX 24h | 같은 레이어·같은 곡, 동일 쌍 3분 쿨다운 |
| 사용자 노출 | `userId`(=email) 그대로 payload | `nickname` + `imageUrl`만, email 금지 |
| 델타 범위 | 레이어 토픽 브로드캐스트 | 셀/곡 구독 인덱스 정방향 조회 → 개인 큐 |
| 반응·따라가기 | 포함 | 이후 단계 |

재사용 가능한 것: `StompAuthChannelInterceptor`(JWT CONNECT 검증·Principal, 로그 금지 — 정본 RT-01과 정합), `WebSocketConfig`(`/ws`, `/app`, `/user`, SimpleBroker), `RealtimePublisher`/`SimpleBrokerPublisher`(발행 단일화 — 수평 확장 교체점), `RealtimeEnvelope`(`{type, seq, ts, payload}` — 정본 §2와 동일 형태), `RedisScriptConfig`(Lua 빈 등록 패턴), `WebSocketSessionRegistry`/`EventListener`(onClose 감지), `RealtimeMapperScanConfig`(오늘 추가, 기동 필수), `RealtimeAsyncConfig`.

**Alternatives**: (a) 스캐폴딩 전부 삭제 후 백지 — config·common의 검증된 부분까지 버림. (b) 스캐폴딩 모델에 정본을 끼워 맞춤 — "좌표를 클라이언트가 보낸다"는 전제가 정본의 보안 원칙(위치 조작 방지)과 정면충돌해 불가.

## R-02. 이웃곡 조회 경로 — HTTP 자기 호출 vs 인프로세스 포트

**Decision**: BE2가 소유한 기존 인터페이스 `com.ssafy.backend.music.detail.MusicDetailReader#findNeighbors(long id, int k)`를 **인프로세스로 호출**한다. REST `GET /music/neighbors`는 외부 노출·디버깅용으로 BE2가 만들되 BE3의 런타임 의존은 아니다. **[협의 필요: BE2]**

**Rationale**: BE2·BE3는 같은 Spring Boot 앱(`com.ssafy.backend`)이다. 정본은 `/music/neighbors`를 "내부 호출 (BE3 → BE2)"로 표기하지만 HTTP loopback은 직렬화·인증·타임아웃을 추가할 뿐 격리를 주지 않는다. `MusicDetailReader` 주석이 이미 "BE2가 계약 소유, BE4가 저장소·KNN 구현(헌법 X)"로 경계를 정의하고 있고, 계약(거리 오름차순·자기 제외·`location` NULL 제외·재생불가 곡 포함·부족분 있는 만큼)이 정본 `/music/neighbors`와 일치한다. 헌법 X "경계를 넘는 접근은 합의된 인터페이스" 충족.

**확인 사항**: `findNeighbors`의 `NeighborTrack` DTO에 `distance`가 있는지, 정본 응답의 `title/artist/x/y`를 BE3가 별도 조회해야 하는지(→ 곡 메타 조회 포트 필요, R-03). 현재 `MusicDetailReader`는 인터페이스만 있고 어댑터가 없다(B-D "BE4 저장소·KNN 확정 후").

**Alternatives**: (a) `RestClient`로 `/music/neighbors` 호출 — 같은 프로세스에 HTTP를 도는 비용과 서킷브레이커 부담만 추가. (b) BE3가 pgvector 쿼리를 직접 작성 — BE2·BE4 경계 침범(헌법 X 위반).

## R-03. 곡 좌표·메타 조회 — BE3가 `music` 테이블을 직접 읽는가

**Decision**: `music.location`(PC1~16)과 `title/artist`는 BE2가 소유하는 조회 포트로 읽는다. 기존 `MusicDetailReader.findDetail(id)`가 `MusicDetail`(= MusicSummary + 메타)을 돌려주므로 이를 쓰되, 실시간 경로에서 매 요청 상세 전체를 읽는 것은 과하다 — `MusicLocationReader#findLocation(long id): Optional<double[16]>` 수준의 **경량 포트 추가를 BE2에 요청**한다. **[협의 필요: BE2]**

**Rationale**: `/music/play`마다 곡 좌표 1건 조회가 필수(FR-010)이고, 근처 스냅샷은 K+1곡의 title/artist/좌표가 필요하다. 실시간 경로의 DB 왕복은 최소화해야 하며(RT-02 "DB 쓰기는 브로드캐스트 경로 밖"), 좌표는 불변이므로 **프로세스 내 캐시**(Caffeine 또는 `ConcurrentHashMap` + 크기 상한) 대상이다. 캐시 키는 `(musicId)`이고 데이터셋 버전 승격 시 플러시(FR-078과 같은 정책).

**Alternatives**: BE3가 `music` 테이블 MyBatis 매퍼를 직접 작성 — 헌법 X 위반, BE2 리뷰 축과 충돌.

## R-04. 원자 갱신 단위 — Lua 스크립트 3종

**Decision**: 정본 RT-02·RT-05·RT-23이 요구하는 원자 단위를 Lua 3종으로 고정한다.

| 스크립트 | KEYS | 동작 | 반환 |
| --- | --- | --- | --- |
| `presence-play.lua` | listeners:{old}, listeners:{new}, active-song:cell:{L}:{oldX}:{oldY}, active-song:cell:{L}:{newX}:{newY}, cell:usercount:{L}, presence:user:{email} | ① presence.playingMusicId == old 검증(불일치 → -1) ② SREM old / 마지막이면 cell에서 곡 제거 / usercount −1(0이면 HDEL) ③ SADD new / 첫이면 cell에 곡 추가 / usercount +1 ④ presence HSET(musicId, layer, x, y, cellX, cellY) | 진입 직전 new 청취자 목록(만남 판정용) |
| `presence-leave.lua` | presence:user:{email}, cell:usercount:{L} | ① presence에서 **스크립트 안에서** playingMusicId·셀 읽기 ② listeners SREM / 마지막이면 cell 제거 / usercount −1 ③ presence·lease·expiry DEL | 제거된 musicId·셀 (LEAVE 델타용) |
| `usercount-recount.lua` | cell:usercount:{L}, active-song:cell:{L}:* (SCAN은 밖에서) | 셀별 곡 목록 → 곡별 SCARD 합 → 기존 값과 비교 → 덮어쓰기 | 불일치 셀 수 |

좌표·셀 계산(부동소수)은 **Lua 밖**에서 미리 하고 정수·문자열만 전달한다(RT-02 "Lua 안에 부동소수 계산 금지").

**Rationale**: 기존 `RedisScriptConfig` 패턴(`DefaultRedisScript<Long>` 빈)을 그대로 쓴다. 반환값이 목록인 스크립트는 `DefaultRedisScript<List>`로 타입만 바꾼다.

**Redis Cluster 제약**: 세 스크립트 모두 KEYS가 서로 다른 슬롯이다(곡·레이어·사용자). 단일 Redis에서는 문제없고, Cluster 전환 시 hash tag(`{L}`)로 레이어 단위 묶기 또는 스크립트 분해가 필요하다. 기존 스캐폴딩 `presence-move.lua`도 같은 제약이 있었다. 이번 범위는 단일 Redis(R-09).

**Alternatives**: MULTI/EXEC — "마지막 청취자면 셀에서 곡 제거"가 SCARD 결과에 의존하는 조건 분기라 트랜잭션으로는 불가, WATCH 재시도 루프는 인기 곡에서 실패율이 치솟는다.

## R-05. 구독 인덱스와 델타 fanout — 정방향 조회 2번

**Decision**: 정본 RT-11·RT-22대로 "보고 있는 대상"에 구독 인덱스를 걸고, 변경 이벤트에서 `S_old`·`S_new`(또는 `V_old`·`V_new`) 두 Set을 읽어 차집합·교집합으로 ENTER/LEAVE/MOVE 수신자를 나눈다. 수신자별 발송 직전에 뷰포트 사각형·누적 bounds를 **서버 메모리의 사용자 뷰포트 상태**(Redis `viewport:meta:{email}`)로 검사한다.

| 인덱스 | 키 | 멤버 | 등록 시점 | 해제 시점 |
| --- | --- | --- | --- | --- |
| 뷰포트 셀 구독 | `viewport:cell:{layer}:{cellX}:{cellY}` (Set) | 보는 사람 email | viewport 수신, INDIVIDUAL 판정 시 | 다음 viewport 수신(저장된 cellKeys로), CLUSTERED 전환, leave/expiry |
| 근처 곡 구독 | `nearby:subscribers:{musicId}` (Set) | 보는 사람 email | nearby/open, 앵커 변경 | nearby/close(저장된 곡 목록으로), leave/expiry |
| 구독 메타 | `viewport:meta:{email}` (Hash: layer, minX..maxY, bounds JSON, cellKeys JSON, mode) / `nearby:meta:{email}` (Hash: anchor, musicIds JSON) | — | 각 등록 시 | 각 해제 시 |

**Rationale**: KNN 재호출·역조회를 없애는 것이 정본의 핵심 결정이고, "저장해둔 목록으로 해제"가 누수 방지의 핵심이다. 구독 메타를 Redis에 두는 이유는 R-09(다중 인스턴스)에서 이벤트를 받은 인스턴스가 수신자의 뷰포트를 알아야 하기 때문이다.

**Alternatives**: SimpleBroker 토픽(`/topic/cell/{...}`) 구독을 클라이언트가 직접 — 구독 인가·bounds 검사·모드 전환을 서버가 강제할 수 없고, CLUSTERED에서 델타를 끊는 정책을 클라이언트에 맡기게 된다. 기각.

## R-06. 뭉침 모드 병합 — 격자 해상도 반감

**Decision**: `cell:usercount:{layer}` Hash(field `"x:y"`, ≤256)를 `HGETALL` 한 번으로 읽고, 뷰포트 셀 범위로 자른 뒤 마커 수 > 64면 `x >> 1, y >> 1`로 접어 합산(16→8→4)을 반복한다. 응답 `cells[{cellX, cellY, count}]`의 셀 좌표는 **접힌 해상도 기준**이며 `resolution` 필드(16/8/4)를 함께 내린다. **[협의 필요: FE — payload에 `resolution` 추가]**

**Rationale**: 정수 시프트 한 번, 마커가 갱신마다 튀지 않음, Hash를 그대로 접어 쓸 수 있음(RT-21). FE가 접힌 셀을 화면 좌표로 되돌리려면 해상도를 알아야 하는데 정본 payload에 없다 — 필드 1개 추가 제안.

**Alternatives**: k-means 등 임의 모양 클러스터링 — 갱신마다 클러스터 중심이 튀고 Hash 재사용 불가. 기각(정본도 명시 기각).

## R-07. `seq` 발급 범위와 스냅샷·델타 순서

**Decision**: `seq`는 **세션(연결) 단위** 단조 증가 카운터로, 서버가 그 세션에 프레임을 보낼 때마다 +1 한다. 스냅샷과 델타가 같은 수열을 공유하므로 "스냅샷 seq 이하 델타 폐기"가 성립한다. 발급은 `RealtimePublisher.publishToUser` 진입점 한 곳에서 한다(`WebSocketSessionRegistry`에 세션별 `AtomicLong`).

**Rationale**: 정본 §2는 seq의 범위를 말하지 않고 목적("팬·줌 중 이전 뷰포트 델타 폐기")만 말한다. 방·레이어 단위 seq(기존 스캐폴딩 `follow:room:*:seq` 방식)는 여러 출처(셀 델타·근처 델타·스냅샷)가 한 세션에 섞이는 이 구조에서 비교가 불가능하다.

**다중 인스턴스 영향**: 세션 단위 카운터는 그 세션이 붙은 인스턴스에만 있으면 되므로 R-09와 충돌하지 않는다.

**Alternatives**: 뷰포트 요청에 클라이언트 `requestId`를 실어 스냅샷에 echo — 정본 봉투에 없는 필드 추가. seq로 충분.

## R-08. 하트비트·TTL·Sweep의 자료구조

**Decision**: `presence:user:{email}` Hash에 TTL을 걸지 **않고**, 만료 시각을 `presence:expiry` ZSET(score = expiresAt epoch ms, member = email)에 둔다. 하트비트는 `ZADD XX`로 score만 갱신. Sweep(5s)은 `ZRANGEBYSCORE presence:expiry -inf now`로 만료 대상을 뽑아 `presence-leave.lua`를 사용자별로 실행한다.

**Rationale**: 정본 RT-05가 `expiresAt`·`presence:expiry`를 명시한다. 키 TTL 방식(스캐폴딩 `redis.expire`)은 만료 순간을 서버가 관측하지 못해 청취자 Set·셀 인덱스·구독 인덱스가 **유령으로 남는다** — 정본이 "이 기능의 대표적 누수 지점"으로 지목한 바로 그 문제다. ZSET이면 Sweep이 만료 대상을 알고 6종 자료구조를 전부 정리할 수 있다. 정본이 요구하는 `sessionEpoch` 비교도 presence Hash 필드로 가능.

**Alternatives**: keyspace notification(`Ex`) — 알림 유실 시 복구 경로가 없고 Redis 설정 의존. 보장 경로로 Sweep이 어차피 필요하므로 ZSET 단일 경로가 단순.

## R-09. 수평 확장 — 이번 범위와 이음새

**Decision**: 이번 구현은 **단일 인스턴스**를 전제하되, (a) 모든 발행은 `RealtimePublisher` 경유, (b) 구독 인덱스·구독 메타·presence는 전부 Redis(인스턴스 로컬 상태는 `WebSocketSessionRegistry`의 세션↔email 매핑과 seq 카운터만), (c) 변경 이벤트를 `RealtimeEventBus` 인터페이스로 추상화해 현재 구현은 인프로세스 직접 호출, 다중화 시 Redis Pub/Sub 구현체로 교체 — 세 이음새를 남긴다. Jira -74 설명의 "Redis Pub/Sub 기반 WS 서버 다중화"는 **후속 이슈로 분리 제안**. **[협의 필요: BE4/Infra — 배포 인스턴스 수]**

**Rationale**: 정본(Notion)은 다중화를 언급하지 않는다. 6주 일정에서 fanout 경로에 Pub/Sub 홉을 넣으면 SC-001(1초) 검증 변수가 늘어난다. 단일 인스턴스에서 정합성을 먼저 검증하고, 인스턴스 수 결정 후 교체한다. `SimpMessagingTemplate.convertAndSendToUser`는 다른 인스턴스에 붙은 세션에 닿지 않으므로, 다중화 시 "수신자 email → 담당 인스턴스" 라우팅이 필수다 — 그때 `WebSocketSessionRegistry`를 Redis로 옮긴다.

**Alternatives**: 처음부터 Redis Pub/Sub — 인스턴스가 1대인 동안은 순수 오버헤드이고 테스트 복잡도만 오른다.

## R-10. 만남 집계 — 비동기 경로와 DB 부하

**Decision**: `presence-play.lua`가 돌려준 같은 레이어·같은 곡의 청취자 목록을 별도 `@Async` 서비스에 넘긴다. email 사전순으로 쌍을 만든 뒤 `meeting-cd:{user1}:{user2}` Redis 키를 180초 TTL로 `SET NX`하고, 새 키가 만들어진 쌍만 `meeting`을 +1 한다.

**Rationale**: 정본 RT-50 "인기 곡 진입 시 기존 청취자 수만큼 한꺼번에", "브로드캐스트 경로 밖 비동기 필수". 기존 스캐폴딩 `ReactionService.recordAsync`가 self-invocation으로 `@Async`가 안 타는 문제가 있었으므로 **별도 빈**으로 둔다. `meeting(user1, user2)`에 UNIQUE가 있어야 ON CONFLICT가 성립 — ERD 확인 항목(B-2).

**Alternatives**: 레이어를 무시하거나 재진입마다 모두 증가시키는 방식은 실제 화면에서 짧은 재접속·곡 전환으로 횟수가 부풀어 제외했다.

## R-11. 에러 코드 — `PRESENCE_ERROR`의 자리

**Decision**: WS 프레임 `PRESENCE_ERROR{code, message}`의 `code`에는 세부 사유(`PRESENCE_NO_ANCHOR`, `PRESENCE_LOCATION_NULL`, `PRESENCE_LAYER_INVALID`, `PRESENCE_VIEWPORT_INVALID`)를 싣고, REST `/music/play`의 `location` NULL은 공통 `ErrorCode` 구현 `RealtimeErrorCode.PRESENCE_ERROR(422)`로 `ApiResponse.fail`에 태운다. 기존 `MusicErrorCode.MUSIC_NOT_FOUND`(404)·`GlobalErrorCode.VALIDATION_ERROR`(400)·`FORBIDDEN`(403)은 재사용. **[협의 필요: BE1 — 정본 §0.5 에러표에 `PRESENCE_ERROR` 추가]**

**Rationale**: 정본 §0.5 에러표에 `PRESENCE_ERROR`가 없다(RT-xx 본문에만 등장). 기존 코드베이스는 도메인별 `XxxErrorCode implements ErrorCode` 패턴(`MusicErrorCode`)이므로 같은 패턴을 따른다. 스캐폴딩의 `IllegalArgumentException("REALTIME_...")` 문자열 방식은 폐기.

## R-12. 테스트 전략 — Testcontainers 부재

**Decision**: 세 층으로 나눈다. ① 순수 단위: 정규화·셀 계산(`floor`·클램프·음수), 차집합 fanout 판정, 격자 반감 병합, 뷰포트 사각형·bounds 검사 — 프레임워크 불필요. ② Lua 스크립트: 로컬 Redis(`infra/local/docker-compose.yml`) 대상 통합 테스트, `@Testcontainers` 대신 `@EnabledIf(redis 접속 가능)` 조건부 실행으로 시작. ③ STOMP E2E: `WebSocketStompClient`로 2세션 시나리오(A20·A25·A40·A42) — 로컬 Redis 필요. Testcontainers 의존성 추가는 BE1 `build.gradle` 소유라 **[협의 필요: BE1]**.

**Rationale**: `build.gradle`에 Testcontainers가 없고(스캐폴딩 기록 #4), `BackendApplicationTests.contextLoads`가 오늘 07:05 실패했으나 `RealtimeMapperScanConfig` 추가로 해소 예정 — 재실행이 첫 검증이다. 기존 MVC 슬라이스 테스트(`MusicControllerTests`)가 `SecurityConfig`·`JwtAuthenticationFilter` 제외 + 매퍼 mock 패턴을 쓰므로 `/music/play` 컨트롤러 슬라이스도 같은 패턴.

## R-13. 로그인 직후 위치 복원 (Q1 — 2026-09-10 확정)

**Decision**: `/app/presence/join {requestSeq, layer, musicId}`는 **배치·복원**이다. 첫 join은 요청 곡을 사용하고, 이후 join은 서버 presence의 현재 곡으로 레이어만 옮긴다. 성공 ACK 뒤 `POST /music/play`를 호출할 때만 새 곡으로 이동한다.

**Rationale**: RT-01 "정지 상태지만 위치는 마지막 곡에 노출"과 RT-50 "POST /play로 진입하는 순간"이 동시에 성립한다. join과 play를 구분하는 기준은 "재생했는가" 하나다.

**방어**: 현재 소켓 epoch와 Redis의 현재 곡을 함께 비교한다. 이전 소켓이나 위치 조회 뒤 곡이 바뀐 요청은 `PRESENCE_STALE`로 거부한다.

## 보류 항목 (Blocked — 착수 금지, 표시만)

| ID | 미결정 / 필요한 확인 | 상대 | 막히는 구간 |
| --- | --- | --- | --- |
| B-1 | ~~Q1~Q3와 join 곡 선택·ACK 순서 확정~~ | FE2 | 프론트가 `PRESENCE_JOINED` 뒤 viewport·play를 호출하도록 반영 필요 |
| B-2 | ERD 실물: `play_history`(컬럼·PK·email FK), `meeting(user1, user2, cnt)` UNIQUE 유무, `"user".is_public` | BE1 | MyBatis XML, ON CONFLICT 절 |
| B-3 | `MusicDetailReader.findNeighbors` 어댑터 구현 시점, `NeighborTrack.distance` 유무, 경량 좌표 포트(R-03) | BE2·BE4 | 근처 스냅샷(US3), `/music/play` 좌표 계산(US1) |
| B-4 | 레이어별 표시 축 배정 확정 + 축별 전역 min/max 초기값 | BE2·BE4 | 셀 계산 전부 — 임의값으로 개발은 가능, 실측 전 시연 불가 |
| B-5 | viewport payload 최종 필드(`bounds` 구조, `resolution` 추가) | FE1 | `contracts/websocket/` 확정 |
| B-6 | Testcontainers 의존성, `RealtimeErrorCode` 배치, `/api` 프리픽스 정리 | BE1 | 통합 테스트, 에러 응답 |
| B-7 | 배포 인스턴스 수 → 다중화 착수 여부 | Infra·BE4 | `RealtimeEventBus` 구현체 |

B-4는 **개발을 막지 않는다** — `application-realtime.yml`에 임의 상수를 두고 진행하되, "실측 전 값"임을 설정 주석과 지표(정규화 좌표가 0 또는 1에 클램프된 비율)로 드러낸다.
