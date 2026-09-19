# 실시간(위치·지도 위 사람·주변 사람) 프론트 작업 명세

프론트가 **무엇을 보내고 · 무엇을 받고 · 무엇을 만들어야 하는지**만 적었다.
지금 붙일 수 있는 실시간 기능은 아래 셋이고, 이 문서가 그 전부다.

| 기능 | 한 줄 | 지금 화면의 무엇을 대체하나 |
| --- | --- | --- |
| **내 위치** | 내가 지금 어느 겹의 어느 곡 위에 서 있는지 서버에 올린다 | (신규) — 지금은 `myMusicId` 가 로컬에만 있다 |
| **지도 위 사람** | 지금 보고 있는 화면 범위 안의 사람을 받는다 | `useNearbyUsersQuery` 15초 폴링 → 소켓 구독 |
| **주변 사람 패널** | 내 곡과 비슷한 곡을 듣는 사람 목록 | 같은 폴링 훅 → 전용 REST + 소켓 델타 |

아직 없는 것: **따라가기 · 반응 · 비공개 계정.** 이 셋과 관련된 UI(따라가기 버튼, 반응 FAB, `isPublic` 분기)는 지금 붙일 데이터가 없다.

> **§12 를 먼저 읽어라.** 여러 명이 실제로 붙여서 돌려본 뒤 드러난, 안 짜면 반드시 터지는 처리들이다. 특히 백그라운드 탭 복구(12.1)와 재연결 시 `seq` 초기화(12.2)는 빠뜨리면 화면이 통째로 안 그려진다.

---

## 0. 시작 전 준비

| 항목 | 내용 |
| --- | --- |
| 라이브러리 | `npm i @stomp/stompjs` (SockJS 불필요) |
| 환경변수 | `NEXT_PUBLIC_WS_ORIGIN` 추가. 비면 `location.origin` 의 `http`→`ws`, `https`→`wss` 치환. 로컬은 `ws://localhost:8080` |
| 토큰 | **실제 로그인으로 받은 accessToken 이 있어야 한다.** `STORAGE_KEYS.accessToken` 에 있는 값을 소켓 CONNECT 헤더와 REST `Authorization` 에 그대로 쓴다. 토큰 없이는 실시간 기능 전체가 시작되지 않는다 |
| 호출 경로 | 실시간 REST 3개는 **브라우저가 직접** 부른다 (`lib/api.ts` 통로). `/bff/` 라우트 핸들러를 만들지 않는다 — 서버가 대신 부르면 전원이 한 사람으로 취급된다 |
| rewrite | `constants/live-api-paths.ts` 에 `"/api/music/play"`, `"/api/music/play/end"`, `"/api/realtime/nearby"` 추가 |
| 소켓 주소 | rewrite 를 타지 않는다. `NEXT_PUBLIC_WS_ORIGIN` 절대 주소로 직접 연다 |
| 기능 스위치 | 실시간 전체를 `features.social && 토큰있음 && 소켓연결됨` 뒤에 둔다. 셋 중 하나라도 아니면 지도는 그냥 곡만 그린다(지금과 동일) |

---

## 1. 두 가지 규칙 — 이것만 틀리면 전부 어긋난다

### 1.1 레이어는 0-based, 변환하지 않는다

실시간으로 주고받는 모든 `layer` 는 **`useMapStore.layer` 와 같은 번호(0~7)** 다. `+1` 하지 않는다.
`ancestorBounds` 도 `useMapStore.boxes` 의 `layer` 를 그대로 쓴다.

> 예외는 곡 조회 `GET /bff/map/songs` 하나뿐이다. 거기만 예전대로 `level = boxes.length + 1`. 실시간 코드에 그 습관을 옮기면 한 겹 어긋난 사람 목록을 받는다.

### 1.2 좌표는 전부 원시 PC — 엔진 월드 좌표 그대로

보내는 값도 받는 값도 전부 `MapEngine` 이 쓰는 그 좌표다. 0~1 정규화 값은 오가지 않는다.

| 방향 | 어디 | 값 |
| --- | --- | --- |
| 보냄 | 뷰포트 `minX/maxX/minY/maxY` | 엔진 `viewBox()` — 화면 네 귀퉁이를 `screenToWorld` 한 값 |
| 보냄 | 뷰포트 `ancestorBounds[].minX...` | `boxes[i].xMin/xMax/yMin/yMax` 그대로 |
| 받음 | `groups[].x/y`, 델타 `x/y`, `cells[].x/y`, 재생 응답 `x/y` | 원시 PC — `worldToScreen` 에 그대로 넣는다 |

---

## 2. 연결과 봉투

### 2.1 연결

```ts
import { Client } from "@stomp/stompjs";

const client = new Client({
  brokerURL: `${WS_ORIGIN}/ws/websocket`,
  connectHeaders: { Authorization: `Bearer ${accessToken}` },
  reconnectDelay: 3000,
  heartbeatIncoming: 0,
  heartbeatOutgoing: 0,
  onConnect: () => {
    client.subscribe("/user/queue/presence", onFrame);   // 모든 데이터
    client.subscribe("/user/queue/errors",   onFrame);   // 모든 오류
    // 구독이 끝난 뒤에 join → viewport 순서로 보낸다 (§3, §5)
  },
});
client.activate();
```

- 구독 대상은 이 **두 개뿐**이다. 토픽 브로드캐스트는 없다.
- CONNECT 가 거부되면(토큰 만료 등) 재발급(`reissueAccessToken`) 후 재연결한다.
- 앱 전체에 클라이언트 **하나**만 둔다. 지도·패널이 각자 열면 서로의 구독을 덮는다.

### 2.2 받는 프레임은 전부 같은 모양

```json
{ "type": "VIEWPORT_SNAPSHOT", "seq": 41, "ts": 1789700000000, "payload": { } }
```

| 필드 | 뜻 | 프론트 처리 |
| --- | --- | --- |
| `type` | 아래 §2.3 표의 11가지 중 하나 | 라우팅 키 |
| `seq` | **내 연결에 보낸 메시지 순번**(단조 증가) | 마지막 처리 seq 보다 작거나 같으면 **버린다**. 주변 사람 목록 필터에도 쓴다(§6) |
| `ts` | 서버 시각(epoch ms) | 표시용·디버깅용 |
| `payload` | 타입별 본문 | — |

REST 의 `{success, data, error}` 봉투와 **다르다.** `lib/api.ts` 를 거치지 않으므로 별도 파서를 둔다.

> **`seq` 는 연결 단위로 리셋된다.** 재연결하면 서버가 다시 1부터 매긴다. 그래서 마지막 처리 seq 를 **연결이 열릴 때마다 0 으로 초기화**해야 한다. 이전 연결의 값을 그대로 들고 있으면 새 연결의 메시지가 전부 "옛날 것"으로 걸러져, 화면은 멀쩡한데 아무것도 갱신되지 않는 상태가 된다. 오류도 안 뜨므로 원인을 찾기 가장 어려운 종류의 버그다. 같은 이유로 `snapshotSeq`(§6) 도 재연결 때 함께 초기화한다.

