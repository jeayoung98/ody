# Feature Specification: 실시간 뷰포트 사용자

**Feature Branch**: `backend/feat/S15P21A405-76-viewport-snapshot`

**Feature Directory**: `specs/jiwon-003-realtime-viewport`

**Created**: 2026-09-16

**Status**: Draft — 2026-09-16 D1~D4 확정 반영, 전체 명세 검토 후 구현 대기

**Jira 범위**:

| 순서 | Jira | 범위 |
| --- | --- | --- |
| 1 | S15P21A405-76 | 뷰포트 최초 스냅샷·개별 사용자 구독 |
| 2 | S15P21A405-141 | 넓은 화면의 셀 뭉침·주기 인원수 갱신 |
| 3 | S15P21A405-77 | 뷰포트 실시간 델타·종료·재연결 |

### 티켓별 완료 경계

| Jira | 이 티켓에서 완료하는 것 | 다음 티켓으로 넘기는 것 |
| --- | --- | --- |
| S15P21A405-76 | 유효한 작은 화면의 요청 검증, 원자적 셀 구독, 정확 사용자 스냅샷, 개인 큐 응답 | 넓은 화면·20명 초과의 실제 셀 인원수 응답 |
| S15P21A405-141 | CLUSTERED 모드 판정, 셀 뭉침, 깊은 레이어 정확 인원수, 5초 갱신, 모드 전환 | 개별 사용자의 ENTER·MOVE·LEAVE와 종료 수명주기 |
| S15P21A405-77 | 실시간 델타, requestSeq 보호, close·disconnect·expiry 정리, 재연결 복구 | 다중 서버 fanout, 따라가기·동승 실제 구현 |

76은 최종 기능의 INDIVIDUAL 경로만 독립 검증한다. 넓은 화면과 20명 초과 입력을 일부 사용자 목록으로 잘라 성공 처리해서는 안 되며, 해당 최종 응답은 141 완료 뒤 제공한다. 세 티켓은 기능상 `76 → 141 → 77` 순서로 누적된다.

**Input**: 기존 실시간 Presence, 음악 재생/종료, 근처 사람 T1~T3 구현과 사용자 확정 뷰포트 명세. 프론트는 S15P21A405-219에서 이미 레이어 진입마다 누적 탐색 범위로 곡을 조회한다.

## 1. 목표

사용자가 지도를 팬·줌할 때 현재 탐색 경로와 화면 안에서 음악을 듣는 사용자를 보여준다. 프론트는 레이어에 들어갈 때마다 이전 레이어에서 선택한 범위를 누적해 곡 집합을 새로 받고, viewport도 같은 탐색 경로를 사용한다. 화면 범위가 작으면 사용자 마커를, 너무 넓거나 사람이 많으면 셀별 인원수를 보여준다. 화면이 열린 동안 다른 사용자의 진입·이동·이탈을 실시간으로 반영하고, 화면을 닫거나 연결이 끊기면 구독을 정리한다.

이 문서는 세 Jira 티켓을 하나의 계약으로 설계한다. 실제 구현과 커밋은 반드시 `76 → 141 → 77` 순서로 나누고, 각 티켓 완료 뒤 사용자 검토 전에는 다음 티켓으로 넘어가지 않는다.

## 2. 현재 코드와의 연결

| 현재 구현 | 이번 기능에서의 사용 |
| --- | --- |
| `PresenceStompController.viewport()` | S15P21A405-76에서 실제 서비스 연결 |
| `PresenceStompController.resync()` | S15P21A405-77에서 재연결 복구 연결 |
| `PresenceLifecycleService.join()` | 레이어 이동 시 현재 곡을 새 레이어에 재배치 |
| `PositionChanged` + `RealtimeEventBus` | 사용자 위치 변경을 뷰포트 델타 서비스에 전달 |
| `SimpleBrokerPublisher` | 개인 큐 `/user/queue/presence`로 스냅샷·델타 발송 |
| `PresenceRedisRepository` | 레이어·셀 청취자와 셀 인원수 조회 |
| `MusicDetailReader.findLocationsByIds()` | 여러 곡의 16차원 좌표를 한 번에 조회 |
| `UserDisplayResolver` | 이메일을 닉네임·프로필 사진으로 변환 |
| `RiderCountPort` | 현재는 0, 동승 기능 구현 후 어댑터만 교체 |
| `GET /api/music/major` | 레이어별 상주 곡 조회. level 1은 정적 집합, level 2+는 이전 레이어 범위를 누적 |
| Front `MapEngine`의 `boxes`·prefetch·query cache | 기존 레이어별 조회 경로를 viewport의 `ancestorBounds` 원본으로 재사용 |

