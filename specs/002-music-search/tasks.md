---

description: "Task list: 음악 검색 (2026-09-09 master 재베이스라인)"
---

# Tasks: 음악 검색

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/music-search.md](contracts/music-search.md)

**Tests**: 포함(standalone MockMvc + 유닛). 통합/실데이터는 블로커 대기.

**Organization**: 이미 완료(이전·재배선) → 🟢 green 작업 → 🔴 블로커 대기.

**경로**: `backend/src/main/java/com/ssafy/backend/`, 테스트 `backend/src/test/...`

---

# ✅ 완료 (merge 380714b)

- [X] T001 music 피처 `src/` → `backend/src/` 이전, 죽은 루트 src 제거
- [X] T002 `build.gradle` 머지(validation + master deps), 커밋
- [X] T003 [US1] MusicController `ApiResponse.ok` → `ApiResponse.success` 재배선 (master 공통 레이어)
- [X] T004 [US1] 서비스 유닛 테스트 통과 유지 in `backend/src/test/java/com/ssafy/backend/music/MusicSearchServiceTests.java` (mock port, 6개 green)

---

# 🟢 지금 실행 가능 — master 위에서 green 만들기

## Phase 1: 공통 검증 매핑 (Foundational, R3)

- [X] T005 공통 `GlobalExceptionHandler`에 검증 예외 → 400 `INVALID_INPUT` 매핑 추가 in `backend/src/main/java/com/ssafy/backend/common/GlobalExceptionHandler.java` (`MethodArgumentNotValidException`, `HandlerMethodValidationException`, `ConstraintViolationException`, `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException` → `ApiResponse.fail(GlobalErrorCode.INVALID_INPUT)`). **⚠️ BE1 소유 파일 — MR에서 BE1 리뷰 요청**. 전 엔드포인트 이득(근본 수정).

## Phase 2: User Story 1·2 — 컨트롤러 테스트 (R2)

**Goal**: master @MapperScan 지뢰 회피하고 검색 컨트롤러 계약 검증.

- [X] T006 [US1] 컨트롤러 테스트 방식 결정 in `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`. **실측 정정**: standalone MockMvc는 `@Validated` @RequestParam 제약검증(@NotBlank/@Min)을 트리거 안 함(3건 실패) → **`@WebMvcTest(MusicController.class)` 유지 + `@MockitoBean MusicService`·`@MockitoBean TestMapper`**로 전환. testMapper mock으로 master @MapperScan 지뢰 회피(BE-infra 소스 무수정), 실제 MVC 검증·공통 GlobalExceptionHandler 동작 검증. A1·A5·A6·E3.
- [X] T007 [US2] 검증·오류 assertion 정정(같은 파일): E1 query 공백/누락 → 400 `INVALID_INPUT`, E2 page=-1/비정수 → 400 `INVALID_INPUT`, E5 port 예외 → 500 `INTERNAL_SERVER_ERROR`. (어제의 VALIDATION_ERROR/INTERNAL_ERROR 문자열 교체) — depends T005·T006
- [X] T008 기존 `MusicControllerTests`(major, 스캐폴딩)도 동일하게 standalone MockMvc + 에러코드 정정 in `backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java` (major는 여전히 UnsupportedOperationException이므로 성공 케이스는 mock, 검증 케이스만 확인)

## Phase 3: 검증

- [X] T009 `cd backend && ./gradlew test` **green 확인** (music 관련 전부 통과, 컨텍스트 로드 실패 0). 실패 시 T005~T008 조정.

---

# 🔴 블로커 대기 (착수 불가)

## B-A: Core 인증 (BE1)
- [ ] T101 [US1] `GlobalErrorCode`에 401 코드 추가(Core 인증 계약 확정 후 명칭 결정) in `backend/src/main/java/com/ssafy/backend/common/GlobalErrorCode.java`
- [ ] T102 [US1] `/music/search`에 Core 인증 경계 적용(Bearer·토큰 subject) — Core 모듈 도착 후
- [ ] T103 [US2] E4 인증 테스트: 토큰 없음/위조/만료 → 401

## B-D: 저장소·데이터·MyBatis 어댑터 (BE4)
- [ ] T201 검색 대상 저장소 확정(Postgres vs Neo4j) 및 곡 스키마(`title`/`artist`/`youtube_cnt`/`pc1~pc16`) 확인 — BE4
- [ ] T202 [US1] `MusicSearchReader` MyBatis 어댑터 구현 in `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchMapper.java` (+ XML/애노테이션 SQL): `title ILIKE %q% OR artist ILIKE %q%`, `youtube_cnt DESC, id ASC`, offset page*10 limit 10, count — @MapperScan 범위 배치
- [ ] T203 substring 인덱스: Postgres면 `title`·`artist` `pg_trgm` GIN — 실행계획 확인 후
- [ ] T204 [US1] 실데이터 통합 테스트(H2/testcontainers): A2 좌표 baseline 일치, A4 실제 다중 페이지 — depends T202
- [ ] T205 성능 벤치 p95<300ms(제안) — depends T202·T203

## B-Common: 전역 테스트 인프라 (BE-infra)
- [X] T301 메인 `@MapperScan`을 `config/MyBatisConfig` 로 분리 (S15P21A405-232) — 평범한 `@Configuration` 은 `@WebMvcTest` 슬라이스가 스캔하지 않는다. 슬라이스 10개에서 매퍼 `@MockitoBean` 4개씩 제거하고 171개 통과 확인. 새 매퍼를 `<도메인>.mapper` 에 추가해도 이제 슬라이스가 깨지지 않는다.

---

## Dependencies & Execution Order