### 2.3 메시지 전체 목록

**보내는 것 (C→S)** — 전부 `client.publish({ destination, body: JSON.stringify(...) })`

| destination | 본문 | 언제 |
| --- | --- | --- |
| `/app/presence/join` | `{requestSeq, layer, musicId}` | 연결 직후 · 겹이 바뀔 때마다 · 재연결 직후 |
| `/app/presence/heartbeat` | 없음 | 15초마다 |
| `/app/presence/leave` | 없음 | 탭 닫힘(선택) |
| `/app/presence/viewport` | `{requestSeq, layer, minX, maxX, minY, maxY, ancestorBounds[]}` | 화면이 멎은 뒤 250ms · 겹 전환 직후 |
| `/app/presence/viewport/close` | `{requestSeq}` | 지도를 떠날 때 |
| `/app/nearby/close` | 없음 | 주변 사람 패널을 닫을 때 |
| `/app/presence/resync` | 없음 | 쓸 일 없음(§3.4) |

**받는 것 (S→C)** — `/user/queue/presence`

| type | payload | 쓰는 화면 |
| --- | --- | --- |
| `PRESENCE_JOINED` | `{requestSeq, layer, musicId}` | 내 표식 |
| `VIEWPORT_SNAPSHOT` | `{requestSeq, mode, layer, groups[], resolution, cells[]}` | 지도 위 사람 (전체 교체) |
| `VIEWPORT_ENTER` | `{requestSeq, email, nickname, imageUrl, musicId, x, y, riderCount}` | 지도 위 사람 (추가) |
| `VIEWPORT_MOVE` | 같음 | 지도 위 사람 (이동) |
| `VIEWPORT_LEAVE` | `{requestSeq, email, 나머지 null}` | 지도 위 사람 (제거) |
| `VIEWPORT_CELL_COUNTS` | `{requestSeq, layer, resolution, cells[]}` | 지도 위 뭉치 (5초마다) |
| `NEARBY_SNAPSHOT` | `{anchorMusicId, snapshotSeq, people[]}` | 주변 사람 패널 (전체 교체) |
| `NEARBY_ENTER` | `{email, nickname, imageUrl, meetingCount, riderCount, musicId}` | 주변 사람 패널 (추가) |
| `NEARBY_MOVE` | 같음 | 주변 사람 패널 (곡 변경) |
| `NEARBY_LEAVE` | `{email, 나머지 null}` | 주변 사람 패널 (제거) |

**받는 것 (S→C)** — `/user/queue/errors`

| type | payload |
| --- | --- |
| `PRESENCE_ERROR` | `{code, message, requestSeq?}` — §7 |

---

## 3. 내 위치 (join · heartbeat · leave)

### 3.1 입장 — `/app/presence/join`

```json
{ "requestSeq": 1, "layer": 2, "musicId": 8812 }
```

| 필드 | 값 | 규칙 |
| --- | --- | --- |
| `requestSeq` | 입장 요청 카운터 | **1 이상, 단조 증가.** 오류 payload 에 그대로 돌아오므로 어느 요청이 실패했는지 알 수 있다 |
| `layer` | `useMapStore.getState().layer` | 0~7 |
| `musicId` | `STORAGE_KEYS.playingMusicId ?? myMusicId ?? 1` | **참고값이다.** 서버가 정한 곡이 응답으로 온다 |

응답 `PRESENCE_JOINED`:

```json
{ "requestSeq": 1, "layer": 2, "musicId": 8812 }
```

**응답의 `musicId` 가 내 진짜 위치다.** 요청에 넣은 값과 다를 수 있다(다른 탭에서 곡을 바꿨거나, 저장값이 낡았거나). 이 값으로:

```ts
useMapStore.getState().setMyMusicId(payload.musicId);   // 내 표식이 이 곡으로
```

### 3.2 언제 보내나

| 시점 | 비고 |
| --- | --- |
| 연결 직후(구독 완료 후) | 현재 겹으로 |
| **겹이 바뀔 때마다** | 파고들기·떠오르기·레이어 스테퍼 — `useMapStore.layer` 변화를 그대로 본다 |
| 재연결 직후 | 서버가 상태를 복원해 주지 않는다. 다시 보내는 것은 프론트 몫 |

겹 전환에서는 **join 을 먼저, viewport 를 나중에** 보낸다. 순서가 바뀌면 내 표식이 이전 겹에 남은 채로 새 화면 목록이 온다.

`prefetchBoxes`(다음 겹 미리 조회)만으로는 보내지 않는다. `layer` 와 `boxes` 가 **실제로 바뀐 뒤**에 보낸다.

### 3.3 아직 지도에 없는 사용자 — 정상 흐름이다

한 번도 곡을 재생한 적 없는 사용자는 join 이 `PRESENCE_NO_ANCHOR` 오류로 거부된다. **오류 화면을 띄우지 않는다.**

```
연결 → join → PRESENCE_ERROR { code: "PRESENCE_NO_ANCHOR" }
   → 지도는 평소대로, 내 표식(우주선)만 없는 상태
   → 튜토리얼/안내: "곡을 재생하면 지도에 나타납니다"
   → 첫 재생 → POST /api/music/play { musicId, source, layer }   ← layer 필수 (§4)
   → 응답 받으면 그때부터 내 표식이 생긴다. 이후 겹 이동은 평소처럼 join
```

즉 **내 표식의 생성 시점이 두 갈래**다: 기록이 있으면 `PRESENCE_JOINED`, 없으면 첫 `play` 응답.

### 3.4 접속 유지 · 종료

| 무엇 | destination | 주기/시점 | 안 하면 |
| --- | --- | --- | --- |
| heartbeat | `/app/presence/heartbeat` | **15초 간격** | 45초 넘으면 남들 화면에서 내가 사라진다 |
| leave | `/app/presence/leave` | `pagehide` 등 | 연결이 끊기면 자동 정리되므로 선택. 보내면 즉시 사라진다. **보낸 뒤에는 heartbeat 타이머를 반드시 멈춘다** — 계속 보내면 15초마다 `PRESENCE_STALE` 이 쌓인다 |
| resync | `/app/presence/resync` | — | 쓰지 않는다. 상태 복원은 재연결 후 join·viewport 재전송으로 한다 |

heartbeat 를 늦게 보내 이미 만료됐다면 `PRESENCE_STALE` 이 온다 → 재연결 → join·viewport 재전송.

### 3.5 여러 탭

위치는 탭끼리 공유되고, **조종권은 마지막에 연 탭**에 있다. 이전 탭이 join·viewport 를 보내면 `PRESENCE_STALE` 이 온다. 그 탭은 재시도하지 말고 "다른 탭에서 사용 중" 상태로 둔다(표식·목록 갱신 중지).

---

## 4. 재생 선언 · 종료 (REST)

곡 재생은 **위치 이동의 유일한 원본**이다. 이 호출을 해야 내 표식이 그 곡으로 날아가고, 남들 화면에도 내 이동이 나타난다.

