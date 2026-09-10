# Feature Specification: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Feature Branch**: `backend/feat/S15P21A405-61-journey-path-creation` · **Spec Dir**: `004-journey-path`

**Created**: 2026-09-10 · **Revised**: 2026-09-10 (BE4 데이터 엔진 MR 반영, rev.2)

**Status**: Clarified — 차단 항목 없음. 방식 명확화는 BE4 구현으로, 계약 공백 4건(식별자 / 성능 게이트 / 엔진 부재 오류 / 엔진 메타 노출)은 2026-09-10 clarify로 해소. 남은 것은 타 파트 알림·요청과 BE4 엔진 엔드포인트 대기. Jira S15P21A405-61 / 기능 ID JOURNEY-01

**Input**: 인증된 사용자가 출발곡·도착곡 두 곡을 지정하면, 시스템이 그 사이를 잇는 곡의 순서 목록(경로)을 만들어 반환한다(정본 §3.3 `GET /music/journey`, 요구사항 JOURNEY-01). 성공 기준은 "두 곡이 연결됐는가"가 아니라 **"인접 정거장 사이의 낙차가 고른가"** 다. 경로 산출 알고리즘은 **BE4 데이터 엔진(Python)** 이 소유하고, BE2는 정본 계약을 지키는 **게이트웨이**를 소유한다(D4).

---

## 데이터 엔진 현황 — rev.2에서 반영한 사실

rev.1은 "출발→도착 벡터를 등분해 각 지점 최근접 곡을 고른다"(정본 §3.3 문구)를 유일한 방식으로 전제했다.
**BE4가 그 방식을 측정해 기본에서 내렸다.** 아래는 원격 MR에 쌓인 실제 코드·결정·측정값이다.

| 출처 | 내용 |
| --- | --- |
| MR !17 / `data/feat/S15P21A405-118-journey-axis-corridor` | 여정 엔진 `axis` 모드 구현, 기본 모드 전환 (Jira S15P21A405-118) |
| `data/feat/S15P21A405-39-retrieval-neighbors` | 이웃 검색 로더·후처리·kNN (Jira S15P21A405-39, MR !17의 base) |
| `data/docs/S15P21A405-117-pgvector-serving-spec` | pgvector 좌표 서빙 계약 (D9, recall@10 0.9995) |
| `data/specs/DECISIONS.md` | D2→**D10**(axis 기본), D3(항상 잇기), D4(FastAPI + BE 게이트웨이), D7(PCA-16) |
| `data/specs/11_journey/spec.md`, `data/retrieval/journey.py` | 스펙·구현 |
| `data/serving/v2.1-pca16/postprocess_rules.json` | 후처리 임계값 정본 (하드코딩 금지) |
| `data/output/bench_journey_v2.1-pca16.json` | 실제 번들 40쌍 측정 |

### D10 — 기본 방식이 `axis`(축 통로 + Viterbi)로 바뀌었다

A→B 축을 잡고 전곡에 **진행도 `p`**(A=0, B=1)와 **축 이탈 `r`**(축까지 수직거리)을 매긴다.
통로 = `0 < p < 1` 이고 `r ≤ R` 인 곡. 통로 안에서 진행도 구간(**층**)마다 후보를 뽑고
Viterbi로 비용 최소 열을 고른다. 비용 = `Σ 걸음² + λ·Σ 축이탈²` (λ = 2.0).

실제 번들 40쌍 측정 (`bench_journey_v2.1-pca16.json`, seed 42):

| | **axis** (기본) | linear (구 방식) |
| --- | --- | --- |
| 인접 역 거리 median — p50 | **2.949** | 3.430 |
| 인접 역 거리 median — p95 | **3.788** | 4.600 |
| 지연 p95 | 1.541s | 1.488s |
| 경로 실패 (`unreachable`) | 0 | 0 |
| 규칙 위반 | 0 | 0 |
| **진행도 단조 증가 위반** | **0** | **21 / 40** |
| far 여정 | 30 / 40 | 32 / 40 |

**rev.1이 전제한 등분 보간(`linear`)은 40쌍 중 21쌍에서 진행도가 단조 증가하지 않는다.**
보간 지점마다 독립으로 최근접을 고르므로 다음 지점의 최근접 곡이 앞 역보다 뒤에 있을 수 있다.
`axis`는 층이 진행도 구간으로 나뉘어 구조적으로 단조다. `linear`는 이식 검증·A/B용 모드로 남는다.

### 그 밖에 rev.1과 달라진 사실

| 항목 | rev.1 전제 | 실제 (BE4 구현) |
| --- | --- | --- |
| 정거장 수 | 미정 (Q1) | **D3**: 기본 10, `endpoint_dist > 10.7`이면 `clamp(round(10 + (dist − 10.7)), 10, 20)`. **상한 20** |
| 아티스트 반복 | 미정 (Q2) | `postprocess_rules.json`의 **`artist_cap` = 3** (총 등장 상한). 행 차단이 아니라 **아티스트 전체 유한 벌점**(행 차단은 DP가 수렴하지 않음 — 실측) |
| detour | 미정 (Q3) | **API 파라미터 아님.** 엔진 내부 상수 — 통로 반경 `4.0 → 6.0`, 실패 시 층 두께 조건 버리고 `14.0`까지 완화(D3), λ=2.0, 층당 후보 상한 400 |
| 최소 걸음 | 없음 | `tau_dup` = **1.6624** 미만 전이는 같은 녹음으로 보고 쓰지 않는다 |
| 실행 주체 | BE4 MyBatis 조회 port | **D4**: Python FastAPI 서비스. BE 게이트웨이가 HTTP로 호출 |
| 좌표 조회 백엔드 | 미정 | `nearest_to_point` 한 함수로 통합. 전곡 스캔(1지점 111ms) / kNN 그래프 후보 / pgvector(스펙 17 이후) |
| 식별자 | `id`(int) | 엔진·data 스키마는 **`mbid`(text UUID)**. `track` 테이블 PK가 mbid이고 int `id` 컬럼이 없다 → **B-ID** |

---

## Clarifications

### Session 2026-09-10

