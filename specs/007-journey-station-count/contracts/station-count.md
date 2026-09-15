# Contract: `AxisFrame.stationCount`

**Feature**: 007-journey-station-count

HTTP 계약은 바뀌지 않는다 — `GET /api/music/journey` 의 요청·응답은 [004 contracts/music-journey.md](../../004-journey-path/contracts/music-journey.md) 그대로다. 이 문서는 이번에 규약이 바뀌는 **내부 함수 하나**를 고정한다.

## 시그니처

```java
public int stationCount(double spacing, int cap)
```

**변경**: `stationCount(double farDist)` → 위 형태. `farDist` 를 더 이상 받지 않는다.

`far(double farDist)` 는 **그대로 남는다** — `recordQuality` 로그가 쓰고 있고 응답에는 싣지 않는다(004 FR-023).

## 규약

| 입력 | 출력 | 근거 |
| --- | --- | --- |
| `spacing ≤ 0` | `IllegalArgumentException` | 0 이하면 `n` 이 무한대가 된다. 설정 오타를 조용히 삼키지 않는다 |
| `cap < 0` | `IllegalArgumentException` | 같은 이유 |
| `length < spacing` | `0` | 중간에 넣을 자리가 없다. 오류가 아니다 |
| `length = k·spacing` | `k − 1` | 간격이 정확히 `spacing` |
| 그 밖 | `clamp(floor(length/spacing) − 1, 0, cap)` | |

**사후 조건**: 반환값 `n` 에 대해 `n = 0` 이거나 `length/(n+1) ≥ spacing`.

## 경계값 표 (spacing=2.5, cap=18)

| `length` | `n` | `musicCnt` |
| --- | --- | --- |
| 0.0 | 0 | 2 |
| 2.4 | 0 | 2 |
| 2.5 | 0 | 2 |
| 4.9 | 0 | 2 |
| 5.0 | 1 | 3 |
| 7.5 | 2 | 4 |
| 15.52 | 5 | 7 |
| 25.77 | 9 | 11 |
| 47.5 | 18 | 20 |
| 58.58 | 18 | 20 |
| 1000.0 | 18 | 20 |

## 호출 측 규약

- 호출자는 `AxisJourneyPathFinder` **한 곳**이다.
- `spacing` 은 `ody.journey.station-spacing`(기본 2.5), `cap` 은 `MAX_STATIONS = 18`.
- 반환값은 `LayerCandidates.collect(..., n, ...)` 와 `AxisFrame.layerPoint(k, n)` 에 그대로 넘어간다. `n = 0` 이면 둘 다 호출되지 않는다.
