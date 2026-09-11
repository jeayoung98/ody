# Phase 1 Data Model: 경로 탐색 게이트웨이

**Feature**: 004-journey-path · **Date**: 2026-09-10 · **Plan**: [plan.md](plan.md)

게이트웨이가 다루는 표현은 세 층이다 — **요청** / **엔진 표현**(내부) / **응답**(정본 §3.3).
엔진 표현은 응답에 그대로 나가지 않는다(FR-023).

---

## 1. 요청

| 필드 | 타입 | 제약 | 근거 |
| --- | --- | --- | --- |
| `start` | `long` | required, `@Min(1)` | 정본 §3.3 |
| `end` | `long` | required, `@Min(1)` | 정본 §3.3 |

`mode`·`n`·detour 관련 입력은 **받지 않는다**(FR-023, FR-011). 인증은 `Authorization: Bearer`(FR-015).
검증 위반 → 400 `INVALID_INPUT`.

---

## 2. 응답 (정본 §3.3)

### `JourneyResponse`

| 필드 | 타입 | 규칙 |
| --- | --- | --- |
| `musicCnt` | `int` | `path.size()`. `start == end`면 1, 그 외 `n_stations + 2` (FR-006, FR-021) |
| `totalDuration` | `int` | `path` 모든 곡 `duration` 합(초). `duration`이 null인 곡은 0으로 더한다 (FR-006) |
| `path` | `List<JourneyStop>` | 길이 1~30(계약 상한). 엔진 상한 20이라 실제 최대 22 (FR-008) |

### `JourneyStop`

`@JsonUnwrapped MusicDetail` + `int step` (R6, 003 `NeighborTrack` 선례).

| 필드 | 출처 |
| --- | --- |
| `step` | 게이트웨이가 0부터 연속 부여. `path[0].step == 0` (FR-005) |
| `id`, `mbid`, `title`, `artist`, `bpm`, `duration`, `album`, `genres`, `youtubeUrl`, `location`, `playCnt`, `youtubeCnt` | `MusicDetail` (기존 record, 재사용) |

`location`은 `pc1`~`pc16` (`Location` record, 기존). 번들 `v2.1-pca16` 고정값 그대로 전달(FR-016).
`youtubeUrl`이 null인 곡도 그대로 포함(FR-007).

**직렬화 예시** (정본 §3.3과 동일 형태):

```json
{ "success": true, "data": {
  "musicCnt": 12, "totalDuration": 3480,
  "path": [ { "step": 0, "id": 10234, "mbid": "b1a9c0e9-...", "title": "...", "artist": "...",
              "bpm": 128.4, "duration": 275, "album": "...", "genres": ["K-Pop"],
              "youtubeUrl": "https://...", "location": { "pc1": -0.4213, "...": "...", "pc16": -0.123 },
              "playCnt": 1428, "youtubeCnt": 3 } ]
}, "error": null }
```

---

## 3. 엔진 표현 (내부 전용)

### `EnginePath`

`JourneyPathFinder`가 돌려주는 값. **응답에 싣지 않는다**(FR-023).

| 필드 | 타입 | 게이트웨이에서의 쓰임 |
| --- | --- | --- |
| `reachable` | `boolean` | `false` → 422 `PATH_NOT_FOUND` (FR-002) |
| `stationMbids` | `List<String>` | **중간 정거장만.** 출발·도착 제외 (FR-021). 순서가 경로 순서 |
| `progresses` | `List<Double>` | 단조 증가 검사용. 위반 시 카운터·로그만 (FR-020, R10) |
| `endpointDist` | `double` | 로그만 (FR-023) |
| `far` | `boolean` | 로그만 (FR-023) |
| `mode` | `String` | 로그만. 요청은 항상 `axis` 고정 |
| `bundle` | `String` | 로그만 (R11 — 대조하지 않음) |

**엔진 필드 중 쓰지 않는 것**: `rank`, `dist_from_prev`, `last_to_end`, `rules`, `row`, `leaf_id`,
`node_d2`, `is_graph_edge_from_prev`, `path_nodes_d2`. 인접 역 거리 지표는 BE4 벤치마크 소유(R10).

### 엔진 → 응답 매핑

