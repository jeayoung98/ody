# Implementation Plan: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Branch**: `backend/feat/S15P21A405-224-journey-inprocess-pathfinder` (rev.3) · 이전 `backend/feat/S15P21A405-61-journey-path-creation` (rev.2, 머지 완료) | **Date**: 2026-09-11 | **Spec**: [spec.md](spec.md)

**Input**: spec.md rev.3 (경로 산출 인프로세스 전환, 2026-09-11 팀 결정)

**Status**: **게이트웨이 계층은 구현 완료**(2026-09-10, `backend/dev` 머지). `./gradlew test` 통과.
**산출 계층은 rev.3 에서 새로 만든다** — rev.2 는 원격 파이썬 엔진 호출을 전제했고 2026-09-11 결정이
그 전제를 뒤집었다(FR-017 개정). 조립·오류 매핑·DTO·컨트롤러는 **그대로 살아남는다** — 산출 주체가
바뀌어도 정본 응답 계약이 같기 때문이다. **D-DATA**(곡 테이블·좌표 컬럼·벡터 확장·근사 인덱스 미프로비저닝)로
층 후보 조회 어댑터는 계약만 두고 대기하며, **산출 알고리즘은 그 대기에 걸리지 않는다**(FR-019 개정).

## Summary

`GET /api/music/journey?start=&end=`에서 두 곡을 잇는 순서 있는 곡 목록을 반환한다(정본 §3.3).

**rev.3: 경로 산출을 BE2 가 한다.** 축 통로 + Viterbi(`axis`, D10)를 백엔드 프로세스 안에서 수행하고,
좌표·층 후보는 저장소의 벡터 근사 인덱스로 조회한다(FR-017 개정). 방식은 데이터 파트가 정의한 것을
따르고 **실행 위치만** 옮긴다 — 임계값은 규칙 정의에서 읽어 이중화를 막는다(FR-024).

흐름은 **DB 조회 2회 + 산출 1회**이며, 산출 안에서 **층 후보 조회가 n회(n = 10~20)** 일어난다.
`start`·`end` 상세를 먼저 읽어 좌표와 mbid를 얻고(없는 곡 404도 여기서), 산출이 준 중간 정거장을
한 번에 조회해 `[출발] + 정거장 + [도착]`으로 조립하며 `step`을 0부터 부여한다.

**세 층으로 자른다** — 이 경계가 이 plan 의 핵심 결정이다.

| 층 | 책임 | 저장소를 아는가 | 검증 방법 |
| --- | --- | --- | --- |
| **호출부** (`JourneyService`) | 검증 · 식별자 해석 · 조립 · 오류 매핑 · 관측 | 상세 조회만 | 산출 경계 mock (rev.2 에서 통과) |
| **산출** (`JourneyPathFinder` 구현) | 역 수 · 축 좌표계 · 층 지점 계산 · 후보 필터 · Viterbi DP · 규칙 재산출 루프 | **아니다** | **합성 좌표** — D-DATA 무관 |
| **층 후보 조회** (신규 port) | 지점 좌표로 근사 이웃 N개 | 그렇다 | 실 DB (D-DATA 대기) |

산출이 저장소를 직접 알지 않는 것이 FR-019·FR-020·SC-003 이 요구하는 것이다 —
그래야 "진행도가 단조 증가하는가" 를 실 DB 없이 검증할 수 있다.

## Technical Context

**Language/Version**: Java 17 (`backend/build.gradle`, `options.release = 17`).

**Primary Dependencies**: Spring Boot 4.1.1 — webmvc, validation, actuator, security, MyBatis 4.1.0,
micrometer-prometheus, lombok. **신규 의존성 없음** — rev.3 에서도 그대로다. 산출은 `double[]` 산술과
표준 자료구조로 충분하고, rev.2 가 예정했던 HTTP 클라이언트(`RestClient`)는 **더 이상 쓰이지 않는다**.
행렬 라이브러리를 넣지 않는다 — 16차원 벡터 거리 계산에 필요 없다.

**Storage**: Postgres(MyBatis). 곡 상세·좌표는 서빙 번들 `v2.1-pca16`(PCA-16, D7) 기준.
BE 곡 테이블에 정수 `id` PK + `mbid` UNIQUE 가 필요하고(clarify), **rev.3 에서 16차원 좌표 컬럼과
벡터 근사 인덱스가 추가로 필요해졌다** — 층 후보 조회가 이를 쓴다. `backend/dev` 에 마이그레이션 SQL
0건·곡 매퍼 0건이므로 **미프로비저닝**이며, **주변 탐색(005)의 요청과 동일**하다(D-DATA).