- Q: 중간 정거장 등분 수를 어떻게 정하나? → A: **등분 보간 자체가 기본이 아니다.** `axis`가 층을 `n_stations`개로 나누고, `n_stations`는 D3의 `endpoint_dist` 기반 `clamp(10, 20)`으로 정해진다. rev.1의 Q1은 `linear` 모드에만 해당하는 질문이었다. *(BE4 구현으로 해소)*
- Q: 아티스트 반복 억제 규칙은? → A: **총 등장 상한 `artist_cap` = 3**, 값은 `postprocess_rules.json`에서 읽는다(하드코딩 금지). 연속 금지가 아니다. 위반 시 그 아티스트 **전체**에 유한 벌점을 더해 DP를 다시 돌린다 — 행 하나만 막으면 같은 아티스트의 다른 곡을 집어 수렴하지 않는다(BE4 실측). *(BE4 구현으로 해소)*
- Q: detour를 이번 이슈에서 어떻게 다루나? → A: **API 계약에 넣지 않는다.** 통로 반경·λ·층 후보 상한은 BE4 엔진 내부 상수이고, 경로 실패 시 반경을 넓히는 완화 단계도 엔진이 갖고 있다(D3). BE2 게이트웨이는 detour를 알지 못한다. *(BE4 구현으로 해소, 정본 §3.3 파라미터 유지)*
- 결정: 균등성 지표를 rev.1이 제안한 **변동계수에서 BE4가 실제 측정하는 지표로 교체**한다 — 인접 역 거리 median(쌍별)의 p50/p95, `progress_not_monotonic` 건수, `rule_violations` 건수. 지표를 BE2가 새로 정의하면 BE4 벤치마크와 대조할 수 없다.
- 결정: **진행도 단조 증가를 인수 기준으로 승격**한다(FR-020). rev.1에는 없던 요구사항이며, BE4 스펙 11 AC2·D10의 핵심 근거다.
- 결정: 30곡 상한(FR-008)은 **게이트웨이 가드로 남기고 축소 알고리즘은 만들지 않는다.** 엔진이 20을 넘기지 않으므로(D3) 축소 경로는 실행되지 않는다. rev.1의 "30곡 초과 축소 + 도약 재평가"는 엔진 기본값과 맞지 않는 설계였다.
- Q: 엔진이 주는 `far`·`endpoint_dist`를 응답에 실어 프론트에 내려주나? → A: **싣지 않는다.** 정본 §3.3 응답 계약을 그대로 유지하고, 두 값은 게이트웨이 관측 지표·로그에만 남긴다. 계약 추가는 헌법 II에 따라 FE1 합의가 선행이며, 필요하면 별자리 뷰(S15P21A405-62)에서 함께 정한다. 프론트에는 **`musicCnt`가 12~22로 변동하므로 곡 수를 고정하지 말라**고 알린다. *(clarify 확정)*
- Q: 데이터 엔진이 안 떠 있거나 응답이 없을 때 어떤 상태·코드를 돌려주나? → A: **500 `INTERNAL_SERVER_ERROR`**. 엔진 부재·타임아웃·응답 조립 불가를 모두 500으로 묶고, 구분은 로그·지표로만 한다. 새 에러 코드나 503을 정본 §0.5에 추가하지 않는다. 엔진 부재는 서버 내부 사정이고 사용자가 입력을 바꿔 해결할 수 없으므로 422(`PATH_NOT_FOUND`)와 섞지 않는다 — 섞으면 프론트가 "다른 곡을 골라보세요"로 오안내한다. *(clarify 확정)*
- Q: 요구사항 §6의 "경로 생성 3초"와 data 스펙 11 AC1의 "`axis` p95 ≤ 5초" 중 무엇이 합격 기준인가? → A: **3초를 종단(end-to-end) 게이트로 확정한다.** 사용자가 요청을 보낸 시점부터 응답을 받기까지가 3초이고, 엔진 구간은 그 하위 예산이다(현재 실측 p95 1.541초). data 스펙 11 AC1의 5초는 상위 게이트를 넘으므로 BE4에 하향 조정을 요청한다. *(clarify 확정)*
- Q: 정본이 요구하는 정수 `id`와 데이터 엔진이 쓰는 `mbid`(UUID)를 무엇으로 이어야 하나? → A: **BE 소유 곡 테이블이 정수 `id` PK와 `mbid` UNIQUE를 함께 갖는다.** 게이트웨이가 `id→mbid`로 해석해 엔진을 호출하고, 응답 정거장의 `mbid`를 `id`로 역매핑한다. 정본 §3.3·§0.6 계약과 프론트는 바뀌지 않는다. `MusicDetail` record가 이미 `id`·`mbid`를 함께 갖고 기존 조회 port가 `long id` 시그니처를 쓰는 것과 정합한다. *(clarify 확정)*

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 두 곡 사이의 경로를 받는다 (Priority: P1)

사용자가 출발곡과 도착곡을 지정하면, 출발곡에서 시작해 도착곡에서 끝나는 순서 있는 곡 목록을 받아 여정으로 삼을 수 있다. 각 곡에는 상세 필드와 지도 좌표가 함께 오므로 목록·지도 어느 쪽으로도 쓸 수 있다.

**Why this priority**: 경로가 하나도 나오지 않으면 여정 기능 전체(시각화 -62, 순차 재생 -63, 이력 -64)가 성립하지 않는다. 이 스토리만 구현해도 "두 곡을 잇는 플레이리스트"라는 사용자 가치가 완결된다.

**Independent Test**: 데이터 엔진 호출을 mock으로 두고 `GET /music/journey?start=10234&end=10877`를 호출해, `path[0]`이 출발곡(`step:0`), 마지막 원소가 도착곡이며 `step`이 0부터 1씩 증가하는지, `musicCnt`·`totalDuration`이 `path`와 일치하는지 검증한다.

**Acceptance Scenarios**:

