# Feature Specification: 실시간 Presence · 화면 사용자 · 근처 사람 · 만난 횟수

**Feature Branch**: `backend/feat/S15P21A405-74-websocket-infra`

**Feature Directory**: `specs/004-realtime-presence-nearby`

**Created**: 2026-09-10

**Status**: Draft — Notion 정본(2026-09-10 15:42~15:55 KST 편집분) 기반 작성. **정본 우선 원칙 확정(2026-09-10, 사용자)**: 저장소 문서와 충돌하면 Notion을 따른다. Q1~Q3 전부 해소 — **Clarifications 미결 없음.** 남은 것은 Notion 「남은 협의」 4건과 Assumptions의 가정들.

**Jira**: [S15P21A405-74 [T] WebSocket 인프라 구축](https://ssafy.atlassian.net/browse/S15P21A405-74) (담당 BE3 지원 · 진행 중 · 라벨 be-realtime, infra, v0.2)

**Input**: Notion 「기능 명세서 (Back)」 functionalSpecification의 RT-01·02·05·10·11·20·21·22·23·50·90 (11건)과
「API 명세서」 Front ↔ Back API 중 담당자 박지원 3건(`POST /music/play`, `PATCH /music/play/end`, `GET /music/neighbors`),
그리고 「📡 실시간 (Presence · Nearby) API 명세」 페이지(WebSocket 메시지 계약·좌표 규약의 정본).

**정본 관계**: Notion이 정본, 이 문서는 저장소 스냅샷이다(docs/README 규정). 저장소 `docs/rules/FEATURES.md`에는
RT-xx ID가 아직 없다 — 기존 ID와의 대응은 §대응표 참조. 대응표는 추적용이며 FEATURES.md 수정은 기획 확인 후 별도로 한다.

## 기존 ID 대응표 (추적용)

| Notion RT | FEATURES.md 기존 ID | 비고 |
| --- | --- | --- |
| RT-01, RT-02, RT-05 | USER-03 접속 상태 관리 | "현재 탐색 좌표"가 이번 정본에서 "재생 곡"으로 구체화됨 |
| RT-10, RT-11 | SOCIAL-01 주변 친구 목록 | 영역 기준이 "이웃곡 K개의 청취자"로 구체화됨 |
| RT-20, RT-21, RT-22, RT-23 | SOCIAL-01 (화면 범위 표현) | 기존 ID 없음 — 신설 필요 |
| RT-50 | SOCIAL-05 만난 횟수 카운팅 | FEATURES.md는 "미확정", Notion은 "같은 곡 동시 청취" 확정 |
| RT-90 | USER-04 온라인 공개·비공개 | 요구사항 §6과 충돌 → **Notion 우선으로 MVP 제외 확정**(Q3) |

## Clarifications

### Session 2026-09-10

- Q: 저장소 문서(BACKEND-NOTES·요구사항 §6·FEATURES.md)와 Notion이 충돌하면? → A: **오늘 준 Notion이 최신·정본. 전부 Notion에 맞춘다.** (사용자 확정)
- Q2 [계약] 재생 REST 경로 → A: Notion대로 `POST /music/play` + `PATCH /music/play/end` 2경로. BACKEND-NOTES A-7(`POST /api/music/{id}/play`)은 구버전으로 처리 — BACKEND-NOTES 갱신 필요(T082). 잔여: `/music/play/end` **네이밍**만 Notion 자체가 BE1 확인 대기로 둠(남은 협의 #4).
- Q3 [보안·개인정보] 비공개 계정 → A: Notion RT-90대로 **MVP 전원 공개 간주**, `filterVisible` 필터 지점만 확보(FR-030). 요구사항 §6 "비공개 좌표 어떤 경로로도 미조회"는 MVP 이후 단계 요건으로 재해석 — 요구사항 문서 쪽에 "MVP 제외" 표기 필요(기획).
- Q1 [동작] `/app/presence/join`과 `POST /music/play`의 관계 → A: **둘 다 맞다. "음악을 플레이해야 그 음악으로 위치가 이동한다."** (사용자 확정)
  - `join {requestSeq, layer, musicId}` = **배치·복원**. 첫 join은 요청 곡으로 노출하고, 이미 현재 곡이 있으면 요청 `musicId` 대신 서버 presence의 현재 곡을 유지한 채 레이어만 옮긴다. 재생이 아니므로 `play_history` INSERT **없음**, 만남 판정 **없음**.
  - `POST /music/play` = **위치 "이동"의 유일한 원본**. 재생 시에만 곡이 바뀌고, 이때만 `play_history` INSERT와 만남 판정이 일어난다.
  - 둘의 차이는 "재생했는가"다. join은 재생 없이 마지막 위치에 서 있는 것(RT-01 "정지 상태지만 위치는 마지막 곡에 노출").
  - join 성공은 `PRESENCE_JOINED {requestSeq, layer, musicId}`로 확인한다. 프론트는 이 메시지를 받은 뒤 새 곡 `/music/play`을 호출한다. 실패는 같은 `requestSeq`를 담아 `/user/queue/errors`로 보낸다.

### 정본이 정하지 않아 이 명세가 채운 것

- **Assumptions 참조** — 틀리면 코드가 아니라 정본 쪽을 먼저 고친다: (Assumptions 참조 — 틀리면 정본 쪽을 고쳐야 함): 사용자는 현재 레이어 하나의 셀에만 인덱싱 / `seq`는 세션 단위 / 멀티탭 정책 / CLUSTERED 응답의 `resolution` 필드 / 인기 곡 fanout 상한.

### 정본 자체가 미결로 남긴 것 (Notion 「남은 협의」 — 구현 착수는 막지 않음, 실측·시연 전 확정 필요)

1. `/music/neighbors` 레이어 필터 위치(쿼리 WHERE 누적 vs 호출측 후처리)와 캐시 주체 — BE2
2. 레이어별 축 배정과 축별 전역 min/max 초기값 — BE2·BE4
3. viewport payload 필드 확정 후 `contracts/websocket/` 명시 — FE
4. `/music/play/end` 네이밍 — BE1 (Q2와 동일)

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 재생한 곡이 곧 내 위치가 된다 (Priority: P1)

로그인한 사용자가 지도에 접속하면 아직 아무에게도 보이지 않는다. 재생 버튼을 눌러 곡을 선언하면 그 곡의 위치가 내 위치가 되어
다른 사용자에게 나타나고, 다른 곡을 재생하면 그 곡으로 이동한다. 탭을 닫거나 연결이 끊기면 지도에서 사라진다. 재생이 끝나도 위치는 남는다.

**Why this priority**: 이 기능의 모든 조회(화면 사용자·근처 사람·만남)가 "누가 어느 곡을 듣고 있는가"라는 하나의 상태에서 파생한다.
이것이 없으면 나머지는 빈 목록이다.

**Independent Test**: 단일 사용자로 CONNECT → join → `/music/play` → 자기 상태 조회 → leave/onClose 순서를 수행하고
각 단계에서 서버 측 presence 상태와 응답을 확인한다. 다른 사용자 없이 완결된다.

**Acceptance Scenarios**:

1. **A1** **Given** 유효한 액세스 토큰, **When** WebSocket CONNECT, **Then** 연결이 수립되고 presence가 `playingMusicId = null`로 생성되며
   어떤 조회 결과에도 나타나지 않는다. (FR-001, FR-003)
2. **A2** **Given** 토큰 없음·만료·위조, **When** CONNECT, **Then** 연결이 거부된다. 서버 로그에 Authorization 값이 남지 않는다. (FR-002, FR-040)
3. **A3** **Given** presence가 있고 `music.location`이 NOT NULL인 곡, **When** `POST /music/play {musicId, source}`, **Then** 200과
   `{playHistoryId, musicId, layer, x, y, cellX, cellY}`를 받고, 그 곡의 청취자에 내가 포함되며, `play_history`에 `played_ms = 0` 행이 생긴다. (FR-010, FR-011, FR-012)
4. **A4** **Given** A3 이후 다른 곡을 재생, **When** `POST /music/play`, **Then** 이전 곡 청취자에서 빠지고 새 곡 청취자에 들어가며,
   위치·셀이 새 곡 기준으로 갱신된다. `play_history` 행이 하나 더 쌓인다. (FR-010, FR-013)
5. **A5** **Given** 같은 곡을 다시 재생, **When** `POST /music/play`, **Then** 위치·청취자·만남 변화가 없고(no-op) `play_history` 행만 추가된다. (FR-014)
6. **A6** **Given** `location`이 NULL인 곡 또는 존재하지 않는 곡, **When** `POST /music/play`, **Then** 각각 `PRESENCE_ERROR` / `MUSIC_NOT_FOUND`로 거부되고 위치가 바뀌지 않는다. (FR-015)
7. **A7** **Given** `source`가 `MAP/JOURNEY/PLAYLIST/FOLLOW` 밖의 값, **When** `POST /music/play`, **Then** 400 `VALIDATION_ERROR`. (FR-015)
8. **A8** **Given** A3의 `playHistoryId`, **When** `PATCH /music/play/end {playHistoryId, playedMs}`, **Then** 200 `data: null`, 해당 행의 `played_ms`가 갱신되고 **위치는 변하지 않는다**. 같은 ID로 재호출하면 마지막 값으로 덮어쓴다. (FR-016, FR-017)
9. **A9** **Given** 타인의 `playHistoryId`, **When** `PATCH /music/play/end`, **Then** 403 `FORBIDDEN`. (FR-018)
10. **A10** **Given** 재생 중 사용자, **When** `/app/presence/leave` 또는 WebSocket onClose, **Then** 청취자·셀 인덱스·셀 인원수·구독 인덱스 2종·presence 키에서 **즉시** 제거되고, 관련 Redis 키에 잔여(빈 Set, 0인 필드)가 없다. TTL을 기다리지 않는다. (FR-020, FR-021)
11. **A11** **Given** 재생 중 사용자가 하트비트를 보내지 않음, **When** TTL(45s) 경과 후 Sweep(5s 주기)이 돌면, **Then** A10과 같은 정리가 일어난다. 하트비트 1회 유실(15s)만으로는 제거되지 않는다. (FR-022, FR-023)
12. **A12** **Given** Sweep이 만료 사용자를 정리하는 동시에 그 사용자가 곡을 바꿈, **When** 두 경로가 경쟁, **Then** 새 곡의 청취자가 지워지지 않는다 — 정리는 스크립트 안에서 읽은 `playingMusicId` 기준으로만 제거한다. (FR-024)
13. **A13** **Given** 재접속(같은 사용자의 새 CONNECT), **When** `/app/presence/resync`, **Then** 전체 스냅샷을 다시 받고 `sessionEpoch`가 증가한다. (FR-004, FR-005)
14. **A14** **Given** CONNECT 직후 사용자가 `/app/presence/join {requestSeq, layer, musicId:X}`, **When** 처리, **Then** X의 좌표로 노출되고 `PRESENCE_JOINED`를 받지만 `play_history`와 만남은 늘지 않는다. 이미 곡 Y에 있는 사용자의 레이어 이동이면 요청 곡과 무관하게 Y를 유지한다. (FR-006)

---

### User Story 2 - 내 화면 안에 있는 사람이 보인다 (Priority: P1)

사용자가 지도를 팬·줌하면 현재 화면 범위 안에서 곡을 듣고 있는 다른 사용자가 개별 마커(닉네임·프로필·재생곡)로 보인다.
화면이 넓어져 사람이 너무 많아지면 개별 대신 "이 구역에 N명"으로 뭉쳐 보인다. 다른 사람이 내 화면 안으로 들어오거나 나가거나 이동하면 즉시 반영된다.

**Why this priority**: 지도 위에 "사람이 있다"는 감각을 만드는 기본 표현이다. US3(근처 사람)과 달리 외부 의존(BE2 이웃곡)이 없어 먼저 완결할 수 있다.

**Independent Test**: 사용자 A가 곡 X를 재생하고, 사용자 B가 X의 좌표를 포함하는 뷰포트를 보내면 B의 스냅샷에 A가 나온다.
A가 화면 밖 곡으로 이동하면 B에게 LEAVE가 온다. 두 사용자만으로 완결된다.

**Acceptance Scenarios**:

1. **A20** **Given** 사용자 B가 layer 3의 원시 pc 범위와 누적 bounds를 담은 `/app/presence/viewport`를 보냄, **When** 조회 셀 수 ≤ 36, **Then**
   `VIEWPORT_SNAPSHOT{mode: INDIVIDUAL, groups[{musicId, x, y, users[{nickname, imageUrl}]}]}`를 받는다. 자기 자신은 제외된다. 클라이언트는 원시 pc값만 보내고 `regionId`는 없다. (FR-033, FR-050, FR-051, FR-055)
2. **A21** **Given** 뷰포트에 걸치는 셀 안에 곡이 있으나 **곡 좌표가 뷰포트 사각형 밖**, **When** 스냅샷 조립, **Then** 그 곡의 청취자는 포함되지 않는다. (FR-052)
3. **A22** **Given** 후보 사용자의 재생곡 좌표가 B의 누적 bounds(레이어 1~현재) 중 하나라도 벗어남, **When** 스냅샷 조립, **Then** 제외된다. (FR-053)
4. **A23** **Given** 조회 셀 수 > 36, **When** 스냅샷 조립, **Then** `mode: CLUSTERED`, `cells[{cellX, cellY, count}]`만 내려오고 개별 사용자 정보는 없다. 셀 구독은 등록되지 않는다. (FR-060, FR-061)
5. **A24** **Given** CLUSTERED에서 표시 마커 수 > 64, **When** 응답 조립, **Then** 격자 해상도를 16→8→4로 반감해 병합하고 상한 이하가 될 때까지 반복한다. (FR-062)
6. **A25** **Given** B가 INDIVIDUAL 모드로 셀 집합 S를 구독 중, **When** 사용자 A가 S 안의 곡으로 이동/진입/이탈, **Then** B는 `VIEWPORT_ENTER/MOVE/LEAVE`를 받는다.
   같은 셀 안 이동만 MOVE이고, 셀이 바뀌면 구셀 LEAVE + 신셀 ENTER다. (FR-056, FR-057)
7. **A26** **Given** A의 새 곡이 B의 구독 셀 안이지만 B의 실제 뷰포트 사각형·누적 bounds 밖, **When** 델타 발송, **Then** B에게 발송되지 않는다. (FR-058)
8. **A27** **Given** B가 뷰포트를 바꿔 CLUSTERED로 전환, **When** 전환, **Then** 이전 셀 구독이 **저장해둔 cellKeys로** 모두 해제되고 이후 델타가 오지 않는다. (FR-061, FR-063)
9. **A28** **Given** B가 `layer` 값이 다른 viewport를 보냄, **When** 수신, **Then** 레이어 이동으로 간주해 B의 셀·구독을 부분 갱신이 아니라 **전체 재계산**한다. (FR-054)
10. **A29** **Given** 스냅샷 `seq = N`, **When** `seq ≤ N`인 델타가 늦게 도착, **Then** 클라이언트가 버릴 수 있도록 모든 프레임에 단조 증가 `seq`가 실린다. (FR-041)
11. **A30** **Given** 셀 인원수 Hash와 청취자 Set이 어긋남, **When** Sweep 주기 검증(60초마다 한 레이어), **Then** 청취자 Set 기준으로 덮어쓰고 경고 로그를 남긴다. (FR-064)

---

### User Story 3 - 나와 비슷한 음악을 듣는 사람이 보인다 (Priority: P1)

사용자가 "주변 사람 보기"를 누르면 내가 듣는 곡과 소리가 가까운 곡 K개(앵커곡 포함)를 듣고 있는 사람들이 곡별로 묶여 보인다.
패널이 열려 있는 동안 그 곡들의 청취자 변동이 실시간으로 반영된다. 패널을 닫으면 갱신이 멈춘다.

**Why this priority**: 서비스 핵심 가치("같은 공간의 사람과 음악 공유")의 직접 표현. 단 BE2 이웃곡 조회에 의존해 US2 뒤에 둔다.

**Independent Test**: A가 곡 X를, C가 X의 이웃곡 Y를 재생한 상태에서 A가 `nearby/open`을 보내면 스냅샷에 Y 그룹 아래 C가 나온다.
C가 이웃이 아닌 곡 Z로 이동하면 A에게 LEAVE가 온다. 이웃곡 조회는 고정 결과로 대체(mock)해 검증할 수 있다.

**Acceptance Scenarios**:

1. **A40** **Given** A가 재생 중(앵커곡 X), **When** `/app/nearby/open`, **Then** X + 이웃곡 K개(기본 10) 각각의 청취자를 곡별 그룹으로 담은 `NEARBY_SNAPSHOT{anchorMusicId, groups[{musicId, title, artist, x, y, distance, users[]}]}`를 받는다. 앵커곡 그룹도 포함되고, 자기 자신은 제외되며, 청취자 0명인 곡은 그룹째 생략된다. (FR-070, FR-071, FR-072)
2. **A41** **Given** A가 재생 선언 전(`playingMusicId = null`), **When** `nearby/open`, **Then** `PRESENCE_ERROR`. (FR-073)
3. **A42** **Given** A의 패널이 열려 있고 K곡 구독이 등록됨, **When** C가 이웃곡 Y → 다른 이웃곡 Y'로 이동, **Then** A는 `NEARBY_MOVE`; Y → 비이웃 Z면 `NEARBY_LEAVE`; Z → Y면 `NEARBY_ENTER`. KNN 재호출·역조회 없이 곡 단위 구독 인덱스 정방향 조회 2번으로 수신자를 찾는다. (FR-074, FR-075)
4. **A43** **Given** A의 앵커곡이 바뀜(A가 다른 곡 재생), **When** 변경, **Then** 구독이 재구성되고 스냅샷이 재발급된다. (FR-076)
5. **A44** **Given** `nearby/close`, **When** 수신, **Then** **저장해둔 구독 곡 목록으로** 해제하고 재계산하지 않는다. 이후 델타가 오지 않는다. (FR-077)
6. **A45** **Given** 같은 `(musicId, k)`, **When** 이웃곡을 두 번 조회, **Then** 결과가 동일하다(불변) — 응답 캐시 가능. (FR-078)

---

### User Story 4 - 같은 곡을 함께 들은 횟수가 쌓인다 (Priority: P2)

사용자가 어떤 곡의 청취자에 진입하는 순간, 그때 그 곡을 듣고 있던 사람 각각과 "만남" 1회가 기록된다. 반복해 마주치면 그만큼 쌓인다.

**Why this priority**: 사용자에게 즉시 보이는 화면이 없고(프로필 표시는 이후 단계), 다른 스토리의 정확성에 영향을 주지 않는다. 다만 진입 시점에만 판정할 수 있어 US1과 같이 구현해야 데이터가 쌓인다.

**Independent Test**: A가 곡 X를 듣는 중에 B가 X를 재생하면 `meeting(A,B).cnt`가 1 증가한다. B가 나갔다 다시 X를 재생하면 2가 된다.

**Acceptance Scenarios**:

1. **A50** **Given** X 청취자 {A, C}, **When** B가 `POST /music/play X`, **Then** `meeting(A,B)`, `meeting(B,C)`가 각각 +1(없으면 1로 INSERT). `user1/user2`는 email 사전순. (FR-080, FR-081)
2. **A51** **Given** B가 X를 재선언(no-op), **When** 호출, **Then** 만남이 증가하지 않는다. (FR-082)
3. **A52** **Given** 같은 레이어·같은 곡에서 만난 A와 B, **When** 3분 안에 다시 같은 조건이 됨, **Then** 만남은 중복 증가하지 않는다. 3분 뒤 다시 만나면 증가한다. (FR-083)
4. **A53** **Given** A(layer 1)와 B(layer 5)가 같은 곡 X, **When** B가 X를 재생, **Then** 레이어가 달라 만남으로 집계하지 않는다. (FR-084)
5. **A54** **Given** X 청취자 1,000명, **When** B 진입, **Then** 1,000건의 증가가 브로드캐스트 경로 밖(비동기)에서 처리되고, 델타 전달 지연에 영향을 주지 않는다. (FR-085)

---

### Edge Cases

- 재생 선언 전 사용자가 `viewport`·`heartbeat`를 보내면? → presence는 유지되나 어떤 조회에도 나오지 않는다(FR-003). viewport는 "보는 쪽"이므로 정상 처리한다 — 위치 없이도 남을 볼 수 있다.
- 같은 사용자가 두 탭에서 CONNECT하면? → 정본 미명시. `sessionEpoch` 증가로 최신 세션이 기준이 되고, 이전 세션의 onClose가 최신 presence를 지우지 않아야 한다(FR-005). 두 세션 동시 유지 정책은 미결(Assumptions).
- 곡 좌표가 정규화 구간 밖(전역 min/max를 벗어남)이면? → `cell = min(floor(x_norm × 16), 15)`, 음수는 `floor` 후 0으로 클램프. `(int)` 캐스팅 금지(FR-031).
- 이웃곡 K개 중 청취자가 한 명도 없으면? → 빈 `groups`가 정상이다. 동접이 적으면 비는 것이 자연스럽다(RT-10). 폴백은 이번 범위 밖.
- 인기 곡에 청취자·구독자가 수천 명이면? → 만남 증가는 비동기, 델타 fanout은 곡별 표시 인원 상한 검토 대상(Assumptions). 이번 명세는 상한을 정하지 않는다.
- Redis `maxmemory-policy`가 `allkeys-lru`면? → 접속 중 presence가 조용히 삭제된다. `noeviction` 필수(FR-025).
- 격자 크기(16)만 바꾸고 임계(36)를 안 바꾸면? → 같은 화면의 셀 수가 4배가 되어 임계의 의미가 바뀐다. 두 값은 한 설정 파일에서 세트로만 바꾼다(FR-032).
- `played_ms` 갱신 호출이 유실되면(브라우저 강제 종료)? → 0으로 남는다. 분석 지표이며 presence에 영향 없다(FR-017).

## Requirements *(mandatory)*

### Functional Requirements

**접속·인증·세션 (RT-01, RT-05)**

- **FR-001**: 시스템은 WebSocket CONNECT 시 `Authorization: Bearer {accessToken}` 네이티브 헤더로 REST와 동일한 액세스 토큰을 검증하고, 성공 시 토큰 subject(email)를 세션 주체로 삼아야 한다.
- **FR-002**: 인증 실패 시 연결을 거부해야 하며, 클라이언트는 인증 실패에 대해 재시도하지 않는다(재시도 대상은 네트워크 오류만).
- **FR-003**: CONNECT 직후 presence는 `playingMusicId = null` 상태로 존재하며, 이 상태의 사용자는 화면 사용자·근처 사람·셀 인원수 어느 조회에도 나타나지 않아야 한다.
- **FR-004**: `/app/presence/resync` 수신 시 현재 뷰포트·근처 패널 상태 기준 전체 스냅샷을 재발급해야 한다.
- **FR-005**: 재접속마다 `sessionEpoch`를 증가시키고, 만료 판정과 이전 세션 정리가 최신 세션의 상태를 지우지 않도록 epoch를 비교해야 한다.
- **FR-006**: `/app/presence/join {requestSeq, layer, musicId}`는 **배치·복원**이다. 최초 join은 요청 `musicId`로 노출하고, 이후 join은 서버 presence의 현재 곡을 유지한 채 `layer`만 옮긴다. 현재 소켓의 epoch가 아니면 거부한다. 성공 시 `PRESENCE_JOINED {requestSeq, layer, musicId}`를 보내고, 실패 시 `/user/queue/errors`로 같은 요청 순번과 원인 코드를 보낸다. `play_history` INSERT와 만남 판정은 하지 않는다.

**재생 선언 = 위치 (RT-02, `/music/play`, `/music/play/end`)**

- **FR-010**: `POST /music/play {musicId, source}`는 위치 이동의 유일한 원본이다. 서버는 `music.location`으로 좌표를 계산하고 클라이언트 좌표를 받지 않는다.
- **FR-011**: 성공 응답은 공통 봉투 안에 `{playHistoryId, musicId, layer, x, y, cellX, cellY}`를 담아야 한다. `x, y`는 현재 레이어 표시 2축의 정규화 좌표(0~1), `cellX, cellY`는 소속 셀이다.
- **FR-012**: 처리 순서는 ① 청취자 Set·셀 인덱스·셀 인원수 원자 갱신 → ② `play_history` INSERT(`played_ms = 0`, `source`) → ③ 델타 팬아웃 2갈래(근처 사람·화면 사용자) → ④ 만남 증가(비동기)여야 한다. ①은 단일 원자 연산이어야 한다.
- **FR-013**: 곡 변경 시 구곡 청취자 SREM → 마지막 청취자면 셀 인덱스에서 곡 제거 → 구셀 인원수 −1(0이면 필드 삭제) → 신곡 SADD → 첫 청취자면 셀 인덱스에 곡 추가 → 신셀 인원수 +1 → presence 갱신을 하나의 원자 단위로 처리해야 한다. 좌표·셀 계산은 원자 단위 **밖에서 먼저** 한다.
- **FR-014**: 같은 곡 재선언은 위치·청취자·만남에 대해 no-op이어야 하며 `play_history`만 새로 INSERT한다.
- **FR-015**: 존재하지 않는 곡은 `MUSIC_NOT_FOUND`(404), `location`이 NULL인 곡은 `PRESENCE_ERROR`, `source`가 `MAP/JOURNEY/PLAYLIST/FOLLOW` 밖이면 `VALIDATION_ERROR`(400)로 거부해야 한다.
- **FR-016**: `PATCH /music/play/end {playHistoryId, playedMs}`는 해당 행의 `played_ms`를 갱신하고 `data: null`을 반환해야 한다. 위치는 변하지 않는다.
- **FR-017**: `/music/play/end`는 멱등이어야 한다(같은 ID 재호출 시 마지막 값으로 덮어씀). 호출 유실 시 `played_ms`는 0으로 남고 presence에 영향이 없다.
- **FR-018**: `/music/play/end`는 `play_history.email == token.email`을 검증하고 불일치 시 `FORBIDDEN`(403)이어야 한다.
- **FR-019**: 곡 변경 전에 presence의 `playingMusicId`가 요청 시점의 구곡과 일치하는지 검증하고, 불일치면 중단해야 한다(Sweep과의 경쟁 방지).

**만료·이탈 정리 (RT-05)**

- **FR-020**: `/app/presence/leave` 또는 WebSocket onClose 시 TTL을 기다리지 않고 즉시 정리해야 한다.
- **FR-021**: 정리는 청취자 Set, 셀 인덱스, 셀 인원수, 뷰포트 셀 구독(저장된 `cellKeys`), 근처 곡 구독(저장된 곡 목록), presence·lease·expiry·구독 메타를 모두 제거해야 하며 빈 Set·0인 필드를 남기지 않아야 한다. 이탈을 보고 있던 사용자에게 LEAVE 델타를 발송해야 한다.
- **FR-022**: 클라이언트 하트비트 15s, presence TTL 45s, Sweep 5s를 기본값으로 하고 전부 설정 파일 한 곳에서만 정의해야 한다.
- **FR-023**: 하트비트 1회 유실로 제거되지 않아야 한다(2회 유실까지 생존).
- **FR-024**: Sweep 정리는 `playingMusicId`를 **원자 단위 안에서 읽어** 그 곡에서만 제거해야 한다. 스크립트 밖에서 읽은 값으로 제거하면 곡 변경과 경쟁해 새 곡의 청취자를 지운다.
- **FR-025**: 운영 문서와 로컬 설정은 Redis `maxmemory-policy = noeviction`을 명시해야 한다.

**좌표·셀 규약 (공통)**

- **FR-030**: 화면 노출 식별자는 `nickname` + `imageUrl`만이다. email은 어떤 소켓 payload에도 싣지 않아야 한다. 서버 내부 식별은 email을 유지한다. 청취자 목록을 조립해 반환하는 함수는 **한 곳**이어야 하며 `is_public` 필터 지점을 확보해야 한다(MVP에서는 항등 — Q3).
- **FR-031**: 정규화는 `x_norm = (pc − min) / (max − min)`, 셀은 `min(floor(x_norm × 16), 15)`(음수는 0으로 클램프)이며 `(int)` 캐스팅을 쓰지 않아야 한다. 축별 전역 min/max와 레이어별 표시 축 배정은 설정 파일 상수이며 데이터 실측 후 교체한다.
- **FR-032**: 이웃곡 K(10), 셀 격자(16×16), 뭉침 임계(36), 마커 상한(64), 뷰포트 debounce(250ms), Heartbeat/TTL/Sweep(15/45/5s)은 전부 설정 파일 한 곳에서만 정의해야 하며, 격자와 임계는 세트로만 변경해야 한다.
- **FR-033**: 클라이언트는 항상 원시 pc값을 보내고, 정규화와 셀 변환은 서버만 수행해야 한다. `regionId`는 없다 — 영역 정체성은 `layer + 누적 bounds`다.

**메시지 봉투·복구 (공통)**

- **FR-040**: CONNECT 헤더의 Authorization 값과 email을 로그·지표에 남기지 않아야 한다.
- **FR-041**: 모든 S→C 프레임은 `{type, seq, ts, payload}` 봉투를 쓰고, `seq`는 한 세션에 전달되는 프레임 기준 단조 증가여야 한다. 스냅샷에 실린 `seq` 이하의 델타는 클라이언트가 버린다.
- **FR-042**: 검증 실패는 `PRESENCE_ERROR {code, message, requestSeq?}`로 해당 사용자에게만 회신해야 한다. join 오류에는 요청 순번을 포함한다.

**화면 사용자 (RT-20~23)**

- **FR-050**: `/app/presence/viewport {layer, minX, maxX, minY, maxY, bounds[]}`를 받아 원시 pc 범위를 정규화하고 걸치는 셀 범위를 산출해야 한다. `min < max`, 존재하는 layer, bounds 필수를 검증한다.
- **FR-051**: 셀 범위의 활성 곡을 조회한 뒤 그 곡의 청취자를 곡별 그룹 `{musicId, x, y, users[{nickname, imageUrl}]}`로 `VIEWPORT_SNAPSHOT`에 담아야 한다. 자기 자신은 제외한다.
- **FR-052**: 셀은 화면에 일부만 걸칠 수 있으므로, 곡 좌표가 실제 뷰포트 사각형 안인지 검사한 곡만 포함해야 한다.
- **FR-053**: 후보 사용자의 재생곡 좌표에 요청자의 누적 bounds(레이어 1~현재)를 모두 적용해 필터해야 한다.
- **FR-054**: `layer` 값이 이전과 다른 viewport 수신은 레이어 이동으로 간주하고, 요청자의 셀·구독을 부분 갱신이 아니라 전체 재계산해야 한다.
- **FR-055**: 조회 셀 수 ≤ 임계(36)면 `mode: INDIVIDUAL`, 초과면 `CLUSTERED`로 판정하고 응답에 `mode`를 실어야 한다.
- **FR-056**: INDIVIDUAL 모드에서는 셀 집합을 구독 인덱스에 등록하고 `cellKeys`를 저장해야 한다. 이전 구독은 먼저 해제한다.
- **FR-057**: 다른 사용자의 진입·이동·이탈 시 구셀 구독자 `V_old`, 신셀 구독자 `V_new`를 조회해 `V_old − V_new` LEAVE, `V_new − V_old` ENTER, 교집합 MOVE로 `VIEWPORT_ENTER/MOVE/LEAVE`를 발송해야 한다. 같은 셀 안 이동만 MOVE다.
- **FR-058**: 델타 발송 전 각 수신자의 실제 뷰포트 사각형과 누적 bounds를 검사하고 통과한 수신자에게만 발송해야 한다.
- **FR-060**: CLUSTERED 모드에서는 `groups` 대신 `cells[{cellX, cellY, count}]`를 내리고 개별 사용자 정보를 싣지 않아야 한다. 셀 인원수는 레이어당 Hash 1개를 `HGETALL` 한 번으로 읽는다.
- **FR-061**: CLUSTERED 모드에서는 셀 구독을 등록하지 않아야 하며, 모드 전환 시 이전 모드의 구독을 반드시 해제해야 한다. 뭉침 모드 사용자는 주기 스냅샷(`VIEWPORT_CELL_COUNTS`)으로 받는다.
- **FR-062**: CLUSTERED에서 표시 마커 수가 상한(64)을 넘으면 격자 해상도를 반감(16→8→4)해 인접 셀을 병합하고 상한 이하가 될 때까지 반복해야 한다. 임의 모양 클러스터링은 쓰지 않는다.
- **FR-063**: 구독 해제는 저장해둔 `cellKeys`로만 해야 하며 재계산하지 않아야 한다.
- **FR-064**: 셀 인원수 갱신은 곡 변경·진입·이탈의 원자 단위 안에서만 해야 한다(밖에서 `HINCRBY` 금지). Sweep은 60초마다 한 레이어씩 청취자 Set 기준으로 재계산해 불일치 시 덮어쓰고 경고 로그를 남겨야 한다.

**근처 사람 (RT-10, RT-11, `/music/neighbors`)**

- **FR-070**: `/app/nearby/open`(payload 없음) 수신 시 presence의 `playingMusicId`를 앵커곡으로 삼아 이웃곡 K개(기본 10)를 조회하고, 앵커곡 + 이웃곡 각각의 청취자를 곡별 그룹 `{musicId, title, artist, x, y, distance, users[]}`로 `NEARBY_SNAPSHOT{anchorMusicId, groups[]}`에 담아야 한다.
- **FR-071**: 앵커곡 자신도 그룹에 포함하고, 자기 자신은 `users`에서 제외하며, 청취자 0명인 곡은 그룹째 생략해야 한다. 곡별 Set을 따로 읽고 `SUNION`으로 합치지 않는다.
- **FR-072**: 스냅샷 응답과 함께 앵커곡 + 이웃곡 K개의 구독 인덱스에 요청자를 등록하고 **구독한 곡 목록을 저장**해야 한다.
- **FR-073**: 앵커곡이 없으면(`playingMusicId = null`) `PRESENCE_ERROR`로 거부해야 한다.
- **FR-074**: 다른 사용자의 곡 변경·이탈 시 구곡 구독자 `S_old`, 신곡 구독자 `S_new`를 조회해 `S_old − S_new` LEAVE, `S_new − S_old` ENTER, 교집합 MOVE로 `NEARBY_ENTER/MOVE/LEAVE`를 개인 큐로 발송해야 한다.
- **FR-075**: 델타 산출에 KNN 재호출과 역조회를 쓰지 않아야 한다.
- **FR-076**: 요청자의 앵커곡이 바뀌면 구독을 재구성하고 스냅샷을 재발급해야 한다.
- **FR-077**: `/app/nearby/close` 수신 시 저장해둔 구독 곡 목록으로 해제해야 하며 재계산하지 않는다.
- **FR-078**: 이웃곡 조회 `GET /music/neighbors?musicId&k`(BE2 소유, 내부 호출)는 `distance` 오름차순, 기준 곡 제외, `location` NULL 곡 제외, 원시 pc값 거리(정규화 좌표 금지)여야 하며, 같은 `(musicId, k)`는 항상 같은 결과(불변)여야 한다 — 응답 캐시 가능(데이터셋 버전 승격 시에만 플러시).

**만난 횟수 (RT-50)**

- **FR-080**: 곡 청취자 Set에 진입하는 순간, 진입 직전 그 곡의 기존 청취자 각각과 쌍을 만들어 `meeting(user1, user2, cnt)`를 UPSERT(있으면 +1, 없으면 1)해야 한다.
- **FR-081**: `user1/user2`는 email 사전순으로 정규화해야 하며 자기 자신과의 쌍은 만들지 않는다.
- **FR-082**: 같은 곡 재선언(no-op)에서는 만남을 집계하지 않아야 한다.
- **FR-083**: 동일 사용자 쌍은 3분 안에 한 번만 집계해야 한다. 3분이 지나 같은 레이어·같은 곡에서 다시 만나면 다시 증가한다.
- **FR-084**: 만남은 같은 레이어에서 같은 곡을 듣던 사용자끼리만 집계해야 한다.
- **FR-085**: 만남 증가는 브로드캐스트 경로 밖에서 비동기로 처리해야 하며, 델타 전달 지연에 영향을 주지 않아야 한다.

**관측 (헌법 VIII)**

- **FR-090**: 동시 연결 수, 이벤트(델타) 전달 지연, `/music/play` 지연·오류율, Sweep 정리 건수·인원수 불일치 건수를 측정 가능한 지표로 제공해야 한다. 지표·로그에 email·토큰을 노출하지 않는다.

### Key Entities

- **Presence**: 접속한 사용자의 실시간 상태 — 주체(email), `sessionEpoch`, `layer`, `playingMusicId`(null이면 비노출), 정규화 좌표(x, y), 셀(cellX, cellY), 만료 시각. Redis에만 존재하며 TTL로 소멸한다.
- **곡 청취자 집합 (Listeners)**: 곡별로 현재 그 곡을 재생 선언한 사용자 집합. 만남 판정과 근처 사람·화면 사용자 조립의 유일한 진실.
- **셀 (Cell)**: 레이어별 16×16 격자의 한 칸. 활성 곡 목록(어느 곡이 이 칸에 청취자를 갖는가)과 인원수(비정규화)를 가진다.
- **뷰포트 구독 (Viewport Subscription)**: "누가 어느 셀을 보고 있는가" — 시선이지 위치가 아니다. 사용자별 저장된 `cellKeys`와 뷰포트 사각형·누적 bounds.
- **근처 구독 (Nearby Subscription)**: "누가 어느 곡(앵커 + 이웃 K)의 청취자 변동을 듣고 있는가". 사용자별 저장된 곡 목록.
- **재생 기록 (play_history)**: 사용자·곡·source·`played_ms`(시작 시 0, 종료 시 갱신). 분석 지표. 로그인 직후 위치 복원의 근거(Q1).
- **만남 (meeting)**: `(user1, user2, cnt)` — email 사전순 쌍과 누적 횟수. 중복 방지 컬럼 없음. ERD 그대로.
- **곡 좌표 (music.location)**: PC1~PC16 원시값(VECTOR(16), 서빙 기준선 v2.1-pca16). 불변. NULL이면 지도 밖.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 재생 버튼을 누른 사용자가 같은 화면을 보고 있는 다른 사용자의 지도에 1초 이내에 나타난다(요구사항 §6 "따라가기 지연 1초 이내(논의)"의 실시간 경로 준용 — 백분위·부하 조건은 계획에서 정한다).
- **SC-002**: 탭을 닫은 사용자가 다른 사용자 화면에서 1초 이내에 사라진다(TTL 45초를 기다리지 않는다).
- **SC-003**: 네트워크 단절로 하트비트가 끊긴 사용자는 45~50초 안에 지도에서 사라지며, 15초 유실 1회로는 사라지지 않는다.
- **SC-004**: 정리 이후 해당 사용자에 대한 Redis 잔여 키·빈 Set·0 필드가 0건이다.
- **SC-005**: 셀 인원수 Hash와 청취자 Set의 합계가 Sweep 검증 시점에 100% 일치하거나, 불일치가 경고 로그로 100% 기록된다.
- **SC-006**: 화면 밖 곡의 청취자가 스냅샷·델타에 포함되는 건수가 0이다(FR-052, FR-058).
- **SC-007**: CLUSTERED 모드 응답의 마커 수가 항상 64 이하다.
- **SC-008**: 소켓 payload·로그·지표에서 email이 관측되는 건수가 0이다.
- **SC-009**: 같은 곡을 동시 청취한 두 사용자의 `meeting.cnt`가 진입 건수와 정확히 일치한다(동시 진입 레이스 포함).
- **SC-010**: 같은 `(musicId, k)` 이웃곡 조회 결과가 데이터셋 버전 내에서 100% 동일하다.

## Assumptions

- **범위**: 반응하기·따라가기(SOCIAL-02~04, 06~12)는 이번 범위 밖이다 — Notion 페이지 헤더 "반응·따라가기는 이후 단계". 기존 스캐폴딩의 `reaction/`·`follow/` 패키지는 이 명세의 대상이 아니다.
- **비공개 계정**: Q3 확정 — RT-90대로 MVP 전원 공개 간주. FR-030 필터 지점은 의무.
- **join `musicId` 사용 범위**: 최초 join은 클라이언트가 보낸 곡을 사용한다. 이후 레이어 이동은 요청 곡이 아니라 서버 presence의 현재 곡을 사용한다. 새 곡 이동은 `PRESENCE_JOINED`를 받은 뒤 `/music/play`로 처리한다.
- **인덱싱 레이어**: 사용자는 **현재 보고 있는 한 레이어**의 셀에만 인덱싱된다(`/music/play` 응답이 단일 `layer`를 돌려주고, RT-22가 "layer 바뀌면 내 셀 전체 재계산"이라 하므로). 다른 레이어를 보는 사용자는 화면 사용자에 나오지 않는다. 만남(곡 기준)은 이와 무관하다. 정본이 명시하지 않아 가정으로 둔다.
- **레이어–축 배정**: 레이어 l은 PC(2l−1)·PC(2l)을 표시 축으로 쓴다(저장소 CLAUDE.md §4 "PC 16·레이어 8", BACKEND-NOTES E-2, spec 001 Q1 확정). 축별 전역 min/max 초기값은 임의값이며 BE2·BE4 실측 후 교체(Notion 남은 협의 #2).
- **seq 범위**: `seq`는 세션(연결) 단위 단조 증가로 해석한다. 정본은 "스냅샷 seq 이하 델타는 버린다"만 정하므로, 스냅샷과 델타가 같은 수열이면 충분하다.
- **멀티탭**: 같은 사용자의 동시 세션 정책은 정본 미명시. `sessionEpoch`로 최신 세션을 기준으로 하되, 두 번째 CONNECT를 거부할지 병존시킬지는 계획 단계 보류 항목.
- **인기 곡 상한**: 곡별 표시 인원·fanout 상한은 정본이 "검토 필요"로만 둔다. 이번 명세는 값을 정하지 않는다.
- **REST 경로 프리픽스**: 기존 `MusicController`가 `/music`(프리픽스 없음), `SecurityConfig`가 `/api/auth/*`를 쓰는 등 저장소 내 프리픽스가 이미 불일치한다. 이 명세는 Notion 경로(`/music/play`)를 따르고 프리픽스 정리는 BE1 몫으로 둔다.
- **이웃곡 조회 방식**: BE2·BE3가 같은 Spring Boot 앱 안에 있으므로 HTTP 자기 호출 대신 BE2가 소유한 인터페이스(`MusicDetailReader.findNeighbors(id, k)`가 이미 존재)를 호출하는 것으로 가정한다. REST `/music/neighbors`는 외부·디버깅용으로 남는다. 계획에서 BE2와 확인.
- **데이터 의존**: `music.location` VECTOR(16)이 서빙 기준선 v2.1-pca16으로 적재되어 있고, `"user"(email, nickname, image_url, is_public)`, `play_history`, `meeting(user1, user2, cnt)` 테이블이 ERD대로 존재한다. `play_history`의 정확한 컬럼(id, email, music_id, source, played_ms, played_at)은 계획에서 ERD 대조.
- **인프라**: 단일 Redis(비클러스터), Spring Boot 4.1 + STOMP SimpleBroker, PostgreSQL 17 + pgvector. Jira -74가 요구하는 Redis Pub/Sub 기반 WS 다중화는 계획에서 이음새(발행 인터페이스)로 다루되 이번 명세의 인수 기준에는 넣지 않는다.