**External Service**: **없다 (rev.3).** rev.2 의 BE4 데이터 엔진(Python FastAPI) 호출이 사라졌다.
`ody.journey.engine.base-url` / `timeout` 설정도 쓰이지 않는다.

**Testing**: JUnit Platform, `@WebMvcTest` 슬라이스(`SecurityConfig`·`JwtAuthenticationFilter` 제외 + master `@MapperScan` 매퍼를 `@MockitoBean` 으로, 002·003 선례),
port mock 서비스 유닛(R9).

**Target Platform**: Java 17 컨테이너(`backend/Dockerfile`), HTTP 8080.

**Project Type**: 단일 Gradle backend (`backend/`).

**Performance Goals**: **종단 3초**(요구사항 §6, clarify로 유일 게이트 확정). **rev.3: 예산 구성이 바뀌었다** —
원격 왕복 대신 **층 후보 조회 n회(n = 10~20) + Viterbi DP** 가 요청 프로세스 안에서 돈다. 측정 구간은
**층 조회 / DP / 조립** 세 개다. 최악 지연은 층 재질의와 규칙 재산출 상한이 모두 소진된 경우이며(FR-025),
**타임아웃이라는 안전장치가 없어졌으므로 반복 상한이 곧 지연 상한이다**. 3초 안에 드는지는 실 데이터
측정 전까지 **미검증**(B-Latency). 참고로 원격 구현 실측은 `axis` p95 1.541초(전곡 스캔 백엔드)였으나
실행 환경이 달라 그대로 이식되지 않는다.

**Constraints**: `path` 최대 30곡(산출 상한 18이라 실제 최대 20 — 007) · `step` 0부터 연속 · 출발 `step:0` ·
`musicCnt = 정거장 수 + 2` · 재생 불가 곡 유지 · 고정 좌표 · 순수 조회(쓰기 0건) ·
산출 메타(`far`/`endpointDist`/`mode`/`bundle`) 응답 비노출 · **임계값 하드코딩 금지(FR-024)** ·
**후보 확정 시 안정 정렬 의무(FR-013)** · **재질의·재산출 상한 필수(FR-025)**.

**rev.3 산출 파라미터** (데이터 파트 정의를 따르며 새로 정하지 않는다):
역 수 `clamp(floor(L / 2.5) − 1, 0, 18)` (007 개정) ·
층 지점 `c_k = A + k/(n+1)·(B − A)` · 층당 후보 200 · 비용 `Σ 걸음² + 2.0·Σ 축이탈²` ·
같은 녹음 컷 미만 전이 금지 · 층 후보 30 미만이면 그 층만 재질의(상한 2회) ·
규칙 위반 시 재산출(상한 8회, 아티스트 위반은 그 아티스트 전체에 벌점).
**임계값(같은 녹음 컷·아티스트 상한·길이 범위)은 이 목록에 값으로 두지 않는다** — 규칙 정의에서 읽는다(FR-024, D-RULES).

**Scale/Scope**: 서빙 번들 6,624,399곡. 응답 1건당 최대 20곡(007). 엔드포인트 1개.
rev.3 신규 운영 파일은 산출 구현 · 층 후보 조회 port · 규칙 정의 로딩 · 축 좌표계 계산으로 늘어난다.
DP 규모는 층당 후보 200 × 전이 200 × 층 최대 20 ≈ 80만 거리 계산이고, 16차원이라 계산량 자체는 작다.

## Constitution Check