> **소켓 프레임이 REST 응답보다 먼저 올 수 있다.** 재생 처리 중에 서버가 밀어내는 `NEARBY_SNAPSHOT`·`VIEWPORT_*` 가 `play` 의 HTTP 응답보다 먼저 도착하는 경우가 실측으로 확인됐다. 그러니 "play 응답을 받은 뒤 상태를 갱신한다" 는 순서를 전제하면 안 된다. 소켓에서 온 목록과 REST 응답은 **서로 다른 상태**(남의 목록 / 내 위치)를 갱신하도록 분리해 두면 순서에 상관없이 안전하다.

### 4.1 재생 — `POST /api/music/play`

요청:

```json
{ "musicId": 8812, "source": "MAP", "layer": 2 }
```

| 필드 | 필수 | 값 |
| --- | --- | --- |
| `musicId` | O | 재생할 곡 |
| `source` | O | `"MAP"` \| `"JOURNEY"` \| `"PLAYLIST"` \| `"FOLLOW"` — 어느 화면에서 틀었는지 |
| `layer` | 사실상 O | `useMapStore.getState().layer`. **항상 넣는다.** 이미 지도에 서 있으면 무시되고, 아직 없으면 이 값으로 첫 자리를 잡는다 |

응답 `data`:

```json
{ "playHistoryId": 501, "musicId": 8812, "layer": 2,
  "x": 0.37, "y": 1.24, "cellX": 6, "cellY": 12 }
```

| 필드 | 쓰임 |
| --- | --- |
| `playHistoryId` | **보관한다.** 재생이 끝날 때 이 ID 로 종료를 보낸다 |
| `layer` | 내가 실제로 서 있는 겹 |
| `x`, `y` | 내 표식의 원시 PC 좌표. 그 곡이 상주 집합에 있으면 엔진이 이미 아는 자리와 같다 |
| `cellX`, `cellY` | 디버깅용. 화면 계산에 쓰지 않는다 |

호출 규칙:

- **소켓이 연결된 뒤에** 부른다. 연결 전에 부르면 422 로 거부된다.
- 한 번 부를 때마다 재생 기록 한 줄이 쌓인다. 같은 곡을 다시 눌러도 부른다.
- **일시정지 → 재개는 다시 부르지 않는다.** 종료 시간만 갱신한다(§4.2).
- 좌표를 보내지 않는다. 곡 ID 만 보내면 자리는 서버가 정한다.

### 4.2 종료 — `PATCH /api/music/play/end`

```json
{ "playHistoryId": 501, "playedMs": 183000 }
```

| 필드 | 값 |
| --- | --- |
| `playHistoryId` | §4.1 응답에서 보관한 값 |
| `playedMs` | 실제로 들은 시간(ms), 0 이상. 여러 번 보내도 되고 마지막 값이 남는다 |

응답 `data` 는 `null`. 위치는 바뀌지 않는다.

보내는 시점: 곡이 끝났을 때 · 다음 곡으로 넘어갈 때 · 정지했을 때 · 탭을 닫을 때(`pagehide` 에서 `keepalive`).

### 4.3 지금 코드에서 바꿀 것

현재 `useRecordPlayMutation` 은 `POST /bff/music/{id}/play` 에 `{source, playedMs: 0}` 을 보내고 응답을 버린다. 종료는 어디서도 기록하지 않는다.

| 파일 | 할 일 |
| --- | --- |
| `constants/api-endpoints.ts` | `music.play` → `"/api/music/play"` (곡 ID 는 본문으로), `music.playEnd` → `"/api/music/play/end"` 추가 |
| `hooks/mutations/use-record-play-mutation.ts` | 본문 `{musicId, source, layer}`, 응답 타입 `PlayResponse`. `playedMs` 제거. 성공 시 `playHistoryId`·시작시각을 플레이어 스토어에 저장 |
| 새 `hooks/mutations/use-play-end-mutation.ts` | `PATCH` 호출 |
| `stores/use-player-store.ts` | `playHistoryId: number \| null`, `startedAt: number \| null` 추가. `playSeq` 가 바뀌면 이전 곡의 종료를 먼저 보낸다 |
| `lib/playback-events.ts` 구독부 | 실제 플레이어의 `ended`·`paused` 보고에서 누적 재생시간 계산 → 종료 호출 |
| 호출 지점 3곳 (`map-view.tsx` `playSong`, `use-song-play-toggle.ts` `toggle`, 그 외 큐 재생) | `layer` 를 함께 넘긴다 |

---

## 5. 지도 위 사람 (뷰포트)

**폴링이 아니다.** 지금 보고 있는 화면 범위를 한 번 보내면, 그 안의 사람을 스냅샷으로 받고 이후 변화는 델타로 밀려온다.

### 5.1 화면 보내기 — `/app/presence/viewport`

```json
{
  "requestSeq": 7,
  "layer": 2,
  "minX": -2.15, "maxX": 1.80, "minY": -0.90, "maxY": 3.42,
  "ancestorBounds": [
    { "layer": 0, "minX": -5.1, "maxX": 4.2, "minY": -3.3, "maxY": 6.0 },
    { "layer": 1, "minX": -1.0, "maxX": 2.5, "minY": -2.0, "maxY": 1.1 }
  ]
}
```

| 필드 | 만드는 법 | 규칙 |
| --- | --- | --- |
| `requestSeq` | 뷰포트 전용 카운터 | 1 이상 단조 증가. **join 카운터와 별개** |
| `layer` | `useMapStore.layer` (= `boxes.length`) | 0~7 |
| `minX...maxY` | 엔진 `viewBox()` | `min < max`, 유한수 |
| `ancestorBounds` | `boxes` 를 이름만 바꿔 복사 | 길이 = `layer`, `bounds[i].layer === i` 순서. 레이어 0 이면 `[]` |

```ts
const toViewportRequest = (seq: number, boxes: readonly LayerBox[], view: LayerBox) => ({
  requestSeq: seq,
  layer: boxes.length,
  minX: view.xMin, maxX: view.xMax, minY: view.yMin, maxY: view.yMax,
  ancestorBounds: boxes.map((b) => ({
    layer: b.layer, minX: b.xMin, maxX: b.xMax, minY: b.yMin, maxY: b.yMax,
  })),
});
```

보내는 시점:

| 시점 | 대기 |
| --- | --- |
| 팬·줌이 멎었을 때 | **250ms 디바운스** (움직이는 내내 보내지 않는다) |
| 겹이 바뀐 뒤 | join 다음에 |
| 재연결 직후 | join 다음에 |

주변 탐색 고리 뷰·별자리 뷰처럼 실제 지도 좌표를 보여주지 않는 동안에는 보내지 않아도 된다(표식도 그리지 않으므로).

### 5.2 받는 것 ① 전체 목록 — `VIEWPORT_SNAPSHOT`

`mode` 가 두 가지이고 **화면 구성이 완전히 다르다.**

**A. `mode: "INDIVIDUAL"` — 사람을 한 명씩 그린다**

