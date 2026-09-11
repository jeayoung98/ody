# Contract: 경로 탐색

**Feature**: 004-journey-path · **Date**: 2026-09-10 · **정본**: `docs/api-spec.md` §3.3

세 개의 계약이 걸린다 — ① 프론트↔백 공개 API, ② BE2 게이트웨이↔BE4 엔진, ③ BE2↔BE4 저장소 port.
①은 **정본이 이미 확정**했고 본 기능이 바꾸지 않는다. ②③은 이번에 정의한다.

---

## ① 공개 API (정본 §3.3 — 변경 없음)

`GET /api/music/journey` · 인증 필요 (`Authorization: Bearer {accessToken}`)

### 요청

| 파라미터 | 타입 | 필수 | 제약 |
| --- | --- | --- | --- |
| `start` | int | ✔ | ≥ 1. 출발곡 ID |
| `end` | int | ✔ | ≥ 1. 도착곡 ID |

`mode`·`n`·detour 파라미터는 **없다**. 추가하지 않는다(FR-023, FR-011).

### 성공 (200)

```json
{ "success": true, "data": {
  "musicCnt": 12,
  "totalDuration": 3480,
  "path": [ {
    "step": 0, "id": 10234, "mbid": "b1a9c0e9-...", "title": "Love wins all", "artist": "IU",
    "bpm": 128.4, "duration": 275, "album": "The Winning", "genres": ["K-Pop"],
    "youtubeUrl": "https://www.youtube.com/watch?v=oCveByMXd_0",
    "location": { "pc1": -0.4213, "pc2": 1.0872, "...": "...", "pc16": -0.123 },
    "playCnt": 1428, "youtubeCnt": 3
  } ]
}, "error": null }
```

**보장**

- `path[0]`은 `start` 곡이고 `step:0`. 마지막 원소는 `end` 곡. `step`은 0부터 1씩 증가.
- `musicCnt == path.length`. `totalDuration`은 `path` 곡 `duration` 합(초).
- `path.length ≤ 30`(계약). 실제로는 엔진 상한 때문에 **1~22**이고, 먼 여정일수록 길다.
- `youtubeUrl: null`인 곡도 포함된다. 재생 가능 여부로 필터하지 않는다.
- 같은 곡이 두 번 나오지 않는다. 같은 아티스트는 최대 `artist_cap`(현재 3)곡.
- 같은 `start`·`end`·같은 서빙 번들이면 같은 목록·같은 순서(결정성). **번들이 바뀌면 달라질 수 있다.**
- `location`은 번들 좌표 원본. 진입 경로와 무관하게 동일.

**프론트가 알아야 할 것** ⚠️

- **곡 수를 고정값으로 가정하지 말 것.** `musicCnt`가 12~22로 변동한다. 실측 40쌍 중 30쌍이
  먼 여정이라 정거장이 10→최대 20으로 늘어난다. `musicCnt`·`path.length`만 보고 그린다.
- `far`·`endpoint_dist`·`mode` 같은 메타는 **응답에 없다**(2026-09-10 clarify). "먼 여정입니다" 안내가
  필요하면 계약 추가를 별도 협의한다(-62 별자리 뷰와 함께).

### 실패

| HTTP | code | 상황 |
| --- | --- | --- |
| 400 | `INVALID_INPUT` | `start`/`end` 누락·비정수·0 이하 |
| 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` | 토큰 없음·위조·만료 |
| 404 | `MUSIC_NOT_FOUND` | `start` 또는 `end`가 없는 곡 |
| 422 | `PATH_NOT_FOUND` | 두 곡을 연결하는 경로를 찾을 수 없음 |
| 500 | `INTERNAL_SERVER_ERROR` | 경로 산출 엔진 부재·타임아웃, 응답 조립 실패, 그 밖의 내부 오류 |

```json
{ "success": false, "data": null,
  "error": { "code": "PATH_NOT_FOUND", "message": "두 곡을 연결하는 경로를 찾을 수 없습니다." } }
