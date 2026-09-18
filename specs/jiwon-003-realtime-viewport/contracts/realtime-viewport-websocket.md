# Contract: 실시간 뷰포트 WebSocket

## 0. 공통

- Endpoint: 기존 STOMP endpoint 사용
- 인증: CONNECT의 로그인 사용자, 서버 식별자는 `Principal.getName()`
- C→S prefix: `/app`
- S→C data queue: `/user/queue/presence`
- S→C error queue: `/user/queue/errors`
- 서버 봉투:

```json
{
  "type": "VIEWPORT_SNAPSHOT",
  "seq": 42,
  "ts": 1789673255299,
  "payload": {}
}
```

아래 문서의 모든 응답 예시는 이 봉투의 `payload` 안에 들어간다.

`seq`는 서버가 이 연결에 보낸 메시지 순서다. 아래 `requestSeq`는 프론트가 보낸 화면 요청 순서이므로 서로 바꿔 쓰지 않는다. `ts`는 서버가 보낸 시각(epoch milliseconds)이다.

기존 레이어별 곡 조회와 `MapEngine.boxes`는 [frontend-layer-navigation.md](frontend-layer-navigation.md)를 따른다. 여기의 `ancestorBounds`는 major 요청을 만든 boxes와 값이 반드시 같아야 한다.

## 1. 화면 조회·구독

### Destination

`SEND /app/presence/viewport`

### Request

```json
{
  "requestSeq": 17,
  "layer": 3,
  "minX": -1.1,
  "maxX": 2.4,
  "minY": -1.8,
  "maxY": 2.6,
  "ancestorBounds": [
    { "layer": 1, "minX": -3.2, "maxX": 4.1, "minY": -2.0, "maxY": 5.7 },
    { "layer": 2, "minX": -1.4, "maxX": 2.9, "minY": -2.2, "maxY": 3.1 }
  ]
}
```

예시는 서버 layer 3이다. `minX...maxY`는 현재 PC5·PC6의 raw 화면 범위이고 ancestorBounds는 이전 PC1·PC2, PC3·PC4 진입 범위다.

### Validation

- `requestSeq > 0`, 연결 동안 단조 증가
- `layer`는 1~8
- 모든 min < max, NaN·Infinity 불가
- layer 1은 `ancestorBounds=[]`
- layer N은 ancestorBounds가 정확히 N-1개
- 각 bound.layer는 1부터 N-1까지 중복 없이 연속
- 프론트 내부 레이어가 0~7이면 전송 직전에 +1

### Response A — Individual

`type = VIEWPORT_SNAPSHOT`

```json
{
  "requestSeq": 17,
  "mode": "INDIVIDUAL",
  "layer": 3,
  "groups": [
    {
      "musicId": 101,
      "x": 0.42,
      "y": 0.61,
      "users": [
        {
          "email": "user@example.com",
          "nickname": "off_beat",
          "imageUrl": "https://example.com/profile.png",
          "riderCount": 0
        }
      ]
    }
  ],
  "resolution": null,
  "cells": []
}
```

### Response B — Clustered

`type = VIEWPORT_SNAPSHOT`

```json
{
  "requestSeq": 18,
  "mode": "CLUSTERED",
  "layer": 3,
  "groups": [],
  "resolution": 8,
  "cells": [
    { "cellX": 2, "cellY": 4, "x": 0.31, "y": 0.58, "count": 31 },
    { "cellX": 3, "cellY": 4, "x": 0.44, "y": 0.58, "count": 12 }
  ]
}
```

`x`·`y`는 합친 셀의 가운데를 곡 마커와 같은 기준으로 계산한 표시 위치다. 현재 화면 범위 안으로 잘라서 내려주므로 프론트는 그대로 찍으면 된다. `cellX`·`cellY`는 `resolution` 기준 격자 번호이며, 마커 위치 계산에 다시 쓰지 않는다.

프론트는 응답의 `requestSeq`가 현재 화면 요청보다 작으면 렌더링하지 않는다.

모드 판정:

```text
걸치는 기본 셀 > 36 OR 정확 필터 사용자 > 20 → CLUSTERED
그 외 → INDIVIDUAL
```

## 2. 셀 인원수 갱신

서버가 CLUSTERED 화면에 5초마다 보낸다.

`type = VIEWPORT_CELL_COUNTS`

```json
{
  "requestSeq": 18,
  "layer": 3,
  "resolution": 8,
  "cells": [
    { "cellX": 2, "cellY": 4, "x": 0.31, "y": 0.58, "count": 29 },
    { "cellX": 3, "cellY": 4, "x": 0.44, "y": 0.58, "count": 14 }
  ]
}
```

`cells[]` 항목의 형태는 §1 Response B와 같다. 인원수가 0인 셀은 보내지 않는다.

