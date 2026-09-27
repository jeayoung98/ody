---
description: "Task list: 음악·아티스트 조건 검색 고도화"
---

# Tasks: 음악·아티스트 조건 검색

**Input**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/music-search.md](contracts/music-search.md), [quickstart.md](quickstart.md)

**Tests**: 명세와 계획이 회귀·계약·SQL 정확성·성능 검증을 요구하므로 테스트 태스크를 포함한다. 각 스토리의 테스트를 먼저 추가하고 실패를 확인한 뒤 구현한다.

**Scope**: 이 브랜치는 Backend와 공통 명세를 구현한다. Frontend 소스 변경은 [frontend-handoff.md](frontend-handoff.md)를 기준으로 별도 Frontend Jira 이슈·브랜치에서 수행한다.

## Phase 1: Setup — 기준선 확보

**Purpose**: 변경 전 동작과 DB 전제를 기록해 회귀·성능 비교 기준을 만든다.

- [X] T001 기존 통합 검색 테스트를 실행하고 커밋·명령·통과/실패를 `specs/002-music-search/validation-results.md`에 기록한다 (`backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`, `MusicSearchServiceTests.java`, `MusicSearchReaderAdapterTests.java` 기준).
- [ ] T002 [P] 검증 DB의 `music_title_lower`·`music_artist_lower` 정의와 `pg_index.indisvalid`, 데이터 버전·행 수를 확인해 `specs/002-music-search/validation-results.md`에 기록한다; 운영 DB에는 쓰기 작업을 하지 않는다.
- [ ] T003 [P] 기존 통합 검색의 대표 입력별 p95·오류율·timeout을 [quickstart.md](quickstart.md) 조건으로 측정해 `specs/002-music-search/validation-results.md`에 변경 전 기준선으로 기록한다.

**Checkpoint**: 기능 회귀와 SC-005를 판정할 기준이 남아 있다. DB 접근이 없으면 T002·T003을 미실행으로 명시하고 로컬 구현은 계속할 수 있지만 기능 완료로 판정하지 않는다.

---

## Phase 2: Foundational — 공통 검색 조건

**Purpose**: 세 검색 경로가 공유하는 허용 조합·공백 처리 규칙을 한곳에 둔다.

- [X] T004 `backend/src/test/java/com/ssafy/backend/music/search/MusicSearchConditionTests.java`에 `query` 단독, `artist` 단독, `music+artist` 허용과 전부 누락·공백·`music` 단독·`query` 혼합 거절 테스트를 작성하고 구현 전 실패를 확인한다.
- [X] T005 `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchCondition.java`에 nullable `query`·`music`·`artist`를 받는 record를 추가하고 trim·허용 조합 검증을 구현해 위반 시 `GlobalErrorCode.INVALID_INPUT`을 발생시킨다.

**Checkpoint**: 컨트롤러·서비스·어댑터가 동일한 조건 의미를 사용할 수 있다.

---

## Phase 3: User Story 1 — 기존 통합 검색 보존 (Priority: P1) 🎯 MVP

**Goal**: `query` 요청의 매칭·정렬·페이지 응답과 SQL 실행 경로를 변경 전과 동일하게 유지한다.

**Independent Test**: `query=Love&page=0` 요청이 기존 `findPage`를 한 번 사용하고 제목 완전일치 → 아티스트 완전일치 → 제목 앞일치 → 아티스트 앞일치 순서와 기존 응답 구조를 반환한다.

### Tests for User Story 1

- [X] T006 [P] [US1] `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`에 기존 `query+page` 성공·빈 결과·페이지 응답 계약 회귀 테스트를 새 선택 파라미터 시그니처에 맞춰 작성하고 실패를 확인한다.
- [X] T007 [P] [US1] `backend/src/test/java/com/ssafy/backend/music/MusicSearchReaderAdapterTests.java`에 통합 조건이 기존 `MusicSearchMapper.findPage`만 호출하고 `size+1`·`long offset`·`hasNext`·장르 일괄 조립을 유지하는 회귀 테스트를 작성하고 실패를 확인한다.

### Implementation for User Story 1

