---

description: "Task list: 음악 검색"
---

# Tasks: 음악 검색

**Input**: [plan.md](plan.md), [spec.md](spec.md), [data-model.md](data-model.md), [contracts/music-search.md](contracts/music-search.md), [quickstart.md](quickstart.md)

**Tests**: 포함 (사용자 요청: 슬라이스·mock 테스트). 통합/실데이터 테스트는 블로커 대기.

**Organization**: 블로커 무관 태스크(Phase 1~3)가 최상단. B-A(인증)·B-D(저장소) 의존은 맨 아래 "블로커 대기".

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일, 선행 태스크 없음 → 병렬 가능
- **[Story]**: US1(검색어로 곡 찾기, P1) / US2(결과 없음 구분, P2)
- 기존 루트: `src/main/java/com/ssafy/backend/`, 테스트: `src/test/java/com/ssafy/backend/`

---

# 🟢 지금 실행 가능 (블로커 무관)

컨트롤러·검증·DTO·port 인터페이스·slice/mock 테스트. DB·인증 없이 완결·검증됨(port는 mock).

## Phase 1: Foundational (공유 자료형·경계)

- [X] T001 [P] `MusicSummary` record 생성 in `src/main/java/com/ssafy/backend/music/dto/MusicSummary.java` (필드 id,title,artist,album,genres,youtubeUrl,location — data-model.md 기준, 기존 `Location` 재사용)
- [X] T002 [P] `PageResponse<T>` record 생성 in `src/main/java/com/ssafy/backend/music/dto/PageResponse.java` (content,page,size,totalElements,totalPages,hasNext — §0.3)
- [X] T003 [P] 검색 조회 port 정의 in `src/main/java/com/ssafy/backend/music/search/MusicSearchReader.java` (`PageResult search(String query, int page, int size)`, `PageResult`= `List<MusicSummary> content` + `long totalElements`; contracts/music-search.md의 매칭·정렬 계약을 javadoc으로 명시, 구현은 B-D)

**Checkpoint**: 자료형·경계 준비 완료.

## Phase 2: User Story 1 - 검색어로 곡 찾기 (P1) 🎯 MVP

**Goal**: query·page로 매칭 곡을 페이지 반환. **Independent Test**: port mock이 목록 반환 시 응답 조립·정렬 보존·페이지 정보 검증.

- [X] T004 [US1] `MusicService.search(query, page)` 구현 in `src/main/java/com/ssafy/backend/music/service/MusicService.java` (query.trim() → port.search(q, page, 10) 호출, PageResult→PageResponse<MusicSummary> 조립, port 반환 순서 그대로 보존, youtubeUrl null 유지) — depends T001~T003
- [X] T005 [US1] `GET /music/search` 핸들러 추가 in `src/main/java/com/ssafy/backend/music/controller/MusicController.java` (`@RequestParam @NotBlank String query`, `@RequestParam @Min(0) int page`, `ApiResponse.ok(musicService.search(...))`) — depends T004
- [X] T006 [US1] 컨트롤러 slice 테스트 in `src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java` (MockitoBean으로 MusicSearchReader stub; A1 성공 응답 구조, A5 youtubeCnt DESC·id ASC 순서 보존, A6 substring 매칭 전달, E3 빈 결과 200) — depends T005
- [X] T007 [P] [US1] 서비스 조립 테스트 in `src/test/java/com/ssafy/backend/music/MusicSearchServiceTests.java` (mock port: size=10 전달, 순서 보존, youtubeUrl null 유지, PageResponse 필드 매핑) — depends T004

**Checkpoint**: mock 기준 US1 완결·검증. 실데이터는 B-D.

## Phase 3: User Story 2 - 결과 없음을 실패와 구분 (P2)

**Goal**: 빈 결과·검증 오류·내부 실패 구분. **Independent Test**: 검증 위반·mock 예외로 상태·코드 확인.

- [X] T008 [US2] 검증·오류 테스트를 T006 파일에 추가 in `src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java` (E1 query 공백/누락→400 VALIDATION_ERROR, E2 page=-1/비정수→400, E5 port 예외→500 INTERNAL_ERROR + 공통 실패 구조) — depends T006
- [X] T009 [US2] `GlobalExceptionHandler`가 `ConstraintViolation`/바인딩 예외를 400 VALIDATION_ERROR로, 미분류 예외를 500 INTERNAL_ERROR로 매핑하는지 확인·보완 in `src/main/java/com/ssafy/backend/common/exception/GlobalExceptionHandler.java` (검색 전용 코드 추가 금지, 기존 재사용)