1. **Given** 인증된 요청과 서로 다른 두 존재하는 곡 ID, **When** `start`·`end`로 경로를 생성하면, **Then** 200과 `success:true`, `data.path`에 출발곡→도착곡 순서 목록, `error:null`을 반환한다. (FR-001, FR-004)
2. **Given** 엔진이 중간 정거장만(`stations`, 출발·도착 제외) 돌려주고, **When** 게이트웨이가 응답을 조립하면, **Then** 출발곡을 맨 앞에, 도착곡을 맨 뒤에 붙이고 `step`을 0부터 연속 부여한다. `musicCnt = n_stations + 2`. (FR-005, FR-006, FR-021)
3. **Given** 엔진이 정거장을 행 인덱스·`mbid`로만 돌려주고, **When** 응답을 조립하면, **Then** 각 원소는 MusicDetail 필드(id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location pc1~pc16, playCnt, youtubeCnt)를 모두 채워 반환한다. (FR-004, FR-022)
4. **Given** 생성된 경로, **When** 응답을 구성하면, **Then** `totalDuration`은 `path` 모든 곡 `duration`의 합(초)이다. (FR-006)
5. **Given** 경로 중간에 `youtubeUrl`이 null인 곡이 선정되었고, **When** 응답하면, **Then** 재생 불가만으로 제외하지 않고 `youtubeUrl:null`로 포함한다. (FR-007)
6. **Given** 같은 두 곡·같은 번들(`v2.1-pca16`)·같은 모드, **When** 경로 생성을 반복하면, **Then** 동일한 곡 목록과 동일한 순서를 반환한다(결정성). (FR-013)
7. **Given** 정본 §3.3에 `mode` 파라미터가 없고, **When** 게이트웨이가 엔진을 호출하면, **Then** 항상 기본 모드 `axis`로 고정 호출하고 `mode`를 클라이언트에 노출하지 않는다. (FR-023)

---

### User Story 2 - 앞으로만 가고 낙차가 고른 경로 (Priority: P1)

사용자는 경로를 순서대로 들으면서 곡이 **출발에서 도착 방향으로** 조금씩 변해가는 흐름을 느낀다. 중간에 왔던 방향으로 되돌아가거나, 어떤 구간은 거의 같은 곡이고 다른 구간은 갑자기 튀는 경로는 두 곡이 연결됐더라도 여정으로서 실패다.

**Why this priority**: Jira S15P21A405-61이 명시한 성공 기준이며, BE4가 D10에서 방식을 바꾼 이유 그 자체다. US1이 만든 경로를 평가하는 독립 계층이므로 따로 검증한다.

**Independent Test**: `axis` 모드로 생성한 경로의 `progress` 수열이 단조 증가하는지, 인접 역 거리(`dist_from_prev`) median이 같은 쌍의 `linear` 결과보다 작은지, 후처리 규칙 위반이 0인지 검증한다. 합성 데이터로 번들 없이 돌 수 있어야 한다.

**Acceptance Scenarios**:

1. **Given** `axis` 모드로 생성한 경로, **When** 각 정거장의 진행도 `progress`를 순서대로 보면, **Then** 단조 증가한다(위반 0건). (FR-020)
2. **Given** 같은 두 곡을 `axis`와 `linear`로 각각 생성하고, **When** 인접 역 거리 median을 비교하면, **Then** `axis`가 더 작다. (FR-010)
3. **Given** 완성된 경로, **When** 후처리 규칙을 검사하면, **Then** 출발·도착과 같은 canonical 곡 0건, 같은 아티스트가 `artist_cap`(3)을 넘는 경우 0건, 길이 규칙 위반·`excluded`·제목 없는 곡 0건이다. (FR-009)
4. **Given** 완성된 경로, **When** 인접 정거장 거리를 검사하면, **Then** `tau_dup`(1.6624) 미만인 인접 쌍이 없다. (FR-009)
5. **Given** 밀집 구역을 지나 같은 아티스트가 상한을 넘게 뽑혔고, **When** 경로를 다시 산출하면, **Then** 그 아티스트 전체에 벌점을 더해 재시도하고 상한을 지킨 경로로 수렴한다(행 단위 차단 아님). (FR-009)
6. **Given** 희소 구역을 지나 인접 거리가 벌어진 경로, **When** 응답하면, **Then** 200으로 반환하고 인접 역 거리 지표를 관측 기록에 남긴다(연결 자체는 실패로 처리하지 않음). (FR-010)

---

### User Story 3 - 먼 여정과 같은 곡 지정 (Priority: P2)

아주 멀리 떨어진 두 곡을 지정하면 정거장이 자동으로 늘어나 급격한 점프가 줄고, 실수로 같은 곡을 두 번 지정해도 오류 없이 그 곡 하나를 받는다.

**Why this priority**: 측정된 40쌍 중 **30쌍이 far**였다 — 먼 여정이 예외가 아니라 다수 경로다. 다만 정상 경로(US1·US2)가 먼저 성립해야 의미가 있어 P2.

**Independent Test**: `endpoint_dist`가 10.7 이하인 쌍과 15.29인 쌍을 각각 호출해 전자는 `musicCnt` 12(정거장 10 + 양 끝), 후자는 정거장 15로 늘어나는지, `start == end`는 `musicCnt:1`로 오는지 검증한다.

**Acceptance Scenarios**:

1. **Given** 두 곡의 `endpoint_dist`가 10.7 이하이고, **When** 경로를 생성하면, **Then** 정거장 10개 + 출발·도착 = `musicCnt` 12를 반환한다. (FR-011)
2. **Given** `endpoint_dist`가 10.7을 넘고, **When** 경로를 생성하면, **Then** 정거장 수가 `clamp(round(10 + (dist − 10.7)), 10, 20)`으로 늘어난다. (FR-011)
3. **Given** 엔진이 정거장 20개(상한)를 돌려주고, **When** 게이트웨이가 응답하면, **Then** `musicCnt`는 22로 정본 상한 30 안에 있고 축소는 일어나지 않는다. (FR-008, FR-011)
4. **Given** `start`와 `end`가 같은 곡 ID이고, **When** 경로를 생성하면, **Then** 200과 `path` 1개(해당 곡, `step:0`), `musicCnt:1`, `totalDuration`은 그 곡의 `duration`을 반환한다(엔진 호출 없이 게이트웨이가 처리). (FR-012)
5. **Given** `start`와 `end`가 서로 다른 곡이지만 좌표가 동일하고, **When** 경로를 생성하면, **Then** 축 길이가 0이라 통로를 만들 수 없으므로 두 곡만 포함한 2곡 경로를 200으로 반환한다. (FR-012)

