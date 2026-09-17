# Contract: Realtime WebSocket (STOMP) — Presence · Viewport · Nearby

**Spec**: [../spec.md](../spec.md) | **Date**: 2026-09-10 | **정본**: Notion 「📡 실시간 (Presence · Nearby) API 명세」(2026-09-10) — 이 문서는 저장소 스냅샷 + BE3 구현 관점 보충.
**상태**: 초안. FE1(Map)·FE2(Service) 리뷰 전. 기존 `contracts/websocket/{destinations,events,recovery}.md`(09-07 구버전)를 **이 문서로 교체**한다(리뷰 후).

## 0. 공통

| 항목 | 값 |
| --- | --- |
| 엔드포인트 | `/ws` (SockJS fallback), app prefix `/app`, user prefix `/user` |
| 인증 | CONNECT 네이티브 헤더 `Authorization: Bearer {accessToken}` — REST와 동일 토큰. 실패 시 연결 거부, **클라이언트 재시도 금지**(네트워크 오류만 지수 백오프) |
| 세션 주체 | 토큰 subject(email). **payload에 email 금지** — 사용자 표현은 `{nickname, imageUrl}` |
| 좌표 언어 | 클라이언트 → 서버: **원시 pc값**. 서버 → 클라이언트: 정규화 좌표 `x, y ∈ [0,1]` 또는 셀 번호. 정규화·셀 변환은 서버만 |
| 봉투 (S→C) | `{ "type": string, "seq": long, "ts": epochMillis, "payload": object }` — `seq`는 **세션 단위** 단조 증가. 스냅샷의 `seq` 이하 델타는 클라이언트가 버린다 |
| 오류 (S→C) | `/user/queue/errors` ← `PRESENCE_ERROR {code, message}` |
| 구독 대상 (C) | `/user/queue/presence` (스냅샷·델타 전부), `/user/queue/errors` |

- 브로드캐스트 토픽은 **없다.** 모든 S→C는 개인 큐다(서버가 수신자를 구독 인덱스로 결정 — bounds·모드 검사를 서버가 강제하기 위함).
- `regionId`는 없다. 영역 정체성 = `layer + 누적 bounds`.

## 1. Client → Server (`/app/...`)

| destination | payload | 관련 FR | 비고 |
| --- | --- | --- | --- |
| `/app/presence/join` | `{ "layer": int, "musicId": long }` | FR-006, R-13 | **배치·복원** — 마지막 재생곡을 보낸다. 서버가 그 곡 좌표로 노출. `play_history` INSERT·만남 **없음**(재생이 아님). 서버는 `play_history` 최신 1건과 대조(불일치면 서버 값). 기록 없으면 비노출 유지 |
| `/app/presence/heartbeat` | — (빈 body) | FR-022 | 15s 주기. `presence:expiry` 갱신만 |
| `/app/presence/leave` | — | FR-020 | 즉시 전체 정리. onClose와 같은 경로 |
| `/app/presence/viewport` | `ViewportRequest` (§1.1) | FR-050~056 | debounce 250ms 후 전송. `layer` 변경 = 레이어 이동 |
| `/app/presence/resync` | — | FR-004 | 자동 복원하지 않고 `PRESENCE_STALE`로 재연결 안내 |
| `/app/nearby/open` | — | FR-070~072 | 스냅샷 + 구독 등록 한 번에 |
| `/app/nearby/close` | — | FR-077 | 저장된 목록으로 해제 |

### 1.1 `ViewportRequest`

```json
{
  "layer": 3,
  "minX": -2.13, "maxX": 1.87,
  "minY": -0.44, "maxY": 3.02,
  "bounds": [
    { "axis": 1, "min": -8.1,  "max": 0.2  },
    { "axis": 2, "min": -1.4,  "max": 6.5  },
    { "axis": 3, "min": -2.13, "max": 1.87 },
    { "axis": 4, "min": -0.44, "max": 3.02 }
  ]
}
```

- `minX..maxY`: 현재 레이어 표시 2축(레이어 l → PC(2l−1), PC(2l))의 **원시 pc값** 화면 범위. `min < max` 필수.
- `bounds`: 레이어 1~현재까지 누적 축 범위(1~2N축). 서버가 후보 사용자의 재생곡 좌표에 전부 적용한다. 비어 있으면 `PRESENCE_ERROR`.
- 검증 실패 코드: `PRESENCE_LAYER_INVALID`, `PRESENCE_VIEWPORT_INVALID`.

## 2. Server → Client (`/user/queue/presence`)

| type | payload | 관련 FR | 발생 |
| --- | --- | --- | --- |
| `VIEWPORT_SNAPSHOT` | §2.1 | FR-051, 055, 060 | viewport 수신 |
| `VIEWPORT_ENTER` / `VIEWPORT_MOVE` / `VIEWPORT_LEAVE` | §2.2 | FR-057, 058 | INDIVIDUAL 구독자에게만 |
| `VIEWPORT_CELL_COUNTS` | `{ layer, resolution, cells[{cellX, cellY, count}] }` | FR-061 | CLUSTERED 사용자에게 주기(초기 5s) |
| `NEARBY_SNAPSHOT` | §2.3 | FR-070, 071 | nearby/open·앵커 변경 |
| `NEARBY_ENTER` / `NEARBY_MOVE` / `NEARBY_LEAVE` | §2.4 | FR-074 | 패널 열린 동안만 |
| `PRESENCE_ERROR` | `{ code, message }` | FR-042 | `/user/queue/errors` |

### 2.1 `VIEWPORT_SNAPSHOT`