- [X] T008 [US1] `backend/src/main/java/com/ssafy/backend/music/controller/MusicController.java`의 검색 엔드포인트가 선택적 `query`·`music`·`artist`와 필수 `page`를 받아 `MusicSearchCondition`을 생성하도록 바꾸고 OpenAPI 설명을 앞일치·허용 조합에 맞춘다.
- [X] T009 [US1] `backend/src/main/java/com/ssafy/backend/music/service/MusicService.java`와 `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchReader.java`가 `MusicSearchCondition`을 전달하도록 시그니처를 갱신하고 페이지 크기 10 및 기존 응답 구조를 유지한다.
- [X] T010 [US1] `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchReaderAdapter.java`에서 `query` 조건은 기존 `MusicSearchMapper.findPage`와 기존 lowercase·LIKE 이스케이프·응답 조립 경로를 그대로 사용하게 연결한다.
- [X] T011 [US1] `backend/src/main/java/com/ssafy/backend/music/service/MusicService.java`의 검색 완료 로그에서 검색어 원문을 제거하고 검색 모드·page·반환 개수만 기록한다.
- [X] T012 [US1] `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`, `MusicSearchServiceTests.java`, `MusicSearchReaderAdapterTests.java`의 US1 테스트를 실행해 기존 query 경로 회귀가 없는지 확인한다.

**Checkpoint**: 신규 필터가 아직 없어도 기존 통합 검색이 독립적으로 동작한다.

---

## Phase 4: User Story 2 — 아티스트의 음악 보기 (Priority: P1)

**Goal**: `artist` 조건만으로 해당 문자열과 완전히 일치하거나 그 문자열로 시작하는 아티스트의 음악을 조회한다.

**Independent Test**: `artist=Radiohead&page=0` 요청이 아티스트 완전일치 결과를 앞일치 결과보다 먼저 반환하고, 제목이 `Radiohead`인 다른 아티스트의 음악은 포함하지 않는다.

### Tests for User Story 2

- [X] T013 [P] [US2] `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`와 `MusicSearchServiceTests.java`에 `artist` 단독 요청 전달·페이지 응답 테스트를 작성하고 실패를 확인한다.
- [X] T014 [P] [US2] `backend/src/test/java/com/ssafy/backend/music/MusicSearchReaderAdapterTests.java`에 아티스트 조건의 lowercase·리터럴 와일드카드 이스케이프·`size+1`·`long offset`·필터 매퍼 선택 테스트를 작성하고 실패를 확인한다.

### Implementation for User Story 2

- [X] T015 [US2] `backend/src/main/java/com/ssafy/backend/music/mapper/MusicSearchMapper.java`에 정규화한 아티스트 원문·앞일치 패턴과 선택적 음악 조건·`cap/size/offset`을 받는 `findFilteredPage` 선언을 추가한다.
- [X] T016 [US2] `backend/src/main/resources/mapper/music/MusicSearchMapper.xml`의 `findFilteredPage`에 아티스트 완전일치와 앞일치 2단계를 상호 배타적으로 구현하고 각 단계에 `video_id IS DISTINCT FROM 'none'`, `ORDER BY id`, `LIMIT cap`, 전체 `timeout="2"`를 적용한다.
- [X] T017 [US2] `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchReaderAdapter.java`에서 `artist` 단독 조건을 `findFilteredPage`로 전달하고 기존 장르 일괄 조회·`MusicSummary`·좌표·재생 정보 조립을 공유한다.
- [X] T018 [US2] US2 테스트를 실행하고 `Radiohead`·NULL 아티스트·`video_id='none'` 사례의 기대 결과를 `specs/002-music-search/validation-results.md`에 기록한다.

**Checkpoint**: 아티스트 단독 검색이 통합 검색과 독립적으로 검증된다.

---

## Phase 5: User Story 3 — 동명 음악을 아티스트로 좁히기 (Priority: P1)

**Goal**: `music+artist` 조건을 모두 만족하는 음악만 반환하고 두 조건의 완전일치 조합으로 관련성 순서를 정한다.

**Independent Test**: `music=Love&artist=Lana Del Rey&page=0` 요청이 각 조건으로 시작하는 교집합만 반환하며 모두 완전일치 → 아티스트만 완전일치 → 음악만 완전일치 → 모두 앞일치 순서를 지킨다.

### Tests for User Story 3

- [X] T019 [P] [US3] `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`와 `MusicSearchServiceTests.java`에 `music+artist` 요청 전달과 빈 교집합 200 응답 테스트를 작성하고 실패를 확인한다.
- [X] T020 [P] [US3] `backend/src/test/java/com/ssafy/backend/music/MusicSearchReaderAdapterTests.java`에 두 조건 정규화·이스케이프·필터 매퍼 인자·다중 페이지 `hasNext` 테스트를 작성하고 실패를 확인한다.

### Implementation for User Story 3

