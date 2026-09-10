# Implementation Plan: 경로 탐색 (두 곡 사이 여정 경로 생성)

**Branch**: `backend/feat/S15P21A405-61-journey-path-creation` | **Date**: 2026-09-10 | **Spec**: [spec.md](spec.md)

**Input**: spec.md rev.3 (BE4 데이터 엔진 MR 반영 + 2026-09-10 clarify 4건)

**Status**: 구현 완료 (2026-09-10). `./gradlew test` 74건 통과·0 실패, `./gradlew build` 통과.
통합 검증(quickstart D, 종단 3초)은 **미실행** — 아래 대기 항목 때문이다. 차단 게이트 없음. **B-Engine**(BE4 엔진 HTTP 엔드포인트 미구현)·**BE 곡 테이블 미생성**으로
어댑터 2개는 계약만 두고 대기. port mock 기준 US1~US4 전부 검증 가능.

## Summary

`GET /music/journey?start=&end=`에서 두 곡을 잇는 순서 있는 곡 목록을 반환한다(정본 §3.3).

**경로 산출은 BE2가 하지 않는다.** BE4 데이터 엔진(Python, D4)이 축 통로 + Viterbi(`axis`, D10)로
경로를 만들고, BE2는 **게이트웨이**로서 입력 검증 · `id↔mbid` 해석 · 엔진 호출 · 상세 필드 조립 ·
정본 계약 준수 · 오류 매핑을 소유한다(FR-017).

흐름은 **DB 조회 2회 + 엔진 호출 1회**다(R3). `start`·`end` 상세를 먼저 읽어 mbid를 얻고(없는 곡 404도 여기서),
엔진이 준 중간 정거장 mbid들을 한 번에 조회해 `[출발] + 정거장 + [도착]`으로 조립하며 `step`을 0부터 부여한다.

## Technical Context

**Language/Version**: Java 17 (`backend/build.gradle`, `options.release = 17`).

**Primary Dependencies**: Spring Boot 4.1.1 — webmvc, validation, actuator, security, MyBatis 4.1.0,
micrometer-prometheus, lombok. **HTTP 클라이언트는 `RestClient`**(spring-web, starter-webmvc에 포함).
신규 의존성 없음(R1).

**Storage**: Postgres(MyBatis). 곡 상세·좌표는 서빙 번들 `v2.1-pca16`(PCA-16, D7) 기준.
BE 곡 테이블에 정수 `id` PK + `mbid` UNIQUE가 필요하다(clarify) — **테이블·매퍼 미생성**.

**External Service**: BE4 데이터 엔진(Python FastAPI + numpy, D4). 경로 산출 담당.
`retrieval/api.py`가 docstring뿐이라 엔드포인트 형태 미확정(B-Engine).

**Testing**: JUnit Platform, `@WebMvcTest` 슬라이스(`SecurityConfig`·`JwtAuthenticationFilter` 제외 + master `@MapperScan` 매퍼를 `@MockitoBean` 으로, 002·003 선례),
port mock 서비스 유닛(R9).

**Target Platform**: Java 17 컨테이너(`backend/Dockerfile`), HTTP 8080.

**Project Type**: 단일 Gradle backend (`backend/`).

**Performance Goals**: **종단 3초**(요구사항 §6, clarify로 유일 게이트 확정). 엔진 하위 예산 —
실측 `axis` p95 **1.541초**. 게이트웨이(조회 2회 + 조립)에 남는 예산 약 **1.46초**. 엔진 타임아웃 2초, 재시도 없음(R8).

**Constraints**: `path` 최대 30곡(엔진 상한 20이라 실제 최대 22) · `step` 0부터 연속 · 출발 `step:0` ·
`musicCnt = n_stations + 2` · 재생 불가 곡 유지 · 고정 좌표 · 순수 조회(쓰기 0건) ·
엔진 메타(`far`/`endpoint_dist`/`mode`) 응답 비노출 · 후처리 임계값 하드코딩 금지.

**Scale/Scope**: 서빙 번들 6,624,399곡. 응답 1건당 최대 22곡. 엔드포인트 1개, 신규 운영 파일 7개 + 테스트 2개. 기존 파일 수정 1곳(`MusicErrorCode` 상수 추가).

## Constitution Check

*GATE: Phase 0 전 통과 필요. Phase 1 설계 후 재확인.*

