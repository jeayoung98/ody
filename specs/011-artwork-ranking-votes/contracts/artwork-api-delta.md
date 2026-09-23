# Contract Delta: `/api/artwork/*` (S15P21A405-616)

기존 계약(BACKEND-NOTES §6, 563)에서 **바뀌는 것만**. 모두 필드 추가라 기존 FE 는 깨지지 않는다 — 단 리더보드 **순서**와 좋아요 **거절**은 동작이 바뀐다.

## `GET /api/artwork/round/current`

```jsonc
{ "roundId": 1, "theme": "고양이", "startsAt": "...", "endsAt": "...",
  "voteLimit": 3,        // 신규 — 회차 한도
  "myVotesLeft": 2 }     // 신규 — 로그인 사용자의 남은 표. 비로그인이면 null
```

(리더보드 응답의 `round` 도 같은 모양. 거기서도 로그인이면 `myVotesLeft` 가 찬다.)

## `POST /api/artwork/submit`

```jsonc
{ "playlistId": 12, "closed": true }   // closed 신규·선택. 없으면 false
```

## `GET /api/artwork/leaderboard`

항목(`ArtworkSummary`)에 추가:

```jsonc
{ ...,
  "rankScore": 13.5,     // 신규 — 좋아요 + AI×aiWeight/100. 이 값의 내림차순이 순서
  "closed": false,       // 신규
  "points": [ { "musicId": 900, "title": "곡", "artist": "가수", "x": -0.42, "y": 0.13 } ] }  // 신규 — 썸네일·곡 목록
```

- **정렬 변경**: `score ↓, likeCnt ↓` → `rankScore ↓, score ↓, createdAt ↑`.
- `rank` 는 이 순서의 순번(기존 필드, 의미 동일).

## `GET /api/artwork/detail`

- `closed` 추가.
- `tracks: [{musicId, title, artist, x, y}]` 추가 — 리더보드 `points` 와 같은 원소. 좌표와 곡 이름이 한 원소라 순번이 어긋나지 않는다. 기존 `points`(좌표)·`musics`(곡 상세)는 호환을 위해 그대로 둔다(`musics` 는 지워진 곡이 빠져 `points` 와 순번이 다를 수 있다).

## `GET /api/artwork/mine`

- 항목에 `closed` 추가 (`rankScore`·`points` 는 리더보드 전용).

## `POST /api/artwork/like` — 새 거절 사유

| 상황 | HTTP | `error.code` |
| --- | --- | --- |
| 이번 회차 표를 다 씀 (누를 때) | 409 | `ARTWORK_VOTE_LIMIT` **(신규)** |
| 내 작품 | 400 | `ARTWORK_VOTE_SELF` **(신규)** |
| 작품 회차가 닫힘 (누르기·거두기 모두) | 409 | `ARTWORK_ROUND_CLOSED` (기존 코드) |

응답은 그대로 `{ artworkId, liked, likeCnt }`. 남은 표는 회차를 다시 조회해 확인한다.

## FE(602) 목 → 실제 API 매핑

| FE 목 | 실제 |
| --- | --- |
| `GET /bff/contests/current` | `GET /api/artwork/round/current` (`voteLimit`·`myVotesLeft`) |
| `POST .../match` | `POST /api/artwork/draw` (598) |
| `POST .../judge` | 없음 — 채점은 출품 뒤 비동기. 출품 전 미리보기는 draw 의 `score`(모양 일치도) |
| `POST .../entries` | `/api/playlist/create` → `POST /api/artwork/submit {playlistId, closed}` → `detail` 재조회(PENDING→SCORED) |
| `GET .../entries?sort=final` | `GET /api/artwork/leaderboard` |
| `POST`·`DELETE .../vote` | `POST /api/artwork/like {artworkId, liked}` |
| `POST .../save` | `POST /api/playlist/create` (출품작 `points` 의 musicId 순서) — 저장 수는 이번 범위 밖 |