---

### User Story 4 - 실패 원인을 구분해 받는다 (Priority: P2)

호출자는 "없는 곡을 지정했다", "요청이 잘못됐다", "곡은 있으나 경로를 못 만들었다", "엔진이 지금 없다"를 구분해 각각 다른 안내를 낼 수 있다.

**Why this priority**: 422(경로 연결 불가)와 503(엔진 미가동)은 이 기능에만 있는 상태다. 404·400과 섞이면 프론트가 "다른 곡을 골라보세요"와 "잠시 후 다시"를 구분할 수 없다. 핵심 흐름은 아니라 P2.

**Acceptance Scenarios**:

1. **Given** `start` 또는 `end`가 존재하지 않는 곡 ID이고, **When** 요청하면, **Then** 404와 `MUSIC_NOT_FOUND`, 공통 실패 구조(`success:false`, `data:null`, `error:{code,message}`)를 반환한다. (FR-003, FR-014)
2. **Given** 엔진이 `reachable:false`를 돌려주고, **When** 응답하면, **Then** 422와 `PATH_NOT_FOUND`("두 곡을 연결하는 경로를 찾을 수 없습니다.")를 반환한다. (FR-002, FR-014)
3. **Given** `start`/`end`가 누락·비정수·0 이하이고, **When** 요청하면, **Then** 400과 `INVALID_INPUT`을 반환한다(엔진 호출 없음). (FR-014)
4. **Given** 토큰이 없거나 위조·만료되었고, **When** 요청하면, **Then** 401과 `UNAUTHENTICATED`/`INVALID_TOKEN`을 반환한다. (FR-015, FR-014)
5. **Given** 데이터 엔진이 안 떠 있거나 응답하지 않거나 503을 돌려주고, **When** 응답하면, **Then** 500 `INTERNAL_SERVER_ERROR`로 응답하고 422로 내지 않는다. 부분 경로를 성공으로 내지 않는다. (FR-014, FR-019)
6. **Given** 엔진 응답이 정본 계약으로 조립할 수 없는 형태이고(필드 누락 등), **When** 응답하면, **Then** 500 `INTERNAL_SERVER_ERROR`로 응답한다(부분 경로 금지). (FR-014)

### Edge Cases