```json
{ "requestSeq": 7, "mode": "INDIVIDUAL", "layer": 2,
  "groups": [
    { "musicId": 8812, "x": 0.37, "y": 1.24,
      "users": [
        { "email": "a@x.com", "nickname": "연희", "imageUrl": null, "riderCount": 0 }
      ] }
  ],
  "resolution": null, "cells": [] }
```

- `groups[]` = **같은 곡 위에 서 있는 사람들의 묶음.** 한 곡에 여러 명이면 한 그룹에 여러 명.
- `groups[].x/y` 가 그 곡의 원시 PC 좌표. 같은 그룹의 사람은 같은 자리이므로 겹쳐 그리지 말고 흩뿌리거나 뭉쳐 표시한다.
- **나는 목록에 없다.**

**B. `mode: "CLUSTERED"` — 사람 대신 "N명" 뭉치를 그린다**

```json
{ "requestSeq": 8, "mode": "CLUSTERED", "layer": 0,
  "groups": [],
  "resolution": 8,
  "cells": [ { "cellX": 2, "cellY": 5, "x": -3.13, "y": 1.02, "count": 14 } ] }
```

- 화면이 넓거나 사람이 많으면 이 모드로 온다. 개별 사람 정보는 오지 않는다.
- `cells[].x/y` 가 뭉치를 찍을 원시 PC 좌표(화면 범위 안으로 잘려서 온다). 그대로 찍는다.
- `count` 가 그 자리의 인원수. `cellX/cellY`·`resolution` 은 키·디버깅용이고 위치 계산에 쓰지 않는다.
- **이 모드에서는 개별 델타가 오지 않는다.** 대신 §5.4 의 주기 갱신을 받는다.

두 모드 모두 `requestSeq` 가 **내가 마지막에 보낸 값과 다르면 버린다.** (늦게 도착한 옛 화면의 결과)

### 5.3 받는 것 ② 개별 변화 — `VIEWPORT_ENTER` / `MOVE` / `LEAVE`

`INDIVIDUAL` 일 때만 온다.

```json
{ "requestSeq": 7, "email": "a@x.com", "nickname": "연희", "imageUrl": null,
  "musicId": 9001, "x": 2.05, "y": -0.71, "riderCount": 0 }
```

| type | 뜻 | 처리 |
| --- | --- | --- |
| `VIEWPORT_ENTER` | 화면 안으로 들어옴 | `email` 키로 추가(있으면 덮어쓰기) |
| `VIEWPORT_MOVE` | 화면 안에서 다른 곡으로 이동 | 그 사람의 `musicId`·`x`·`y` 갱신 → 우주선이 새 자리로 날아가는 연출 |
| `VIEWPORT_LEAVE` | 화면 밖으로 나감 · 접속 종료 | `email` 만 유효(나머지 `null`). 목록에서 제거 |

모든 델타는 `requestSeq` 가 현재 것이 아니면 버린다.

### 5.4 받는 것 ③ 뭉치 갱신 — `VIEWPORT_CELL_COUNTS`

`CLUSTERED` 일 때 **5초마다** 온다.

```json
{ "requestSeq": 8, "layer": 0, "resolution": 8,
  "cells": [ { "cellX": 2, "cellY": 5, "x": -3.13, "y": 1.02, "count": 12 } ] }
```

`cells` 를 **통째로 교체**한다. 인원수가 0 인 자리는 아예 오지 않으므로, 이전 목록에 있고 이번에 없으면 사라진 것이다.
현재 모드가 `INDIVIDUAL` 이거나 `requestSeq` 가 다르면 버린다.

### 5.5 닫기 — `/app/presence/viewport/close`

```json
{ "requestSeq": 8 }
```

마지막으로 보낸 `requestSeq` 를 넣는다. 지도를 떠날 때(언마운트) 보낸다. 안 보내도 새 화면 요청이 이전 것을 덮는다.

### 5.6 지금 `NearbyUser` 타입을 어떻게 채우나

엔진(`setFriends`)과 `draw-friends.ts` 는 그대로 쓸 수 있다. 서버가 주지 않는 필드는 아래처럼 채운다.

| `NearbyUser` 필드 | 출처 |
| --- | --- |
| `email`, `nickname`, `imageUrl`, `riderCount` | 그대로 (스냅샷 `users[]` / 델타) |
| `musicId` | 스냅샷은 `groups[].musicId`, 델타는 `musicId` |
| `isOnline` | **항상 `true`** — 목록에 있다는 것이 곧 접속 중이라는 뜻 |
| `isPublic` | **항상 `true`** — 비공개 계정은 아직 없다 |
| `viewingMusicId` | `musicId` 와 같게 — 따라가기가 없어 "보고 있는 곡"이 따로 오지 않는다 |
| `genreId` | 상주 집합에서 `musicId` 로 찾아 그 곡의 `genreId`, 없으면 `NO_GENRE_ID` |
| `meetingCount` | `0` — 뷰포트에는 오지 않는다(주변 사람 패널에만 있다) |
| `followingNickname` | `null` |
| `avatarSeed` | 지금처럼 이메일 해시로 생성 |

`riderCount` 는 **현재 항상 0** 이다(따라가기 미구현). 우주선·동승자 줄 연출은 값이 들어오기 전까지 뜨지 않는다 — 코드는 그대로 둬도 되지만 "동승자 N명" 같은 문구를 전제한 UI 는 아직 검증할 수 없다.

표식 자리는 두 가지로 정한다:
1. `musicId` 가 이 겹 상주 집합에 있으면 그 별 자리(`worldOf(musicId)`) — 지금 `anchorFor` 의 첫 분기와 같다.
2. 없으면 받은 `x`·`y` 를 그대로 쓴다. → **지금의 이메일 해시 폴백은 제거한다.** 엉뚱한 별에 붙이던 목 전용 코드다.

### 5.7 만들 것

| 파일 | 할 일 |
| --- | --- |
| 새 `lib/realtime/stomp-client.ts` | 연결·구독·봉투 파싱·`seq` 검사·heartbeat 타이머·재연결 시 join/viewport 재전송 |
| 새 `hooks/use-presence-join.ts` | `layer` 변화 감지 → join, `PRESENCE_JOINED` → `setMyMusicId`, `PRESENCE_NO_ANCHOR` → "아직 재생 전" 상태 |
| 새 `hooks/use-viewport-subscription.ts` | `boxes`+`viewBox` → 250ms 디바운스 → 요청, 스냅샷/델타/뭉치를 상태로 유지, 언마운트 시 close |
| `components/map/map-view.tsx` | `useNearbyUsersQuery(layer)` 제거 → 위 훅. `engine.setFriends(layer, friends)` 는 유지, `CLUSTERED` 면 뭉치 목록을 엔진에 별도 입력 |
| `components/map/engine/map-engine.ts` | `viewBox()` 공개(요청 범위용), 뭉치("N명") 렌더 입력 추가, `anchorFor` 해시 폴백 제거 |
| `components/map/render/draw-friends.ts` | 그대로. 뭉치 그리기만 추가 |
| `hooks/queries/use-nearby-users-query.ts`, `app/bff/users/nearby/route.ts`, `mocks/user.ts`, `hooks/use-mock-friend-reactions.ts` | 실연동에서 제거 (`USE_MOCK_API=1` 목 전용으로만 남긴다) |