### 기능 경계

- 음악 재생은 사용자의 곡과 위치를 바꾸는 원본이다.
- 레이어 이동은 프론트가 `/app/presence/join`을 다시 보내 처리한다.
- 뷰포트 요청은 화면 구독과 조회만 담당하며 음악 재생이나 레이어 이동을 대신하지 않는다.
- nearby는 비슷한 곡 기준 평면 목록이고, viewport는 현재 지도 화면 기준 사용자 표시다. 같은 `PositionChanged`를 소비하지만 구독 기준과 응답이 다르다.
- 곡 지도와 사용자 지도는 같은 탐색 경로를 사용해야 한다. 프론트의 `/api/music/major` 누적 범위와 viewport의 `ancestorBounds`가 다르면 안 된다.
- 다음 레이어 prefetch는 곡 준비용일 뿐이며, 실제 layer·boxes 변경 전에는 presence·viewport를 바꾸지 않는다.

## 3. 확정 설계

아래 항목은 2026-09-16 사용자 확인으로 확정했다.

| ID | 제안 | 권장 이유 |
| --- | --- | --- |
| D1 | 요청마다 증가하는 `requestSeq`를 프론트가 보낸다 | 빠른 팬·줌 중 늦게 끝난 이전 요청이 최신 화면을 덮지 않게 한다 |
| D2 | 기본 셀이 36개를 넘거나 정확 필터 사용자가 20명을 넘으면 CLUSTERED로 전환한다 | 목록을 20명에서 잘라 델타 상태가 어긋나는 문제를 피한다 |
| D3 | layer 2 이상은 이전 레이어의 `ancestorBounds`로 정확히 필터링한다 | 같은 현재 셀이라도 다른 드릴다운 경로의 사용자가 섞이지 않게 한다 |
| D4 | 개별 사용자 식별자로 `email`을 내려준다 | 프로필 버튼과 같은 사용자 마커 갱신·제거에 안정적인 키가 필요하다 |

## 4. 레이어 탐색 계약

프론트 레이어는 0~7, 서버 level/layer는 1~8이다. 프론트는 소켓과 REST 경계에서 `serverLayer = frontendLayer + 1`로 변환한다.

```text
서버 layer 1: 현재 PC1·PC2, ancestorBounds=[]
서버 layer 2: 현재 PC3·PC4, ancestorBounds=[layer 1에서 진입한 PC1·PC2 범위]
서버 layer 3: 현재 PC5·PC6, ancestorBounds=[layer 1 범위, layer 2 범위]
```

기존 프론트가 레이어를 내려가는 흐름과 실시간 연동 순서:

1. 현재 레이어의 실제 지도 표시 사각형을 raw PC 범위로 계산한다.
2. 그 범위를 기존 `boxes`에 추가하고 다음 레이어 곡을 미리 조회한다.
3. 실제 descend로 layer·boxes가 바뀌고 전환 화면이 안정되면 같은 곡으로 presence join을 보낸다.
4. 같은 `boxes`에서 만든 ancestorBounds와 현재 화면으로 viewport를 보낸다.
5. 늦은 곡 응답으로 화면 범위가 다시 바뀌면 더 큰 requestSeq로 viewport를 갱신한다.

레이어를 올라갈 때는 기존 stack과 query cache가 이전 곡 집합·카메라·boxes를 복원한다. 화면이 안정되면 join과 viewport를 다시 보낸다. 캐시 적중으로 REST 요청이 새로 발생하지 않아도 정상이다.

## 5. User Scenarios & Testing

### User Story 1 - 현재 화면의 사용자를 처음 본다 (Priority: P1 · S15P21A405-76)

실제 `layer·boxes`가 변경되고 전환 화면이 안정되거나 팬·줌이 끝나면 현재 레이어, 현재 화면의 raw PC 사각형, 이전 레이어에서 선택한 `ancestorBounds`를 보낸다. 화면이 충분히 좁고 사용자가 20명 이하면 서버는 화면 안 사용자들을 곡 위치별로 묶어 한 번에 보내고, 이후 변경을 받을 셀 구독을 저장한다. 늦은 곡 응답으로 화면 범위가 다시 바뀌면 더 큰 `requestSeq`로 다시 요청한다.