| 상황 | 동작 |
| --- | --- |
| `start`/`end` 누락·비정수·0 이하 | 400 `INVALID_INPUT` (엔진 호출 없음) |
| `start` 또는 `end`가 없는 곡 | 404 `MUSIC_NOT_FOUND` |
| `start == end` | 200, `path` 1개(`step:0`), `musicCnt:1` — 게이트웨이가 처리 |
| `start != end`이나 좌표 동일 | 200, 2곡 경로 (축 길이 0 → 통로 없음) |
| 엔진 `reachable:false` | 422 `PATH_NOT_FOUND` (D3상 실측 0/40건) |
| 엔진 미가동·타임아웃·503 | 500 `INTERNAL_SERVER_ERROR` (422 아님). 부분 경로 금지 |
| `id` → `mbid` 해석 실패 | 404 `MUSIC_NOT_FOUND` |
| 엔진 응답 필드 누락·조립 불가 | 500 `INTERNAL_SERVER_ERROR` |
| far 여정 (`endpoint_dist > 10.7`) | 정거장 수 자동 증가, 상한 20 |
| 엔진 정거장 20개 | `musicCnt` 22 — 정본 상한 30 안, 축소 없음 |
| 경로 중 `youtubeUrl` null | 그대로 포함 (재생 불가 표시는 클라이언트 책임) |
| 경로 전체가 재생 불가 곡 | 그대로 200 (재생 가능 여부로 필터하지 않음) |
| 같은 아티스트가 `artist_cap`(3) 초과 | 아티스트 전체 벌점 후 재시도 (최대 8회) |
| 인접 정거장 거리 < `tau_dup`(1.6624) | 같은 녹음으로 보고 전이에서 배제 |
| 출발·도착과 같은 canonical 곡 | 후보에서 제외 |
| 같은 두 곡 반복 요청 | 동일 곡 목록·동일 순서 (같은 번들 기준) |
| 번들이 v2.1-pca16 → v2.2-pca16으로 교체 | 결과가 달라질 수 있음 — 결정성 보장은 번들 안에서만 |
| 인증 실패 | 401 `UNAUTHENTICATED` / `INVALID_TOKEN` |

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001 — 경로 탐색 조회**: 시스템은 `GET /music/journey`에서 `start`·`end` 곡 ID로 두 곡을 잇는 경로를 반환해야 한다(MUST). **근거**: [api-spec §3.3](../../docs/api-spec.md).
- **FR-002 — 경로 연결 불가**: 데이터 엔진이 `reachable:false`를 반환하면 422 `PATH_NOT_FOUND`로 응답해야 한다(MUST). **근거**: api-spec §0.4·§0.5·§3.3; `journey.py` 반환 계약. **[정정]** `PATH_NOT_FOUND`는 master `MusicErrorCode`에 미등록 → 본 기능에서 BE2 도메인 에러로 정의한다. **[주의]** D3("먼 곡도 항상 잇는다")과 통로 완화 단계 때문에 실측 실패는 40쌍 중 0건이다. 422는 계약상 유지하되 사실상 예외 경로다.
- **FR-003 — 없는 곡**: `start` 또는 `end`가 존재하지 않으면 404 `MUSIC_NOT_FOUND`로 응답해야 한다(MUST). **근거**: api-spec §0.5·§3.3.
- **FR-004 — 경로 원소 필드**: `path`의 각 원소는 `step`과 MusicDetail 필드(id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location pc1~pc16, playCnt, youtubeCnt)를 포함해야 한다(MUST). 데이터 엔진은 정거장을 행 인덱스·`mbid`와 `rank`/`dist_from_prev`/`progress`로만 돌려주므로, **나머지 필드는 게이트웨이가 채워야 한다**(MUST). **근거**: api-spec §0.6·§3.3; `journey.py::journey` 반환 형태.
- **FR-005 — 순서와 step**: `path`는 출발곡을 `step:0`으로 시작해 도착곡까지 순서대로 나열해야 하며(MUST), `step`은 최종 목록 기준 0부터 1씩 증가하는 연속값이어야 한다(MUST). 엔진의 `stations`는 **출발·도착을 제외한 중간 정거장만** 담으므로 게이트웨이가 양 끝을 붙이고 번호를 부여한다(MUST). **근거**: api-spec §3.3; `journey.py`(`path[1:-1]`).
- **FR-006 — 집계값**: `musicCnt`는 `path` 길이(= `n_stations` + 2, 단 `start == end`면 1), `totalDuration`은 `path` 모든 곡 `duration`의 합(초)이어야 한다(MUST). **근거**: api-spec §3.3.
- **FR-007 — 재생 불가 곡 포함**: `youtubeUrl`이 null인 곡을 재생 불가만으로 경로에서 제외해서는 안 된다(MUST NOT). **근거**: api-spec §3.3; 요구사항 SONG-04.
- **FR-008 — 30곡 상한 가드**: `path`는 출발곡·도착곡 포함 최대 30곡이어야 한다(MUST). 게이트웨이는 이를 **검증 가드로 확인**하고 초과 시 오류로 처리해야 한다(MUST). **축소 알고리즘을 구현하지 않는다** — 엔진 정거장 수 상한이 20이므로(FR-011) 최대 22곡이고 축소 경로는 실행되지 않는다. **근거**: api-spec §3.3; 요구사항 JOURNEY-01(최대 30곡); D3 clamp(10, 20).
- **FR-009 — 후처리 규칙**: 경로는 다음을 지켜야 한다(MUST) — 출발·도착과 같은 canonical 곡 제외, 같은 아티스트 `artist_cap` 이하, 길이 규칙(`length_range_s`) 위반·`excluded`·제목 없는 곡 제외, `flag_*` 후순위, 인접 정거장 거리 `tau_dup` 이상. **임계값은 `postprocess_rules.json`에서 읽고 하드코딩해서는 안 된다**(MUST NOT) — 현재 값 `artist_cap` 3, `tau_dup` 1.6624, `length_range_s` 30~1200초. 아티스트 상한 위반은 그 아티스트 **전체에 유한 벌점**을 더해 재시도해야 하며, 행 단위 차단만으로는 DP가 수렴하지 않는다(BE4 실측). **근거**: `postprocess_rules.json`; `journey.py::_rule_violation`; data 스펙 11 규칙절.
- **FR-010 — 낙차 균등성 지표**: 시스템은 경로 품질을 **BE4 벤치마크와 같은 지표**로 측정·기록할 수 있어야 한다(MUST) — 쌍별 인접 역 거리(`dist_from_prev`) median의 p50/p95, `progress_not_monotonic` 건수, `rule_violations` 건수, `unreachable` 건수. 이 지표는 응답 본문에 노출하지 않으며(정본 §3.3에 해당 필드 없음) 관측·검증용으로만 쓴다(MUST). 현재 기준선: `axis` median p50 2.949 / p95 3.788. **근거**: `bench_journey_v2.1-pca16.json`; Jira S15P21A405-61(성공 기준); 헌법 VIII. **[정정]** rev.1이 제안한 변동계수는 BE4 벤치마크와 대조할 수 없어 폐기.
- **FR-011 — 정거장 수와 산출 방식**: 경로 산출은 **기본 모드 `axis`**(축 통로 + Viterbi, D10)를 사용해야 한다(MUST). 정거장 수는 `endpoint_dist ≤ 10.7`이면 10, 초과하면 `clamp(round(10 + (endpoint_dist − 10.7)), 10, 20)`이어야 한다(MUST, D3). 통로 반경·λ·층 후보 상한·완화 단계는 **엔진 내부 파라미터이며 BE2가 정하거나 노출하지 않는다**(MUST NOT). **근거**: D3, D10; `journey.py::_station_count`, `_solve_corridor`.
- **FR-012 — 경계 입력**: `start == end`이면 엔진을 호출하지 않고 200과 `path` 1개(해당 곡, `step:0`), `musicCnt:1`을 반환해야 한다(MUST). `start != end`이면서 좌표가 동일하면 축 길이가 0이라 통로가 성립하지 않으므로 두 곡만 포함한 2곡 경로를 200으로 반환해야 한다(MUST). **근거**: api-spec §3.3; `journey.py::axis_frame`(`length == 0.0` 분기).
- **FR-013 — 결정성**: 같은 `start`·`end`·같은 번들·같은 모드에서 반복 요청하면 동일한 곡 목록과 동일한 순서를 반환해야 한다(MUST). 산출 로직에 기록되지 않은 무작위성을 도입해서는 안 된다(MUST NOT). **번들 버전이 바뀌면 결과가 달라질 수 있으며 결정성 보장은 번들 안에서만 성립한다.** **근거**: 헌법 IV·V·VI.
- **FR-014 — 오류 구조**: 검증 실패는 400 `INVALID_INPUT`, 없는 곡·식별자 해석 실패는 404 `MUSIC_NOT_FOUND`, 경로 불가는 422 `PATH_NOT_FOUND`, 인증 실패는 401 `UNAUTHENTICATED`/`INVALID_TOKEN`, **엔진 부재·타임아웃·응답 조립 불가·그 밖의 내부 실패는 500 `INTERNAL_SERVER_ERROR`** 로 응답하고, 실패 본문은 `success:false`, `data:null`, `error:{code,message}`(master `ErrorResponse`)여야 한다(MUST). 부분 경로를 성공으로 응답해서는 안 된다(MUST NOT). **엔진 부재를 422와 섞어서는 안 된다**(MUST NOT) — 사용자가 곡을 바꿔 해결할 수 있는 실패가 아니다. 새 에러 코드나 503을 정본 §0.5에 추가하지 않는다(2026-09-10 clarify); 엔진 부재와 다른 500의 구분은 로그·지표로만 한다(MUST). **근거**: 2026-09-10 clarify; master `common.GlobalErrorCode`/`AuthErrorCode`/`MusicErrorCode`/`GlobalExceptionHandler`; api-spec §0.2·§0.4·§0.5.
- **FR-015 — 인증**: `Authorization: Bearer {accessToken}` 인증을 요구해야 한다(MUST). master `SecurityConfig`는 기본 거부(`anyRequest().authenticated()`)이므로 `/music/journey`는 별도 조치 없이 인증 대상이다. **근거**: api-spec §0.1·§0.7·§3.3; master `SecurityConfig`(S15P21A405-33).
- **FR-016 — 고정 좌표**: 경로 곡의 좌표는 서빙 번들(`v2.1-pca16`, PCA-16, D7) 기준으로 진입 경로와 무관하게 동일해야 하며(MUST), 경로 생성이 좌표·모델을 변경해서는 안 된다(MUST NOT). 서빙·요청 경로에서 차원 축소 모델을 재학습해서는 안 된다(MUST NOT). **근거**: 헌법 V·VII; D7.
- **FR-017 — 아키텍처 경계**: 경로 산출 알고리즘(축 통로·Viterbi·후처리·완화 단계)은 **BE4 데이터 엔진(Python)이 소유**해야 한다(MUST). BE2는 정본 계약 준수, 입력 검증, 식별자 해석, 응답 조립, 오류 매핑을 소유하는 **게이트웨이**여야 한다(MUST). BE2가 경로 산출 로직을 Java로 재구현해서는 안 된다(MUST NOT). **근거**: **D4**(검색 서비스 = Python FastAPI + numpy, BE 게이트웨이가 호출); 헌법 X. **[정정]** rev.1의 "BE4 MyBatis 조회 port(`*Reader`) 패턴"은 D4와 맞지 않는다. 그 패턴은 곡 조회에는 유효하나 여정 산출에는 적용되지 않는다.
- **FR-018 — 순수 조회**: 경로 생성은 어떤 도메인 상태도 변경해서는 안 된다(MUST NOT). 여정 이력 저장은 S15P21A405-64 범위다. **근거**: 헌법 X.
- **FR-019 — 엔진 의존성 표면화**: 데이터 엔진 HTTP 엔드포인트가 아직 없으므로(`retrieval/api.py`는 docstring만), 게이트웨이는 엔진 호출을 **교체 가능한 경계 하나로 분리**해야 한다(MUST). 엔진이 없을 때 미구현을 명확히 드러내야 하며(MUST), 임시 경로 산출 로직·목 데이터를 운영 코드로 남겨서는 안 된다(MUST NOT). **근거**: `data/retrieval/api.py` 현재 상태; Jira S15P21A405-118 제외 범위("API 엔드포인트는 별도"); 헌법 IX.
- **FR-020 — 진행도 단조 증가**: `axis` 모드 경로의 정거장 진행도(`progress`)는 순서대로 단조 증가해야 한다(MUST). 위반은 규칙 위반으로 취급해 측정·기록해야 한다(MUST). **근거**: data 스펙 11 AC2; D10(linear의 40쌍 중 21쌍 위반이 방식 전환의 최강 근거). **[신규]** rev.1에 없던 요구사항.
- **FR-021 — 정거장 범위 매핑**: 엔진의 `n_stations`는 **중간 정거장 수**이고 `stations`에는 출발·도착이 없다. 게이트웨이는 이를 정본의 `path`(출발·도착 포함)·`musicCnt`(전체 곡 수)로 변환해야 한다(MUST). 두 수를 혼용해서는 안 된다(MUST NOT). **근거**: `journey.py`(`path[1:-1]`); api-spec §3.3.
- **FR-022 — 식별자 해석**: 정본 계약은 `start`·`end`를 정수 `id`로 받지만 데이터 엔진과 data 소유 스키마는 `mbid`(text UUID)를 식별자로 쓴다. 게이트웨이는 `id ↔ mbid` 해석을 담당해야 한다(MUST). **BE 소유 곡 테이블이 정수 `id` PK와 `mbid` UNIQUE를 함께 갖는 것을 매핑 원천으로 한다**(2026-09-10 clarify). 따라서 정본 §3.3·§0.6의 정수 `id` 계약과 프론트는 바뀌지 않고(MUST), 엔진에 `id`를 받게 요청하지도 않는다(MUST NOT). 요청 경로에서 `start`·`end`를 `mbid`로 해석하고, 응답 조립에서 엔진 정거장의 `mbid`를 `id`로 역매핑해야 한다(MUST). 해석 실패(해당 `id` 없음 / `mbid` 없음)는 FR-003의 404로 처리해야 한다(MUST). **근거**: 2026-09-10 clarify; api-spec §0.6; master `MusicDetail`(id·mbid 동시 보유)·`MusicDetailReader.findDetail(long id)`; data 스펙 50(`track.mbid` PK). **[신규]**
- **FR-023 — 엔진 메타 비노출**: 게이트웨이는 엔진을 기본 모드 `axis`로 고정 호출해야 하며(MUST), `mode`를 정본 계약에 추가하거나 클라이언트에 노출해서는 안 된다(MUST NOT). `linear`는 BE4의 이식 검증·A/B용 모드다. 엔진 응답의 `far`·`endpoint_dist`·`n_stations`·`last_to_end`·`rules`·`bundle`도 응답 본문에 싣지 않아야 한다(MUST NOT, 2026-09-10 clarify) — 정본 §3.3에 대응 필드가 없고 계약 추가는 FE1 합의가 선행이다(헌법 II). 이 값들은 관측 지표·로그로만 남긴다(MUST). **근거**: 2026-09-10 clarify; D2→D10(UI 토글 없음); 정본 §3.3 응답·파라미터 목록. **[신규]**