**Checkpoint**: US1+US2 mock 기준 독립 동작.

## Phase 4: Polish (블로커 무관 범위)

- [X] T010 관측 확인(헌법 VIII): `/music/search`가 actuator `http.server.requests`에 집계되는지 확인, 실패 로그에 query 원문 과다 노출 없는지 점검 (신규 의존성·커스텀 메트릭 추가 금지) in `src/main/resources/application.yml` 및 예외 핸들러

---

# 🔴 블로커 대기 (지금 착수 불가)

아래는 공유 인프라 도착 후. 검색 고유 로직 아님.

## B-A 대기: Core 인증 (담당 BE1)

- [ ] T101 [US1] `ErrorCode`에 `INVALID_TOKEN(401)`·`TOKEN_EXPIRED(401)` 추가 in `src/main/java/com/ssafy/backend/common/exception/ErrorCode.java` (Core 인증 계약 확정 후)
- [ ] T102 [US1] `/music/search`에 Core 인증 경계 적용(Bearer 검증, 토큰 subject) — Core 모듈 인터페이스 도착 후
- [ ] T103 [US2] 인증 테스트 E4: 토큰 없음/위조→401 INVALID_TOKEN, 만료→401 TOKEN_EXPIRED

## B-D 대기: 저장소·데이터·BE4 조회 (담당 BE4)

- [ ] T201 DB 의존성·datasource 설정 추가 in `build.gradle`, `src/main/resources/application.yml` (BE4가 정한 DB 제품/드라이버 기준)
- [ ] T202 곡 엔티티·스키마 및 `title`/`artist`/`youtubeCnt`/`pc1~pc16` 매핑 정의 (BE4 스키마 계약 확정 후)
- [ ] T203 [US1] `MusicSearchReader` 어댑터 구현 in `src/main/java/com/ssafy/backend/music/search/` (substring `title ILIKE %q% OR artist ILIKE %q%`, youtubeCnt DESC·id ASC, offset page*10 limit 10, 총계) — port 계약(T003) 준수
- [ ] T204 substring 가속 인덱스: Postgres면 title·artist `pg_trgm` GIN 인덱스 (research.md R3) — 실제 DB·실행계획 확인 후
- [ ] T205 [US1] 실데이터 통합 테스트: A2 좌표 baseline 일치, A4 실제 다중 페이지·hasNext — depends T203
- [ ] T206 성능 검증: p95 목표(제안 <300ms) 벤치마크 (research.md R4) — depends T203~T204

---

## Dependencies & Execution Order

- **Phase 1~4 (🟢)**: 지금 착수. T001~T003 병렬 → T004 → T005 → T006 → (T007 병렬) → T008 → T009 → T010.
- **B-A (🔴)**: T101 → T102 → T103. Core 인증 도착 의존.
- **B-D (🔴)**: T201 → T202 → T203 → (T204·T205·T206). BE4 저장소 의존.
- 🟢와 🔴는 독립. 🟢 완료 후에도 실제 검색 동작은 T203(어댑터)·T102(인증)가 있어야 end-to-end 성립.

### 병렬 기회

- T001·T002·T003 동시 (다른 파일, 선행 없음).
- T007은 T004 후 T006과 병렬(다른 테스트 파일).

## Implementation Strategy

### MVP (지금 가능한 최대치)

1. Phase 1(T001~T003) → Phase 2(T004~T007): mock 기준 검색 로직 완결·검증.
2. Phase 3(T008~T009): 오류 계약 검증.
3. Phase 4(T010): 관측 확인.
4. **STOP**: port mock으로 A1/A3/A5/A6/E1/E2/E3/E5 통과. 남은 A2/A4/E4는 블로커 대기.

### 블로커 해제 후

- B-A 도착 → T101~T103 (인증·E4).
- B-D 도착 → T201~T206 (어댑터·인덱스·실데이터·성능). T203 완료 시 실제 end-to-end 동작.

## Notes

- ponytail: DTO 2개 + port 1개 + 컨트롤러/서비스 각 1개 + 테스트 2파일이 🟢 전부. 스캐폴딩 최소.
- 페이지 크기 10은 서버 상수(요청 파라미터 아님). `PageResponse.size`는 참고값.
- 검색 전용 ErrorCode·응답 래퍼를 새로 만들지 않고 공통(ApiResponse/ErrorCode/handler) 재사용.
- `MusicSearchReader`는 BE4 합의 전 제안 계약 — 시그니처 변경 가능(B-D).