**Why this priority**: 최초 스냅샷과 구독이 있어야 델타와 뭉침 모드를 붙일 기준 상태가 생긴다.

**Independent Test**: 사용자 A가 곡을 재생한 상태에서 사용자 B가 A의 위치를 포함한 뷰포트를 보내면 B의 개인 큐에 A가 포함된 `VIEWPORT_SNAPSHOT`이 온다.

**Acceptance Scenarios**:

1. **V1** **Given** B의 presence와 유효한 뷰포트, **When** `/app/presence/viewport` 요청, **Then** 화면이 걸치는 셀 구독을 먼저 교체하고 그 다음 스냅샷을 만든다.
2. **V2** **Given** 화면 안과 밖에 곡이 있음, **When** 스냅샷 생성, **Then** 현재 raw PC 사각형과 이전 레이어 ancestorBounds를 모두 만족하는 곡의 사용자만 포함한다.
3. **V3** **Given** 같은 곡을 여러 명이 듣고 있음, **When** 스냅샷 생성, **Then** 곡 위치 하나에 사용자 목록을 묶어 반환한다.
4. **V4** **Given** 요청자 자신이 화면 안 곡을 듣고 있음, **When** 스냅샷 생성, **Then** 자기 자신은 사용자 목록에서 제외한다.
5. **V5** **Given** 같은 연결의 새 `requestSeq`, **When** 새 뷰포트를 요청, **Then** 이전 셀 구독을 지우고 새 셀 구독과 메타를 원자적으로 교체한다.
6. **V6** **Given** 저장된 값보다 작거나 같은 `requestSeq`, **When** 늦은 요청이 도착, **Then** 상태와 스냅샷을 바꾸지 않는다.
7. **V7** **Given** 정확 필터 결과가 20명을 초과, **When** 스냅샷 생성, **Then** 일부 사용자를 자르지 않고 CLUSTERED 모드로 전환한다.
8. **V8** **Given** layer가 1~8 밖이거나 현재 사각형·ancestorBounds가 잘못됨, **When** 요청, **Then** 구독을 바꾸지 않고 `/user/queue/errors`로 검증 오류를 보낸다.
9. **V9** **Given** layer 1 요청, **When** 검증, **Then** ancestorBounds는 빈 목록이어야 한다.
10. **V10** **Given** layer N 요청, **When** 검증, **Then** ancestorBounds는 layer 1부터 N-1까지 정확히 N-1개여야 한다.

---

### User Story 2 - 넓은 화면은 인원수로 본다 (Priority: P1 · S15P21A405-141)

줌아웃으로 화면에 포함되는 기본 셀이 너무 많으면 개별 사용자를 모두 보내지 않는다. 셀을 단계적으로 합쳐 최대 마커 수 안에서 셀별 인원수만 보내고, 화면을 유지하는 동안 5초마다 갱신한다.

**Why this priority**: 넓은 화면에서 사용자와 소켓 이벤트가 폭증하는 것을 막으면서 지도 전체의 활동량은 유지한다.

**Independent Test**: 36개보다 많은 기본 셀이 포함되는 뷰포트를 보내면 `CLUSTERED` 스냅샷이 오고, 인원이 바뀐 뒤 5초 이내에 새 셀 인원수가 온다.

**Acceptance Scenarios**:

1. **V20** **Given** 포함 기본 셀 수가 36개 이하, **When** 요청, **Then** `INDIVIDUAL` 모드가 된다.
2. **V21** **Given** 포함 기본 셀 수가 36개 초과 또는 정확 필터 사용자 수가 20명 초과, **When** 요청, **Then** `CLUSTERED` 모드가 되고 개별 셀 구독을 저장하지 않는다.
3. **V22** **Given** 셀 마커 수가 64개 초과, **When** 뭉침 스냅샷 생성, **Then** 16×16에서 8×8, 4×4 순서로 합쳐 64개 이하가 되는 첫 해상도를 사용한다.
4. **V23** **Given** layer 1, **When** 셀 인원수 계산, **Then** 기존 `cell:usercount:{layer}`를 빠른 경로로 사용한다.
5. **V24** **Given** layer 2 이상, **When** 셀 인원수 계산, **Then** 곡 좌표에 이전 레이어 ancestorBounds를 적용한 뒤 곡별 청취자 수를 합산한다.
6. **V25** **Given** CLUSTERED 화면을 유지, **When** 5초 주기 실행, **Then** 최신 `VIEWPORT_CELL_COUNTS`를 개인 큐로 보낸다.
7. **V26** **Given** INDIVIDUAL과 CLUSTERED 사이를 전환, **When** 새 요청 처리, **Then** 이전 모드 인덱스는 남지 않는다.