| 원칙 | 판단 | 근거 |
| --- | --- | --- |
| I 명세 우선 | 충족 | spec rev.3 + clarify 4건 완료 후 설계. `[NEEDS CLARIFICATION]` 0건 |
| II 계약 우선 | 충족 | [contracts/music-journey.md](contracts/music-journey.md)에 API·엔진·port 3개 계약 명시. 정본 §3.3 응답을 바꾸지 않음(엔진 메타 비노출은 clarify 결정) |
| III 완료 전 검증 | 설계 충족 | [quickstart.md](quickstart.md) 시나리오 + `@WebMvcTest` 슬라이스·서비스 유닛. 어댑터 부재 구간은 mock으로 검증하고 실 통합은 미검증으로 보고 |
| IV 데이터 재현성 | N/A | 조회 전용. 데이터 산출물 생성 없음 |
| V 좌표 안정성 | 충족 | 좌표는 번들 고정값 그대로 전달. 게이트웨이가 좌표·모델을 만들거나 바꾸지 않음(FR-016) |
| VI 탐색 일관성 | 충족 | 결정성은 같은 번들 안에서만 보장으로 명시(FR-013). 사용자 선택(`start`/`end`)을 재해석하지 않음 |
| VII 실험 격리 | 충족 | 엔진 `mode`를 `axis`로 고정하고 노출하지 않음(FR-023). `linear`는 BE4 A/B용이며 게이트웨이가 승격시키지 않음 |
| VIII 관측 | 설계 충족 | actuator `http.server.requests`(종단·상태코드별) + 엔진 구간 `Timer` 1개 + 엔진 메타 구조화 로그. PII·비밀정보 미기록(R10) |
| IX 추정 금지 | 충족 | 엔진 엔드포인트·번들 검증·왕복 실측을 미확인으로 남김(R8·R11). 없는 컬럼을 있다고 가정하지 않음. 타임아웃 2초는 예산 역산값으로 명시 |
| X 경계 | 충족 | 경로 산출 = BE4 엔진 / 계약·조립·오류 = BE2 게이트웨이. Java로 축 통로·Viterbi를 재구현하지 않음(FR-017) |

**미통과로 남기는 것 없음.** 단 B-Engine·곡 테이블 미생성은 **통합 검증 시점의 대기**이며
게이트를 통과로 표시하지 않는다(원칙 III).

### Phase 1 재확인

설계 후 원칙 위반 신규 발생 없음. 신규 추상화는 port 2개뿐이고 둘 다 파트 경계(원칙 X)에 대응한다 —
`JourneyPathFinder`(BE2↔BE4 엔진), `JourneyTrackReader`(BE2↔BE4 저장소). 구현이 각각 1개이지만
경계를 넘는 호출을 합의된 인터페이스로 두라는 원칙 X의 요구이고, master의 기존 두 port와 같은 형태다.
→ Complexity Tracking 기재 사항 없음.

## Project Structure

### Documentation (this feature)

