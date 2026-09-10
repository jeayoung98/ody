# Quickstart: 경로 탐색 검증

**Feature**: 004-journey-path · **Date**: 2026-09-10 · **Plan**: [plan.md](plan.md)

이 문서는 **무엇이 통과해야 이 기능이 동작한다고 말할 수 있는가**를 적는다.
구현 코드는 담지 않는다 — 그건 `tasks.md`와 구현 단계 몫이다.

---

## 전제

| 항목 | 상태 |
| --- | --- |
| Java 17, Gradle wrapper | 준비됨 (`backend/gradlew`) |
| master 공통 레이어 (`ApiResponse`, `ErrorCode`, `GlobalExceptionHandler`) | 준비됨 |
| 인증 (`SecurityConfig` 기본 거부, `AuthErrorCode`) | 준비됨 (S15P21A405-33, -121) |
| `MusicDetail`·`Location` record | 준비됨 |
| BE4 데이터 엔진 HTTP 엔드포인트 | ⛔ **미구현** (`retrieval/api.py` docstring만) |
| BE 곡 테이블 (`id` PK + `mbid` UNIQUE) | ⛔ **미생성** |

두 ⛔ 때문에 **실 통합 검증은 지금 불가능하다.** 아래 A~C는 port mock으로 전부 돌아가고,
D는 두 항목이 준비된 뒤에만 실행한다. **D를 실행하지 않았다면 통과로 보고하지 않는다.**

---

## A. 최소 검증선 (CLAUDE.md §5)

```bash
cd backend && ./gradlew test
```

```bash
cd backend && ./gradlew build
```

**기대**: 둘 다 성공. 신규 테스트가 전부 통과하고 기존 테스트가 깨지지 않는다.

---

## B. 조립 로직 — 서비스 유닛 (port mock)

`JourneyPathFinder`와 `JourneyTrackReader`를 mock으로 두고 `JourneyService`만 검증한다.
[data-model.md](data-model.md) §6의 불변식 I1~I9이 검증 대상이다.

| # | 준비 | 기대 |
| --- | --- | --- |
| B1 | 엔진이 정거장 mbid 10개를 순서대로, reader가 그 10곡 상세를 **뒤섞인 순서로** 반환 | `path` 12개, 정거장 순서가 **엔진 순서**와 같다 (I7, R4) |
| B2 | 같은 준비 | `path[0].step == 0`, step이 0~11 연속 (I1) |
| B3 | 같은 준비 | `path[0].id == start`, `path[11].id == end` (I2) |
| B4 | 같은 준비 | `musicCnt == 12 == path.size()` (I3) |
| B5 | 각 곡 `duration` 합이 3480 | `totalDuration == 3480` (I4) |
| B6 | 정거장 중 한 곡의 `duration`이 null | 그 곡을 0으로 더하고 나머지 합산, 예외 없음 |
| B7 | 정거장 중 `youtubeUrl`이 null인 곡 포함 | 그 곡이 `path`에 남고 `youtubeUrl: null` (FR-007) |
| B8 | 엔진이 정거장 20개(상한) | `musicCnt == 22`, 축소 없음, 예외 없음 (FR-008) |
| B9 | 엔진이 정거장 29개(계약 위반 상황 강제) | 500 경로. 부분 경로를 반환하지 않는다 (I5) |
| B10 | reader가 요청한 mbid 중 1건을 **반환하지 않음** | 500 경로. 19곡 경로를 성공으로 내지 않는다 (R4) |
| B11 | 엔진 `progresses`가 단조가 아님 | 요청은 **200 통과**, 카운터·로그만 남는다 (FR-020, R10) |
| B12 | 엔진 응답에 같은 mbid 2회 | 500 또는 중복 검산 실패. 같은 곡이 두 번 나오지 않는다 (I6) |
| B13 | 전 시나리오 | 저장소 쓰기 호출 0건 (I8) |

## C. API 계약 — `@WebMvcTest` 슬라이스

컨트롤러만 세우고(`@MapperScan` 충돌 회피, R9) 서비스는 mock.

### C1. 성공 응답 형태

```
GET /music/journey?start=10234&end=10877
```

**기대**: 200, `success:true`, `error:null`, `data`에 `musicCnt`/`totalDuration`/`path`.
`path` 원소가 MusicDetail 필드 전부 + `step`으로 **평평하게** 직렬화된다(`@JsonUnwrapped`, R6).