---

### User Story 3 - 화면 변화가 실시간으로 반영된다 (Priority: P1 · S15P21A405-77)

개별 모드 화면이 열린 동안 다른 사용자가 곡을 재생하거나 레이어를 옮기거나 나가면 ENTER·MOVE·LEAVE 델타로 반영된다. 화면 종료와 연결 종료 시 구독을 정리하며, 재연결하면 최신 상태를 다시 만든다.

**Why this priority**: 최초 목록만 있고 이후 변화가 반영되지 않으면 실제 지도 상태와 금방 어긋난다.

**Independent Test**: B가 개별 뷰포트를 연 상태에서 A가 화면 밖→안→안의 다른 위치→밖으로 이동하면 B가 ENTER→MOVE→LEAVE를 순서대로 받는다.

**Acceptance Scenarios**:

1. **V40** **Given** A가 B의 화면 밖에서 안으로 이동, **When** `PositionChanged` 발행, **Then** B에게 현재 화면 requestSeq가 포함된 `VIEWPORT_ENTER`를 보낸다.
2. **V41** **Given** A가 B의 화면 안에서 다른 화면 안 위치로 이동, **When** 이벤트 처리, **Then** B에게 현재 화면 requestSeq가 포함된 `VIEWPORT_MOVE`를 보낸다.
3. **V42** **Given** A가 B의 화면 안에서 밖으로 이동하거나 접속 종료, **When** 이벤트 처리, **Then** B에게 현재 화면 requestSeq가 포함된 `VIEWPORT_LEAVE`를 보낸다.
4. **V43** **Given** A와 B가 같은 기본 셀에 있지만 A의 실제 좌표가 B 화면 밖, **When** 이벤트 처리, **Then** B에게 ENTER/MOVE를 보내지 않는다.
5. **V44** **Given** B가 CLUSTERED 모드, **When** A가 이동, **Then** 개별 델타는 보내지 않고 다음 인원수 주기에서 반영한다.
6. **V45** **Given** B가 `/app/presence/viewport/close` 호출, **When** 종료 처리, **Then** 저장된 셀 구독·뭉침 인덱스·메타를 현재 epoch와 requestSeq 확인 후 지운다.
7. **V46** **Given** 연결 종료 또는 TTL 만료, **When** presence 정리, **Then** 뷰포트 구독도 같은 이탈 처리에서 정리한다.
8. **V47** **Given** 연결이 끊겼다가 다시 연결, **When** 프론트가 구독→join→viewport를 재전송, **Then** 새 epoch와 최신 requestSeq로 스냅샷부터 다시 받는다.
9. **V48** **Given** 이전 연결의 종료·델타가 늦게 도착, **When** epoch가 현재 연결과 다름, **Then** 새 연결의 구독과 화면을 건드리지 않는다.
10. **V49** **Given** 레이어 이동 완료, **When** 프론트가 같은 곡으로 join 후 viewport를 보냄, **Then** 옛 레이어에서는 LEAVE, 새 레이어에서는 ENTER가 전달되고 새 화면 스냅샷이 발급된다.
11. **V50** **Given** 이전 화면용 델타가 새 화면 스냅샷 뒤에 도착, **When** 델타 requestSeq가 현재 값보다 작음, **Then** 프론트는 그 델타를 적용하지 않는다.

### 5.4 사용자 노출 생명주기

사용자 노출은 실제 음원 재생 여부가 아니라 서비스에 접속해 곡 위치에 배치되었는지를 기준으로 한다.

1. `connect`는 소켓 접속 정보만 만들며 위치가 없으므로 다른 사용자에게 노출하지 않는다.
2. 최초 `join`은 직전 곡 위치에 사용자를 배치하고 다른 사용자에게 ENTER로 알린다.
3. 레이어 이동 `join`은 같은 곡의 새 레이어 위치로 사용자를 옮기고 MOVE로 알린다.
4. 곡 재생은 새 곡 위치로 사용자를 옮기고 MOVE로 알린다.
5. `playEnd`는 재생 시간만 저장하며 마지막 위치와 노출을 유지한다.
6. 명시 종료·소켓 종료·TTL 만료는 위치와 노출 정보를 제거하고 LEAVE로 알린다.

