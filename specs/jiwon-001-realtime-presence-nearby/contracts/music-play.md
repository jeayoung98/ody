# Contract: `POST /music/play` · `PATCH /music/play/end`

**Spec**: [../spec.md](../spec.md) FR-010~019 | **Date**: 2026-09-10 | **소유**: BE3 Realtime | **정본**: Notion Front ↔ Back API (담당 박지원)
**상태**: 경로 확정(2026-09-10, Notion 정본 우선) — `POST /music/play` + `PATCH /music/play/end`. 저장소 BACKEND-NOTES A-7(`POST /api/music/{id}/play`)은 구버전. 잔여: `/music/play/end` **네이밍**만 BE1 확인(Notion 남은 협의 #4).

공통 규약(봉투·에러·인증)은 Notion 「API 명세서」 §0 및 `backend/.../common/ApiResponse.java`를 따른다. 본인 대상 API이므로 **email을 받지 않는다**(§0.7) — 토큰 subject 사용.

## 1. `POST /music/play` — 재생 선언

사용자가 재생 버튼을 누를 때. **지도상 위치는 현재 재생 곡이 정하므로 이 API가 위치 이동의 유일한 원본이다.** 좌표는 서버가 `musicId`로 계산한다.

| | |
| --- | --- |
| method | POST |
| uri | `/music/play` |
| 인증 | 필요 (`Authorization: Bearer`) |
| Content-Type | `application/json` |

**Request body**

| 이름 | 타입 | 필수 | 검증 | 위반 |
| --- | --- | --- | --- | --- |
| `musicId` | long | required | 곡 존재 · `music.location` NOT NULL | `MUSIC_NOT_FOUND` 404 / `PRESENCE_ERROR` 422 |
| `source` | string | required | `MAP` \| `JOURNEY` \| `PLAYLIST` \| `FOLLOW` | `VALIDATION_ERROR` 400 |
| `layer` | int | optional | 1~8. **아직 지도에 서 있지 않을 때만** 쓴다(첫 재생). 이미 서 있으면 무시하고 서버 레이어 유지 | 범위 밖 `VALIDATION_ERROR` 400 / 지도에 없는데 누락 `PRESENCE_ERROR` 422 |

**Response 200**

```json
{
  "success": true,
  "data": {
    "playHistoryId": 88213,
    "musicId": 10234,
    "layer": 3,
    "x": 0.62,
    "y": 0.31,
    "cellX": 9,
    "cellY": 4
  },
  "error": null
}
```

| 필드 | 의미 |
| --- | --- |
| `playHistoryId` | `/music/play/end`에서 `playedMs` 갱신에 사용 |
| `layer` | 요청자가 **실제로 서 있는 레이어**. 이미 지도에 있었으면 그 레이어(요청 `layer` 무시), 첫 재생이면 요청 `layer`. 이 API로 레이어가 바뀌지 않는다 |
| `x`, `y` | 현재 레이어 표시 2축의 정규화 좌표(0~1). FE는 내 마커 보정에만 사용 |
| `cellX`, `cellY` | 소속 셀(격자 16). FE 표시 불필요 — 디버깅용 |

**서버 처리 순서** (FR-012): ① 좌표·셀 계산(원자 단위 밖) → ② Lua 원자 갱신(구곡 SREM·셀·인원수 / 신곡 SADD·셀·인원수 / presence) → ③ `play_history` INSERT(`played_ms = 0`) → ④ 델타 팬아웃(뷰포트·근처) → ⑤ 만남 증가(비동기).

**의미 규칙**

- 같은 곡 재선언: 위치·청취자·만남 **no-op**, `play_history`만 INSERT. 응답은 정상 200(현재 좌표).
- **첫 재생 = 첫 배치**(2026-09-18 확정): 재생 기록이 없는 사용자는 `/app/presence/join`을 할 수 없다(입장할 곡이 없다). 그래서 CONNECT 후 첫 `POST /music/play`가 지도에 처음 나타나는 순간이며, 이때 `layer`로 어느 레이어에 놓을지 받는다. 기록이 있는 사용자는 join으로 먼저 자리를 잡고 오므로 `layer`는 무시된다. FE는 두 경우를 구분하지 않고 **항상 현재 보고 있는 레이어를 `layer`에 넣어** 보내면 된다.
- presence가 없는 상태(WebSocket 미연결)에서 호출: `PRESENCE_ERROR 422 (PRESENCE_NOT_CONNECTED)`로 거부한다. FE 흐름상 WS 연결이 선행되므로 정상 경로에서는 발생하지 않는다.
- Sweep과 경쟁해 old 곡 불일치: `PRESENCE_ERROR 422 (PRESENCE_STALE)` — FE 재시도 1회 권장.
- `youtubeUrl` NULL 곡: 이 API와 무관(FE가 재생 불가 표시). 위치 이동은 정상 처리된다.

**에러**

| code | HTTP | 상황 |
| --- | --- | --- |
| `VALIDATION_ERROR` | 400 | `musicId` 누락/타입, `source` 범위 밖 |
| `INVALID_TOKEN` / `TOKEN_EXPIRED` | 401 | 공통 |
| `MUSIC_NOT_FOUND` | 404 | 곡 없음 |
| `PRESENCE_ERROR` | 422 | `location` NULL · presence 없음 · Sweep 경쟁 (세부는 `error.message`) |

## 2. `PATCH /music/play/end` — 재생 종료 기록

곡 재생이 끝나거나 다른 곡으로 넘어갈 때 실제 재생 시간을 기록한다. `play_history.played_ms`는 NOT NULL이지만 시작 시점에는 알 수 없어 `/music/play`가 0으로 쓰고 이 API가 갱신한다. **위치는 변하지 않는다.**

| | |
| --- | --- |
| method | PATCH |
| uri | `/music/play/end` |
| 인증 | 필요 |

**Request body**

| 이름 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `playHistoryId` | long | required | `/music/play` 응답값 |
| `playedMs` | long | required | 실제 재생 시간(ms), ≥ 0 |

**Response 200**

```json
{ "success": true, "data": null, "error": null }
```

**의미 규칙**

- 소유자 검증: `play_history.email == token.email`. 불일치·존재하지 않는 ID 모두 `FORBIDDEN` 403(존재 유무 비노출).
- 멱등: 같은 ID 재호출 시 마지막 값으로 덮어쓴다.
- 호출 유실(브라우저 강제 종료): `played_ms = 0`으로 남는다. 분석 지표이며 presence 무영향.

**에러**

| code | HTTP |
| --- | --- |
| `VALIDATION_ERROR` | 400 |
| `INVALID_TOKEN` / `TOKEN_EXPIRED` | 401 |
| `FORBIDDEN` | 403 |

## 3. 정본 §0.5 에러표 추가 요청 **[BE1]**

| code | HTTP | message 예시 |
| --- | --- | --- |
| `PRESENCE_ERROR` | 422 | 지도에 표시할 수 없는 곡입니다. / 실시간 연결이 없습니다. |

구현은 `realtime/common/RealtimeErrorCode implements ErrorCode` (기존 `MusicErrorCode` 패턴).

## 4. 경로 정합 확인 항목

- [x] Q2: Notion 2경로로 확정(2026-09-10). BACKEND-NOTES A-7 갱신 필요 **[T082]**
- [ ] `/music/play/end` 네이밍 최종 확인 **[BE1]** (Notion 남은 협의 #4)
- [ ] `/api` 프리픽스: 기존 `MusicController`는 `/music`, `SecurityConfig`는 `/api/auth/*`. 이 API는 `/music/play`로 두되 팀 프리픽스 정리 시 함께 이동 **[BE1]**
- [ ] `SecurityConfig`가 `anyRequest().permitAll()`이라 현재 `/music/play`가 **미인증으로 열려 있다**. `/music/play*`·`/api/realtime/**`를 `authenticated()`로 올려야 한다 **[요청: BE1]** — 없으면 Principal null로 NPE
- [ ] 컨트롤러 클래스 위치: `realtime/play/MusicPlayController`(BE3 소유)가 `/music` 하위 경로를 매핑 — BE2 `MusicController`와 경로 충돌 없음 확인(`/music/major·search·detail` vs `/music/play·play/end`)
