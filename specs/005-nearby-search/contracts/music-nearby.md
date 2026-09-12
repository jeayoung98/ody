# Contract: `GET /api/music/nearby` (005)

**작성**: 2026-09-13 | **상태**: 제안 — 구현 전 `docs/api-spec.md` §3.5 로 반영해야 한다(헌법 II)

---

## 1. 요청

```text
GET /api/music/nearby?id={musicId}
GET /api/music/nearby?pc1={}&pc2={}&...&pc16={}
```

인증 필요(정본 §0.1·§0.7). 현재 `SecurityConfig` 가 `permitAll` 이라 실제로는 열려 있다 — 이 기능이 바꾸지 않는다(research R6).

| 파라미터 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | int | 배타 택1 | 기준 곡 id. 1 이상 |
| `pc1`~`pc16` | float | 배타 택1 | 기준 지점 좌표. 16개 전부 |

**정확히 하나**를 줘야 한다. 둘 다 주거나 둘 다 안 주면 400 이다 — 서버가 우선순위를 정하지 않는다.

## 2. 응답 200

```json
{
  "success": true,
  "data": {
    "center": {
      "id": 1000000,
      "title": "Manifesto",
      "artist": "CCCP Fedeli Alla Linea",
      "location": { "pc1": 4.3231773, "pc2": -0.79649943, "pc16": 0.6472596 }
    },
    "neighbors": [
      {
        "id": 1024529,
        "title": "The Last Dj",
        "artist": "Tom Petty & The Heartbreakers",
        "album": null,
        "genres": ["GN1000"],
        "youtubeUrl": "https://www.youtube.com/results?search_query=...",
        "location": { "pc1": 4.1850863, "pc16": -0.08339364 },
        "distance": 2.464320107530008
      }
    ],
    "lowSimilarity": false
  },
  "error": null
}
```

- `neighbors` 는 **최대 10**. 규칙을 통과한 곡이 적으면 그만큼만 온다. 0곡이면 빈 배열 + 200
- 정렬은 `distance` 오름차순, 동률 시 `id` 오름차순. 같은 요청은 같은 목록·같은 순서를 준다
- 좌표 기준 요청이면 `center.id`·`title`·`artist` 는 `null` 이고 `location` 만 채워진다
- `lowSimilarity` 는 마지막 이웃 거리가 `tauFar` 를 넘었다는 뜻이다. **오류가 아니다** — 결과는 그대로 준다

`location` 은 `pc1`~`pc16` 16개 필드를 모두 담는다(위 예시는 줄여 적었다).

### 이웃 원소

`MusicSummary` + `distance`. **곡 상세(§3.2)의 `neighbors` 원소와 같은 타입이고, 같은 곡을 기준으로 하면 같은 목록이다**(SC-006).

## 3. 오류

| 상황 | 코드 | HTTP |
| --- | --- | --- |
| `id`·좌표를 둘 다 주거나 둘 다 안 줌 | `INVALID_INPUT` | 400 |
| `id` 가 0 이하·비정수 | `INVALID_INPUT` | 400 |
| 좌표가 16개 미만이거나 숫자가 아님 | `INVALID_INPUT` | 400 |
| `id` 에 해당하는 곡 없음 | `MUSIC_NOT_FOUND` | 404 |
| 내부 실패 | `INTERNAL_SERVER_ERROR` | 500 |

실패 본문은 공통 구조 `{success:false, data:null, error:{code,message}}`.

## 4. 선정 규칙 — 이 API 가 약속하는 것

이웃은 **최근접 순서 그대로가 아니다.** 아래를 통과한 곡만 담긴다.

1. 기준점 곡 자신 제외
2. 기준점과 같은 녹음(거리 `tauDup` 미만) 제외
3. 기준점과 제목·아티스트가 같은 곡 제외
4. 이미 담은 이웃과 제목·아티스트가 같은 곡 제외
5. 한 아티스트는 `artistCap`(3)곡까지
6. 재생 길이가 범위(30~1200초) 밖인 곡 제외

규칙이 실제로 걷어내는 양은 크지 않다 — 2026-09-13 운영 실측 기준 후보 99개 중 평균 3.4개. **`lowSimilarity` 는 약 9% 확률로 뜬다**(700곡 표본). 드문 예외가 아니다.

재생 수단이 없는 곡은 **그 이유만으로는 빼지 않는다**(FR-007).

임계값은 좌표계 버전(`ody.serving.bundle`)에 묶여 있다. **버전이 바뀌면 결과도 바뀐다** — 클라이언트가 값을 캐시해 재현하려 하면 안 된다.

## 5. §3.2(곡 상세)에 생기는 변경

같은 규칙이 곡 상세의 `neighbors` 에도 적용된다(003 FR-014).

| | 이전 | 이후 |
| --- | --- | --- |
| 이웃 선정 | 최근접 10곡을 그대로 | 선정 규칙 통과 후 최대 10곡 |
| 개수 | 항상 10 (후보가 있으면) | **10보다 적을 수 있음** |
| 응답 필드 | — | **`lowSimilarity` 추가** |

## 6. 성능

p95 **1초 이내**(요구사항 §6). 운영 실측 참고: 곡 상세 웜 90~150ms, HNSW `ef_search` 200 기준 웜 4.0ms / **콜드 350ms**.

## 7. 부수효과

없다. 재생 수·최근 들은 곡을 바꾸지 않고 서버에 탐색 세션을 두지 않는다. 같은 요청을 반복해도 상태가 변하지 않는다.