```text
specs/004-journey-path/
├── spec.md                        # rev.3 (BE4 MR 반영 + clarify 4건)
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
| `music/controller/JourneyController.java` | `GET /music/journey` 핸들러 (`@Min(1) long start`, `@Min(1) long end`) | **신규**. `MusicController` 에 메서드를 더하면 그 컨트롤러의 기존 슬라이스 테스트 19건이 새 빈을 요구하며 깨진다(실제로 깨졌다) → 분리. URL·응답 계약 동일 |
| `music/dto/JourneyResponse.java` | `musicCnt`, `totalDuration`, `List<JourneyStop> path` | **신규** |
| `music/dto/JourneyStop.java` | `@JsonUnwrapped MusicDetail` + `int step` | **신규** |
| `music/journey/JourneyPathFinder.java` | 엔진 호출 port (BE2 계약) | **신규** (계약) |
| `music/journey/EnginePath.java` | 엔진 응답 표현 (`reachable`, `stationMbids`, `progresses`, 로그용 메타) | **신규** |
| `music/journey/JourneyTrackReader.java` | mbid 일괄 상세 조회 port | **신규** (계약) |
| `music/journey/JourneyEngineClient.java` | **port 구현 = RestClient 어댑터** | **신규**, B-Engine 후 완성 |
| `music/journey/JourneyTrackMapper.java` | **port 구현 = MyBatis 어댑터** | **신규**, 곡 테이블 후 완성 |
| `music/service/JourneyService.java` | 조립 오케스트레이션 (`Optional<port>` 주입) | **신규** |
| `music/detail/MusicDetailReader.java` | `findDetail(long id)` 재사용 (mbid 원천, 404 판정) | 존재, 재사용 |
| `music/dto/MusicDetail.java` | `id`·`mbid` 동시 보유 — 그대로 사용 | 존재, 재사용 |
| `common/MusicErrorCode.java` | `PATH_NOT_FOUND`(422) 상수 추가 | 기존 파일에 상수 추가 |
| `common/GlobalExceptionHandler.java` | `CustomException`→`ErrorCode` 매핑 재사용 | BE1 소유, 변경 없음 |
| `src/test/.../music/JourneyControllerTests.java`·`JourneyServiceTests.java` | `@WebMvcTest` 슬라이스 + 서비스 유닛 | **신규**. 테스트 패키지는 기존 관례대로 flat (`music/`) |

**Structure Decision**: master `backend/` 구조와 공통 레이어를 그대로 쓴다. 여정 전용 코드는
`music/journey/` 한 패키지에 모으고, 상세 조회·에러 코드·응답 봉투는 기존 것을 재사용한다.
신규 공통 클래스 없음. `MusicService`·`MusicController` 를 건드리지 않고 `JourneyService`·`JourneyController` 를 따로 둔다 —
`MusicService` 가 이미 검색·상세·대표곡 3개를 갖고 있고 여정은 의존 port 가 다르며,
컨트롤러를 공유하면 엔드포인트가 늘 때마다 남의 기능 슬라이스 테스트가 깨진다.

## 처리 흐름

```text
GET /music/journey?start=10234&end=10877   (Bearer 필수 — SecurityConfig 기본 거부)
 │
 1. MVC 바인딩·검증 (@Min(1) long)          위반 → 400 INVALID_INPUT
 │
 2. start == end ?  ── yes ──> findDetail(start) → path 1개(step:0), musicCnt:1
 │                              없으면 404 MUSIC_NOT_FOUND                    [R5]
 no
 │
 3. findDetail(start), findDetail(end)      Optional.empty → 404 MUSIC_NOT_FOUND
 │                                          → MusicDetail 2건 (mbid 확보)     [R3, FR-022]
 4. JourneyPathFinder.find(startMbid, endMbid)          타임아웃 2초, 재시도 없음 [R8]
 │    ├─ reachable:false ──> 422 PATH_NOT_FOUND
 │    ├─ 예외·타임아웃 ────> 500 INTERNAL_SERVER_ERROR  (422 아님)          [FR-014]
 │    └─ 정거장 mbid 목록 + 메타(far, endpoint_dist, progress[])
 │
 5. JourneyTrackReader.findDetailsByMbids(정거장 mbid)  → Map<mbid, MusicDetail>
 │    누락 mbid 존재 ──> 500 INTERNAL_SERVER_ERROR (부분 경로 금지)         [R4]
 │
 6. 조립: [startDetail] + 엔진 순서대로 정거장 + [endDetail]
 │    step 0..n-1 연속 부여 · musicCnt = path.size() · totalDuration = Σ duration
 │    musicCnt > 30 ──> 500 (계약 가드, 엔진 상한 20이라 미발동)            [FR-008]
 │
 7. 관측: 엔진 구간 Timer / 메타·단조위반 로그 / actuator 종단              [R10]
 │
 8. ApiResponse.success(JourneyResponse)
```

## 오류 매핑

| 상황 | HTTP | code | 근거 |
| --- | --- | --- | --- |
| `start`/`end` 누락·비정수·0 이하 | 400 | `INVALID_INPUT` | FR-014 |
| 토큰 없음·위조·만료 | 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` | FR-015 |
| 곡 없음 · `id→mbid` 해석 실패 | 404 | `MUSIC_NOT_FOUND` | FR-003, FR-022 |
| 엔진 `reachable:false` | 422 | `PATH_NOT_FOUND` (신규 상수) | FR-002 |
| 엔진 부재·타임아웃 | 500 | `INTERNAL_SERVER_ERROR` | clarify — **422와 섞지 않음** |
| 정거장 상세 누락·30곡 초과·조립 불가 | 500 | `INTERNAL_SERVER_ERROR` | FR-014, R4 |

## 검증 계획 (원칙 III)

| 대상 | 방법 | 상태 |
| --- | --- | --- |
| US1~US4 시나리오 | `@WebMvcTest` 슬라이스 + port mock ([quickstart.md](quickstart.md)) | **통과** (2026-09-10) |
| 조립 로직(step·musicCnt·totalDuration·순서 재조립) | 서비스 유닛 | **통과** |
| 경계(`start==end`, 좌표 동일, 30곡 가드, 누락 mbid) | 서비스 유닛 | **통과** |
| 오류 매핑 6종 | MockMvc | **통과** |
| 결정성(FR-013·SC-006) | 서비스 유닛 (같은 입력 2회 → 동일 응답) | **통과** |
| 단조 증가·인접 역 거리·규칙 위반 | **BE4 `tests/bench_journey.py`가 소유** — 게이트웨이는 카운터·로그만 | BE4 실측 완료(40쌍) |
| 종단 3초 | 엔진 통합 후 측정 | **미검증** (B-Engine) |
| 실 DB 조회 | 곡 테이블 생성 후 | **미검증** |

`./gradlew test` · `./gradlew build`가 최소 검증선이다(CLAUDE.md §5).
엔진·DB 통합 미검증 항목을 통과로 보고하지 않는다.

## Complexity Tracking

Constitution Check 위반 없음 — 기재 사항 없음.