- [X] T021 [US3] `backend/src/main/resources/mapper/music/MusicSearchMapper.xml`의 `findFilteredPage`를 음악 조건 존재 시 4개 상호 배타적 tier로 확장하고 모든 조건을 단계별 `LIMIT` 전에 적용해 `UNION ALL` 중복과 페이지 누락을 막는다.
- [X] T022 [US3] `backend/src/main/java/com/ssafy/backend/music/search/MusicSearchReaderAdapter.java`가 음악 원문·앞일치 패턴을 필터 매퍼에 전달하도록 확장하되 응답 조립은 US2 경로와 공유한다.
- [X] T023 [US3] US3 테스트를 실행하고 `Love`·`Lana Del Rey`, 두 조건은 각각 많지만 교집합 0건, 11건 이상 다중 페이지 사례의 기대 결과를 `specs/002-music-search/validation-results.md`에 기록한다.

**Checkpoint**: 동명 음악 좁히기가 아티스트 단독 검색 및 기존 통합 검색과 함께 동작한다.

---

## Phase 6: User Story 4 — 결과 없음과 요청 실패 구분 (Priority: P2)

**Goal**: 유효한 빈 결과는 200으로, 잘못된 조건은 400으로, 내부 실패는 500으로 구분하고 인증 계약의 현재 상태를 명확히 검증한다.

**Independent Test**: 세 유효 경로의 0건은 빈 `content`와 200을 반환하고, 전부 누락·공백·`music` 단독·`query` 혼합·잘못된 page는 400 `INVALID_INPUT`, 매퍼 timeout은 500 `INTERNAL_SERVER_ERROR`를 반환한다.

### Tests for User Story 4

- [X] T024 [US4] `backend/src/test/java/com/ssafy/backend/music/MusicSearchControllerTests.java`에 조건 누락·각 필드 공백·`music` 단독·`query` 혼합·page 누락/음수/비정수·필터 내부 실패 계약 테스트를 작성하고 구현 전 실패를 확인한다.
- [X] T025 [P] [US4] `backend/src/test/java/com/ssafy/backend/music/MusicSearchMapperTimeoutTests.java`와 `MusicSearchMapperVideoIdFilterTests.java`가 `findFilteredPage`의 2초 timeout 및 모든 tier의 `video_id='none'` 제외를 검증하도록 확장하고 실패를 확인한다.

### Implementation for User Story 4

- [X] T026 [US4] T024·T025 실패를 `MusicSearchCondition.java`, `MusicController.java`, `MusicSearchMapper.xml`의 기존 책임 범위에서 수정하고 별도 예외 타입·엔드포인트·전략 클래스를 추가하지 않는다.
- [X] T027 [US4] 현재 `backend/src/main/java/com/ssafy/backend/config/SecurityConfig.java`의 임시 `permitAll` 상태에서 미인증 요청 결과를 확인해 `specs/002-music-search/validation-results.md`에 계약 미충족으로 기록하고, Core 인증 정책 복구 후 401 재검증 항목을 남긴다.

**Checkpoint**: 인증을 제외한 성공·빈 결과·400·500 계약이 자동 검사로 구분되고, 401의 외부 의존성이 숨겨지지 않는다.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: 실제 PostgreSQL 정확성·성능과 공통 계약을 검증해 완료 여부를 판정한다.

