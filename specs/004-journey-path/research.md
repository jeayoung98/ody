# Phase 0 Research: 경로 탐색 게이트웨이

**Feature**: 004-journey-path · **Date**: 2026-09-10 · **Spec**: [spec.md](spec.md)

spec에 남은 미결정과 plan 단계로 넘긴 항목을 실제 저장소 상태로 해소한다.
근거 없이 고른 항목은 없다. 확인 못한 것은 그대로 미확인으로 적는다.

---

## R1 — 엔진 HTTP 호출 수단

**Decision**: Spring Framework의 **`RestClient`** 를 쓴다. 새 의존성을 추가하지 않는다.

**Rationale**: `backend/build.gradle`에 `spring-boot-starter-webmvc`가 있고 `RestClient`는 그 안의
`spring-web`에 들어 있다. 동기 호출 한 곳이라 논블로킹이 필요 없다.

**Alternatives considered**:
- `WebClient` — `spring-boot-starter-webflux` 의존성을 새로 넣어야 한다. 동기 호출 하나에 리액티브 스택을 끌어오는 값이 없다.
- `RestTemplate` — 신규 코드에 권장되지 않고 `RestClient`가 같은 동기 모델을 대체한다.
- `HttpClient`(JDK) — 직렬화·에러 변환을 직접 써야 한다. 이득 없음.

---

## R2 — 엔진 경계의 형태

**Decision**: **port 인터페이스 1개 + 어댑터 1개**. `JourneyPathFinder`(BE2 소유 계약)를
`Optional`로 주입하고, 구현 `JourneyEngineClient`(RestClient)가 BE4 엔진을 호출한다.
빈이 없으면 기존 `MusicService` 패턴대로 미구현을 드러낸다.

**Rationale**: master에 이미 같은 패턴이 두 개 있다(`MusicSearchReader`, `MusicDetailReader` —
`Optional` 주입 + 어댑터 부재 시 `UnsupportedOperationException`). 새 패턴을 만들 이유가 없고,
`retrieval/api.py`가 아직 docstring뿐이라(B-Engine) 어댑터 없이도 컴파일·테스트가 돌아야 한다(FR-019).

**Alternatives considered**:
- 서비스가 `RestClient`를 직접 들기 — 엔진 없이 단위 테스트를 못 하고, pgvector 백엔드로 바뀔 때 서비스가 흔들린다.
- 인터페이스 없이 어댑터만 — FR-017의 경계 요구를 코드로 표현할 자리가 없다.

---

## R3 — 식별자 해석과 정거장 상세 조회를 몇 번에 하는가

**Decision**: **DB 조회 2회 + 엔진 호출 1회.** 별도의 `id→mbid` 조회를 만들지 않는다.

1. 기존 `MusicDetailReader.findDetail(long id)` 를 `start`·`end`에 각각 호출한다.
   `MusicDetail` record가 이미 `mbid`를 갖고 있어 **엔진 호출에 필요한 mbid가 여기서 나온다.**
   없는 곡(`Optional.empty`) → 404 `MUSIC_NOT_FOUND`도 같은 자리에서 처리된다(FR-003, FR-022).
2. 엔진에 두 mbid로 경로를 요청한다. 응답 `stations`는 중간 정거장만(FR-021).
3. 신규 port 메서드 하나로 중간 정거장 mbid들을 한 번에 조회한다(최대 20건).

**Rationale**: `id→mbid` 전용 조회를 두면 같은 행을 두 번 읽는다. `findDetail`이 이미
그 행 전체를 주고, `path[0]`·`path[last]`에 넣을 상세 필드도 그 결과가 그대로 쓰인다.
왕복이 줄어 1.46초 하위 예산(SC-002)에 여유가 생긴다.

**Alternatives considered**:
- `findMbidById` 전용 메서드 — 조회 1회 추가. start/end 상세를 어차피 또 읽어야 한다.
- 정거장을 하나씩 조회 — 최대 22회 왕복. 예산 위험.
- 매핑을 Redis에 캐시 — `spring-boot-starter-data-redis`가 있긴 하지만, 측정된 병목이 아니다. 필요해지면 그때.

---

## R4 — 신규 port 메서드의 순서 보장

**Decision**: port는 순서를 보장하지 않는다. **게이트웨이가 `Map<String, MusicDetail>`로 받아
엔진이 준 정거장 순서대로 재조립한다.**