---

## 6. 주변 사람 패널

뷰포트와 **기준이 다르다.** 화면 범위가 아니라 **내가 듣는 곡과 비슷한 곡(최대 10곡)을 듣는 사람**이고, 가까운 순 목록이다. 좌표는 오지 않는다(지도에 찍지 않는다).

### 6.1 열기 — `POST /api/realtime/nearby` (본문 없음)

응답 `data`:

```json
{
  "anchorMusicId": 8812,
  "snapshotSeq": 41,
  "people": [
    { "email": "a@x.com", "nickname": "연희", "imageUrl": null,
      "meetingCount": 3, "riderCount": 0,
      "musicId": 8812, "title": "곡 제목", "artist": "아티스트", "distance": 0.0 },
    { "email": "b@x.com", "nickname": null, "imageUrl": null,
      "meetingCount": 0, "riderCount": 0,
      "musicId": 9001, "title": "…", "artist": "…", "distance": 1.83 }
  ]
}
```

| 필드 | 뜻 |
| --- | --- |
| `anchorMusicId` | 기준이 된 **내 곡** |
| `snapshotSeq` | 이 목록이 이미 반영한 마지막 메시지 순번. **봉투 `seq` 가 이 값 이하인 `NEARBY_*` 는 버린다.** 연결이 새로 열리면 서버 카운터도 0 부터 다시 매겨지므로, 재연결 뒤에는 이 값을 반드시 새로 받아야 한다(§2.2) |
| `people[]` | 가까운 순 평면 목록. **나는 없다** |
| `people[].musicId/title/artist` | 그 사람이 지금 듣는 곡 |
| `people[].distance` | 내 곡과의 거리(정렬 근거). `0.0` 이면 나와 같은 곡 |
| `people[].meetingCount` | 나와 그 사람의 누적 만남 횟수 |
| `people[].nickname` | **`null` 일 수 있다** — 빈 자리 처리 필요 |
| `people[].riderCount` | 현재 항상 `0` |

호출 규칙:

- **패널을 열 때 한 번만** 부른다. 이 호출이 곧 실시간 구독 시작이다. **폴링 금지** (`refetchInterval` 없음, `staleTime: Infinity`).
- 아직 아무 곡도 재생하지 않았으면 422 로 거부된다 → "곡을 먼저 재생하세요" 안내.
- 503 이면 잠시 후 재시도 안내(계산 일시 실패).

### 6.2 실시간 변화 — `NEARBY_ENTER` / `MOVE` / `LEAVE` / `SNAPSHOT`

```json
{ "email": "c@x.com", "nickname": "도현", "imageUrl": null,
  "meetingCount": 1, "riderCount": 0, "musicId": 9004 }
```

| type | 처리 |
| --- | --- |
| `NEARBY_ENTER` | 목록에 추가. **`distance` 가 오지 않는다** → 이미 목록에 있는 `musicId` 면 그 곡 옆에, 아니면 맨 뒤에 넣는다 |
| `NEARBY_MOVE` | 그 사람의 `musicId`(+닉네임·사진·만남수) 갱신 |
| `NEARBY_LEAVE` | `email` 만 유효. 제거 |
| `NEARBY_SNAPSHOT` | **내 곡이 바뀌어 기준이 달라졌다.** payload 는 §6.1 과 같은 모양 → 목록을 **통째로 교체**하고 `snapshotSeq` 도 새 값으로 갱신 |

모든 `NEARBY_*` 는 봉투 `seq ≤ 현재 snapshotSeq` 면 버린다.

### 6.3 닫기 — `/app/nearby/close` (본문 없음)

패널을 닫을 때 보낸다. 안 보내면 델타가 계속 온다.

### 6.4 만들 것

| 파일 | 할 일 |
| --- | --- |
| `constants/api-endpoints.ts` | `realtime.nearby: "/api/realtime/nearby"` 추가 |
| 새 `hooks/queries/use-nearby-people-query.ts` | `useMutation` 성격의 1회 POST 를 `useQuery` 로 감싸되 `staleTime: Infinity`, `refetchInterval` 없음. `enabled: 패널열림 && features.social && 소켓연결됨` |
| 새 `hooks/use-nearby-people-live.ts` | `NEARBY_*` 수신 → `queryClient.setQueryData` 로 목록 갱신, `snapshotSeq` 필터, 패널 닫힐 때 `/app/nearby/close` |
| `components/panels/friends/friends-panel.tsx` | `useNearbyUsersQuery(layer)` → 위 훅. **`layer` 인자가 없어진다**(레이어와 무관한 목록). 안내 문구도 "이 영역의 사람" → "내가 듣는 곡과 비슷한 곡을 듣는 사람"으로 |
| `components/panels/friends/friend-row.tsx` | `isOnline` 항상 true, `followingNickname` 없음. 각 행에 **듣는 곡(title·artist)** 을 보여줄 자리가 생긴다. 따라가기 버튼은 숨긴다 |
| `types` | `NearbyPerson` 추가 (`NearbyUser` 와 다른 타입이다 — 좌표 없음, 곡 정보·거리·만남수 있음) |

---

## 7. 오류 처리

### 7.1 소켓 오류 — `/user/queue/errors`, `type: "PRESENCE_ERROR"`

```json
{ "code": "PRESENCE_NO_ANCHOR", "message": "…", "requestSeq": 1 }
```

| `code` | 언제 | 프론트가 할 일 |
| --- | --- | --- |
| `PRESENCE_NO_ANCHOR` | 첫 입장인데 재생 기록이 없음 | **정상 흐름.** 표식 없이 지도 표시 + 첫 재생 유도 (§3.3) |
| `PRESENCE_NOT_CONNECTED` | 연결이 준비되기 전에 요청 | 잠시 후 1회 재전송, 반복되면 재연결 |
| `PRESENCE_STALE` | 만료됐거나 이전 탭의 요청 | 재연결 → join·viewport 재전송. 다른 탭이 조종 중이면 갱신 중지 |
| `PRESENCE_LAYER_INVALID` | `layer` 가 0~7 밖 | 코드 버그 — `+1` 하고 있지 않은지 확인 |
| `PRESENCE_JOIN_INVALID` | `requestSeq`·`musicId` 가 1 미만이거나 본문 누락 | 코드 버그 |
| `PRESENCE_VIEWPORT_INVALID` | `min ≥ max`, `ancestorBounds` 개수·순서 불일치 | 코드 버그 — §5.1 규칙 확인 |
| `PRESENCE_LOCATION_NULL` | 그 곡의 좌표를 찾을 수 없음 | 드묾. 토스트 후 다른 곡 유도 |

`requestSeq` 는 join·viewport 오류에만 붙는다.

### 7.2 REST 오류 — 기존 `api.ts` 가 `ApiError` 로 던진다