## 6. Functional Requirements

### 6.1 공통 계약과 검증

- **FR-001** 서버는 `@Profile("realtime")`에서만 뷰포트 기능을 활성화해야 한다.
- **FR-002** 클라이언트는 `layer(1~8)`, 현재 표시 축의 raw PC 사각형, 이전 레이어의 `ancestorBounds`, 증가하는 `requestSeq`를 보내야 한다.
- **FR-003** 서버는 현재 사각형의 `min < max`, ancestorBounds의 연속된 layer 번호와 각 `min < max`, `ancestorBounds.size == layer - 1`을 검증해야 한다.
- **FR-004** 서버는 세션 발급 순번 `RealtimeEnvelope.seq`와 클라이언트 요청 순번 `requestSeq`를 서로 다른 목적으로 관리해야 한다.
- **FR-005** 프론트의 지도 레이어 0~7은 소켓 경계에서 서버 레이어 1~8로 변환해야 한다.
- **FR-006** 뷰포트 연동은 기존 `MapEngine.boxes`를 탐색 경로의 원본으로 사용하고 별도 누적 범위를 다시 계산하지 않아야 한다.
- **FR-007** prefetch 시작만으로 presence join·viewport를 보내지 않고, 실제 layer·boxes 변경과 화면 안정화 뒤 전송해야 한다.
- **FR-008** 올라가기는 기존 stack과 query cache가 복원한 boxes를 사용해야 하며 캐시 적중을 요청 누락으로 판단하지 않아야 한다.

### 6.2 S15P21A405-76 — 최초 스냅샷·개별 구독

- **FR-010** 구독 교체는 `구독 등록 → 스냅샷 조회` 순서로 처리해 사이의 변경을 놓치지 않아야 한다.
- **FR-011** 구독 교체는 이전 셀 SREM, 새 셀 SADD, 메타 저장을 한 원자 작업으로 수행해야 한다.
- **FR-012** 저장된 epoch가 다르거나 requestSeq가 최신 이하이면 늦은 요청을 무시해야 한다.
- **FR-013** 개별 스냅샷은 셀 후보 조회 후 현재 raw PC 사각형과 이전 레이어 ancestorBounds를 다시 검사해야 한다.
- **FR-014** 여러 곡 좌표는 기존 배치 조회 경계를 통해 한 번에 가져와야 하며 곡마다 DB를 호출하지 않아야 한다.
- **FR-015** 곡별 청취자는 Redis pipeline으로 읽고 요청자 자신을 제외해야 한다.
- **FR-016** 각 사용자에는 `email`, `nickname`, `imageUrl`, `riderCount`를 포함하고, 곡 그룹에는 `musicId`, 정규화 `x`, `y`를 포함해야 한다.
- **FR-017** 정확 필터 사용자 수가 20명을 넘으면 일부를 자르지 않고 CLUSTERED로 전환해야 한다.

### 6.3 S15P21A405-141 — 뭉침·인원수 갱신

- **FR-020** 기본 셀 수가 36개를 넘거나 정확 필터 사용자 수가 20명을 넘으면 CLUSTERED, 두 조건을 모두 넘지 않으면 INDIVIDUAL로 정해야 한다. 이 기준은 모든 레이어에 같다.
- **FR-020-1** 격자 크기, 셀 임계값, 개별 사용자 상한, 뭉침 마커 상한, debounce, 갱신 주기는 realtime 설정으로 관리하고 잘못된 값은 서버 시작 시 거부해야 한다.
- **FR-021** CLUSTERED 모드는 개별 셀 구독을 만들지 않고 `viewport:clustered:{layer}`에 사용자를 등록해야 한다.
- **FR-022** 셀 집계는 마커가 64개 이하가 될 때까지 해상도를 절반씩 낮춰야 한다.
- **FR-023** layer 1은 기존 셀 인원수 Hash를 사용하고, layer 2 이상은 이전 레이어 ancestorBounds를 만족하는 곡만 골라 곡별 청취자 수를 합산해야 한다.
- **FR-024** CLUSTERED 구독자에게 5초마다 최신 셀 인원수를 보내야 한다.
- **FR-025** 주기 작업은 같은 레이어·비슷한 화면의 공통 조회를 가능한 범위에서 공유하고, 사용자마다 전체 DB 조회를 반복하지 않아야 한다.

