---
description: "Task list: 노래 상세 조회 (Nearby 포함)"
---

# Tasks: 노래 상세 조회 (Nearby 포함)

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/music-detail.md](contracts/music-detail.md)

**Tests**: 포함(@WebMvcTest 슬라이스 + 서비스 유닛). 통합/실데이터·인증은 블로커 대기.

**Organization**: 🟢 지금 실행 가능(mock 기준 green) → 🔴 블로커 대기.

**경로**: `backend/src/main/java/com/ssafy/backend/`, 테스트 `backend/src/test/...`

**전제**: master에 music 패키지 없음 → 상세 슬라이스가 패키지를 신규 생성(001·002가 각 브랜치에서 독립 생성한 것과 동일). 병합 시 `MusicController`/`MusicService` 메서드는 union.

---

# 🟢 지금 실행 가능 — mock 기준 green

## Phase 1: DTO·에러 (Foundational)

- [ ] T001 `music/dto/Location.java`, `music/dto/MusicSummary.java`, `music/dto/MusicDetail.java` 생성(정본 §0.6, 001·002와 동일 형태) in `backend/src/main/java/com/ssafy/backend/music/dto/`
- [ ] T002 `music/dto/NeighborTrack.java` 생성: `@JsonUnwrapped MusicSummary music` + `double distance` (flat 직렬화, 정본 §3.2)
- [ ] T003 `music/dto/MusicDetailResponse.java` 생성: `@JsonUnwrapped MusicDetail detail` + `List<NeighborTrack> neighbors`
- [ ] T004 `common/MusicErrorCode.java` 생성: `MUSIC_NOT_FOUND(NOT_FOUND, "MUSIC_NOT_FOUND", ...)` implements `ErrorCode` (정본 §0.5 정합, BE2 도메인)

## Phase 2: Port·Service·Controller (US1·US2·US3)

- [ ] T005 `music/detail/MusicDetailReader.java` port 생성: `Optional<MusicDetail> findDetail(long)`, `List<NeighborTrack> findNeighbors(long,int)` (헌법 X 계약; 어댑터는 B-D)
- [ ] T006 [US1·US2] `music/service/MusicService.java` 생성: `getDetail(long id)` — `Optional<MusicDetailReader>` 주입, 곡 없음 → `CustomException(MusicErrorCode.MUSIC_NOT_FOUND)`, neighbors k=10 위임, `MusicDetailResponse` 조립. reader 부재 시 `UnsupportedOperationException`(B-D 대기)
- [ ] T007 [US1] `music/controller/MusicController.java` 생성: `@GetMapping("/detail")`, `@RequestParam @Min(1) long id`, `@Validated`, `ApiResponse.success`

## Phase 3: 공통 검증 매핑 (B-Common, R-V — 002와 공유)

- [ ] T008 `common/GlobalExceptionHandler.java`에 검증 예외 → 400 `INVALID_INPUT` 매핑 추가 (`MethodArgumentNotValidException`, `HandlerMethodValidationException`, `ConstraintViolationException`, `MethodArgumentTypeMismatchException`, `MissingServletRequestParameterException`). **⚠️ BE1 소유 파일 — MR 리뷰 요청**. 전 엔드포인트 이득(근본 수정). 002 T005와 동일 변경.

## Phase 4: 테스트

- [ ] T009 [US1·US2·US3] `MusicDetailControllerTests` (@WebMvcTest(MusicController.class) + @MockitoBean MusicService·TestMapper): Q1 성공(상세 flat 필드 + neighbors[10]·distance), Q3 상세 youtubeUrl null, Q4 neighbor youtubeUrl null 포함, Q5 404 `MUSIC_NOT_FOUND`, Q6 id=0/abc/누락 → 400 `INVALID_INPUT`, 내부 실패 → 500. testMapper mock으로 @MapperScan 회피(002와 동일)
- [ ] T010 [US1·US2] `MusicDetailServiceTests` (유닛, Mockito mock reader): 상세+neighbors 조립·pass-through, 곡 없음 → CustomException, reader 부재 → UnsupportedOperationException, neighbor 후보 부족 시 있는 만큼(Q7)
- [ ] T011 `cd backend && ./gradlew test --tests '*MusicDetail*'` **green 확인**. 특히 `@JsonUnwrapped` flat 직렬화(`$.data.id`·`$.data.neighbors[0].distance`) 실측 검증. 실패 시 T002·T003 조정.