```json
{ "type": "VIEWPORT_SNAPSHOT", "seq": 1002, "ts": 1725690000000,
  "payload": {
    "layer": 3,
    "mode": "INDIVIDUAL",
    "groups": [
      { "musicId": 10877, "x": 0.31, "y": 0.42,
        "users": [ { "nickname": "off_beat", "imageUrl": "https://..." } ] }
    ]
  } }
```

`mode: "CLUSTERED"`일 때:

```json
{ "type": "VIEWPORT_SNAPSHOT", "seq": 1003, "ts": 1725690000500,
  "payload": {
    "layer": 3,
    "mode": "CLUSTERED",
    "resolution": 8,
    "cells": [ { "cellX": 4, "cellY": 2, "count": 17 } ]
  } }
```

- `groups`: 곡 좌표가 **실제 뷰포트 사각형 안**이고 청취자가 요청자의 누적 bounds를 통과한 곡만. 자기 자신 제외.
- `resolution` (**정본 대비 추가 제안 — FE 확인**): 16/8/4. `cells`의 `cellX, cellY`는 이 해상도 기준. FE가 화면 좌표로 되돌릴 때 필요.
- `nickname`은 NULL 가능(UNIQUE 없음) — FE 대체 표시 필요.

### 2.2 `VIEWPORT_ENTER` / `MOVE` / `LEAVE`

```json
{ "type": "VIEWPORT_MOVE", "seq": 1043, "ts": 1725690001500,
  "payload": {
    "nickname": "off_beat", "imageUrl": "https://...",
    "fromMusicId": 10877, "toMusicId": 20415,
    "x": 0.55, "y": 0.18
  } }
```

- `ENTER`: `fromMusicId` 없음. `LEAVE`: `toMusicId`·`x`·`y` 없음.
- 셀이 바뀌는 이동은 구셀 구독자에게 `LEAVE`, 신셀 구독자에게 `ENTER`, 양쪽 다 보는 사람에게 `MOVE` 1건.
- 수신자의 사각형·bounds 밖이면 발송되지 않는다(FR-058).

### 2.3 `NEARBY_SNAPSHOT`

```json
{ "type": "NEARBY_SNAPSHOT", "seq": 1001, "ts": 1725690000000,
  "payload": {
    "anchorMusicId": 10234,
    "groups": [
      { "musicId": 10877, "title": "Through the Night", "artist": "IU",
        "x": 0.62, "y": 0.31, "distance": 0.0412,
        "users": [ { "nickname": "off_beat", "imageUrl": "https://..." },
                   { "nickname": "low_pass", "imageUrl": null } ] }
    ]
  } }
```

- 앵커곡 그룹 포함(`distance: 0`). 자기 자신 제외. 청취자 0명 곡은 그룹째 생략 → `groups`가 빌 수 있다(정상).
- `x, y`는 요청자의 **현재 레이어** 표시축 기준 정규화 좌표.

### 2.4 `NEARBY_ENTER` / `MOVE` / `LEAVE`

`VIEWPORT_*`와 같은 payload 형태(`nickname, imageUrl, fromMusicId?, toMusicId?, x?, y?`). `MOVE`는 이웃곡 → 이웃곡 이동.

## 3. 오류 코드 (`PRESENCE_ERROR.code`)

| code | 상황 |
| --- | --- |
| `PRESENCE_NO_ANCHOR` | 재생 선언 전 `nearby/open` |
| `PRESENCE_LOCATION_NULL` | `location` NULL 곡 (WS join 복원 경로에서 발견 시) |
| `PRESENCE_LAYER_INVALID` | 배정표에 없는 layer |
| `PRESENCE_VIEWPORT_INVALID` | `min ≥ max`, bounds 비어있음 |
| `PRESENCE_STALE` | 곡 변경이 Sweep 정리와 경쟁해 중단됨 (재시도 권장) |

## 4. 복구 규칙

1. **재연결**: CONNECT부터. 서버는 `sessionEpoch`를 올리고 이전 세션 정리는 epoch 비교로 새 상태를 지우지 않는다. 클라이언트는 개인 큐 구독 후 `join` → `viewport` → 필요 시 `nearby/open`을 다시 보낸다.
2. **seq gap**: 복구가 필요하면 새로 연결한 뒤 위 순서로 상태를 다시 보낸다. `/app/presence/resync`는 과거 화면을 복원하지 않는다.
3. **debounce**: viewport는 250ms debounce 후 전송. 매 프레임 전송 금지.

## 5. 기존 `contracts/websocket/`와의 차이 (교체 근거)

| 구버전 (09-07) | 이 계약 |
| --- | --- |
| `/app/presence/move {layerId, x, y}` | 삭제 — 위치는 `POST /music/play`로만 |
| `/topic/presence/layer/{layerId}` 브로드캐스트 | 개인 큐 + 구독 인덱스 |
| `PRESENCE_JOIN/MOVE/LEAVE` (userId 노출) | `VIEWPORT_*`·`NEARBY_*` (nickname/imageUrl) |
| heartbeat 25s | 15s |
| `/app/reaction/*`, `/app/follow/*` | 이번 범위 밖 (문서에서 제거하지 않고 "이후 단계" 표기) |

## 6. FE 리뷰 항목

- [ ] `ViewportRequest.bounds` 구조 확인 (Notion 남은 협의 #3)
- [ ] `resolution` 필드 추가 수용 여부
- [ ] `nickname` NULL 대체 표시 정책
- [x] `/app/presence/join` payload `{layer, musicId}` — Q1 확정(2026-09-10)
- [ ] join `musicId`를 서버가 `play_history`와 대조하는 방어 — FE2 확인
- [ ] FE1 · FE2 리뷰 완료 (미완 — 합의 전 payload 확정 금지)