### Key Entities *(include if feature involves data)*

- **경로 요청**: `start`(1 이상 정수, 출발곡 ID), `end`(1 이상 정수, 도착곡 ID).
- **경로(Journey Path)**: 순서 있는 정거장 목록. 출발곡 `step:0` ~ 도착곡. 길이 1~22(계약 상한 30). 집계값 `musicCnt`, `totalDuration`(초).
- **정거장(Stop)**: `step`(0-based) + MusicDetail(id, mbid, title, artist, bpm, duration, album, genres, youtubeUrl, location pc1~pc16, playCnt, youtubeCnt). 좌표는 번들 `v2.1-pca16` 고정.
- **엔진 정거장(Engine Station)**: `rank`, `row`/`mbid`, `dist_from_prev`, `progress`. 출발·도착 제외. 게이트웨이 내부에서만 쓰이고 응답에 그대로 나가지 않는다.
- **엔진 응답 메타**: `mode`, `endpoint_dist`, `far`, `n_stations`, `last_to_end`, `reachable`, `bundle`, `rules`. 응답에 싣지 않고 관측 지표·로그로만 쓴다(FR-023). 예외적으로 `reachable`은 422 판정에, `n_stations`는 `musicCnt` 계산에 게이트웨이 내부에서 쓰인다.
- **후처리 규칙(Rules)**: `tau_dup`, `artist_cap`, `length_range_s`, `flag_*` 후순위. `postprocess_rules.json`이 정본.
- **낙차 균등성 지표**: 인접 역 거리 median p50/p95, 단조 위반 건수, 규칙 위반 건수. 응답에 포함하지 않는 내부 측정값.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: US1(순서·필드·집계·재생불가 포함·결정성·모드 고정), US2(단조 증가·낙차·후처리 규칙), US3(far 정거장 증가·경계 입력), US4(404/422/400/401/500·엔진 부재) 시나리오를 모두 통과한다. 엔진 HTTP 엔드포인트(FR-019)와 식별자 매핑(B-ID) 확정 전에는 엔진 경계 mock 기준으로 검증한다.
- **SC-002**: 두 곡을 지정한 뒤 사용자가 경로를 받기까지 **종단 3초 이내**가 이 기능의 유일한 성능 게이트다(2026-09-10 clarify). 엔진 구간은 하위 예산이며 현재 실측은 `axis` p95 **1.541초**(전곡 스캔 백엔드)이므로, 게이트웨이 왕복·식별자 해석 2회(`id→mbid`, `mbid→id`)·최대 22곡 상세 조립에 남는 예산은 약 **1.46초**다. 엔진 구간이 3초를 넘으면 상위 게이트 위반으로 판정한다. **근거**: 요구사항 §6(확정); `bench_journey_v2.1-pca16.json`; 2026-09-10 clarify.
- **SC-003**: `axis` 경로의 진행도 단조 증가 위반이 **0건**이다. **근거**: FR-020; 실측 40쌍 0건.
- **SC-004**: 후처리 규칙 위반이 **0건**이다 — 같은 canonical 중복, `artist_cap`(3) 초과, 길이 규칙 위반, `excluded` 포함, 인접 거리 `tau_dup` 미만. **근거**: FR-009; 실측 40쌍 0건.
- **SC-005**: `axis`의 쌍별 인접 역 거리 median이 같은 쌍의 `linear` 값보다 작다(현재 기준선 p50 2.949 대 3.430, p95 3.788 대 4.600). **근거**: FR-010; data 스펙 11 AC4.
- **SC-006**: 같은 두 곡·같은 번들·같은 모드에서 경로 생성을 반복하면 동일한 곡 목록·동일 순서를 반환한다(차이 0건). **근거**: FR-013.
- **SC-007**: `path` 길이가 30을 넘는 사례가 0건이고, `musicCnt`가 `path` 길이와 다른 사례가 0건이다. **근거**: FR-008, FR-021.
- **SC-008**: 같은 번들에서 동일 곡의 반환 PC1~PC16 차이는 0이며, 경로 생성에 의한 좌표·모델 변경은 0건, 도메인 저장소 쓰기는 0건이다. **근거**: FR-016, FR-018.
- **SC-009**: 실패 요청(400/401/404/422/500)을 코드별로 로그·지표에서 구분해 추적할 수 있고, 500 중 **엔진 부재·타임아웃과 그 밖의 내부 실패를 구분**할 수 있다(응답 코드는 같으므로 지표로만 갈린다). 엔진 메타(`far`, `endpoint_dist`, `n_stations`, `mode`)가 관측 지표에 남고 응답 본문에는 0건 노출된다. 로그·지표에 비밀정보·불필요한 개인정보 노출은 0건이다. **근거**: 헌법 VIII; FR-014, FR-023; 요구사항 §6.