*GATE: Phase 0 전 통과 필요. Phase 1 설계 후 재확인.*

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족 | spec rev.3 개정(FR-017·FR-019)을 **코드보다 먼저** 반영한 뒤 설계. `[NEEDS CLARIFICATION]` 0건 |
| II 계약 우선 | 충족 | [contracts/music-journey.md](contracts/music-journey.md) 의 API 계약은 그대로. **rev.3: 산출 주체가 바뀌어도 정본 §3.3 응답과 프론트는 변경 없음** — 계약 변경 없이 실행 위치만 바뀌는 것이 이 전환의 성질이다. 원격 엔진 계약(§②)은 무효가 되고 층 후보 조회 계약이 대체 |
| III 완료 전 검증 | 설계 충족 | [quickstart.md](quickstart.md) 시나리오 + `@WebMvcTest` 슬라이스·서비스 유닛. **rev.3: 산출 알고리즘은 합성 좌표로 실제 검증한다**(mock 이 아니다). 조회 어댑터 부재 구간만 미검증으로 보고 |
| IV 데이터 재현성 | N/A | 조회 전용. 데이터 산출물 생성 없음 |
| V 좌표 안정성 | 충족 | 좌표는 번들 고정값 그대로 전달. 게이트웨이가 좌표·모델을 만들거나 바꾸지 않음(FR-016) |
| VI 탐색 일관성 | 충족 | 결정성은 같은 번들 안에서만 보장으로 명시(FR-013). 사용자 선택(`start`/`end`)을 재해석하지 않음 |
| VII 실험 격리 | 충족 | `mode`를 `axis`로 고정하고 노출하지 않음(FR-023). **rev.3: `linear` 가 우리 프로세스 안으로 들어오므로 요청 파라미터로 승격할 유혹이 생긴다 — 승격하지 않는다.** 비교·폴백 경로로만 두고 API 계약에 넣지 않음 |
| VIII 관측 | 설계 충족 | actuator `http.server.requests`(종단·상태코드별) + **rev.3: 층 조회 / DP / 조립 세 구간 분리 계측**(원격 홉이 없어 "엔진 구간" 이라는 단일 구간이 의미를 잃었다) + 산출 메타 구조화 로그 + 단조 위반·재산출 횟수. PII·비밀정보 미기록(R10) |
| IX 추정 금지 | 충족 | **rev.3: 최악 지연을 측정 전에 단정하지 않는다**(B-Latency) — 원격 타임아웃이라는 상한이 사라졌으므로 반복 상한이 곧 지연 상한이고, 그 값이 예산 안인지는 실측 사항. 없는 테이블·컬럼·벡터 인덱스를 있다고 가정하지 않음(D-DATA). 임계값을 값으로 박아 "이 값일 것" 이라 가정하지 않음(D-RULES) |
| X 경계 | **rev.3 재판단** | 경계가 **BE2 ↔ BE4 에서 BE2 내부 세 층으로** 옮겨졌다: 호출부 / 산출 / 층 후보 조회. 산출이 저장소를 직접 알지 않는 것이 이 원칙을 지키는 방식이며, 그래야 합성 좌표로 산출만 검증할 수 있다. **알고리즘 방식은 데이터 파트 정의를 따르고 새로 설계하지 않는다** — 임계값 이중화는 FR-024 가 막는다 |

**미통과로 남기는 것 없음.** 단 **D-DATA**(곡 테이블·좌표 컬럼·벡터 인덱스 미프로비저닝)·**D-RULES**(임계값
출처 미확정)·**B-Latency**(최악 지연 미실측)는 **통합 검증 시점의 대기**이며 게이트를 통과로 표시하지 않는다(원칙 III).
**산출 알고리즘 구현·검증은 이 대기에 걸리지 않는다** — 조회 경계 뒤에 있기 때문이다.

### Phase 1 재확인

설계 후 원칙 위반 신규 발생 없음. **rev.3: port 가 3개로 늘었다** — `JourneyPathFinder`(호출부↔산출),
`JourneyTrackReader`(정거장 상세 조회), **층 후보 조회**(산출↔저장소). 각 구현이 1개씩이지만
세 경계는 다음 이유로 값을 한다:

- **`JourneyPathFinder`** — 살려 두는 이유는 원격 복귀 가능성이 아니라 **검증 가능성**이다. 산출을
  호출부에서 떼어 놓아야 조립·오류 매핑 테스트(rev.2 의 39건)가 산출 없이 돌고, 반대로 산출 테스트가
  MVC 없이 돈다. 인터페이스를 없애면 두 쪽이 서로를 끌고 들어온다.
- **층 후보 조회** — **FR-019·FR-020·SC-003 이 직접 요구하는 경계다.** 산출이 저장소를 직접 알면
  "진행도가 단조 증가하는가" 를 D-DATA 해소 전까지 검증할 수 없다. 이 경계 하나가 산출 구현을
  인프라 대기에서 풀어 준다.
- **`JourneyTrackReader`** — rev.2 그대로.

→ Complexity Tracking 기재 사항 없음. **단, 산출 구현을 인터페이스 하나에 클래스 하나로 끝내려 하지
않는다** — 축 좌표계·후보 선별·DP·규칙 루프는 각각 따로 검증할 값이 있다. 반대로 각 단계마다
인터페이스를 두지도 않는다(구현이 1개뿐인 추상화).