| 엔진 | 응답 | 변환 |
| --- | --- | --- |
| `stations[i].mbid` | `path[i+1]` | `JourneyTrackReader`로 상세 조회 후 조립 |
| (엔진에 없음) | `path[0]`, `path[last]` | `MusicDetailReader.findDetail(start/end)` 결과 |
| `n_stations` | `musicCnt` | `stationMbids.size() + 2`. 엔진 메타의 `n_stations` 값을 따로 들고 있지 않는다 — 조립은 실제 mbid 목록 기준이라 자기정합적이다 (FR-021 — 두 수를 혼용하지 않는다) |
| (엔진에 없음) | `totalDuration` | 게이트웨이가 `duration` 합산 |
| `stations[i].rank` | `step` | **쓰지 않는다.** `step`은 최종 목록 기준 0부터 재부여 (FR-005) |
| `far`, `endpoint_dist`, `mode`, `bundle` | — | 응답 제외, 로그만 |

---

## 4. Port 계약

### `JourneyPathFinder` (신규, BE2 소유 계약 / BE4 엔진 구현)

```
EnginePath find(String startMbid, String endMbid)
```

- 모드는 구현이 `axis`로 고정 호출한다. 파라미터로 받지 않는다(FR-023).
- 정거장 수는 엔진이 정한다(D3). 게이트웨이가 `n`을 넘기지 않는다(FR-011).
- 경로 없음은 **예외가 아니라** `reachable:false`로 표현한다 — 422와 500을 구분하기 위해서다.
- 엔진 부재·타임아웃·프로토콜 오류는 예외로 던진다 → 500 (FR-014).
- 어댑터: `JourneyEngineClient`(RestClient, 타임아웃 2초, 재시도 없음, R8). **B-Engine 대기.**

### `JourneyTrackReader` (신규, BE2 소유 계약 / BE4 저장소 구현)

```
List<MusicDetail> findDetailsByMbids(List<String> mbids)
```

- **순서를 보장하지 않는다.** 게이트웨이가 `Map<String, MusicDetail>`로 재조립한다(R4).
- 요청한 mbid 중 없는 것은 결과에서 빠진다. 누락은 게이트웨이가 500으로 처리한다(부분 경로 금지).
- 최대 20건(엔진 정거장 상한). 한 번의 조회로 처리한다.
- 어댑터: `JourneyTrackMapper`(MyBatis). **BE 곡 테이블 미생성 대기.**

### `MusicDetailReader` (기존, 재사용)

```
Optional<MusicDetail> findDetail(long id)
```

- `start`·`end`에 각각 호출한다. 결과가 `id ↔ mbid` 해석의 원천이자 `path` 양 끝 원소다(R3, FR-022).
- `Optional.empty` → 404 `MUSIC_NOT_FOUND`.
- `findNeighbors`는 이 기능에서 호출하지 않는다.

---

## 5. 저장소 요구사항

BE 소유 곡 테이블에 다음이 필요하다(clarify 결정 — **현재 미생성**):

| 컬럼 | 용도 |
| --- | --- |
| 정수 `id` (PK) | 정본 계약의 `start`/`end`, 응답 `id` |
| `mbid` (UNIQUE) | 엔진 호출·정거장 조회 키. data 소유 `track.mbid`와 같은 값 |
| `title`, `artist`, `album`, `genres`, `bpm`, `duration`, `playCnt`, `youtubeCnt`, `youtubeUrl` | `MusicDetail` 필드 |
| `pc1`~`pc16` | `location`. `real`(float32) — 번들 dtype과 같아야 좌표가 변하지 않는다 |

→ **BE4에 요청 필요**: `mbid` UNIQUE 컬럼 포함, 좌표 컬럼 `real`.

---

## 6. 불변식 (테스트가 지켜야 하는 것)

| # | 불변식 | 근거 |
| --- | --- | --- |
| I1 | `path[0].step == 0`이고 `step`은 1씩 증가하는 연속값 | FR-005 |
| I2 | `path[0].id == start`, `path[last].id == end` (단 `start == end`면 원소 1개) | FR-005, FR-012 |
| I3 | `musicCnt == path.size()` | FR-006 |
| I4 | `totalDuration == Σ path[].duration` | FR-006 |
| I5 | `path.size() <= 30` | FR-008 |
| I6 | `path`에 같은 곡이 두 번 나오지 않는다 | FR-009. 엔진이 보장하고, 게이트웨이는 **엔진이 같은 mbid를 두 번 준 경우**를 거부해 이를 감시한다 |
| I7 | 정거장 순서 = 엔진 `stationMbids` 순서 (조회 결과 순서가 아니다) | R4, FR-005 |
| I8 | 도메인 저장소 쓰기 0건 | FR-018 |
| I9 | 응답 JSON에 `far`·`endpoint_dist`·`mode`·`n_stations`·`bundle` 키가 없다 | FR-023 |