**Rationale**: SQL `IN`은 입력 순서를 보존하지 않는다. 어댑터에 `ORDER BY CASE ...` 같은 요구를
얹으면 BE4 SQL이 복잡해지고 그 순서가 맞는지 게이트웨이가 검증할 수도 없다. 순서의 원천은
엔진 응답이므로 순서 조립도 게이트웨이가 갖는 게 맞다(FR-005, FR-021).

**부수 효과**: 조회 결과에 없는 mbid(엔진과 DB 번들 불일치)를 조립 단계에서 잡아
500 `INTERNAL_SERVER_ERROR`로 처리한다(FR-014, 부분 경로 금지).

---

## R5 — `start == end` 처리 위치

**Decision**: **엔진 호출 전에 게이트웨이가 짧게 끊는다.** `findDetail(start)` 1회만 하고
`path` 1개(`step:0`), `musicCnt:1`, `totalDuration`은 그 곡의 `duration`으로 응답한다.

**Rationale**: 엔진 `axis_frame`은 축 길이 0이면 통로를 만들 수 없어 경로가 없다.
FR-012는 이 경우 200을 요구하므로 엔진에 보내면 422가 나올 자리다. 조회 1회로 끝나는 일에
HTTP 왕복을 쓸 이유도 없다.

**주의**: `start != end`인데 좌표가 같은 경우는 별개다(FR-012 후반). 이건 엔진이 축 길이 0으로
판단해 경로 없이 돌려주므로, 게이트웨이가 **2곡 경로**로 조립한다.

---

## R6 — 응답 DTO 표현

**Decision**: `JourneyResponse(musicCnt, totalDuration, path)` + `JourneyStop`은
**`@JsonUnwrapped MusicDetail` + `int step`**.

**Rationale**: 003-music-detail의 `NeighborTrack`(`@JsonUnwrapped MusicSummary` + `distance`)과
같은 선례다. 정본 §3.3의 `path` 원소는 MusicDetail 필드 전부 + `step`이므로 필드를 다시 나열하면
`MusicDetail`과 이중 관리가 된다.

**Alternatives considered**:
- 필드를 펼쳐 쓴 별도 record — 정본 §0.6이 바뀔 때 두 곳을 고쳐야 한다.
- `Map<String,Object>` — 타입 검증이 사라진다.

---

## R7 — `PATH_NOT_FOUND`(422) 정의 위치

**Decision**: 기존 **`common.MusicErrorCode`에 상수 하나 추가**. 새 `JourneyErrorCode` 파일을 만들지 않는다.

**Rationale**: `MusicErrorCode`가 이미 `ErrorCode` 인터페이스를 구현하고 `MUSIC_NOT_FOUND`를 담고 있다.
정본 §0.5도 두 코드를 한 표에 둔다. 여정 전용 enum은 상수 1개에 파일 1개를 쓰는 셈이다.
공통 핸들러 연동은 `CustomException(ErrorCode)` 경로가 이미 처리한다(B-Common 해소).

---

## R8 — 엔진 타임아웃과 재시도

**Decision**: 엔진 호출 타임아웃 **2초**(연결 + 응답), **재시도 없음**. 설정 속성으로 뺀다.

**Rationale**: 종단 예산 3초(SC-002)에서 역산한다. 엔진 실측 p95 1.541초이므로 2초는 정상 응답을
자르지 않는다. 남는 1초가 DB 조회 2회 + 조립 몫이다. **재시도를 1회만 넣어도 최악 4초로 예산을 넘긴다** —
따라서 재시도는 넣지 않고, 실패는 500으로 즉시 전달한다(FR-014).

**미확인**: 엔진 엔드포인트가 아직 없어(B-Engine) 실제 게이트웨이 왕복 오버헤드는 측정하지 못했다.
2초는 예산 역산값이며 통합 후 재측정 대상이다. 이 값을 측정 결과로 보고하지 않는다.

---

## R9 — 테스트 인프라

**Decision**: 002·003과 같은 **`@WebMvcTest` 슬라이스** + port mock 서비스 유닛 테스트.

**[2026-09-10 정정]** 처음 이 항목을 "standalone MockMvc" 로 적었으나 실제 저장소 관례를 확인한 결과
`@WebMvcTest(controllers = ...)` 에 `excludeFilters` 로 `SecurityConfig`·`JwtAuthenticationFilter` 를 빼고
`@MapperScan` 이 끌어오는 매퍼를 `@MockitoBean` 으로 채우는 방식이다(003 `MusicDetailControllerTests` 선례).
이 방식이 실제 MVC 바인딩·`GlobalExceptionHandler` 매핑·Jackson 직렬화를 함께 검증하므로 더 낫다.
구현은 이 관례를 따랐고 39건이 통과한다.

