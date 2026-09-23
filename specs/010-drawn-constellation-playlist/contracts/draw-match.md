# Contract: 그린 별자리 매칭 API

## `POST /api/artwork/draw` — 인증 필요

그린 점에 대응하는 곡을 고른다. **플레이리스트를 만들지 않는다**(FR-020). 저장은 기존 `POST /api/playlist/create`.

### Request

```jsonc
{
  "points": [ { "x": 0.12, "y": 0.80 }, { "x": 0.45, "y": 0.20 }, { "x": 0.78, "y": 0.81 } ]
}
```

| 필드 | 규칙 |
| --- | --- |
| `points` | 3~20개, 순서 = 연결 순서 = 재생 순서 |
| `x`, `y` | 캔버스 기준 0~1. **x 오른쪽, y 아래**(캔버스 좌표 ÷ 캔버스 크기) |

### Response `200`

```jsonc
{
  "success": true,
  "data": {
    "score": 98,                // 모양 일치도 0~100. 이동·회전·균일 배율 불변, 반사는 다른 모양
    "quality": "HIGH",          // HIGH(≥90) · MEDIUM(≥70) · LOW(<70)
    "points": [                 // 요청 점 순서 그대로, 곡 중복 없음
      { "musicId": 900, "x": -0.42, "y": 0.13 }
    ]
  },
  "error": null
}
```

- `points` 좌표는 `POST /api/constellations/layout` 에 같은 `musicId` 목록을 넣은 값과 **같다**(FR-011). 저장 후 다시 열어도 같은 별자리가 된다.
- 같은 요청이면 항상 같은 응답이다(FR-012).
- `quality: "LOW"` 도 `200` 이다. FE 는 성공 표시 대신 낮은 품질 경고를 띄우고 저장은 허용한다(Clarifications).

### Errors

| 상황 | HTTP | `error.code` | FE 안내 (FR-016) |
| --- | --- | --- | --- |
| 점 3개 미만 · 20개 초과 · 좌표 누락/0~1 밖 | 400 | `INVALID_INPUT` | 입력 개수 부족 (FE 가 먼저 막는다) |
| 점이 한 자리에 몰림 (bbox 긴 변 < 0.02) | 400 | `ARTWORK_DRAWING_DEGENERATE` **(신규)** | 입력 모양 오류 |
| 비로그인 | 401 | `UNAUTHENTICATED` | 로그인 필요 |
| 서버 오류 | 500 | `INTERNAL_SERVER_ERROR` | 매칭 처리 실패 |
| (FE) 10 s 무응답 | — | — | 매칭 처리 실패 |

## 저장 — 기존 API 그대로

```jsonc
// POST /api/playlist/create
{ "playlistName": "내 별자리 143012", "musicIdList": [900, 901, 902] }   // draw 응답 points 순서 그대로
```

같은 이름이 있으면 기존 `PLAYLIST_NAME_DUPLICATED`(409). 이름 기본값은 FE 가 채운다.