## Project Structure

### Documentation (this feature)

```text
specs/004-journey-path/
├── spec.md                        # rev.3 (경로 산출 인프로세스 전환, 2026-09-11)
├── plan.md                        # 이 파일
├── research.md                    # Phase 0 — R1~R11 결정
├── data-model.md                  # Phase 1 — DTO·port·엔진 응답 매핑
├── quickstart.md                  # Phase 1 — 검증 시나리오
├── contracts/
│   └── music-journey.md           # Phase 1 — API·엔진·port 계약
└── checklists/
    └── requirements.md            # spec 품질 체크리스트 (16/16)
```

### Source Code (`backend/`, master 구조)

| 위치 | 설계 | 상태 |
| --- | --- | --- |
| `music/controller/JourneyController.java` | `GET /api/music/journey` 핸들러 (`@Min(1) long start`, `@Min(1) long end`) | **신규**. `MusicController` 에 메서드를 더하면 그 컨트롤러의 기존 슬라이스 테스트 19건이 새 빈을 요구하며 깨진다(실제로 깨졌다) → 분리. URL·응답 계약 동일 |
| `music/dto/JourneyResponse.java` | `musicCnt`, `totalDuration`, `List<JourneyStop> path` | **신규** |
| `music/dto/JourneyStop.java` | `@JsonUnwrapped MusicDetail` + `int step` | **신규** |
| `music/journey/JourneyPathFinder.java` | 산출 경계 port (BE2 계약) | 존재. **rev.3: javadoc 개정 필요** — "게이트웨이가 Java로 재구현하지 않는다"·"엔진 부재·타임아웃은 예외" 가 틀려졌다. **인터페이스 서명은 그대로 살린다** (좋은 경계다) |
| `music/journey/EnginePath.java` | 산출 결과 표현 (`reachable`, `stationMbids`, `progresses`, 로그용 메타) | 존재, 재사용. **rev.3: `bundle` 출처를 새로 정해야 한다** — 원격 엔진이 응답에 담아 주던 값이다(D-RULES). 이름의 "Engine" 은 남기되 뜻을 "산출" 로 읽는다 — 개명은 별건(D-ID2 와 함께) |
| `music/journey/JourneyTrackReader.java` | mbid 일괄 상세 조회 port | 존재, 재사용 |
| ~~`music/journey/JourneyEngineClient.java`~~ | ~~RestClient 어댑터~~ | ❌ **rev.3 폐기** — 호출할 원격 엔진이 없다 |
| `music/journey/*` 산출 구현 | **`JourneyPathFinder` 의 인프로세스 구현** — 축 좌표계, 역 수, 층 지점, 후보 필터, Viterbi DP, 규칙 재산출 루프 | **rev.3 신규**. 저장소를 직접 알지 않는다 |
| `music/journey/*` 층 후보 조회 port | **지점 좌표 → 근사 이웃 N개** 계약. 산출과 저장소 사이의 유일한 경계 | **rev.3 신규** (계약) |
| `music/journey/*` 층 후보 조회 어댑터 | port 구현 = MyBatis + 벡터 근사 인덱스 | **rev.3 신규**, **D-DATA 후** |
| `music/journey/*` 규칙 정의 로딩 | 임계값·번들 버전 출처 (FR-024) | **rev.3 신규**, **D-RULES 후**. 005 와 공유 |
| `music/journey/JourneyTrackMapper.java` | **port 구현 = MyBatis 어댑터** | **신규**, 곡 테이블 후 완성 |
| `music/service/JourneyService.java` | 조립 오케스트레이션 (`Optional<port>` 주입) | 존재, **거의 그대로 살아남는다**. rev.3 수정은 (a) 엔진 부재·타임아웃 문구·분기 정리 (b) `ody.journey.engine` Timer 구간 재정의 |
| `music/detail/MusicDetailReader.java` | `findDetail(long id)` 재사용 (mbid 원천, 404 판정) | 존재, 재사용 |
| `music/dto/MusicDetail.java` | `id`·`mbid` 동시 보유 — 그대로 사용 | 존재, 재사용 |
| `common/MusicErrorCode.java` | `PATH_NOT_FOUND`(422) 상수 추가 | 기존 파일에 상수 추가 |
| `common/GlobalExceptionHandler.java` | `CustomException`→`ErrorCode` 매핑 재사용 | BE1 소유, 변경 없음 |
| `src/test/.../music/JourneyControllerTests.java`·`JourneyServiceTests.java` | `@WebMvcTest` 슬라이스 + 서비스 유닛 | 존재(39건). **rev.3: 엔진 부재·타임아웃 테스트만 손본다** — 조립·검증·오류 매핑 테스트는 살아남는다 |
| `src/test/.../music/*` 산출 테스트 | **합성 좌표로 산출 알고리즘 검증** — 단조 증가, 규칙 수렴, 결정성, 역 수 | **rev.3 신규**. D-DATA 대기에 걸리지 않는다 |

