# Feature Specification: 근처 사람 보기 (Nearby People)

**Feature Branch**: `backend/feat/S15P21A405-309-nearby-snapshot`

**Feature Directory**: `specs/jiwon-002-nearby-people`

**Created**: 2026-09-14

**Status**: Draft — `jiwon-001-realtime-presence-nearby`(옛 004)에서 근처 사람(RT-10·11)만 뽑아 재정리. **REST 이관 반영본**: 스냅샷+구독을 소켓 `/app/nearby/open`에서 REST `POST /realtime/nearby`로 이관(2026-09-14 확정). 델타·닫기는 소켓 유지.

**Jira**: [S15P21A405-309 근처 사람 T1 스냅샷 조회](https://ssafy.atlassian.net/browse/S15P21A405-309) · [S15P21A405-310 T2 구독+델타+닫기](https://ssafy.atlassian.net/browse/S15P21A405-310) · [S15P21A405-311 T3 이탈 정리](https://ssafy.atlassian.net/browse/S15P21A405-311) (담당 BE3 박지원 · 라벨 be-realtime)

**Input**: 기능명세(Back) RT-10(근처 사람 스냅샷)·RT-11(근처 사람 델타), API 명세 `/realtime/nearby`(계약 정본), 📡 실시간 (Presence · Nearby) API 명세(WS 델타·좌표 규약 정본), `jiwon-001` FR-070~078.

**정본 관계**: Notion이 정본, 이 문서는 저장소 스냅샷. 계약(무엇을 보장하나)의 정본은 `/realtime/nearby` API 페이지, 알고리즘·근거의 정본은 기능명세 RT-10/RT-11.

## 이전 스펙(jiwon-001)과의 관계

| jiwon-001 (통합) | 이 스펙 (분리) | 변경 |
| --- | --- | --- |
| US3 근처 사람 · FR-070~078 | 전부 | 스냅샷+구독 진입점을 WS `nearby/open` → REST `POST /realtime/nearby`로 이관 |
| A40~A45 | US1~US3로 재편 | T1(조회)/T2(델타)/T3(정리) 3단위로 분할 |
| 근처+뷰포트+만남+presence 한 덩어리 | 근처만 | 뷰포트·만남·presence는 이 스펙 범위 밖(의존으로만 소비) |

## Clarifications

### Session 2026-09-14

- Q: nearby 스냅샷을 WS로 줄지 REST로 줄지 → A: **REST `POST /realtime/nearby`로 이관.** 버튼 한 번에 목록(REST) + 이후 갱신은 소켓 델타만. 기존 WS `/app/nearby/open`은 **제거**(FE2 전환 필요).
- Q: 근처 사람 목록의 대상은 레이어를 따지나 → A: **레이어 무관 전역.** 근처 = 전역 `listeners:{musicId}`. (만남 판정이 `layer-listeners`로 레이어를 따지는 것과 다르다 — 두 개념은 별개다.)
- Q: 이웃곡 조회(BE2)가 지연·실패하면 → A: **503 `SERVICE_UNAVAILABLE`** — 빈 목록으로 숨기지 않는다(고장과 "아무도 없음"을 구분).
- Q: 패널 닫기 방식 → A: **소켓 `/app/nearby/close`.**
- Q: 소켓 미연결 상태에서 REST open을 부르면 → A: **유연** — 구독은 등록하되 델타는 유실 허용(resync로 복구), open 자체는 거부하지 않는다.

### 구현 정합성 조건 (Redis 실측 기반, 2026-09-14)

- **① 구독 순서**: 델타 구독 등록을 청취자 스냅샷 읽기보다 **먼저** 한다. 순서가 반대면 그 사이 변동이 스냅샷에도 델타에도 안 잡혀 누락된다. 구독 먼저면 최악의 경우 중복 델타뿐이며(클라 idempotent 처리) 누락은 없다.
- **② 구독 정리**: 구독(`nearby:subscribers`·`nearby:meta`)은 `presence-leave.lua`·sweep 만료 경로에서 `nearby:meta` 기준으로 함께 해제한다(REST open은 stateless라 orphan 방지).
- **③ 구조 불변**: 앵커는 `presence:user:{email}.musicId`에서 읽고(정지면 필드 없음→422), `listeners:{musicId}`는 join/play/leave가 이미 유지한다 — REST 이관이 Redis 구조를 바꾸지 않는다(실측 확인).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 근처 사람 목록을 한 번 본다 (Priority: P1) — T1 / S15P21A405-309

"주변 사람 보기" 버튼을 누르면 내가 듣는 곡과 소리가 가까운 곡 K개(앵커곡 포함)를 듣고 있는 사람들이 곡별로 묶여 한 번 나타난다. (아직 실시간 갱신은 없다.)

**Why this priority**: 이것만으로 "근처에 누가 있나"를 보여줄 수 있다. 구독·델타 없이 독립적으로 완결·데모 가능하며, 이후 실시간 갱신(US2)의 토대가 된다.

**Independent Test**: A가 곡 X를, C가 X의 이웃곡 Y를 재생한 상태에서 A가 `POST /realtime/nearby`를 호출하면 응답에 Y 그룹 아래 C가 나온다. 이웃곡 조회는 `realtime-dev` 스텁으로 고정 결과를 준다. 두 세션으로 완결.

**Acceptance Scenarios**:

1. **N1** **Given** A가 재생 중(앵커곡 X), **When** `POST /realtime/nearby`, **Then** 200 공통 envelope 안에 `{anchorMusicId, groups[{musicId, title, artist, x, y, distance, users[{nickname, imageUrl}]}]}`를 받는다. 앵커곡 그룹(`distance:0`)도 포함되고, 자기 자신은 `users`에서 제외되며, 청취자 0명 곡은 그룹째 생략된다. (FR-N01, FR-N02)
2. **N2** **Given** A가 재생 선언 전(`musicId` 없음), **When** `POST /realtime/nearby`, **Then** 422 `PRESENCE_NO_ANCHOR`. (FR-N03)
3. **N3** **Given** 이웃곡·앵커곡에 청취자가 전부 0명, **When** 호출, **Then** 200 · `groups: []`(빈 배열이 정상). (FR-N02)
4. **N4** **Given** 이웃곡 조회(BE2 `findNeighbors`) 지연·실패, **When** 호출, **Then** 503 `SERVICE_UNAVAILABLE` — 빈 목록으로 숨기지 않는다. (FR-N04)
5. **N5** **Given** 같은 `(musicId, k)`, **When** 이웃곡을 두 번 조회, **Then** 결과가 동일하다(불변) — 캐시 가능. (FR-N05)
6. **N6** **Given** `x, y` 좌표, **When** 스냅샷 조립, **Then** 요청자의 현재 레이어 표시축 기준 정규화 좌표(0~1)이며 `distance`는 원시 pc 거리다. 근처 대상 선정은 레이어를 따지지 않는다(전역). (FR-N06)

---

### User Story 2 - 근처 목록이 실시간으로 갱신된다 (Priority: P1) — T2 / S15P21A405-310

패널이 열려 있는 동안, 이웃곡의 청취자가 들어오거나 나가거나 이동하면 목록이 실시간으로 반영된다. 패널을 닫으면 갱신이 멈춘다.

**Why this priority**: US1(정지 목록)을 "살아있는 목록"으로 만든다. 이것이 근처 사람 기능의 실질적 가치다.

**Independent Test**: A가 패널을 연 상태에서(REST open) C가 이웃곡 Y로 곡을 바꾸면 A에게 `NEARBY_ENTER`가 온다. C가 비이웃 곡 Z로 이동하면 `NEARBY_LEAVE`가 온다. 두 세션 + 로컬 Redis로 완결.

**Acceptance Scenarios**:

1. **N10** **Given** A가 `POST /realtime/nearby`로 패널을 엶, **When** 처리, **Then** 앵커곡 + 이웃곡 K개의 구독 인덱스에 A가 등록되고 구독한 곡 목록이 저장된다. **구독 등록은 청취자 스냅샷 읽기보다 먼저** 수행된다(조건①). (FR-N10)
2. **N11** **Given** A의 패널이 열려 있고 K곡 구독 등록됨, **When** C가 이웃곡 Y → 다른 이웃곡 Y'로 이동, **Then** A는 `NEARBY_MOVE`; Y → 비이웃 Z면 `NEARBY_LEAVE`; Z → Y면 `NEARBY_ENTER`. 구곡/신곡 구독자 정방향 조회 2번으로 수신자를 찾으며 KNN 재호출·역조회를 하지 않는다. (FR-N11, FR-N12)
3. **N12** **Given** A의 앵커곡이 바뀜(A가 다른 곡 재생), **When** 변경, **Then** 구독이 재구성되고 스냅샷이 재발급된다. (FR-N13)
4. **N13** **Given** `/app/nearby/close`, **When** 수신, **Then** 저장해둔 구독 곡 목록으로 해제하고 재계산하지 않는다. 이후 델타가 오지 않는다. (FR-N14)
5. **N14** **Given** 스냅샷과 델타의 순서 경계, **When** 델타가 늦게 도착, **Then** 스냅샷 시점 이하의 델타는 클라이언트가 버릴 수 있어야 한다(seq 봉투). 구독을 먼저 등록했으므로 스냅샷과 델타 사이 누락은 없다. (FR-N15, 조건①)
6. **N15** **Given** 소켓 미연결 상태에서 REST open 호출, **When** 처리, **Then** 구독은 등록되되 델타는 유실될 수 있고(open 거부 안 함), resync로 복구한다. (FR-N16)

---

### User Story 3 - 나가면 구독이 새지 않는다 (Priority: P1) — T3 / S15P21A405-311

사용자가 나가거나 하트비트가 끊겨 만료되면, 그 사람이 걸어둔 근처 구독이 남지 않고 정리된다.

**Why this priority**: REST open은 stateless라 구독이 orphan 날 수 있다. 정리가 없으면 유령 델타가 계속 발송되고 인덱스가 샌다.

**Independent Test**: A가 패널을 연 뒤 leave 또는 TTL 만료 → Sweep이 돌면, A가 걸어둔 `nearby:subscribers` 항목이 전부 사라진다. 이후 다른 사용자의 곡 변경이 A에게 발송되지 않는다.

**Acceptance Scenarios**:

1. **N20** **Given** A가 근처 구독 중, **When** `/app/presence/leave` 또는 onClose, **Then** `nearby:meta:{A}`의 곡 목록으로 `nearby:subscribers:*`에서 A가 제거되고 `nearby:meta:{A}`가 삭제된다. 빈 Set이 남지 않는다. (FR-N20)
2. **N21** **Given** A가 하트비트를 보내지 않아 TTL 만료, **When** Sweep이 돌면, **Then** N20과 같은 정리가 일어난다. (FR-N21)
3. **N22** **Given** 정리 직후, **When** 다른 사용자가 A의 옛 구독 곡을 재생, **Then** A에게 델타가 발송되지 않는다(유령 델타 0). (FR-N22)
4. **N23** **Given** 재접속(A의 새 CONNECT)이 만료 정리와 경쟁, **When** 두 경로가 겹침, **Then** 새 세션의 구독을 지우지 않는다(epoch/score 방어와 정합). (FR-N23)

### Edge Cases

- 앵커곡이 없으면(재생 선언 전)? → 422 `PRESENCE_NO_ANCHOR`. 빈 배열이 아니라 에러(N2).
- 이웃곡 K개 중 청취자가 한 명도 없으면? → 빈 `groups`가 정상(N3). 동접이 적으면 비는 것이 자연스럽다.
- REST open을 소켓 없이 부르면? → 구독만 등록, 델타 유실 허용, resync로 복구(N15). open은 거부하지 않는다.
- BE2 이웃곡 어댑터가 아직 없으면(B-3)? → `realtime-dev` 스텁으로 200 정상 응답. 운영 어댑터는 합의 후 교체.
- 인기 곡에 구독자가 수천 명이면? → 델타 fanout이 커진다. 곡별 표시 인원 상한은 이번 범위에서 값을 정하지 않는다(Assumptions).
- 스냅샷(REST)과 델타(WS)의 순서? → 구독을 먼저 등록(조건①)하므로 누락 없음. 중복 델타는 클라가 idempotent 처리.

## Requirements *(mandatory)*

### Functional Requirements

**T1 — 스냅샷 조회 (RT-10)**

- **FR-N01**: `POST /realtime/nearby`(body 없음, Bearer 인증, 본인은 토큰 subject)는 presence의 `musicId`를 앵커로 삼아 이웃곡 K개(기본 10)를 조회하고, 앵커곡 + 이웃곡 각각의 청취자를 곡별 그룹 `{musicId, title, artist, x, y, distance, users[{nickname, imageUrl}]}`로 공통 envelope `data.{anchorMusicId, groups[]}`에 담아 반환해야 한다.
- **FR-N02**: 앵커곡 자신도 그룹에 포함(`distance:0`)하고, 자기 자신은 `users`에서 제외하며, 청취자 0명 곡은 그룹째 생략해야 한다(빈 `groups`는 정상). 곡별 Set을 따로 읽고 `SUNION`으로 합치지 않는다.
- **FR-N03**: 앵커곡이 없으면(`musicId` 없음) 422 `PRESENCE_NO_ANCHOR`로 거부해야 한다.
- **FR-N04**: 이웃곡 조회(BE2)가 지연·실패하면 503 `SERVICE_UNAVAILABLE`로 응답해야 하며, 빈 목록으로 숨기지 않아야 한다.
- **FR-N05**: 이웃곡 조회 `findNeighbors(musicId, k)`는 `distance` 오름차순, 기준 곡 제외, `location` NULL 곡 제외, 원시 pc값 거리여야 하며, 같은 `(musicId, k)`는 항상 같은 결과(불변)여야 한다 — 응답 캐시 가능. B-3 미해소 동안 `realtime-dev` 스텁으로 대체한다.
- **FR-N06**: 근처 대상 선정은 **레이어 무관 전역**(`listeners:{musicId}`)이어야 한다. 응답 좌표 `x, y`는 요청자의 현재 레이어 표시축 기준 정규화 좌표(0~1), `distance`는 원시 pc 거리다. 정규화·셀 변환은 서버만 한다.

**T2 — 구독 + 델타 + 닫기 (RT-11)**

- **FR-N10**: 스냅샷 응답과 함께 앵커곡 + 이웃곡 K개의 구독 인덱스(`nearby:subscribers:{musicId}`)에 요청자를 등록하고 구독한 곡 목록(`nearby:meta:{email}`)을 저장해야 한다. **구독 등록은 청취자 조회(FR-N01)보다 먼저** 수행해야 한다(조건① — 누락 방지).
- **FR-N11**: 다른 사용자의 곡 변경·이탈 시 구곡 구독자 `S_old`, 신곡 구독자 `S_new`를 조회해 `S_old − S_new` LEAVE, `S_new − S_old` ENTER, 교집합 MOVE로 `NEARBY_ENTER/MOVE/LEAVE`를 개인 큐(`/user/queue/presence`)로 발송해야 한다. payload는 `{nickname, imageUrl, fromMusicId?, toMusicId?, x?, y?}`.
- **FR-N12**: 델타 산출에 KNN 재호출과 역조회를 쓰지 않아야 한다(곡 단위 구독 인덱스 정방향 조회 2번).
- **FR-N13**: 요청자의 앵커곡이 바뀌면 구독을 재구성하고 스냅샷을 재발급해야 한다.
- **FR-N14**: `/app/nearby/close` 수신 시 저장해둔 구독 곡 목록으로 해제해야 하며 재계산하지 않는다.
- **FR-N15**: 델타는 `{type, seq, ts, payload}` 봉투를 쓰고 스냅샷 시점 이하의 델타는 클라이언트가 버릴 수 있어야 한다. 구독을 먼저 등록했으므로 스냅샷–델타 사이 누락은 없어야 한다.
- **FR-N16**: 소켓 미연결 상태의 REST open은 거부하지 않아야 하며, 구독만 등록하고 델타 유실은 resync로 복구한다.

**T3 — 이탈·만료 시 구독 정리 (조건②)**

- **FR-N20**: `/app/presence/leave` 또는 onClose 시 `nearby:meta:{email}`의 곡 목록으로 `nearby:subscribers:*`에서 제거하고 `nearby:meta`를 삭제해야 하며, 빈 Set을 남기지 않아야 한다.
- **FR-N21**: TTL 만료 → Sweep 정리 경로에서도 FR-N20과 같은 정리가 일어나야 한다.
- **FR-N22**: 정리 이후 그 사용자에게 유령 델타가 발송되지 않아야 한다.
- **FR-N23**: 재접속(새 세션)이 만료 정리와 경쟁할 때 새 세션의 구독을 지우지 않아야 한다(epoch/score 방어와 정합).

### Key Entities

- **근처 구독 (Nearby Subscription)**: "누가 어느 곡(앵커 + 이웃 K)의 청취자 변동을 듣고 있는가". `nearby:subscribers:{musicId}`(곡별 구독자 Set) + `nearby:meta:{email}`(구독한 곡 목록). REST open이 등록, close·leave·sweep가 해제.
- **곡 청취자 집합 (Listeners)**: `listeners:{musicId}` 전역 Set — 근처 사람 조립의 유일한 원본. join/play/leave가 유지(이 스펙 범위 밖, 소비만).
- **앵커 (Anchor)**: `presence:user:{email}.musicId` — 요청자의 현재 재생곡. 없으면 비노출(422).
- **이웃곡 (Neighbors)**: `findNeighbors(musicId, k)`가 주는 거리순 K곡. 불변·캐시 가능. BE2 소유(B-3).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-N01**: 재생 중인 사용자가 주변사람 버튼을 누르면 근처 사람 목록을 1초 이내에 받는다(스텁 기준).
- **SC-N02**: 이웃곡의 청취자가 곡을 바꾼 뒤 1초 이내에 열린 패널에 ENTER/MOVE/LEAVE가 반영된다.
- **SC-N03**: 소켓 payload·로그·지표에서 email이 관측되는 건수가 0이다(사용자 표현은 nickname·imageUrl만).
- **SC-N04**: 이탈·만료 정리 이후 그 사용자에 대한 `nearby:subscribers`·`nearby:meta` 잔여가 0건이고, 유령 델타가 0건이다.
- **SC-N05**: 같은 `(musicId, k)` 이웃곡 조회 결과가 데이터셋 버전 내에서 100% 동일하다.
- **SC-N06**: 청취자 0명 곡이 스냅샷 `groups`에 포함되는 건수가 0이다.

## Assumptions

- **범위**: 이 스펙은 **근처 사람(RT-10·11)만** 다룬다. 뷰포트(RT-20~23)·만남(RT-50)·presence 코어(RT-01·02·05)는 범위 밖이며 완성된 자산으로 소비만 한다.
- **의존(완성)**: `presence:user.musicId`(앵커), `listeners:{musicId}`(전역 청취자), `PositionChanged` 이벤트 버스, `MusicLocationPort`(곡 좌표·메타), `CoordinateMapper`(좌표 투영)가 이미 존재한다(jiwon-001 / -75 / -272에서 구현).
- **이웃곡 조회 방식**: 같은 Spring Boot 앱 안의 BE2 인터페이스(`MusicDetailReader.findNeighbors(id, k)`)를 인프로세스 포트(`NeighborPort`)로 호출한다. B-3 미해소 동안 `realtime-dev` 스텁. REST `/music/neighbors`는 외부·디버깅용으로 별개.
- **UserDisplayResolver**: email→`{nickname, imageUrl}`는 `AuthMapper.findByEmail`(BE1 소유, 읽기만) 위임 + 상한형 캐시로 가정한다.
- **REST 경로 프리픽스**: 문서 URI는 `/realtime/nearby`(Notion 관례, `/api` 생략), 실제 컨트롤러 경로는 다른 realtime 엔드포인트처럼 `/api` 프리픽스가 붙을 수 있다. 프리픽스 정리는 BE1 몫.
- **인프라**: 단일 Redis(비클러스터, `noeviction`), Spring Boot 4.1 + STOMP SimpleBroker, PostgreSQL 17 + pgvector. 다중화(Redis Pub/Sub)는 `RealtimeEventBus` 이음새로만 다루고 이 스펙 인수 기준에 넣지 않는다.
- **인기 곡 상한**: 곡별 표시 인원·fanout 상한은 값을 정하지 않는다(관측 대상).