**plan 단계로 미루는 사항**:

- 엔진 호출 경계 설계 — HTTP 클라이언트, **타임아웃 값과 재시도 여부**(3초 종단 예산에서 역산), 엔진 오류의 500 매핑 지점. 엔드포인트가 생긴 뒤(FR-019) 확정.
- 식별자 해석 구현 — BE 소유 곡 테이블의 `id`·`mbid` 컬럼 조회 port 시그니처. 왕복 2회(`id→mbid`, `mbid→id`)를 한 번으로 줄일 수 있는지(정거장 상세 조회와 합치기).
- 정거장 상세 필드 조회 — 엔진이 `mbid`만 주므로 최대 22곡의 MusicDetail을 한 번에 읽는 방법(IN 조회 vs 배치). 1.46초 하위 예산 안에 들어가야 한다.
- 응답 DTO 설계 — `JourneyResponse`(musicCnt/totalDuration/path) + 정거장 DTO의 기존 `MusicDetail` 재사용 범위.
- `PATH_NOT_FOUND`(422) 도메인 에러 정의 위치 — 기존 `MusicErrorCode` 확장 vs 신규 `JourneyErrorCode`.
- **관측 지표 (헌법 VIII)** — 요청량·지연(3초 예산 대비 게이트웨이/엔진 구간 분리)·오류율(422/500/엔진부재)·인접 역 거리 median 분포·단조 위반 건수의 확인 방법.
- 3초 예산의 측정 구간·백분위·부하 조건. 엔진이 pgvector 백엔드(스펙 17)로 바뀌면 재측정 필요.
- 테스트 인프라 — master `@MapperScan` + `@WebMvcTest` 슬라이스 대응(002·003과 공유 과제).

## Assumptions

