# Contract: 근처 사람 목록 — `POST /realtime/nearby`

**Spec**: [../spec.md](../spec.md) FR-N01~N06, N10 | **Date**: 2026-09-14 | **소유**: BE3 박지원
**정본**: Notion `/realtime/nearby` API 명세 페이지(계약 정본) · 📡 실시간 (Presence · Nearby) API 명세 §5.1(델타). 이 문서는 저장소 스냅샷이며, 어긋나면 Notion을 먼저 고친다.
**상태**: 초안. FE2(Service) 리뷰 전 — 소켓 `/app/nearby/open` → REST 전환 확인 필요.

## 1. 진입 (REST)

`POST /realtime/nearby` — 주변사람 버튼. 스냅샷 반환 + 델타 구독 등록(비멱등, 재호출 안전).

| 항목 | 값 |
| --- | --- |
| 인증 | `Authorization: Bearer {accessToken}`. 본인 = 토큰 subject(email), body 없음 |
| 앵커 | 서버가 `presence:user:{email}.musicId`에서 읽음(클라 미지정) |
| 근처 기준 | **레이어 무관 전역** `listeners:{musicId}` |

**성공 200** (공통 envelope):

```json
{ "success": true,
  "data": {
    "anchorMusicId": 10234,
    "groups": [
      { "musicId": 10877, "title": "...", "artist": "...",
        "x": 0.62, "y": 0.31, "distance": 0.0412,
        "users": [ { "nickname": "off_beat", "imageUrl": "https://..." } ] }
    ]
  },
  "error": null }
```

- 앵커곡 그룹 포함(`distance:0`), 자기 자신 `users` 제외, 청취자 0명 곡 그룹째 생략(빈 `groups` 정상).
- `x, y` = 요청자 현재 레이어 정규화 좌표, `distance` = 원시 pc 거리.

**에러**

| HTTP | code | 조건 |
| --- | --- | --- |
| 401 | `INVALID_TOKEN`/`TOKEN_EXPIRED` | 토큰 |
| 422 | `PRESENCE_NO_ANCHOR` | 재생 선언 전(앵커 없음) |
| 503 | `SERVICE_UNAVAILABLE` | 이웃곡 조회(BE2) 지연·실패 — 빈 목록으로 숨기지 않음 |

> `PRESENCE_NO_ANCHOR`(422)는 공통 §0.5 에러표에 추가 필요.

## 2. 갱신 (소켓 델타) — 구독 이후

`/user/queue/presence`로 델타만. 재스냅샷 없음. 봉투·순서(seq)의 정본은 📡 실시간 명세.

| type | 발생 | payload |
| --- | --- | --- |
| `NEARBY_ENTER`/`MOVE`/`LEAVE` | 패널 열린 동안 이웃곡 청취자 변동 | `{ nickname, imageUrl, fromMusicId?, toMusicId?, x?, y? }` |

- 닫기: `/app/nearby/close`(WS) 또는 연결 종료 시 자동 해제.
- 본인 앵커곡 변경 → 프론트가 이 API 재호출.

## 3. 구현 정합성 조건 (계약에 드러나는 부분)

- **① 순서**: 구독 등록을 청취자 스냅샷 읽기보다 먼저(누락 방지, 중복 델타는 클라 idempotent).
- **② 정리**: 구독(`nearby:subscribers`·`nearby:meta`)은 `presence-leave.lua`·sweep가 `nearby:meta` 기준으로 해제(orphan 방지).

## 4. 협의 항목

- [ ] FE2: 소켓 `/app/nearby/open` → REST `POST /realtime/nearby` 전환 확인
- [ ] 이웃곡 어댑터 시점(B-3, BE2) — 그 전 BE3는 스텁
- [ ] `/api` 프리픽스 정리(BE1)