| HTTP | `code` | 언제 |
| --- | --- | --- |
| 400 | `VALIDATION_ERROR` | `source` 오타, `musicId` 누락, `layer` 범위 밖, `playedMs` 음수 |
| 403 | `FORBIDDEN` | 종료 — 내 기록이 아니거나 없는 `playHistoryId` |
| 404 | `MUSIC_NOT_FOUND` | 없는 곡 |
| 422 | `PRESENCE_ERROR` | 소켓 미연결 / 첫 배치인데 `layer` 없음 / 곡 좌표 없음 / 재생한 곡 없이 주변 사람 요청 |
| 503 | `SERVICE_UNAVAILABLE` | 주변 사람 — 비슷한 곡 계산 일시 실패 |

`types/api.ts` 의 `ApiErrorCode` 에 `"PRESENCE_ERROR"`, `"SERVICE_UNAVAILABLE"` 을 추가한다.

---

## 8. 타입 정의 (새 `types/realtime.ts`)

```ts
/** 모든 소켓 수신 프레임의 봉투 */
export interface RealtimeMessage<T> {
  type: RealtimeMessageType;
  seq: number;
  ts: number;
  payload: T;
}

export type RealtimeMessageType =
  | "PRESENCE_JOINED"
  | "VIEWPORT_SNAPSHOT" | "VIEWPORT_ENTER" | "VIEWPORT_MOVE" | "VIEWPORT_LEAVE" | "VIEWPORT_CELL_COUNTS"
  | "NEARBY_SNAPSHOT" | "NEARBY_ENTER" | "NEARBY_MOVE" | "NEARBY_LEAVE"
  | "PRESENCE_ERROR";

// ── 내 위치 ───────────────────────────────────────────────
export interface JoinRequest { requestSeq: number; layer: number; musicId: number }
export interface PresenceJoined { requestSeq: number; layer: number; musicId: number }

// ── 재생 ─────────────────────────────────────────────────
export type PlaySource = "MAP" | "JOURNEY" | "PLAYLIST" | "FOLLOW";
export interface PlayRequest { musicId: number; source: PlaySource; layer?: number }
export interface PlayResponse {
  playHistoryId: number; musicId: number; layer: number;
  x: number; y: number; cellX: number; cellY: number;
}
export interface PlayEndRequest { playHistoryId: number; playedMs: number }

// ── 뷰포트 ───────────────────────────────────────────────
export interface LayerBound { layer: number; minX: number; maxX: number; minY: number; maxY: number }
export interface ViewportRequest {
  requestSeq: number; layer: number;
  minX: number; maxX: number; minY: number; maxY: number;
  ancestorBounds: LayerBound[];
}
export interface ViewportUser { email: string; nickname: string | null; imageUrl: string | null; riderCount: number }
export interface ViewportMusicGroup { musicId: number; x: number; y: number; users: ViewportUser[] }
export interface ViewportCellCount { cellX: number; cellY: number; x: number; y: number; count: number }
export interface ViewportSnapshot {
  requestSeq: number;
  mode: "INDIVIDUAL" | "CLUSTERED";
  layer: number;
  groups: ViewportMusicGroup[];
  resolution: number | null;
  cells: ViewportCellCount[];
}
export interface ViewportDelta {
  requestSeq: number; email: string;
  nickname: string | null; imageUrl: string | null;
  musicId: number | null; x: number | null; y: number | null; riderCount: number | null;
}
export interface ViewportCellCounts {
  requestSeq: number; layer: number; resolution: number; cells: ViewportCellCount[];
}
export interface ViewportCloseRequest { requestSeq: number }

// ── 주변 사람 ─────────────────────────────────────────────
export interface NearbyPerson {
  email: string; nickname: string | null; imageUrl: string | null;
  meetingCount: number; riderCount: number;
  musicId: number; title: string; artist: string | null; distance: number;
}
export interface NearbySnapshot { anchorMusicId: number; snapshotSeq: number; people: NearbyPerson[] }
export interface NearbyChange {
  email: string; nickname: string | null; imageUrl: string | null;
  meetingCount: number | null; riderCount: number | null; musicId: number | null;
}

// ── 오류 ─────────────────────────────────────────────────
export type WebSocketErrorCode =
  | "PRESENCE_NO_ANCHOR" | "PRESENCE_LOCATION_NULL" | "PRESENCE_LAYER_INVALID"
  | "PRESENCE_JOIN_INVALID" | "PRESENCE_VIEWPORT_INVALID" | "PRESENCE_STALE" | "PRESENCE_NOT_CONNECTED";
export interface PresenceErrorPayload { code: WebSocketErrorCode; message: string; requestSeq?: number }
```

상수(새 `constants/realtime.ts`):

```ts
export const REALTIME = {
  ws: { path: "/ws/websocket" },
  queue: { presence: "/user/queue/presence", errors: "/user/queue/errors" },
  send: {
    join: "/app/presence/join",
    heartbeat: "/app/presence/heartbeat",
    leave: "/app/presence/leave",
    viewport: "/app/presence/viewport",
    viewportClose: "/app/presence/viewport/close",
    nearbyClose: "/app/nearby/close",
  },
  heartbeatMs: 15_000,
  viewportDebounceMs: 250,
} as const;
```

---

## 9. 전체 흐름 한 장

```
로그인 완료 (accessToken 보유)
 │
 ├─ WS CONNECT  /ws/websocket   (Authorization: Bearer …)
 ├─ SUBSCRIBE   /user/queue/presence · /user/queue/errors
 │
 ├─ SEND /app/presence/join {requestSeq:1, layer:0, musicId:<저장값>}
 │    ├─ ← PRESENCE_JOINED {layer:0, musicId:8812}   → 내 표식 = 8812
 │    └─ ← PRESENCE_ERROR PRESENCE_NO_ANCHOR         → 표식 없음, 첫 재생 대기
 │
 ├─ 15초마다 SEND /app/presence/heartbeat
 │
 ├─ 지도 멎고 250ms → SEND /app/presence/viewport {requestSeq:1, layer:0, minX.., ancestorBounds:[]}
 │    ├─ ← VIEWPORT_SNAPSHOT (INDIVIDUAL)  → groups[] 로 사람 그리기
 │    │   └─ ← VIEWPORT_ENTER / MOVE / LEAVE  (계속)
 │    └─ ← VIEWPORT_SNAPSHOT (CLUSTERED)   → cells[] 로 "N명" 뭉치
 │        └─ ← VIEWPORT_CELL_COUNTS  (5초마다 전체 교체)
 │
 ├─ 곡 재생 → POST /api/music/play {musicId:9001, source:"MAP", layer:0}
 │    ← {playHistoryId:501, musicId:9001, layer:0, x, y}  → 내 표식 이동 + playHistoryId 보관
 │  곡 종료 → PATCH /api/music/play/end {playHistoryId:501, playedMs:183000}
 │
 ├─ 파고들기 (layer 0 → 1)
 │    1) SEND /app/presence/join     {requestSeq:2, layer:1, musicId:9001}
 │       ← PRESENCE_JOINED {layer:1, musicId:9001}
 │    2) SEND /app/presence/viewport {requestSeq:2, layer:1, ancestorBounds:[{layer:0,…}]}
 │       ← VIEWPORT_SNAPSHOT …
 │
 ├─ 주변 사람 패널 열기 → POST /api/realtime/nearby
 │    ← {anchorMusicId, snapshotSeq:41, people[]}
 │    ← NEARBY_ENTER / MOVE / LEAVE  (seq > 41 만)
 │    ← NEARBY_SNAPSHOT  (내 곡이 바뀌면 통째 교체)
 │  패널 닫기 → SEND /app/nearby/close
 │
 └─ 지도 떠남 → SEND /app/presence/viewport/close {requestSeq:2}
    탭 닫힘 → SEND /app/presence/leave → DISCONNECT
```