- **기준 인프라 = master 통합본**: backend/ 단일 Gradle 프로젝트, 공통 레이어 `common.ApiResponse`/`ErrorCode`/`GlobalErrorCode`/`AuthErrorCode`/`MusicErrorCode`/`CustomException`/`GlobalExceptionHandler`, MyBatis + Postgres(+Neo4j/Redis).
- **BE2 = 게이트웨이, BE4 = 엔진**(D4). 본 spec은 게이트웨이 쪽 요구사항이다. 엔진의 알고리즘 파라미터·모드 기본값·완화 단계는 BE4 소유이며 여기서 재정의하지 않는다.
- **경로 산출 방식은 `axis`가 기본**(D10)이고 `linear`는 남아 있는 모드다. 정본 §3.3 본문("출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택")은 `linear`를 서술한 것이며 현재 기본 동작과 다르다 → 정본 갱신 필요(아래 알림).
- **인증은 블로커가 아니다**: 003이 남긴 B-A는 master `SecurityConfig` 기본 거부 전환(S15P21A405-33)과 `AuthErrorCode`로 해소됐다.
- 후처리 임계값은 `postprocess_rules.json`(현재 `serving/v2.1-pca16/`)이 정본이다. 값을 spec·코드에 고정하지 않는다.
- 서빙 번들은 현재 `v2.1-pca16`이다. data 스펙 10 예시에 `v2.2-pca16`이 보이고 D1이 `serving/v2.2-pca16` 재적재를 예고하므로, 번들 교체 시 경로 결과와 지표 기준선이 함께 바뀐다고 본다.
- `PATH_NOT_FOUND`(422)는 정본 §0.5에 있으나 master 코드에 없다. 여정 도메인 에러는 BE2 소유이므로 본 기능에서 정의할 수 있고 타 팀 블로커가 아니다(003의 `MUSIC_NOT_FOUND` 선례).
- 엔진의 `far`·`endpoint_dist`·`mode`·`n_stations`·`last_to_end`·`rules`·`bundle`은 정본 §3.3 응답에 대응 필드가 없어 싣지 않는다(2026-09-10 clarify). 관측 지표·로그로만 남기고, 계약 추가가 필요해지면 별자리 뷰(-62)에서 FE1과 정한다(헌법 II).
- 프론트는 여정 곡 수를 고정값으로 가정하지 않는다고 본다. far 여정이 다수(실측 40쌍 중 30쌍)라 `musicCnt`가 12~22로 변동한다.
- 여정 이력 저장·조회(-64), 별자리 시각화(-62), 순차 재생(-63), 프론트 출발·도착 지정 UI, 주변 탐색(-59, data 스펙 10)은 범위 밖이다.
- pgvector(D9, 스펙 17)는 좌표 이웃 조회용이며 **여정을 SQL로 옮기는 것은 스펙 17의 비범위**다. 여정은 Python 엔진에 남는다.

## Dependencies / Blockers

| ID | 내용 | 상태 |
| --- | --- | --- |
| **B-ID** | ~~`id`(int) ↔ `mbid`(UUID) 매핑 원천이 없다~~ → **해소**: BE 소유 곡 테이블이 int `id` PK + `mbid` UNIQUE (2026-09-10 clarify). 남은 것은 그 테이블·컬럼을 **누가 언제 만드는가** — 현재 `backend/src/main/resources/mapper/`에 music 매퍼가 없다 | 협의 — BE4에 `mbid` 컬럼 포함 요청 |
| **B-Gate** | ~~성능 게이트 불일치~~ → **해소**: 종단 3초가 유일 게이트, 엔진은 하위 예산 (2026-09-10 clarify). 남은 것은 data 스펙 11 AC1의 `axis` p95 ≤ 5초 **하향 조정 요청** | 협의 — BE4 |
| **B-Far** | ~~엔진의 `far`·`endpoint_dist`를 프론트에 노출할지~~ → **해소**: 싣지 않고 정본 §3.3 유지 (2026-09-10 clarify). 남은 것은 **프론트에 `musicCnt` 12~22 변동을 알리는 것** | 알림 — FE1 |
| B-Engine | 데이터 엔진 HTTP 엔드포인트 미구현(`retrieval/api.py` docstring만). Jira S15P21A405-118 제외 범위 | 대기 — BE4 |
| B-Merge | MR !17이 `S15P21A405-39` 브랜치 위에 쌓여 있어 39 선행 머지 필요(BE4 코멘트). 아직 `data/dev` 미반영 | 대기 — BE4 |
| B-Metric | 낙차 지표 합격 임계값. 지표식은 BE4 벤치마크로 확정됐고 **합격선**만 미정 | plan 단계 |
| B-Common | 422 `PATH_NOT_FOUND` 도메인 에러 정의·공통 핸들러 연동 | 진행 가능 (BE2 정의) |

**[해소 기록]**
- rev.1 Q1(등분 수)·Q2(아티스트 반복)·Q3(detour) → BE4 구현·결정으로 해소. Clarifications 참조.
- 003-music-detail의 B-A(Core 인증) → master 통합으로 해소.
- rev.1 B-D(BE4 ANN 실행·거리 계산식) → 여정에 관해서는 해소. `nearest_to_point`가 전곡 스캔(1지점 111ms)·그래프 후보를 제공하고 거리는 L2(pgvector `vector_l2_ops`, τ 값들이 L2 기준). 주변 탐색(-59) 쪽은 별건.

**[정정 기록]**
- 정본 §0.5는 400을 `VALIDATION_ERROR`, 500을 `INTERNAL_ERROR`로 적지만 master 구현은 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`다. 002·003이 이미 보고한 불일치이며 본 spec은 구현 코드값을 따른다.
- 정본 §3.3의 "중간 지점: 출발→도착 벡터를 등분한 각 지점에서 최근접 곡 선택"은 D10 이후 기본 동작과 다르다.
- 정본 §3.3의 "초과 경로는 서버가 30곡 이하로 줄인 뒤 최종 목록 기준으로 곡 간 도약을 재평가"는 엔진 상한이 20이라 발동하지 않는다.
- data 스펙 11 규칙절은 "아티스트당 ≤ 2"로 적지만 `postprocess_rules.json`의 `artist_cap`은 **3**이고 구현은 파일 값을 읽는다. 스펙 11 문구가 최신이 아니다 → BE4에 확인 요청.
