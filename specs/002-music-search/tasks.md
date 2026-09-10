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
- [ ] T301 메인 `@MapperScan`을 별도 @Configuration으로 분리해 슬라이스 테스트에서 제외(전역 `@WebMvcTest` 복구) — BE1/BE4 합의. 완료 시 T006~T008을 @WebMvcTest로 되돌릴지 재검토.

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