---

## 10. 작업 체크리스트

**신규 파일**

- [ ] `lib/realtime/stomp-client.ts` — 연결 · 구독 · 봉투 파싱 · seq 검사 · heartbeat · 재연결 복원
- [ ] `types/realtime.ts` — §8 타입
- [ ] `constants/realtime.ts` — §8 상수
- [ ] `hooks/use-presence-join.ts`
- [ ] `hooks/use-viewport-subscription.ts`
- [ ] `hooks/mutations/use-play-end-mutation.ts`
- [ ] `hooks/queries/use-nearby-people-query.ts`
- [ ] `hooks/use-nearby-people-live.ts`

**수정**

- [ ] `package.json` — `@stomp/stompjs`
- [ ] `.env.example` — `NEXT_PUBLIC_WS_ORIGIN`
- [ ] `constants/api-endpoints.ts` — `music.play` 경로 변경, `music.playEnd`·`realtime.nearby` 추가
- [ ] `constants/live-api-paths.ts` — 실시간 3경로 + 실로그인 경로
- [ ] `types/api.ts` — `PRESENCE_ERROR`, `SERVICE_UNAVAILABLE`
- [ ] `hooks/mutations/use-record-play-mutation.ts` — 본문·응답·`layer`
- [ ] `stores/use-player-store.ts` — `playHistoryId`, 종료 전송
- [ ] `components/map/map-view.tsx` — 폴링 → 뷰포트 구독, 재생 호출에 `layer`
- [ ] `components/map/engine/map-engine.ts` — `viewBox()` 공개, 뭉치 렌더, 해시 폴백 제거
- [ ] `components/map/render/draw-friends.ts` — 뭉치 그리기
- [ ] `components/panels/friends/friends-panel.tsx` · `friend-row.tsx` — 주변 사람 실연동, 듣는 곡 표시, 따라가기 숨김

**목 전용으로 격리 (`USE_MOCK_API=1`)**

- [ ] `hooks/queries/use-nearby-users-query.ts`
- [ ] `app/bff/users/nearby/route.ts`
- [ ] `mocks/user.ts` 의 `mockNearbyUsers`
- [ ] `hooks/use-mock-friend-reactions.ts`

---

## 11. 수동 검증 시나리오

브라우저 두 개(다른 계정)로 확인한다.

| # | 확인할 것 | 기대 |
| --- | --- | --- |
| 1 | 로그인 → 소켓 연결 | 콘솔에 CONNECTED, 오류 큐 조용함 |
| 2 | 재생 기록 없는 새 계정 접속 | `PRESENCE_NO_ANCHOR` 1회, 지도는 정상, 내 표식 없음 |
| 3 | 그 계정이 첫 곡 재생 | play 응답 200, 내 표식 생김. **다른 브라우저 화면에 그 사람이 나타남** |
| 4 | A 가 다른 곡 재생 | B 화면에서 A 가 새 자리로 이동(`VIEWPORT_MOVE`) |
| 5 | A 가 화면 밖 곡으로 이동 | B 화면에서 A 사라짐(`VIEWPORT_LEAVE`) |
| 6 | 줌아웃해서 넓게 보기 | `mode: CLUSTERED` 로 바뀌고 "N명" 뭉치, 5초마다 숫자 갱신 |
| 7 | 파고들기 | join → viewport 순서로 나가고, 새 겹의 사람만 보임 |
| 8 | 팬·줌을 빠르게 반복 | 요청이 250ms 뒤 **한 번만** 나감, 옛 응답이 화면을 덮지 않음 |
| 9 | 주변 사람 패널 열기 | 목록이 가까운 순, 내가 빠져 있음, 각 행에 듣는 곡 표시 |
| 10 | A 가 곡 변경 (패널 연 상태) | B 패널에서 A 의 곡이 바뀜(`NEARBY_MOVE`) |
| 11 | 내가 곡 변경 (패널 연 상태) | 패널 목록이 통째로 새로 옴(`NEARBY_SNAPSHOT`) |
| 12 | 패널 닫기 → A 가 곡 변경 | 더 이상 `NEARBY_*` 가 오지 않음 |
| 17 | `leave` 뒤 heartbeat 중단 확인 | `PRESENCE_STALE` 이 반복해서 오지 않음 |
| 13 | 탭 두 개로 같은 계정 접속 | 나중 탭이 정상 동작, 이전 탭은 `PRESENCE_STALE` |
| 14 | 네트워크 끊었다 복구 | 재연결 후 join·viewport 가 다시 나가고 목록이 복구됨 |
| 15 | 곡 끝까지 재생 | `PATCH /play/end` 1회, 403 아님 |
| 16 | 45초간 heartbeat 중단(강제) | 남의 화면에서 내가 사라짐 → 재연결로 복구 |

---

## 12. 실측에서 드러난 것 — 프론트가 반드시 처리해야 할 것

로컬 백엔드 + 배포 DB로 1인 · 2인 · 3인 수동 테스트를 돌려 확인한 내용이다.
아래는 **전부 프론트 쪽에서 코드로 막아야 하는 것**이고, 서버가 알아서 봐주지 않는다.

### 12.1 백그라운드 탭에서 presence 가 끊긴다 — 가장 자주 터진다

브라우저는 화면에 보이지 않는 탭의 `setInterval` 을 **약 1분 간격까지 늘려버린다.**
15초로 걸어둔 heartbeat 가 실측에서 **53~61초 간격**으로 나갔고, presence 는 그보다 먼저 만료됐다.
그 결과 `PRESENCE_STALE` 이 연달아 오고, 그 상태에서 누른 재생은 **422 `PRESENCE_ERROR`** 로 실패했다.

탭을 다시 열었을 때 화면이 살아나게 하려면 이렇게 짠다.

```ts
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") return;
  // 백그라운드에 있는 동안 만료됐다고 가정하고 무조건 복구한다
  sendJoin({ musicId: currentMusicId, layer: currentLayer });
  sendViewport(currentViewport);
  if (isNearbyPanelOpen) refetchNearby();
});
```

규칙 셋.