---

# 🔴 블로커 대기 (착수 불가)

## B-A: Core 인증 (BE1)
- [ ] T101 [US3] `GlobalErrorCode`(또는 인증 도메인)에 401 코드 추가 — Core 인증 계약 확정 후
- [ ] T102 `/music/detail`에 Core 인증 경계 적용(Bearer·토큰 subject) — Core 도착 후
- [ ] T103 [US3] 인증 테스트: 토큰 없음/위조/만료 → 401

## B-D: 저장소·KNN 어댑터 (BE4)
- [ ] T201 곡 상세 저장소·스키마(`mbid/bpm/duration/play_cnt/youtube_cnt/pc1~pc16`) 확인 — BE4
- [ ] T202 **거리 척도·KNN 실행 방식 확정**(pgvector 미프로비저닝 여부, 브루트포스 vs 인덱스) — BE4
- [ ] T203 [US1·US2] `MusicDetailReader` MyBatis 어댑터 구현 in `music/detail/MusicDetailMapper.(java|xml)`: `findDetail`(id로 상세 1건), `findNeighbors`(자기 제외, distance ASC·id ASC, k=10, 재생불가 포함) — depends T201·T202
- [ ] T204 [US2] KNN 인덱스 전략(pgvector 가능 시 ivfflat/hnsw, 불가 시 대안) — 실행계획 확인
- [ ] T205 [US1·US2] 실데이터 통합 테스트: 좌표 baseline 일치, 실제 최근접·자기 제외·결정성(FR-006·009) — depends T203
- [ ] T206 Nearby 응답 예산(§6 유사곡 1초 매핑) 벤치 — depends T203

## B-Common: 전역 테스트 인프라 (BE-infra, 002와 공유)
- [X] T301 메인 `@MapperScan`을 `config/MyBatisConfig` 로 분리 (S15P21A405-232) — 평범한 `@Configuration` 은 `@WebMvcTest` 슬라이스가 스캔하지 않는다. 슬라이스 10개에서 매퍼 `@MockitoBean` 4개씩 제거하고 171개 통과 확인. 새 매퍼를 `<도메인>.mapper` 에 추가해도 이제 슬라이스가 깨지지 않는다.

---

## Dependencies & Execution Order

- 🟢: T001~T004 → T005 → T006 → T007 → T008 → T009·T010 → T011. (T008 검증 매핑이 T009의 400 케이스 선행)
- 🔴 B-A: T101→T102→T103. B-D: T201→T202→T203→(T204·T205·T206). B-Common: T301 독립.
- 🟢 완료해도 실제 상세·주변곡 동작은 T203(어댑터)·T102(인증) 후 end-to-end.

## Implementation Strategy

### MVP (지금 최대치)
1. T001~T004(DTO·에러) → T005~T007(port·service·controller) → T008(검증 매핑) → T009·T010(테스트) → T011(green).
2. **STOP**: 상세·주변곡 조립·검증·에러코드·404 green(mock). 실 KNN(FR-006·009)·인증(B-A)은 블로커 대기.

### 블로커 후
- B-D → T203 완료 시 실제 상세·주변곡. B-A → 인증. B-Common → T301로 testMapper mock 제거.

## Notes
- ponytail: 프로덕션 신규 = DTO 5개(3개는 001·002와 동일 재생성) + port 1 + service/controller(detail만) + 도메인 에러 1 + 공통 검증 매핑 1(BE1 리뷰). ORM·캐시·거리계산 신규 없음(어댑터는 B-D).
- T008은 BE1 소유 파일 → MR 리뷰 플래그(002 T005와 동일 변경, 병합 시 dedup).
- `MUSIC_NOT_FOUND`는 BE2 도메인 에러로 정의 → 정본 §0.5 정합. api-spec `VALIDATION_ERROR`/`INTERNAL_ERROR` 명칭 불일치는 정본 갱신 대상(spec [정정]).