- [ ] T028 `quickstart.md`의 고정 fixture를 전용 PostgreSQL+pgvector 환경에 구성하고 기존 MyBatis XML로 통합·아티스트·동시 조건의 전체 기대 ID 순서, 특수 문자, NULL 아티스트, `video_id` 필터, 연속 페이지 중복·누락을 검증해 `specs/002-music-search/validation-results.md`에 기록한다.
- [ ] T029 T002의 기존 인덱스로 흔한·희소·0건·교집합 0건·깊은 페이지 입력의 `EXPLAIN (ANALYZE, BUFFERS)`를 제한 시간 안에서 실행하고 plan·실행시간·buffer를 `specs/002-music-search/validation-results.md`에 기록한다.
- [ ] T030 [P] 동일 데이터·설정·부하에서 기존 통합 검색 p95 회귀 10% 미만과 신규 아티스트/동시 검색 p95 300ms 이하를 측정하고 timeout·오류를 포함한 결과를 `specs/002-music-search/validation-results.md`에 기록한다.
- [ ] T031 T029·T030이 기준을 넘을 때만 원인을 분석해 필요한 SQL 또는 인덱스 변경 제안을 `specs/002-music-search/validation-results.md`에 작성하고, DB DDL은 BE4 협의용 별도 Jira 이슈로 분리한다.
- [ ] T032 [P] 승인된 API 계약을 `docs/api-spec.md` §3.1과 `docs/rules/BACKEND-NOTES.md`에 동기화하고 Frontend 담당자에게 [frontend-handoff.md](frontend-handoff.md)의 신규 파라미터·페이지 응답·인증 제약을 전달한다.
- [X] T033 `backend/gradlew.bat test`와 `backend/gradlew.bat build`를 실행하고 전체 결과를 `specs/002-music-search/validation-results.md`에 기록한다.
- [X] T034 `specs/002-music-search/quickstart.md`의 Backend·실 DB·성능·Frontend 연동·인증 항목을 통과/실패/미실행으로 최종 판정하고 하나라도 필수 게이트가 미검증이면 전체 완료로 표시하지 않는다.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: 즉시 시작한다. T001은 로컬 구현 기준선, T002·T003은 실 DB 접근 가능 시 병렬 수행한다.
- **Foundational**: T004 → T005. 모든 사용자 스토리를 막는다.
- **US1**: T005 후 T006·T007을 병렬 작성하고 T008 → T009 → T010 → T011 → T012 순으로 통합 검색 회귀를 고정한다.
- **US2**: US1 후 T013·T014를 병렬 작성하고 T015 → T016 → T017 → T018 순으로 구현한다.
- **US3**: US2의 필터 매퍼가 필요하다. T019·T020 → T021 → T022 → T023.
- **US4**: 세 성공 경로가 있어야 전체 오류 계약을 검증할 수 있다. T024·T025 → T026 → T027.
- **Polish**: 원하는 사용자 스토리 완료 후 수행하며 T028 → T029 → T030 → T031, 문서·빌드는 가능한 범위에서 병렬화한다.

### User Story Dependencies

```text
Foundational
    └── US1 기존 통합 검색
          └── US2 아티스트 검색
                └── US3 음악+아티스트 검색
                      └── US4 오류 구분
                            └── 실제 DB·성능·통합 검증
```

스토리 의존성은 동일 endpoint·reader·mapper를 최소 수정으로 확장하기 때문에 생긴다. 각 Checkpoint에서는 해당 스토리의 요청만으로 독립 검증할 수 있다.

### Parallel Opportunities

- T002와 T003은 다른 DB 점검·부하 측정으로 병렬 가능하다.
- T006과 T007, T013과 T014, T019와 T020은 각각 컨트롤러/서비스 계약과 어댑터 경계를 다른 테스트 파일에서 병렬 작성할 수 있다.
- T025는 컨트롤러 오류 테스트와 다른 XML 검사 파일이므로 T024와 병렬 가능하다.
- T030 성능 측정과 T032 문서 동기화는 코드·계약이 고정된 뒤 서로 다른 산출물에서 병렬 가능하다.

## Parallel Example: User Story 2

```text
Task A: T013 — Controller/Service의 artist 단독 요청 계약 테스트
Task B: T014 — ReaderAdapter의 정규화·이스케이프·mapper 인자 테스트

두 테스트가 실패하는 것을 확인한 뒤 T015~T017을 순서대로 구현한다.
```

## Implementation Strategy

### MVP First

1. T001과 T004~T005로 기준선과 조건 객체를 준비한다.
2. T006~T012로 기존 통합 검색을 새 요청 구조에 연결한다.
3. 여기서 멈추고 기존 `query` API의 응답·정렬·성능이 유지되는지 확인한다.

### Incremental Delivery

1. **US1**: 호환 가능한 요청 구조와 기존 통합 검색 보존.
2. **US2**: 기존 아티스트 인덱스를 사용하는 아티스트 단독 검색.
3. **US3**: 같은 필터 매퍼를 확장한 음악+아티스트 교집합 검색.
4. **US4**: 빈 결과·잘못된 요청·실패 계약과 인증 의존성 확인.
5. **Polish**: 실제 PostgreSQL 정확성·성능·FE 연동을 통과한 뒤 완료 판정.

## Notes

- 기존 `findPage`, 페이지 크기, 응답 DTO, 장르 일괄 조회, 함수 인덱스와 timeout을 재사용한다.
- 신규 프로덕션 타입은 `MusicSearchCondition` 하나, 신규 SQL 진입점은 `findFilteredPage` 하나다.
- 아티스트 테이블·캐시·자동완성·전체 개수·새 라이브러리·초기 복합 인덱스는 만들지 않는다.
- `music` 칩만 있고 아티스트 입력이 비어 있으면 Frontend가 요청하지 않는다.
- Frontend 소스는 파트 소유권과 브랜치 규칙상 이 Backend 브랜치에서 수정하지 않는다.