### 6.4 S15P21A405-77 — 델타·종료·재연결

- **FR-030** `PositionChanged`는 이전/새 레이어, 이전/새 곡·셀을 제공해야 하며, 델타 서비스는 이전·새 곡의 16차원 좌표를 이벤트당 최대 한 번의 batch로 얻을 수 있어야 한다.
- **FR-031** 곡 재생, 최초 배치, 레이어 이동, 명시 종료, TTL 만료가 모두 올바른 `PositionChanged`를 발행해야 한다.
- **FR-031-1** 최초 배치부터 사용자를 노출하고 재생 종료 후에도 마지막 위치의 노출을 유지하며, 명시 종료·소켓 종료·TTL 만료에서만 노출을 제거해야 한다.
- **FR-032** 델타 서비스는 이전 셀 구독자와 새 셀 구독자를 이용해 수신 후보를 만들고 각 수신자의 현재 사각형·ancestorBounds를 정확히 검사해야 한다.
- **FR-033** 화면 밖→안은 ENTER, 안→안은 MOVE, 안→밖은 LEAVE로 분류해야 한다.
- **FR-034** 모든 델타는 대상 화면의 `requestSeq`를 포함해야 한다. ENTER/MOVE는 사용자와 현재 곡·좌표를 포함하고, LEAVE는 제거에 필요한 `email`을 포함해야 한다.
- **FR-035** 델타 조립 중 닉네임·사진·좌표·동승자 수를 수신자마다 다시 조회하지 않아야 한다.
- **FR-036** `/app/presence/viewport/close`는 저장된 메타를 기준으로 구독을 해제하고 화면 범위를 재계산하지 않아야 한다.
- **FR-037** 명시 종료, DISCONNECT, TTL 만료는 viewport 메타·셀 구독·clustered 인덱스를 함께 정리해야 한다.
- **FR-038** 종료 작업은 epoch가 현재 연결과 같고 close requestSeq가 저장된 최신 viewport requestSeq와 같을 때만 실행해 이전 화면·연결이 새 상태를 지우지 못하게 해야 한다.
- **FR-039** 재연결 복구는 새 소켓 구독 완료 후 `join → viewport → nearby/open(패널이 열려 있을 때)` 순서로 클라이언트가 다시 보내야 한다.

### 6.5 성능·관측성

- **FR-040** 팬·줌 요청은 프론트 250ms debounce를 적용해야 한다.
- **FR-041** 서버는 viewport 요청 처리 시간, 모드, 후보 셀 수, 후보 곡 수, 결과 사용자 수, 델타 수신자 수, 거부된 stale 요청 수를 기록해야 한다.
- **FR-042** 이메일·토큰·원시 16차원 좌표 전체를 로그나 metric tag에 남기지 않아야 한다.
- **FR-043** 현재 단일 서버의 인프로세스 이벤트 버스와 Simple Broker를 기준으로 한다. 다중 서버 fanout은 별도 인프라 범위다.

## 7. Edge Cases

- 화면이 지도 경계를 넘으면 유효 범위로 clamp하되 빈 범위가 되면 거부한다.
- 셀 후보에는 포함되지만 실제 사각형 밖인 곡은 제외한다.
- 같은 셀 안 이동도 좌표가 바뀌고 화면 안이면 MOVE가 필요하다.
- 이전 곡 좌표를 구할 수 없더라도 수신자 화면에 기존 사용자가 있었다면 email 기준 LEAVE가 가능해야 한다.
- 사용자가 빠르게 팬·줌해 요청이 역순으로 도착해도 가장 큰 requestSeq만 남는다.
- 새 스냅샷 뒤에 이전 화면용 델타가 도착해도 델타 requestSeq가 다르면 적용하지 않는다.
- 뭉침 주기 실행 중 화면을 닫으면 epoch/requestSeq 검사로 늦은 결과를 버린다.
- 사용자 표시 정보 조회가 실패하면 해당 사용자만 제외하고 전체 스냅샷을 실패시키지 않는다.
- 비어 있는 셀과 인원수 0인 마커는 응답에 포함하지 않는다.
- 다음 레이어 곡 조회가 늦으면 기존 엔진의 임시 집합 전환을 유지하고, 늦은 응답으로 화면이 바뀔 때 viewport를 다시 보낸다.
- 레이어 전환 중에는 중간 카메라 값을 viewport로 보내지 않고 모프 완료 후 한 번 보낸다.
- 올라간 뒤 버려진 하위 ancestorBounds를 다시 사용하지 않는다.