**Structure Decision**: master `backend/` 구조와 공통 레이어를 그대로 쓴다. 여정 전용 코드는
`music/journey/` 한 패키지에 모으고, 상세 조회·에러 코드·응답 봉투는 기존 것을 재사용한다.
**rev.3: 산출이 들어와도 패키지를 쪼개지 않는다** — 산출·조회 port·규칙 로딩 모두 `music/journey/` 안이다.
구현 클래스를 몇 개로 나눌지는 구현 단계 판단이며, 경계 세 개(호출부 / 산출 / 조회)만 지킨다.
신규 공통 클래스 없음. `MusicService`·`MusicController` 를 건드리지 않고 `JourneyService`·`JourneyController` 를 따로 둔다 —
`MusicService` 가 이미 검색·상세·대표곡 3개를 갖고 있고 여정은 의존 port 가 다르며,
컨트롤러를 공유하면 엔드포인트가 늘 때마다 남의 기능 슬라이스 테스트가 깨진다.

## 처리 흐름

```text
GET /api/music/journey?start=10234&end=10877   (Bearer 필수 — SecurityConfig 기본 거부)
 │
 1. MVC 바인딩·검증 (@Min(1) long)          위반 → 400 INVALID_INPUT
 │
 2. start == end ?  ── yes ──> findDetail(start) → path 1개(step:0), musicCnt:1
 │                              없으면 404 MUSIC_NOT_FOUND                    [R5]
 no
 │
 3. findDetail(start), findDetail(end)      Optional.empty → 404 MUSIC_NOT_FOUND
 │                                          → MusicDetail 2건 (mbid 확보)     [R3, FR-022]
 4. JourneyPathFinder.find(start, end)   ← rev.3: 인프로세스 산출 (아래 4a~4f)
 │    ├─ reachable:false ──> 422 PATH_NOT_FOUND
 │    ├─ 조회 실패·상한 소진 ─> 500 INTERNAL_SERVER_ERROR  (422 아님)        [FR-014]
 │    └─ 정거장 목록 + 메타(far, endpointDist, progress[])
 │
      ┌─ 4a. 축 좌표계: L = ‖B − A‖. L == 0 ──> 2곡 경로로 끊음        [FR-012]
      │  4b. 역 수: clamp(floor(L/2.5)−1, 0, 18)                              [FR-011/007]
      │  4c. 층 지점 c_k = A + k/(n+1)·(B − A), k = 1..n
      │      → 층 후보 조회 port: c_k 근처 200개  (n회, 지점 좌표는 값으로 바인딩)
      │  4d. 앱 단 필터: 진행도 p ≤ 0 또는 p ≥ 1 버림 / A·B 및 같은 녹음 버림
      │      / 길이 범위 밖 버림.  ※ 필터를 조회에 넣지 않는다
      │      남은 후보 30 미만 ──> 그 층만 재질의(상한 2회)                 [FR-025]
      │      확정 시 (거리, 식별자) 안정 정렬                               [FR-013]
      │  4e. Viterbi DP: cost[k][v] = min_u(cost[k−1][u] + step(u,v)²) + 2.0·r(v)²
      │      단 step(u,v) ≥ 같은 녹음 컷 인 u 만. 마지막에 B 로 한 번 더 전이
      │      역추적 → 경로.  전 층이 비면 reachable:false
      │  4f. 규칙 검사: 같은 녹음 중복 → 그 곡만 후보 제외
      │      아티스트 상한 초과 → 그 아티스트 전체에 벌점 → 4e 재실행(상한 8회)
      └─     상한 안에 규칙을 지킨 경로를 못 얻으면 500 (성공으로 내지 않음)  [FR-009]
 │
 5. JourneyTrackReader.findDetailsByMbids(정거장 mbid)  → Map<mbid, MusicDetail>
 │    누락 mbid 존재 ──> 500 INTERNAL_SERVER_ERROR (부분 경로 금지)         [R4]
 │
 6. 조립: [startDetail] + 엔진 순서대로 정거장 + [endDetail]
 │    step 0..n-1 연속 부여 · musicCnt = path.size() · totalDuration = Σ duration
 │    musicCnt > 30 ──> 500 (계약 가드, 산출 상한 18이라 미발동)            [FR-008]
 │
 7. 관측: 층 조회 / DP / 조립 구간 분리 · 메타·단조위반 로그 · actuator 종단   [R10]
 │    rev.3: 단조 위반은 카운터에 그치지 않고 산출 결함으로 다룬다          [FR-020]
 │
 8. ApiResponse.success(JourneyResponse)
```