- 🟢: T005 → T006 → T007 → T008 → T009. (T005가 검증 매핑 선행)
- 🔴 B-A: T101 → T102 → T103. B-D: T201 → T202 → (T203·T204·T205). B-Common: T301 독립.
- 🟢 완료해도 실제 검색 동작은 T202(어댑터)·T102(인증) 후 end-to-end.

## Implementation Strategy

### MVP (지금 최대치)
1. T005(검증 매핑) → T006~T008(standalone 테스트) → T009(green).
2. **STOP**: 컨트롤러 계약·검증·에러코드·서비스 조립 green. 실검색(A2/A4)·인증(E4)은 블로커 대기.

### 블로커 후
- B-D → T202 완료 시 실제 검색 동작. B-A → 인증. B-Common → 전역 @WebMvcTest.

## Notes
- ponytail: 🟢 신규 코드 = 공통 핸들러 검증 매핑 1곳 + 테스트 방식 전환. 프로덕션 로직(서비스·컨트롤러·DTO·port)은 이미 이전·재배선 완료라 재작성 없음.
- T005·T301은 BE1/BE-infra 소유 파일 → MR 리뷰 플래그.
- 에러코드는 master `GlobalErrorCode` 기준. api-spec §0.5 불일치는 정본 갱신 대상(spec [충돌]).

---

## Phase 4: Convergence (2026-09-12, Jira S15P21A405-229)

B-D 해소 — BE4가 어댑터 구현을 BE2에 위임. 운영 DB는 PostgreSQL(pgvector 0.7.0), `music` 6,624,399행 적재 완료.
근거 질의·실측·함정: `origin/data/dev:data/ingest/map_layer_queries.sql`, 스키마: `origin/data/dev:data/ingest/load_postgres.sh`.

- [X] T302 `MusicSearchMapper`를 `com.ssafy.backend.music.mapper` 에 둔다 per plan: 소스 구조 (contradicts) — plan·T202는 `music/search/MusicSearchMapper.java`로 적었으나 `@MapperScan("com.ssafy.backend.*.mapper")` 는 와일드카드 1단계라 `music.search` 를 스캔하지 않는다. **경로**: 처음엔 스캔 범위 밖에 두고 `SqlSession.getMapper()` 로 우회했다(매퍼 빈이 늘면 슬라이스 10곳이 죽어서 — 실측 63건). 그 뒤 T301(S15P21A405-232)로 근본 원인을 없애고 표준 위치로 되돌렸다.
- [X] T303 [US1] `MusicSearchReader` MyBatis 어댑터 구현 per FR-001·FR-009·FR-010 (missing) — `MusicSearchMapper.xml`(classpath:mapper/music/)에 `title ILIKE '%'||#{query}||'%' OR artist ILIKE '%'||#{query}||'%'`, `ORDER BY youtube_cnt DESC, id ASC`, `LIMIT #{size} OFFSET #{page}*#{size}` + count 질의. `music/search/MusicSearchReaderAdapter`가 port를 구현해 매퍼에 위임.
- [X] T304 [US1] `MusicSummary` 조립 per FR-005 (missing) — `genres`는 `music_genre`+`genre` 조인(곡당 0..n, collection resultMap), `album`·`youtube_url`은 적재 결과상 전 행 NULL이므로 null 그대로 싣는다(FR-007 재생 불가 곡 유지). `map-underscore-to-camel-case` 전제.
- [X] T305 [US1] `location vector(16)` → `Location(pc1..pc16)` 매핑 per FR-006·SC-002 (missing) — pgvector 값을 저장값 그대로 읽어 담는다. 재계산·재투영·반올림 금지. JDBC가 `vector`를 문자열로 돌려주므로 SELECT에서 `(location::real[])[n]` 로 축을 펴거나 TypeHandler 중 하나를 택한다.
- [X] T306 [US1] 어댑터 단위 테스트 per SC-004·Constitution III (missing) — 매퍼 mock 기준으로 page/size→offset 계산, hasNext 판정(size+1 조회), query trim 전달을 검증한다. 실 DB(H2에 pgvector 없음) 통합 검증은 T204로 남는다.
- [X] T307 substring 인덱스 미도입 상태를 기록한다 per plan: 성능 목표 p95<300ms (partial) — 6,624,399행에 `ILIKE %q%`는 순차 스캔이다. `pg_trgm` GIN 생성은 운영 DB 변경이라 BE4/Infra 합의 후(T203). 그 전까지 p95<300ms를 충족했다고 보고하지 않는다. **기록 완료**: 매퍼 XML 주석과 MR 에 남겼다. 측정도 인덱스도 하지 않았다.

## youtubeUrl 은 조회 시 만든다 (2026-09-12, S15P21A405-233)

`music.youtube_url` 은 662만 행 전부 NULL 이고 채울 방법이 없다(규칙 6 + YouTube Data API 할당량, data 스펙 18 D12).
그래서 Backend 가 조회 시 `https://www.youtube.com/results?search_query=<아티스트>+<제목>` 을 만들어 담는다. 만드는 곳은 `music/YoutubeSearchUrl` 하나다.

**따라온 결과 둘 — 확인 필요**

1. **`youtubeUrl: null` 인 곡이 사실상 사라진다.** 아티스트·제목이 둘 다 비어야만 null 이다. FR-007(재생 불가 곡을 제외하지 않고 null 유지)은 계약으로는 유효하지만 실제로는 거의 도달하지 않는다. 프론트의 "재생 불가" 표시 조건을 다시 볼 필요가 있다.
2. **`MapPoint.playable` 은 그대로 전부 false 다.** 지도 별은 전부 흐리게 나오는데 검색·상세에서는 모든 곡에 링크가 있어 서로 어긋난다. `playable` 을 true 로 뒤집으면 FE 의 흐림 상태가 의미를 잃으므로 FE 확인 없이 정하지 않았다(S15P21A405-233 제외 범위).
