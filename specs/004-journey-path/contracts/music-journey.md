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

## ② 경로 산출 — 인프로세스 (rev.3, 2026-09-11 결정)

> **[무효]** rev.2 의 이 절은 *"게이트웨이 → 원격 파이썬 엔진 HTTP 호출"* 계약이었다.
> 2026-09-11 팀 결정(D12)으로 **산출이 백엔드 프로세스 안으로 들어왔다.** 호출할 원격 엔진이 없으므로
> 엔드포인트·타임아웃·재시도 계약이 전부 사라졌다. 방식(`axis`·λ·역 수·임계값)은 그대로다 —
> **바뀐 것은 실행 위치뿐**이다.

산출은 `JourneyPathFinder` 경계 뒤에 있다. 호출부는 "두 곡을 주면 중간 정거장 열이 온다"만 안다.

```
EnginePath find(MusicDetail start, MusicDetail end)
```

| 항목 | 계약 |
| --- | --- |
| 입력 | `MusicDetail` 두 건. **좌표(16축)와 `artist`·`title` 이 채워져 있어야 한다** — 축 좌표계와 같은 녹음 판정에 쓴다 |
| 모드 | 구현이 `axis` 로 고정. 실패 시 `linear` 폴백. **요청 파라미터로 승격하지 않는다**(FR-023) |
| 역 수 | 구현이 끝점 거리로 정한다. 호출자가 넘기지 않는다(D3) |
| 경로 없음 | **예외가 아니라** `reachable:false` → 422. D3 대로 정상 입력에서 오면 안 된다 |
| 조회 어댑터 부재·재산출 상한 소진 | 예외 → 500. 422 와 섞지 않는다 |
| 부수효과 | 없음 |

절차·파라미터·임계값의 출처는 `data/docs/BE_ALGORITHM_HANDOFF.md` §4 다. 백엔드가 새로 설계한 것이 없다.

### 산출이 쓰는 조회 계약

```
List<TrackCandidate> findNearest(float[] point, int limit)
```

여정 층 후보와 주변 탐색(005) 이웃이 **같은 질의**라 하나의 port 를 공유한다(D-005).

```sql
SELECT id, mbid, title, artist, duration, location
FROM music ORDER BY location <-> :point LIMIT :limit
```

⚠️ **지점 좌표를 바인드 파라미터로 넘긴다.** 서브쿼리로 넘기면 `InitPlan` 이 되어 HNSW 를 못 쓴다 —
실측 recall **0.0000**, 거리 0 인 자기 자신 대신 23.3 짜리가 1위로 나왔다. 조용히 틀린다.

⚠️ **후처리 조건을 SQL 에 넣지 않는다.** pgvector 0.7.0 은 필터를 걸면 `LIMIT` 보다 적게 준다.
그래서 층당 200개를 뽑아 애플리케이션에서 거른다.

### 임계값

유일 출처는 `data/serving/<bundle>/postprocess_rules.json` 이고, 백엔드는 `ody.serving` 설정으로 받는다
(FR-024). 코드에 상수로 박지 않는다. 거리는 전부 **L2** — 코사인·내적으로 바꾸면 임계값이 무의미해진다.

### BE4 에 남은 요청

rev.2 의 요청 6건 중 **1·2·3·6번은 무효**다(원격 엔진·머지 순서·엔진 성능 게이트). 남은 것:

- 스펙 11 규칙절이 "아티스트당 ≤ 2" 인데 `postprocess_rules.json` 의 `artist_cap` 은 **3** 이다. 문구 정정
- `far` 노출 여부 — 핸드오프 §4.2 는 응답에 실으라 하고 FR-023 은 싣지 말라 한다(**B-Far2**, FE1·기획 협의)

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