## 오류 매핑

| 상황 | HTTP | code | 근거 |
| --- | --- | --- | --- |
| `start`/`end` 누락·비정수·0 이하 | 400 | `INVALID_INPUT` | FR-014 |
| 토큰 없음·위조·만료 | 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` | FR-015 |
| 곡 없음 · `id→mbid` 해석 실패 | 404 | `MUSIC_NOT_FOUND` | FR-003, FR-022 |
| 산출 `reachable:false` (전 층 후보 없음) | 422 | `PATH_NOT_FOUND` | FR-002 |
| 층 후보 조회 어댑터 부재·저장소 조회 실패 | 500 | `INTERNAL_SERVER_ERROR` | rev.3 — **422와 섞지 않음** |
| 재산출 상한 안에 규칙을 지킨 경로를 못 얻음 | 500 | `INTERNAL_SERVER_ERROR` | rev.3, FR-009·FR-025 |
| 규칙 정의를 읽을 수 없음 | 500 | `INTERNAL_SERVER_ERROR` | rev.3, FR-024 — 기본값으로 대체하지 않는다 |
| 정거장 상세 누락·30곡 초과·조립 불가 | 500 | `INTERNAL_SERVER_ERROR` | FR-014, R4 |

## 검증 계획 (원칙 III)

| 대상 | 방법 | 상태 |
| --- | --- | --- |
| US1~US4 시나리오 | `@WebMvcTest` 슬라이스 + port mock ([quickstart.md](quickstart.md)) | **통과** (2026-09-10) |
| 조립 로직(step·musicCnt·totalDuration·순서 재조립) | 서비스 유닛 | **통과** |
| 경계(`start==end`, 좌표 동일, 30곡 가드, 누락 mbid) | 서비스 유닛 | **통과** |
| 오류 매핑 6종 | MockMvc | **통과** |
| 결정성(FR-013·SC-006) | 서비스 유닛 (같은 입력 2회 → 동일 응답) | **통과** |
| 진행도 단조 증가 (SC-003) | **rev.3: 합성 좌표 유닛** — 산출이 조회 경계 뒤에 있어 실 DB 불필요 | **rev.3 신규** |
| 규칙 수렴 (SC-004) | **rev.3: 합성 좌표 유닛** — 아티스트 전체 벌점으로 상한을 지킨 경로에 수렴하는지. 행 단위 차단이 수렴하지 않는 것도 함께 | **rev.3 신규** |
| 결정성 (SC-006) | **rev.3: 동률 거리 후보를 포함한 합성 입력** — 안정 정렬 없이는 깨지는 케이스 | **rev.3 신규** |
| 역 수 (FR-011) | 합성 좌표 유닛 — `L` 경계값 10.7 전후와 clamp 상·하한 | **rev.3 신규** |
| 인접 역 거리 median `axis` < `linear` (SC-005) | 별도 검증 경로 | ✅ **검증** 2026-09-12 — 2.822 대 3.530, 40/40 쌍 axis 승 |
| 최악 지연이 종단 3초 안 (SC-002) | 재질의·재산출 상한 소진 시나리오 실측 | **미검증** (B-Latency, D-DATA 이후) |
| 실 DB 층 후보 조회 | 곡 테이블·좌표 컬럼·벡터 인덱스 생성 후 | **미검증** (D-DATA) |
| 임계값 로딩 (FR-024) | 규칙 정의 출처 확정 후 | **미검증** (D-RULES) |

`./gradlew test` · `./gradlew build`가 최소 검증선이다(CLAUDE.md §5).
**미검증 항목을 통과로 보고하지 않는다.** rev.3 에서 중요한 구분: **산출 알고리즘 검증은
D-DATA 대기에 걸리지 않는다**(합성 좌표로 돈다). 실 데이터가 필요한 것은 SC-005·SC-002·조회 어댑터뿐이다.

## Complexity Tracking

Constitution Check 위반 없음 — 기재 사항 없음.