**Rationale**: master가 `@MapperScan`을 쓰고 있어 슬라이스가 매퍼 빈을 요구한다(002·003이 이미 밟은 문제).
매퍼를 `@MockitoBean` 으로 채워 회피한다. BE-infra 소스는 수정하지 않는다.
엔진·DB 둘 다 port mock이라 B-Engine 대기 중에도 US1~US4 전부 검증된다.

**검증 대상 로직**(테스트가 실제로 잡아야 하는 것): step 연속 부여, `musicCnt = n_stations + 2`,
`totalDuration` 합, mbid→detail 재조립 순서, `start == end` 단축, 30곡 가드, 조회 누락 시 500,
`reachable:false` → 422, 엔진 예외 → 500(422 아님).

---

## R10 — 관측 지표 (헌법 VIII)

**Decision**: 세 가지만 둔다.

| 지표 | 수단 | 왜 |
| --- | --- | --- |
| 종단 지연·요청량·상태코드별 오류율 | actuator `http.server.requests` (이미 있음) | 3초 게이트(SC-002)와 SC-009의 400/401/404/422/500 구분이 여기서 나온다 |
| 엔진 구간 지연 | Micrometer `Timer` 1개 (`ody.journey.engine`) | "엔진은 하위 예산" 판정에 구간 분리가 필요하다(SC-002). actuator만으로는 게이트웨이/엔진을 못 가른다 |
| 엔진 메타·품질 | 구조화 로그 1줄 — `far`, `endpoint_dist`, `n_stations`, 단조 위반 여부 | FR-010·FR-023. 응답에 안 싣기로 했으므로(clarify) 로그가 유일한 경로. 곡 제목·사용자 식별자는 남기지 않는다 |

**진행도 단조 증가**(FR-020): 엔진이 구조적으로 보장하므로 게이트웨이가 다시 계산해 응답을 막지 않는다.
엔진이 준 `progress` 수열이 단조가 아니면 **카운터 1개만 올리고 로그에 남긴다**. 요청은 200으로 통과시킨다.

**Alternatives considered**:
- 인접 역 거리 median을 게이트웨이가 계산해 지표로 — BE4 `tests/bench_journey.py`가 이미 측정한다. 운영 경로에서 다시 계산할 값이 아니다.
- 엔진 메타를 지표 태그로 — `endpoint_dist`는 연속값이라 태그로 쓰면 카디널리티가 터진다. 로그가 맞다.

---

## R11 — 번들 버전 확인

**Decision**: 이번 범위에서 번들 버전 검증을 하지 않는다. 엔진 응답의 `bundle` 값을 **로그에만** 남긴다.

**Rationale**: 엔진 응답에 `bundle`이 있고 DB 좌표도 번들에서 나오지만, 게이트웨이가 둘을 대조할
기준값을 갖고 있지 않다(BE 곡 테이블에 번들 컬럼이 있는지 미확인). data 스펙 17은 `track_vector.bundle`을
계획하지만 아직 스펙 단계다. 없는 컬럼을 있다고 가정하지 않는다(헌법 IX).

**후속**: 번들 불일치는 R4의 "조회 결과에 없는 mbid" 경로로 부분적으로 드러난다.
정식 검증은 곡 테이블 스키마가 확정된 뒤 별건.

---

## 미해결로 남기는 것

| 항목 | 왜 지금 못 정하는가 |
| --- | --- |
| 엔진 엔드포인트 경로·파라미터·오류 바디 | `retrieval/api.py`가 docstring뿐(B-Engine). data 스펙 11의 `GET /journeys?from=&to=&n=&mode=`는 스펙 문구이고 구현 확정이 아니다. 어댑터 1개 파일에 격리해 확정 후 채운다 |
| 엔진 base URL 설정 위치 | 배포 형태(같은 호스트 / 컨테이너 네트워크)가 인프라 소유. 속성으로 빼고 값은 인프라에 요청 |
| BE 곡 테이블 `mbid` 컬럼·매퍼 | clarify로 방향은 정해졌으나 테이블·매퍼가 아직 없다. port 계약만 정의하고 어댑터는 대기 |
| 게이트웨이 왕복 실측 | 엔진 부재로 측정 불가(R8) |