```

**422와 500의 구분** — 422는 "이 두 곡으로는 안 된다"(다른 곡을 권할 수 있음),
500은 "서버 사정"(곡을 바꿔도 안 됨, 잠시 후 재시도). 엔진 부재를 422로 내리지 않는다(clarify).

### 경계

| 입력 | 결과 |
| --- | --- |
| `start == end` | 200, `path` 1개(`step:0`), `musicCnt:1`, `totalDuration` = 그 곡 길이 |
| `start != end`, 좌표 동일 | 200, 2곡 경로 |

### 정본과의 차이 (문서 갱신 요청 대상)

| 정본 §3.3 문구 | 실제 |
| --- | --- |
| "중간 지점: 출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택" | D10 이후 기본은 **축 통로 + Viterbi**(`axis`). 등분 보간(`linear`)은 진행도 단조 증가를 못 지켜(40쌍 중 21쌍 위반) 기본에서 내려갔다 |
| "초과 경로는 서버가 30곡 이하로 줄인 뒤 곡 간 도약을 재평가" | 엔진 정거장 상한이 20이라 **발동하지 않는다.** 축소 알고리즘 없음 |

---

## ② 게이트웨이 → 데이터 엔진 (BE2 ↔ BE4, **미확정 — B-Engine**)

**D4**: 검색·경로 서비스는 Python FastAPI이고 BE 게이트웨이가 HTTP로 호출한다.

`data/specs/11_journey/spec.md`가 적은 형태:

```
GET /journeys?from={mbid}&to={mbid}&n=10&mode=axis
```

게이트웨이가 보내는 것:

| 파라미터 | 값 | 비고 |
| --- | --- | --- |
| `from` | 출발곡 `mbid` | `MusicDetailReader.findDetail(start).mbid` |
| `to` | 도착곡 `mbid` | 같음 |
| `mode` | `axis` **고정** | D10 기본값. 클라이언트에 노출하지 않음 |
| `n` | **보내지 않음** | 정거장 수는 엔진이 D3으로 정한다 |

게이트웨이가 읽는 응답 필드:

| 필드 | 용도 |
| --- | --- |
| `reachable` | `false` → 422 `PATH_NOT_FOUND` |
| `stations[].mbid` | 중간 정거장. **순서가 경로 순서**. 출발·도착 불포함 |
| `stations[].progress` | 단조 증가 검사(카운터·로그) |
| `n_stations` | `musicCnt` 검산 |
| `endpoint_dist`, `far`, `mode`, `bundle` | 로그만 |

나머지 필드(`rank`, `dist_from_prev`, `last_to_end`, `rules`, `leaf_id`, `node_d2`,
`is_graph_edge_from_prev`, `path_nodes_d2`)는 쓰지 않는다.

**호출 정책**: 타임아웃 2초(종단 3초에서 역산), **재시도 없음**(1회 재시도만 넣어도 최악 4초로 예산 초과).
타임아웃·연결 실패·프로토콜 오류 → 500.

### ⛔ BE4에 확인·요청할 것

1. **엔드포인트 확정** — `retrieval/api.py`가 docstring뿐이다. 경로·파라미터명·오류 바디 형태 필요.
   현재 docstring은 오류를 `404/422/503`으로 적는데, 각 코드의 의미와 바디 스키마를 알려주면 매핑을 맞춘다.
2. **`stations`에 `mbid` 포함** — 현재 `journey.py::journey`는 `row`(행 인덱스)를 돌려준다.
   행 인덱스는 번들 내부 값이라 게이트웨이가 쓸 수 없다. `mbid`가 필요하다.
3. **스펙 11 AC1 성능 게이트 하향** — `axis` p95 ≤ 5초는 상위 게이트(요구사항 §6 종단 3초)를 넘는다.
   실측 1.541초이므로 3초 이하로 바꿔도 통과한다.
4. **스펙 11 규칙절 문구** — "아티스트당 ≤ 2"인데 `postprocess_rules.json`의 `artist_cap`은 **3**이고
   구현은 파일 값을 읽는다. 문구가 최신이 아니다.
5. **곡 테이블 `mbid` 컬럼** — BE 소유 곡 테이블에 정수 `id` PK + `mbid` UNIQUE가 필요하다(clarify).
   좌표 컬럼은 `real`(float32) — 번들 dtype과 같아야 좌표 불변성이 성립한다.
6. **머지 순서** — MR !17은 `S15P21A405-39` 위에 쌓여 있어 39 선행 머지가 필요하다(BE4 코멘트).
   두 브랜치 모두 `data/dev` 미반영이라 게이트웨이 통합 검증은 그 이후다.

---

## ③ 저장소 Port (BE2 계약 / BE4 구현)

### `MusicDetailReader.findDetail(long id)` — 기존, 재사용

`Optional<MusicDetail>`. `start`·`end` 각 1회. `id ↔ mbid` 해석의 원천이며 `path` 양 끝 원소가 된다.
`Optional.empty` → 404. `findNeighbors`는 이 기능에서 호출하지 않는다.

### `JourneyTrackReader.findDetailsByMbids(List<String> mbids)` — 신규

`List<MusicDetail>`.

| 항목 | 계약 |
| --- | --- |
| 순서 | **보장하지 않는다.** 호출자가 mbid 키로 재조립한다 |
| 누락 | 없는 mbid는 결과에서 빠진다(예외 아님). 호출자가 500으로 처리 |
| 건수 | 최대 20건. 한 번의 조회로 |
| 필드 | `MusicDetail` 전체. `location`은 `pc1`~`pc16` 원본값 |
| 부수효과 | 없음. 조회 전용(FR-018) |

---

## 공통 계약 (master, 변경 없음)

| 항목 | 위치 |
| --- | --- |
| 응답 봉투 `{success, data, error}` | `common.ApiResponse` / `common.ErrorResponse` |
| 에러 코드 인터페이스 | `common.ErrorCode` |
| 400·500 | `common.GlobalErrorCode` (`INVALID_INPUT`, `INTERNAL_SERVER_ERROR`) |
| 401 | `common.AuthErrorCode` (`UNAUTHENTICATED`, `INVALID_TOKEN`) |
| 404·**422(신규)** | `common.MusicErrorCode` (`MUSIC_NOT_FOUND`, **`PATH_NOT_FOUND` 추가**) |
| 예외→응답 변환 | `common.GlobalExceptionHandler` (BE1 소유, 변경 없음) |
| 인증 | `config.SecurityConfig` 기본 거부 — `/api/music/journey`는 별도 등록 없이 인증 대상 |

**정정**: 정본 §0.5는 400을 `VALIDATION_ERROR`, 500을 `INTERNAL_ERROR`로 적지만 master 구현은
`INVALID_INPUT`/`INTERNAL_SERVER_ERROR`다. 002·003이 이미 보고한 불일치이며 본 계약은 구현 코드값을 따른다.