현재 mode가 INDIVIDUAL이거나 requestSeq가 다르면 무시한다.

## 3. 개별 사용자 델타

### ENTER

`type = VIEWPORT_ENTER`

```json
{
  "requestSeq": 17,
  "email": "user@example.com",
  "nickname": "off_beat",
  "imageUrl": "https://example.com/profile.png",
  "musicId": 101,
  "x": 0.42,
  "y": 0.61,
  "riderCount": 0
}
```

### MOVE

`type = VIEWPORT_MOVE`

```json
{
  "requestSeq": 17,
  "email": "user@example.com",
  "nickname": "off_beat",
  "imageUrl": "https://example.com/profile.png",
  "musicId": 205,
  "x": 0.48,
  "y": 0.55,
  "riderCount": 0
}
```

### LEAVE

`type = VIEWPORT_LEAVE`

```json
{
  "requestSeq": 17,
  "email": "user@example.com",
  "nickname": null,
  "imageUrl": null,
  "musicId": null,
  "x": null,
  "y": null,
  "riderCount": null
}
```

프론트 처리 규칙:

- 모든 델타: requestSeq가 현재 viewport 요청과 다르면 무시
- ENTER: email 기준 추가 또는 upsert
- MOVE: email 기준 기존 마커를 새 곡 그룹·좌표로 이동, 없으면 upsert
- LEAVE: email 기준 제거, 이미 없으면 무시
- CLUSTERED 화면에서는 세 이벤트를 렌더링하지 않음

## 4. 화면 종료

### Destination

`SEND /app/presence/viewport/close`

### Request

```json
{
  "requestSeq": 18
}
```

응답 본문은 없다. `requestSeq`는 마지막으로 적용된 viewport 요청과 같아야 한다. 다르면 이전 화면의 늦은 close로 보고 무시한다. 서버는 저장된 meta로만 구독을 정리하며 프론트는 화면이 실제로 닫힐 때 보내고 단순 팬·줌에는 보내지 않는다.

## 5. 레이어 이동

prefetch 시작이 아니라 실제 layer·boxes가 변경되고 전환 화면이 안정된 뒤 아래 순서를 지킨다.

1. 현재 `MapEngine.boxes`를 서버 1-based ancestorBounds로 변환
2. `SEND /app/presence/join { "requestSeq": nextJoinSeq, "layer": newLayer, "musicId": currentMusicId }`
3. 같은 join requestSeq의 `PRESENCE_JOINED` 확인
4. 새 layer, 새 현재 화면, 같은 ancestorBounds로 `SEND /app/presence/viewport`
5. 새 곡도 함께 바꾸는 경우에만 join ACK 뒤 `POST /api/music/play`
6. 늦은 major 응답으로 화면 범위가 바뀌면 더 큰 viewport requestSeq로 갱신

viewport 요청만 보내면 자신의 presence 레이어는 바뀌지 않는다.

### 입장 응답 — PRESENCE_JOINED

`type = PRESENCE_JOINED`

```json
{
  "requestSeq": 4,
  "layer": 3,
  "musicId": 101
}
```

`requestSeq`는 방금 보낸 join 요청의 순번이므로, 프론트는 이 값으로 자기 요청의 응답인지 가린다. 다른 값이면 버린다.

`layer`·`musicId`는 **서버가 실제로 적용한 값**이다. 요청의 `musicId`가 그대로 오지 않을 수 있다 — 첫 입장은 서버가 재생 기록으로 검증한 곡을 쓰고, 이후 입장은 레이어만 옮기면서 서버에 남아 있는 현재 곡을 유지한다. 프론트는 요청값이 아니라 이 응답값을 화면 상태로 삼는다.

입장 요청 자체가 거부되면 `PRESENCE_JOINED` 대신 `/user/queue/errors`로 오류가 오며, 그 오류 payload에도 같은 `requestSeq`가 실린다(§7).

## 6. 연결과 재연결

### 최초 연결

1. 기존 `useMapSongsQuery([])`로 level 1 곡 상태 준비
2. STOMP CONNECT
3. `/user/queue/presence`, `/user/queue/errors` SUBSCRIBE 완료
4. `/app/presence/join { requestSeq, layer, musicId: 마지막 재생곡 }`
5. 같은 requestSeq의 `PRESENCE_JOINED` 확인 — **또는** `PRESENCE_NO_ANCHOR` 오류(아래 참조)
6. 현재 layer·화면·boxes에서 만든 ancestorBounds로 `/app/presence/viewport`
7. 주변사람 패널이 열려 있으면 nearby open REST 호출
8. heartbeat 시작

