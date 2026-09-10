# Tasks: PC 레벨·중심좌표 기반 대표곡 조회

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/music-major.md](contracts/music-major.md) · [quickstart.md](quickstart.md)

**Tests**: 포함. spec의 작업 시나리오와 quickstart가 검증(A1~A14)을 명시적으로 요구한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3 (spec User Story 매핑)
- **[BLOCKED: B#]**: plan의 미결정 게이트에 막힘. **착수 금지**, 표시만. (B1~B6 정의는 [plan.md](plan.md) "보류 항목")

> ⚠️ **현 상태**: 인프라·데이터(B6)와 제품/외부 계약(B1~B5)이 여전히 미결정이다. 선행 게이트였던 T002·T003은 해소됐으므로
> 지금 착수 가능한 것은 **미정 정책에 독립적인 순수 로직·공통 계층 정합·wire 레벨 테스트**(T006~T012)다.
> BLOCKED 태스크는 해당 게이트 해소 후 착수한다. 정책 확정 전 의존 구현은 금지(헌법 I·IX).
>
> ✅ **재배치 완료(2026-09-10, S15P21A405-115)**: music 코드는 `backend/src/...` 아래로 이미 옮겨졌고 master 공통 계층
> (`ApiResponse.success`·`ErrorCode` 인터페이스·`CustomException`)을 쓴다. Setup 단계(T001~T003)는 해소됐다. 상세·충돌은
> plan "master 통합 재검증" 절(M1~M8) 참조.

---

## Phase 1: Setup

**Purpose**: master `backend/` 베이스 위에 music 기능을 올릴 준비. master 스택(postgres·MyBatis·neo4j·redis) 재사용.

- [X] T001 (2026-09-10 완료: 27개 통과) `cd backend && ./gradlew test` (PowerShell `cd backend; .\gradlew.bat test`)로 master 베이스 테스트 통과 기준선 확인. Gradle wrapper는 `backend/`에 있음
- [X] T002 (2026-09-10 완료, S15P21A405-115) music 스캐폴딩을 `backend/src/main/java/com/ssafy/backend/`로 재배치, master 공통 계층 사용으로 정합. record→Lombok DTO 관례는 여전히 팀 확인 대상(M8)
- [X] T003 (2026-09-10 완료) `spring-boot-starter-validation`을 `backend/build.gradle`에 추가 (music `@Min/@Validated`용)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 모든 스토리의 종단 구현이 의존하는 기반. **전부 외부 게이트에 막혀 있음** — 지금 착수 불가.

- [ ] T004 [BLOCKED: B6] `MajorTrackReader` 조회 port 인터페이스 정의 (`backend/src/main/java/com/ssafy/backend/music/retrieval/MajorTrackReader.java`). 시그니처·스키마·ID 매핑은 BE4와 합의 후. 잠정 시그니처를 확정 계약으로 만들지 않는다
- [ ] T005 [BLOCKED: B6] v2.1-pca16 곡 데이터 접근 어댑터. master 스택상 **MyBatis mapper(XML `classpath:mapper/**/*.xml`) + PostgreSQL**이 유력. 좌표 원형 조회 물리 방식(pgvector 없음, 스칼라 컬럼 vs 벡터 확장)·저장소(postgres vs neo4j)는 BE4 확인 (`backend/src/main/java/com/ssafy/backend/music/retrieval/`, `backend/src/main/resources/mapper/`)
- [ ] T006 [P] music용 `ErrorCode` 구현 enum(`MusicErrorCode`) + 예외 매핑 보완 **(지금 가능)**: api-spec §0.5 계약 코드 `VALIDATION_ERROR`·`INVALID_TOKEN`·`TOKEN_EXPIRED`·`INTERNAL_ERROR` 정의(master 전역 `GlobalErrorCode`의 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`와 불일치 M4 → **전역 코드 정합은 BE1·팀 결정**). `GlobalExceptionHandler`에 (a) 검증 예외(타입/누락/제약) → **400 `VALIDATION_ERROR`**(M5), (b) music 내부 실패 → **500 `INTERNAL_ERROR`**(generic `INTERNAL_SERVER_ERROR` 대신, F1) 매핑 추가. **Core 인증 연동 자체는 B5(T022)** (`backend/src/main/java/com/ssafy/backend/music/`, `.../common/`)

**Checkpoint**: T004·T005는 B6까지 blocked. **T006은 지금 가능** — T020(A7)·T021(A8)의 계약 코드 검증을 가능하게 한다. US 종단 흐름은 T004·T005 해소에 의존.

---

## Phase 3: User Story 1 — 중심좌표 주변 구역 대표곡 (Priority: P1) 🎯 MVP

**Goal**: 레벨·중심좌표 → 이동 원형 영역에서 `youtubeCnt` DESC 상위 k 대표곡 반환.

**Independent Test**: 순수 조건 변환(A9/A10)과 선정 정렬(A14 부분)을 DB 없이 검증; 성공 응답 필드·고정 좌표(A2)를 MVC 슬라이스로 검증.

### 지금 착수 가능 (미정 정책·인프라 독립; `backend/` 경로에 배치)

- [ ] T007 [P] [US1] `MajorQueryResolver` 구현: level n → 축 번호 (2n-1, 2n), 해당 축 중심 추출. 순수 함수(DB·HTTP 비의존). 레벨 상한·생략 검증 미포함(B1) (`backend/src/main/java/com/ssafy/backend/music/service/MajorQueryResolver.java`)
- [ ] T008 [P] [US1] Resolver 단위테스트 A9/A10: level=1→pc1·pc2, level=2→pc3·pc4, 이전 단계 중심으로 해석 안 함 (`backend/src/test/java/com/ssafy/backend/music/MajorQueryResolverTests.java`)
- [ ] T009 [P] [US1] 대표곡 선정 순수 로직: 후보 리스트에 `youtubeCnt` DESC 정렬 후 상위 k. **k는 주입 파라미터**(하드코딩 금지, B4). `playCnt`·재생 링크로 순위 변경 안 함. 동률·null·부족 미포함(B4) (`backend/src/main/java/com/ssafy/backend/music/service/MajorSelection.java`)
- [ ] T010 [P] [US1] 선정 단위테스트 A14: 후보 조회수 [300,100,200], k=2 → [300,200]; `playCnt` 역순이어도 순서 불변 (`backend/src/test/java/com/ssafy/backend/music/MajorSelectionTests.java`)
- [ ] T011 [US1] **부분 완료** — `major_level1_returnsSuccessEnvelope`가 id·title·genres·pc1만 확인. MVC 슬라이스 테스트 A2: 성공 항목이 §0.6 필드 전부 포함, `location.pc1`~`pc16`이 곡 기준선 좌표와 일치 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T012 [US1] MVC 슬라이스 테스트 A3: `youtubeUrl: null`이어도 항목 유지·null 보존 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)

### 게이트 대기

- [ ] T013 [BLOCKED: B2] [US1] `MajorSelectionPolicy`: 레벨별 서버 반경 + 원형 내부 판정(원주 포함 `<=`/`<`, 축 스케일). 값·규칙 미정 (`backend/src/main/java/com/ssafy/backend/music/service/MajorSelectionPolicy.java`)
- [ ] T014 [BLOCKED: B3] [US1] 장르·이전 PC 선택 누적 제약을 현재 한 쌍 요청과 연결. 제약 미확보 시 전역 후보 축소 금지. 신규 세션/파라미터 임의 추가 금지 (`backend/src/main/java/com/ssafy/backend/music/service/`)
- [ ] T015 [BLOCKED: B2/B3/B4/B6] [US1] `MusicService.getMajor` orchestration으로 미구현 예외 교체: 정책 조회 → 조건 변환 → Reader 호출 → 순위 보존 조립 (`backend/src/main/java/com/ssafy/backend/music/service/MusicService.java`)
- [ ] T016 [BLOCKED: B6] [US1] `MajorTrackReader` 어댑터 구현(MyBatis mapper): "동일 버전 + 기존 제약 + 원형 내부" 후보에 `youtubeCnt` DESC top-k. 전역 선절단·ANN 대체 금지 (`backend/src/main/java/com/ssafy/backend/music/retrieval/`, `backend/src/main/resources/mapper/`)
- [ ] T017 [BLOCKED: B2/B6] [US1] 통합 테스트 A11/A12/A13 + SC-002: 이동 원형·레벨별 동일 반경·원 내부/외부 포함·동일 버전 좌표 불변(차이 0). H2(test) 또는 실 postgres fixture (`backend/src/test/java/com/ssafy/backend/music/`)

**Checkpoint**: T007~T012 완료 시 순수 로직·wire 계약 독립 검증(MVP 부분). 종단 조회는 T013~T017 게이트 해소 후.

---

## Phase 4: User Story 2 — 좌표 선택 전 최상위 조회 (Priority: P1)

**Goal**: `level=1`을 PC 값 없이 호출 가능(최상위 진입).

**Independent Test**: `GET /music/major?level=1` PC 미포함 요청이 PC 생략만으로 검증 오류가 아님을 확인.

- [X] T018 (2026-09-10 완료: `major_level1_returnsSuccessEnvelope`) [US2] MVC 슬라이스 테스트 A5: `level=1` PC 생략 → `VALIDATION_ERROR` 아님(200) (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T019 [BLOCKED: B2] [US2] level=1 PC 생략 시 조회 대상 정의(중심을 (0,0)/전체 영역으로 대체 금지). 초기 조회 분기 (`backend/src/main/java/com/ssafy/backend/music/service/MusicService.java`)

**Checkpoint**: A5 계약은 T018로 유지. 최상위 실제 반환은 B2 후.

---

## Phase 5: User Story 3 — 실패를 정상 결과와 구분 (Priority: P2)

**Goal**: 인증 실패·타입 위반·내부 실패를 정상 응답과 구분(공통 실패 구조).

**Independent Test**: 타입 위반·내부 실패·인증 상태를 각각 구성해 기존 오류 계약 확인.

- [ ] T020 [US3] **부분 완료** — `major_invalidLevel_/nonNumericLevel_returnsInvalidInput`이 400은 확인하나 코드가 master `INVALID_INPUT`이라 계약 코드(M4) 불일치. MVC 슬라이스 테스트 A7: `level=abc` 및 PC 필드에 `abc` → 400 `VALIDATION_ERROR` + 공통 실패 구조. **T006의 검증 예외 매핑 선행**(master 기본 핸들러엔 없음, M5) (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T021 [US3] MVC 슬라이스 테스트 A8: 서비스 내부 실패 → 500 `INTERNAL_ERROR` + 공통 실패 구조. `MusicService` mock이 예외 throw. ⚠️ **T006의 500→`INTERNAL_ERROR` 매핑 선행 필수**: master generic 핸들러는 `INTERNAL_SERVER_ERROR`를 반환하므로(M4/F1) 매핑 없이는 계약 코드 불일치로 실패 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T022 [BLOCKED: B5] [US3] 인증 테스트 A6: 토큰 위조·무효 → 401 `INVALID_TOKEN`, 만료 → 401 `TOKEN_EXPIRED`, 토큰 없음 → 401 상태·공통 실패. 인증 연동(T006) 후 (`backend/src/test/java/com/ssafy/backend/music/`)

**Checkpoint**: A7·A8은 T020·T021로 검증(T006의 검증 핸들러 보완 전제). 401(A6)은 인증 통합 후.

---

## Phase 6: Polish & Cross-Cutting

- [ ] T023 [P] 관측: 요청 수·지연·오류·반환 수 지표 노출. master가 `http.server.requests` 히스토그램 이미 활성(M7) → 재사용. 로그·지표에 비밀/불필요 PII 제외(SC-004) (`backend/src/main/java/com/ssafy/backend/music/`, `backend/src/main/resources/application.yml`)
- [ ] T024 [BLOCKED: B1] 요청 검증 규칙: 레벨 상한·생략, 두 축 외 PC 추가·한쪽 누락, 좌표 유효 범위·NaN/Infinity·영역 밖. 중심좌표 임의 보정 금지 (`backend/src/main/java/com/ssafy/backend/music/controller/MusicController.java`)
- [ ] T025 [BLOCKED: B4/C2] 대표곡 응답 페이지 계약(page/size 적용 여부) 및 k 확정값·동률·null·중복·후보 부족·빈 결과 본문 (`backend/src/main/java/com/ssafy/backend/music/dto/MajorResponse.java`, `.../service/`)
- [ ] T026 [BLOCKED: D6/B6] 성능 검증: 이 API 단독 시간 예산·백분위·측정 환경 정의 후 SC-003 확인. 지도 2초 전체 목표를 이 API 한도로 대체 안 함
- [ ] T027 [BLOCKED: B2/B4/B5/B6] quickstart.md "B6 이후 통합 검증" 전체 실행(A4/A6/A11~A13). 지금은 "지금 실행 가능한 검증" 표만 대상

---

## Dependencies & Execution Order

- **Phase 1 (Setup)**: T001·T002·T003 완료(2026-09-10). 선행 게이트 해소.
- **Phase 2 (Foundational)**: T004·T005는 BLOCKED(B6). **T006(공통 계층 정합)은 지금 가능**(T002 후) — T020/T021의 계약 코드 검증을 가능하게 하는 선행.
- **Phase 3~5 (Stories)**:
  - **지금 가능(순수·인프라 독립)**: T007·T008·T009·T010 (서로 다른 신규 파일·병렬).
  - **wire 테스트**: T011·T012·T018·T020·T021 — 모두 `MusicControllerTests.java` 편집 → **순차**. T020·T021은 추가로 **T006 선행**(검증·500 매핑).
  - **게이트 대기**: T013~T017, T019, T022, T024~T027.
- **Story 독립성**: US1/US2/US3의 착수 가능 부분은 서로 독립. 종단은 T004·T005 해소에 의존.

### Parallel Opportunities

- T007 · T008 · T009 · T010 — 서로 다른 신규 파일, 병렬 가능.
- T011 · T012 · T018 · T020 · T021 — 같은 `MusicControllerTests.java` 편집 → **병렬 금지**(순차).
- T023 — 독립.

---

## Implementation Strategy

### 선행 (완료)

master `backend/`가 정식 베이스다. T002(재배치 + master 공통 계층 정합)·T003(validation 스타터)는 2026-09-10 완료.

### 지금 착수 가능한 MVP (인프라·정책 무관)

1. T006 공통 계층 정합(`MusicErrorCode` + 검증/500 매핑) — T020/T021 전제
2. T007~T010 순수 로직 + 단위테스트 (Resolver 축 매핑, youtubeCnt top-k) — 병렬
3. T011·T012·T018·T020·T021 wire 계약 테스트(A2·A3·A5·A7·A8) — 순차 (A7·A8은 T006 전제)
4. T023 관측 지표(master 히스토그램 재사용)
5. **STOP**: 여기까지가 B1~B6 무관 검증 범위. 종단 대표곡 조회는 미착수.

### 게이트 해소 후

- B2 → T013·T019, B3 → T014, B4 → T025, B5 → T022(인증 연동; T006 공통 계층은 B5 아님), B6 → T004·T005·T016·T017.
- B2~B4·B6 확보 후 T015(orchestration) → 종단 흐름 → T026·T027 성능·통합.

---

## Notes

- BLOCKED 태스크는 게이트가 열리기 전에는 구현하지 않는다. 미정 정책을 운영 기본값으로 가정 금지(헌법 IX).
- **master 통합**: `backend/` 평면 레이어·MyBatis·postgres·neo4j·redis·Lombok 공통 계층 재사용. 신규 ORM·캐시·검색엔진 신규 채택 금지.
- **M4 문서 충돌**: master 전역 에러 코드(`INVALID_INPUT`/`INTERNAL_SERVER_ERROR`)가 api-spec §0.5(`VALIDATION_ERROR`/`INTERNAL_ERROR`)와 다르다. music은 자체 `ErrorCode` 구현으로 계약 준수, 전역 정합은 팀 결정(plan M4).
- 정확한 대표곡 ID·k·동률 순서·빈 결과 기대값은 B2~B4 확정 후 fixture로 보완. 지금은 정렬 규칙·축 매핑·응답 구조만 확정 검증.