## 8. Key Entities

- **LayerBound**: 한 이전 레이어에서 다음 레이어로 들어갈 때 선택한 raw PC 사각형.
- **ViewportRequest**: 요청 순번, 현재 레이어, 현재 raw PC 표시 사각형, ancestorBounds.
- **ViewportMeta**: 현재 연결의 epoch, 최신 requestSeq, 모드, 범위, 구독 셀.
- **ViewportSnapshot**: INDIVIDUAL 사용자 그룹 또는 CLUSTERED 셀 인원수.
- **ViewportDelta**: 한 사용자의 ENTER·MOVE·LEAVE 변화.
- **PositionChanged**: presence 변화가 뷰포트·nearby에 전달되는 내부 이벤트.
- **Viewport Cell Subscription**: 특정 기본 셀의 변화를 받아야 하는 사용자 집합.

## 9. Success Criteria

- **SC-001** 유효한 개별 뷰포트 요청의 스냅샷이 로컬 기준 1초 이내 도착한다.
- **SC-002** 팬·줌 요청이 역순으로 처리되어도 마지막 requestSeq의 화면만 남는다.
- **SC-003** 화면 밖 사용자가 개별 스냅샷·델타에 포함되는 오탐이 0건이다.
- **SC-004** INDIVIDUAL 모드 응답 사용자가 20명을 넘지 않고, 20명 초과 시 사용자 누락 상태 대신 CLUSTERED로 일관되게 전환한다.
- **SC-005** CLUSTERED 셀 마커가 64개를 넘지 않고, 변경된 인원수가 5초 이내 반영된다.
- **SC-006** ENTER·MOVE·LEAVE가 두 세션 시나리오에서 순서와 최종 상태 모두 일치한다.
- **SC-007** close·disconnect·expiry 후 해당 사용자의 viewport Redis 인덱스가 남지 않는다.
- **SC-008** 이전 epoch의 종료와 이전 requestSeq의 스냅샷·인원수·델타가 새 화면을 변경하지 않는다.
- **SC-009** realtime 프로파일이 없을 때 기존 데모 서버의 빈 구성과 동작이 바뀌지 않는다.
- **SC-010** 레이어를 내려갔다 올라오면 이전 곡 집합·카메라·탐색 범위가 동일하게 복원된다.
- **SC-011** 곡 지도와 사용자 viewport가 동일한 ancestorBounds를 적용해 다른 탐색 분기의 사용자가 표시되는 경우가 0건이다.

## 10. Assumptions & Dependencies

- 로그인 완료 이후 기능이며 `Principal.getName()`이 email을 제공한다.
- 곡 좌표는 16차원이고 화면 레이어는 1~8이다. 레이어 N의 표시 축은 해당 레이어에 배정된 2개 축이다.
- 현재 Redis의 `layer-listeners`, `active-song:cell`, `active-song:cells`, `cell:usercount`는 재사용한다.
- 프로필 공개 정책은 현재 MVP의 전원 공개 가정을 유지한다. 비공개 정책이 확정되면 사용자 필터 지점만 교체한다.
- `RiderCountPort`는 현재 0을 반환하며 동승 기능이 구현되면 계약 변경 없이 어댑터를 교체한다.
- 프론트엔드는 확정된 requestSeq·email 식별자와 재연결 전송 순서를 함께 반영해야 한다.
- 프론트엔드의 레이어별 조회·prefetch·캐시는 이미 구현돼 있으며 이번 범위에서는 다시 만들지 않는다.
- 실서비스 BFF는 기존대로 level 1은 범위 없이, level N은 이전 N-1개 boxes를 `/api/music/major`에 전달한다.
- 목 BFF의 범위 밖 곡 채우기는 작은 목 데이터용 보정이므로 백엔드 viewport가 따라 하지 않는다.

## 11. Out of Scope

- 음악 재생/종료, nearby 목록·델타의 재구현
- 따라가기·동승 기능 자체 구현
- 비공개 계정 정책 확정과 권한 시스템 변경
- 프론트엔드 코드 직접 수정
- Redis Pub/Sub 또는 외부 브로커를 이용한 다중 서버 fanout
- 지도 렌더링 디자인과 마커 겹침 UI