**재생 기록이 없는 사용자**(처음 온 사용자)는 4번 join이 `PRESENCE_NO_ANCHOR`로 거부된다. 입장할 곡이 없기 때문이다. 이 경우 프론트는 오류를 "아직 지도에 없음"으로 받아들이고 6번부터 계속 진행한다 — 위치 없이도 남을 보는 것은 정상이다. 이 사용자가 처음 지도에 나타나는 순간은 첫 `POST /api/music/play`이며, 그 요청의 `layer`로 자리를 잡는다. 프론트는 play 요청에 **항상 현재 보고 있는 레이어를 `layer`로 넣어** 보낸다(이미 서 있는 사용자면 서버가 무시한다).

기록이 있는 사용자는 join이 끝나면 마지막 재생곡 위치에 배치되어 다른 사용자에게 노출된다. 이후 playEnd는 재생 시간만 끝내고 마지막 위치의 노출은 유지한다. 노출 제거는 leave·disconnect·TTL 만료에서 수행한다.

### 재연결

새 연결은 새 epoch이므로 최초 연결과 같은 순서를 다시 수행한다. 끊기기 전 requestSeq를 이어 쓸 필요는 없으며 새 연결에서는 1부터 시작할 수 있다.

### 명시 종료

지도 화면만 닫으면 viewport close를 보낸다. 앱 실시간 연결 전체를 닫으면 기존 `/app/presence/leave` 후 DISCONNECT 흐름을 따른다.

## 7. 오류

`/user/queue/errors`의 기존 실시간 오류 봉투를 사용한다. `payload`는 다음과 같고, 요청 순번을 아는 오류에만 `requestSeq`가 붙는다(모르면 생략).

```json
{
  "code": "PRESENCE_JOIN_INVALID",
  "message": "입장 요청 순번은 1 이상이어야 한다",
  "requestSeq": 4
}
```

`code`는 `PRESENCE_NO_ANCHOR`, `PRESENCE_LOCATION_NULL`, `PRESENCE_LAYER_INVALID`, `PRESENCE_JOIN_INVALID`, `PRESENCE_VIEWPORT_INVALID`, `PRESENCE_STALE`, `PRESENCE_NOT_CONNECTED` 중 하나다.

| 상황 | 처리 |
| --- | --- |
| presence 없음 또는 만료 | `PRESENCE_STALE`, 프론트 재연결 흐름 수행 |
| 재생 기록 없는 사용자의 join | `PRESENCE_NO_ANCHOR`, 오류 아님 — "아직 지도에 없음"으로 처리하고 viewport 계속 (§6) |
| layer·현재 범위·ancestorBounds 오류 | `PRESENCE_VIEWPORT_INVALID`, 현재 화면 유지 |
| join 요청값 오류(순번·레이어·곡 ID) | `PRESENCE_JOIN_INVALID`, 같은 `requestSeq`로 회신 |
| stale epoch/requestSeq | 서버 무시, 필요 시 debug metric만 증가 |
| 내부 조회 실패 | 기존 realtime internal 오류, 프론트는 직전 화면 유지 후 재시도 |

## 8. Frontend Verification Checklist

- [ ] 모든 S→C 메시지를 `payload`에서 읽는다(`data` 아님).
- [ ] `PRESENCE_JOINED`의 `layer`·`musicId`를 요청값 대신 화면 상태로 삼는다.
- [ ] join이 `PRESENCE_NO_ANCHOR`로 거부돼도 viewport·heartbeat는 계속한다.
- [ ] `POST /api/music/play`에 항상 현재 레이어를 `layer`로 넣는다.
- [ ] 소켓 queue 구독 전에 join/viewport를 보내지 않는다.
- [ ] 팬·줌은 250ms debounce한다.
- [ ] requestSeq를 요청마다 증가시킨다.
- [ ] 응답 requestSeq가 현재 값과 다르면 버린다.
- [ ] layer 0~7을 서버 1~8로 변환한다.
- [ ] 기존 boxes·prefetch·query cache를 다시 구현하지 않고 재사용한다.
- [ ] major와 viewport가 같은 boxes 값에서 만든 ancestorBounds를 사용한다.
- [ ] prefetch만으로 layer·join·viewport를 바꾸지 않는다.
- [ ] 늦은 major 응답으로 화면이 바뀌면 더 큰 requestSeq로 viewport를 갱신한다.
- [ ] layer 전환 시 join 후 viewport를 보낸다.
- [ ] mode 전환 시 이전 사용자/셀 마커를 모두 지운다.
- [ ] email 기준 ENTER/MOVE/LEAVE를 멱등 처리한다.
- [ ] 현재 viewport와 requestSeq가 다른 델타를 버린다.
- [ ] 화면 종료 시 viewport close를 보낸다.
- [ ] 재연결 시 join→viewport→nearby 순서를 재실행한다.