**추가 확인 (I9)**: 응답 JSON에 `far`·`endpoint_dist`·`mode`·`n_stations`·`bundle`·`reachable` 키가
**하나도 없다.** 엔진 메타 비노출은 clarify 결정이므로 이 검사를 반드시 둔다.

### C2. 경계

| 요청 | 기대 |
| --- | --- |
| `start=10234&end=10234` | 200, `path` 1개(`step:0`), `musicCnt:1`, `totalDuration` = 그 곡 길이. **엔진 호출 0회** (R5) |
| `start != end`, 좌표 동일 | 200, 2곡 경로 |

### C3. 오류 매핑

| 요청 / 상황 | 기대 |
| --- | --- |
| `start` 누락 | 400 `INVALID_INPUT` |
| `start=0` | 400 `INVALID_INPUT` |
| `start=abc` | 400 `INVALID_INPUT` |
| `end` 누락 | 400 `INVALID_INPUT` |
| 없는 곡 ID | 404 `MUSIC_NOT_FOUND` |
| 엔진 `reachable:false` | 422 `PATH_NOT_FOUND`, message "두 곡을 연결하는 경로를 찾을 수 없습니다." |
| **엔진 port 빈 부재** | 500 `INTERNAL_SERVER_ERROR` — **422 아님** (clarify) |
| **엔진 타임아웃·연결 실패** | 500 `INTERNAL_SERVER_ERROR` — **422 아님** (clarify) |
| 정거장 상세 조회 누락 | 500 `INTERNAL_SERVER_ERROR` |

모든 실패 본문이 `success:false`, `data:null`, `error:{code,message}` 형태여야 한다.

### C4. 검증 순서

| 상황 | 기대 |
| --- | --- |
| `start=0`이고 엔진도 부재 | **400**이 먼저. 검증 실패가 엔진 부재보다 우선이고 엔진을 호출하지 않는다 |
| 없는 곡이고 엔진도 부재 | **404**가 먼저. 엔진 호출 전에 곡 조회가 끝난다 |

### C5. 인증

| 상황 | 기대 |
| --- | --- |
| `Authorization` 헤더 없음 | 401 `UNAUTHENTICATED` |
| 위조·만료 토큰 | 401 `INVALID_TOKEN` |

이 슬라이스는 시큐리티 체인을 태우지 않으므로, 이 두 건은 `SecurityConfig` 기본 거부 규칙이
`/music/journey`를 덮는지 확인하는 것으로 대체한다(permitAll 목록에 없음 → 인증 대상).

---

## D. 통합 검증 — ⛔ 선행 조건 대기

엔진 엔드포인트(B-Engine)와 곡 테이블이 준비된 뒤에만 실행한다.

| # | 검증 | 기대 | 근거 |
| --- | --- | --- | --- |
| D1 | 실제 두 곡으로 호출 | 200, `path`가 실 좌표·실 상세로 채워짐 | SC-001 |
| D2 | **종단 지연 측정** | **p95 ≤ 3초.** 엔진 구간(`ody.journey.engine` Timer)과 게이트웨이 구간을 분리해 기록 | SC-002 |
| D3 | 같은 두 곡 반복 호출 | 동일 곡 목록·동일 순서 (차이 0건) | SC-006 |
| D4 | 여러 쌍 호출 | 같은 곡 중복 0, `artist_cap`(3) 초과 0, `path.length ≤ 30` 위반 0 | SC-004, SC-007 |
| D5 | 먼 여정 쌍 (`endpoint_dist > 10.7`) | 정거장 수가 10보다 큼, 최대 20 | FR-011 |
| D6 | 같은 곡의 좌표를 상세 API와 대조 | `pc1`~`pc16` 차이 0 | SC-008 |
| D7 | 엔진을 내린 상태로 호출 | 500 (422 아님) | C3과 동일, 실 환경 확인 |

**단조 증가·인접 역 거리 median은 여기서 재측정하지 않는다.** BE4 `tests/bench_journey.py`가
40쌍으로 이미 측정했고(단조 위반 0, median p50 2.949) 그 지표의 소유자는 BE4다(R10, SC-003·SC-005).
게이트웨이는 단조 위반 카운터가 0인지만 본다.

---

## 보고 형식

검증 결과는 통과·실패·**미실행**을 구분해 적는다(헌법 III). 특히:

- A·B·C를 돌렸으면 그대로 적는다.
- **D는 선행 조건 미충족으로 미실행**이라고 적는다. "3초 이내 동작 확인"이라고 쓰지 않는다.
- 엔진·DB 어댑터가 미완성이면 그 사실을 적는다.