- **`setInterval` heartbeat 만 믿지 않는다.** 탭 복귀(`visibilitychange`)를 진짜 복구 지점으로 쓴다.
- **`PRESENCE_STALE` 은 에러 토스트가 아니다.** 사용자에게 아무것도 띄우지 말고 조용히 join·viewport 재전송으로 처리한다. 토스트를 띄우면 백그라운드에 오래 둔 사용자가 복귀할 때마다 경고가 쌓인다.
- **재생 버튼을 누르기 직전에 한 번 더 join 을 보낸다.** 재생(`POST /api/music/play`)은 presence 가 살아 있어야 200 이 온다. 만료 상태에서 누르면 422 다. 재생 호출 전에 join 을 선행시키면 이 실패가 사라진다.
- 422 `PRESENCE_ERROR` 를 받았을 때도 **자동 복구 1회**(join 재전송 → 재생 재시도)까지는 프론트가 처리한다. 그래도 실패하면 그때 사용자에게 알린다.

### 12.2 `seq` 는 연결마다 0부터 다시 시작한다 — 재연결 때 반드시 초기화

서버의 `seq` 는 **연결 단위 카운터**다. 재연결하면 다시 1부터 온다.
마지막으로 받은 `seq` 를 전역에 들고 있으면, 재연결 직후 들어오는 정상 프레임이 전부 "과거 프레임"으로 판정돼 **화면이 통째로 안 그려진다.** 테스트 페이지에서 실제로 모든 프레임이 버려졌다.

```ts
onConnect(() => {
  lastRecvSeq = 0;   // 반드시 0 으로
  snapshotSeq = 0;
  mode = null;
  // 그 다음에 join · viewport 재전송
});
```

`seq` 검사는 **한 연결 안에서만** 유효하다는 것을 주석으로 남겨둬라. 이건 다시 밟기 쉬운 함정이다.

### 12.3 소켓 요청은 실패해도 아무 응답이 안 올 수 있다 — 타임아웃을 걸어라

REST 는 실패하면 4xx/5xx 가 오지만, **소켓은 아니다.** `/app/presence/join` 이 서버 내부에서 예상 못 한 이유로 실패하면 `/user/queue/errors` 에도 아무것도 오지 않고 **그냥 조용하다.** 실측에서 join 을 보내고 응답도 오류도 오지 않는 상황이 실제로 나왔다.

그래서 join·viewport 는 **응답을 기다리는 쪽에 타임아웃이 필요하다.**

```ts
const JOIN_TIMEOUT_MS = 3000;

sendJoin(payload);
const timer = setTimeout(() => {
  // 성공(스냅샷·델타)도 PRESENCE_ERROR 도 안 왔다 = 실패로 간주
  retryOnce() ?? showRetryUi();
}, JOIN_TIMEOUT_MS);
// 관련 프레임이나 오류를 받으면 clearTimeout(timer)
```

무한정 로딩 스피너를 돌리는 화면을 만들지 마라. 응답이 영영 안 오는 경우가 실재한다.

### 12.4 재연결하면 구독이 전부 날아간다 — 세 가지를 다시 보내야 한다

연결이 끊겼다 붙으면 서버 쪽 구독 상태가 남아 있지 않다. 재연결 직후 순서대로 보낸다.

1. `/app/presence/join` — 내 위치 복구
2. `/app/presence/viewport` — 지도 위 사람 구독 복구
3. 주변 사람 패널이 열려 있었다면 `POST /api/realtime/nearby` **재호출** — 이건 REST 지만 구독 등록을 겸한다. 다시 부르지 않으면 패널은 떠 있는데 `NEARBY_*` 가 영영 안 온다.

순서가 중요하다. join 이 먼저 성공해야 viewport 와 nearby 가 의미를 가진다.

### 12.5 토큰이 만료되면 소켓도 같이 다시 붙여야 한다

실시간 API 는 토큰 없이 부르면 **401** 이 온다(실측 확인). `api.ts` 의 재발급 흐름이 REST 는 알아서 복구하지만, **소켓은 CONNECT 프레임에 토큰을 한 번 실어 보낸 뒤 그대로 유지된다.** 재발급만 하고 끝내면 REST 는 되는데 소켓은 옛 토큰으로 붙어 있는 어긋난 상태가 된다.

토큰이 재발급되면 **소켓을 끊고 새 토큰으로 다시 연결**하고, 12.4 의 복구 절차를 그대로 태워라.

### 12.6 `playedMs` 는 프론트에서 상한을 걸어라

`PATCH /api/music/play/end` 의 `playedMs` 는 큰 값을 넣으면 서버에서 실패한다.
탭을 열어두고 방치한 뒤 종료를 보내면 비정상적으로 큰 값이 만들어질 수 있다.

- 재생 시작 시각 기준 경과시간을 그대로 보내지 말고, **곡 길이(또는 합리적 상한)로 잘라서** 보낸다.
- 백그라운드 방치 시간은 실제 재생 시간이 아니다. `visibilitychange` 로 누적을 멈추는 편이 정확하다.

### 12.7 주변 사람 503 은 일시 실패다 — 패널을 죽이지 마라

`POST /api/realtime/nearby` 의 **503 `SERVICE_UNAVAILABLE`** 은 비슷한 곡 계산이 일시적으로 실패했다는 뜻이다(테스트 중 서버 데이터 정비로 실제 발생). 영구 오류가 아니다.

- 패널을 비활성화하거나 기능을 숨기지 말고, **"다시 시도" 버튼**이 있는 빈 상태로 둔다.
- 자동 재시도를 건다면 **1회, 2~3초 뒤**까지만. 연타하면 서버에 부담만 준다.
- 404·422 와 달리 **사용자 잘못이 아니므로** 문구도 그렇게 쓴다("잠시 후 다시 시도해주세요").

### 12.8 추가 체크리스트

- [ ] `stomp-client.ts` — `onConnect` 에서 `seq` 상태 전부 초기화 (12.2)
- [ ] `stomp-client.ts` — join·viewport 요청 타임아웃 (12.3)
- [ ] `stomp-client.ts` — 재연결 시 join → viewport → nearby 재전송 (12.4)
- [ ] `stomp-client.ts` — 토큰 재발급 시 소켓 재연결 (12.5)
- [ ] `use-presence-join.ts` — `visibilitychange` 복귀 처리 (12.1)
- [ ] `use-record-play-mutation.ts` — 재생 전 join 선행, 422 시 1회 자동 복구 (12.1)
- [ ] `use-play-end-mutation.ts` — `playedMs` 상한 (12.6)
- [ ] `use-nearby-people-query.ts` — 503 재시도 UI (12.7)
- [ ] `PRESENCE_STALE` 은 토스트 금지, 조용히 복구 (12.1)

### 12.9 검증 시나리오 추가

| # | 확인할 것 | 기대 |
| --- | --- | --- |
| 18 | 탭을 2분간 백그라운드로 둔 뒤 복귀 | 자동으로 내 표식·지도 위 사람이 복구됨. 경고 토스트 없음 |
| 19 | 백그라운드 방치 후 복귀하자마자 재생 | 422 없이 200 |
| 20 | 네트워크 끊고 30초 뒤 복구 | 프레임이 버려지지 않고 화면이 다시 그려짐 (`seq` 초기화 확인) |
| 21 | 주변 사람 패널 연 채로 재연결 | 재연결 후에도 `NEARBY_*` 가 계속 옴 |
| 22 | 토큰 만료 후 아무 동작 | REST·소켓 둘 다 복구됨 |
