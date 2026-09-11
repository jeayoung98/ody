# Tasks: PC 레벨·중심좌표 기반 대표곡 조회

**Input**: [spec.md](spec.md) · [plan.md](plan.md) · [research.md](research.md) · [data-model.md](data-model.md) · [contracts/music-major.md](contracts/music-major.md) · [quickstart.md](quickstart.md)

**Tests**: 포함. spec의 작업 시나리오와 quickstart가 검증(A1~A14)을 명시적으로 요구한다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 다른 파일·의존 없음 → 병렬 가능
- **[Story]**: US1/US2/US3 (spec User Story 매핑)
- **[BLOCKED: B#]**: plan의 미결정 게이트에 막힘. **착수 금지**, 표시만. (B1~B6 정의는 [plan.md](plan.md) "보류 항목")

> ⟲ **2026-09-11 D15**: 조회 구역이 원형 → **격자 모델**로 바뀌었다. 롤백 가능하게 원안을 보존했다 —
> 맨 아래 "D15 영향 요약" 과 [spec.md 롤백 기록](spec.md) 절 참조. **B6(데이터·조회 인터페이스)는 해소됐다.**
>
> ⚠️ **현 상태**: 제품/외부 계약(B1~B4)이 여전히 미결정이다. 선행 게이트였던 T002·T003은 해소됐으므로
> 지금 착수 가능한 것은 **미정 정책에 독립적인 순수 로직·wire 레벨 테스트**(T007~T012)다.
> T006(전역 에러 코드 정합)은 BE1 이관 대상으로 바뀌었다 — 아래 T006 항목 참조.
> BLOCKED 태스크는 해당 게이트 해소 후 착수한다. 정책 확정 전 의존 구현은 금지(헌법 I·IX).
>
> ✅ **재배치 완료(2026-09-10, S15P21A405-115)**: music 코드는 `backend/src/...` 아래로 이미 옮겨졌고 master 공통 계층
> (`ApiResponse.success`·`ErrorCode` 인터페이스·`CustomException`)을 쓴다. Setup 단계(T001~T003)는 해소됐다. 상세·충돌은
> 아래 Notes 의 "master 통합 재검증(M 항목)" 참조.
> (plan.md 에는 해당 절이 없다 — M 번호는 S15P21A405-115 작업 메모에서 왔다)

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
- [ ] T006 [P] ⛔ **BE1 이슈로 이관 대상 — BE2 브랜치에서 하지 않는다**: 전역 `GlobalErrorCode` 개명은 이 기능만의 일이 아니다. 한 번 시도해 커밋했다가(`6349665`) 리베이스 때 제외했다. 근거: (a) 옛 코드(`INVALID_INPUT`/`INTERNAL_SERVER_ERROR`) 참조가 **12파일**(main 3 + test 9: auth·user·playlist·music)로 늘었다, (b) dev 가 `GlobalErrorCode` 에 `FORBIDDEN` 을 §0.5 이름으로 추가해 이미 §0.5 방향으로 가고 있다, (c) BE1 이 같은 파일에서 인증·유저·플레이리스트를 동시에 올리는 중이라 충돌 비용이 계속 커진다. 계약 코드만 미리 enum 에 넣는 것은 호출부 없는 죽은 코드라 하지 않았다. music용 `ErrorCode` 구현 enum(`MusicErrorCode`) + 예외 매핑 보완: api-spec §0.5 계약 코드 `VALIDATION_ERROR`·`INVALID_TOKEN`·`TOKEN_EXPIRED`·`INTERNAL_ERROR` 정의(master 전역 `GlobalErrorCode`의 `INVALID_INPUT`/`INTERNAL_SERVER_ERROR`와 불일치 M4 → **전역 코드 정합은 BE1·팀 결정**). `GlobalExceptionHandler`에 (a) 검증 예외(타입/누락/제약) → **400 `VALIDATION_ERROR`**(M5), (b) music 내부 실패 → **500 `INTERNAL_ERROR`**(generic `INTERNAL_SERVER_ERROR` 대신, F1) 매핑 추가. **Core 인증 연동 자체는 B5(T022)** (`backend/src/main/java/com/ssafy/backend/music/`, `.../common/`). **이관 추적**: BE1 이슈 **미생성** (2026-09-10). 이슈 생성 후 여기에 키를 적고 T020·T021 의 선행을 그 키로 바꾼다. ⚠️ 키가 비는 동안 FR-010 은 실효 커버리지가 없다

**Checkpoint**: T004·T005는 B6까지 blocked. **T006은 BE1 이관 대상**(이슈 키 미정) — 열리기 전에는 T020(A7)·T021(A8)의 계약 코드 검증을 할 수 없다. US 종단 흐름은 T004·T005 해소에 의존.

---

## Phase 3: User Story 1 — 중심좌표 주변 구역 대표곡 (Priority: P1) 🎯 MVP

**Goal** ⟲ *D15*: 레벨 → 해당 PC 축 쌍 평면의 **격자 구역별 대표곡** 반환. 1레이어 정적, 2레이어 이후 실시간.
*(원안: 이동 원형 영역에서 `youtubeCnt` DESC 상위 k)*

**Independent Test**: 순수 조건 변환(A9/A10)과 선정 정렬(A14 부분)을 DB 없이 검증; 성공 응답 필드·고정 좌표(A2)를 MVC 슬라이스로 검증.

### 지금 착수 가능 (미정 정책·인프라 독립; `backend/` 경로에 배치)

- [X] T007 (2026-09-10 완료) [P] [US1] `MajorQueryResolver` 구현: level n → 축 번호 (2n-1, 2n), 해당 축 중심 추출. 순수 함수(DB·HTTP 비의존). 레벨 상한·생략 검증 미포함(B1) (`backend/src/main/java/com/ssafy/backend/music/service/MajorQueryResolver.java`)
- [X] T008 (2026-09-10 완료: 4 tests) [P] [US1] Resolver 단위테스트 A9/A10: level=1→pc1·pc2, level=2→pc3·pc4, 이전 단계 중심으로 해석 안 함 (`backend/src/test/java/com/ssafy/backend/music/MajorQueryResolverTests.java`)
- [X] T009 (2026-09-10 완료) [P] [US1] 대표곡 선정 순수 로직: 후보 리스트에 `youtubeCnt` DESC 정렬 후 상위 k. **k는 주입 파라미터**(하드코딩 금지, B4). `playCnt`·재생 링크로 순위 변경 안 함. 동률·null·부족 미포함(B4) (`backend/src/main/java/com/ssafy/backend/music/service/MajorSelection.java`)
- [X] T010 (2026-09-10 완료: 3 tests) [P] [US1] 선정 단위테스트 A14: 후보 조회수 [300,100,200], k=2 → [300,200]; `playCnt` 역순이어도 순서 불변 (`backend/src/test/java/com/ssafy/backend/music/MajorSelectionTests.java`)
- [X] T011 (2026-09-10 완료: `major_successItem_carriesAllContractFieldsAndBaselineCoordinates` — §0.6 12필드 + pc1~pc16 전부) [US1] MVC 슬라이스 테스트 A2: 성공 항목이 §0.6 필드 전부 포함, `location.pc1`~`pc16`이 곡 기준선 좌표와 일치 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [X] T012 (2026-09-10 완료: `major_itemWithoutYoutubeUrl_isKeptWithNullPreserved`) [US1] MVC 슬라이스 테스트 A3: `youtubeUrl: null`이어도 항목 유지·null 보존 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)

### 게이트 대기

- [ ] T013 ⟲**D15 재정의** [BLOCKED: B2] [US1] ~~`MajorSelectionPolicy`: 레벨별 서버 반경 + 원형 내부 판정~~ → **격자 구역 판정**(격자 단위·칸 경계·칸별 선정 규칙). 원안 문구는 롤백용으로 남긴다 (`backend/src/main/java/com/ssafy/backend/music/service/MajorSelectionPolicy.java`)
- [ ] T014 [BLOCKED: B3] [US1] 장르·이전 PC 선택 누적 제약을 현재 한 쌍 요청과 연결. 제약 미확보 시 전역 후보 축소 금지. 신규 세션/파라미터 임의 추가 금지 (`backend/src/main/java/com/ssafy/backend/music/service/`)
- [ ] T015 [BLOCKED: B2/B3/B4/B6] [US1] `MusicService.getMajor` orchestration으로 미구현 예외 교체: 정책 조회 → 조건 변환 → Reader 호출 → 순위 보존 조립 (`backend/src/main/java/com/ssafy/backend/music/service/MusicService.java`)
- [ ] T016 ⟲**D15 재정의** [BLOCKED: B2] [US1] `MajorTrackReader` 어댑터 구현(MyBatis mapper): ~~"원형 내부" 후보에 `youtubeCnt` DESC top-k~~ → **1레이어는 `map_sample` 정적 조회, 2레이어 이후는 `point(...) <@ box(...)` + GiST 인덱스**(data 스펙 16 `map_layer_queries.sql` 이 질의 형태·함정 제공). 전역 선절단·ANN 대체 금지는 유지. **B6 는 해소됨**(DB 적재 완료, 조회 계약 문서화) (`backend/src/main/java/com/ssafy/backend/music/retrieval/`, `backend/src/main/resources/mapper/`)
- [ ] T017 ⟲**D15 보류** [BLOCKED: B2] [US1] ~~통합 테스트 A11/A12/A13~~ — A11~A14 가 D15 로 보류돼 대상이 없다. **SC-002(동일 버전 좌표 불변, 차이 0)는 유효**하므로 그 부분만 먼저 할 수 있다. 격자 모델의 새 수용 기준이 정해지면 그때 확장. 실 postgres fixture 사용 가능(DB 적재 완료) (`backend/src/test/java/com/ssafy/backend/music/`)

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

- [ ] T020 [US3] **부분 완료** — `major_invalidLevel_/nonNumericLevel_returnsInvalidInput`이 400은 확인하나 코드가 master `INVALID_INPUT`이라 계약 코드(M4) 불일치. MVC 슬라이스 테스트 A7: `level=abc` 및 PC 필드에 `abc` → 400 `VALIDATION_ERROR` + 공통 실패 구조. **T006(BE1 이관, 이슈 키 미정) 선행**(master 기본 핸들러엔 없음, M5) (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T021 [US3] MVC 슬라이스 테스트 A8: 서비스 내부 실패 → 500 `INTERNAL_ERROR` + 공통 실패 구조. `MusicService` mock이 예외 throw. ⚠️ **T006(BE1 이관, 이슈 키 미정) 선행 필수**: master generic 핸들러는 `INTERNAL_SERVER_ERROR`를 반환하므로(M4/F1) 매핑 없이는 계약 코드 불일치로 실패 (`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)
- [ ] T022 [BLOCKED: T030] **(부분 착수 가능 — T029 dev 해소로 토큰 없음·위조는 지금 검증 가능, 만료만 T030 대기)** [US3] 인증 테스트 A6: 토큰 위조·무효 → 401 `INVALID_TOKEN`, 만료 → 401 `TOKEN_EXPIRED`, 토큰 없음 → 401 상태·공통 실패. 인증 연동(T006) 후 (`backend/src/test/java/com/ssafy/backend/music/`)

**Checkpoint**: A7·A8은 T020·T021로 검증(T006의 검증 핸들러 보완 전제). 401(A6)은 인증 통합 후.

---

## Phase 6: Polish & Cross-Cutting

- [X] T023 (2026-09-10 부분 완료: `ObservabilityTests` 2 tests — prometheus `http_server_requests_seconds` + `_bucket` 노출, `env`/`configprops` 비노출·JWT secret 미포함. **대표곡 '반환 수' 지표는 성공 경로가 없어 T015 로 이월**) [P] 관측: 요청 수·지연·오류·반환 수 지표 노출. master가 `http.server.requests` 히스토그램 이미 활성(M7) → 재사용. 로그·지표에 비밀/불필요 PII 제외(SC-004) (`backend/src/main/java/com/ssafy/backend/music/`, `backend/src/main/resources/application.yml`)
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
- **master 통합 재검증 (M 항목)** — plan.md 에 절이 없으므로 이 파일에서 인용하는 것만 정의한다.
  - **M4** 문서 충돌: master 전역 에러 코드(`INVALID_INPUT`/`INTERNAL_SERVER_ERROR`)가 api-spec §0.5(`VALIDATION_ERROR`/`INTERNAL_ERROR`)와 다르다. music 은 자체 `ErrorCode` 구현으로 계약 준수, 전역 정합은 BE1 결정(T006).
  - **M5**: master `GlobalExceptionHandler` 에 검증 예외 → 계약 코드 매핑이 없다.
  - **M7**: master 가 `http.server.requests` 히스토그램을 이미 켜뒀다(`application.yml`).
  - **M8**: master 는 Lombok DTO 관례, music 은 record. 팀 확인 대상.
  - M1~M3·M6 은 이 파일에서 인용하지 않는다. 필요하면 S15P21A405-115 작업 기록에서 확인.
- 정확한 대표곡 ID·k·동률 순서·빈 결과 기대값은 B2~B4 확정 후 fixture로 보완. 지금은 정렬 규칙·축 매핑·응답 구조만 확정 검증.

---

## Phase 7: Convergence

**Input**: 2026-09-10 코드 대조. master 병합으로 들어온 인증 인프라
(`SecurityConfig`·`JwtAuthenticationFilter`·`JwtTokenProvider`·`AuthErrorCode`)에 대해 새로 드러난 계약 공백만 기록한다.
기존 미완 태스크(T004~T017·T019~T027)는 그대로 유효하며 중복 기재하지 않는다.

> 🔄 **2026-09-10 후반 갱신 — `origin/backend/dev` 19커밋 위로 리베이스**. 기준선 `./gradlew test` **113 tests / 0 failures**
> (내 것 14건 + dev 의 auth·user·playlist 99건). dev 가 가져온 변화:
> - `c820b53` 인증 정책을 **기본 거부**로 전환(S15P21A405-33, 정본 §0.7) → `/music/**` 인증 필요. **T029 해소**
> - `AuthErrorCode` 확장(`OAUTH_FAILED`·`EMAIL_ALREADY_EXISTS` 등) — 단 `TOKEN_EXPIRED` 는 여전히 없음 → T030 유효
> - `GlobalErrorCode` 에 `FORBIDDEN` 추가(§0.5 이름). 옛 코드(`INVALID_INPUT`/`INTERNAL_SERVER_ERROR`) 참조는 **12파일**로 증가
> - M4 정합 커밋은 이 브랜치에서 **제외**했다(BE1 이 같은 파일 활발히 편집 중) → T006·T020·T021 미완 복귀

- [X] T028 (2026-09-10 완료: `major_level0_currentMinConstraintRejects_provisionalUntilB1` 로 개명 + 잠정 검증 javadoc. 커버리지 유지) **CRITICAL** `major_invalidLevel_returnsInvalidInput`(`backend/src/test/java/com/ssafy/backend/music/MusicControllerTests.java`)이 `level=0 → 400`을 확정 기대값으로 단언한다. spec Edge Cases는 레벨 하한을 P1 미정으로 두고 `@Min(1)`을 정책 근거로 쓰지 말라고 명시했다. 해당 단언을 B1 의존 잠정 검증으로 표시하거나 기대값을 B1 확정까지 보류로 분리한다. 커버리지 자체를 삭제하지 않는다 per Constitution IX (contradicts)
- [X] T029 (2026-09-10 **dev 가 해소** — `c820b53 fix: 인증 정책을 화이트리스트에서 기본 거부로 전환 [S15P21A405-33]`. `SecurityConfig` 가 로그인·재발급·OAuth·`/actuator/health,prometheus` 만 `permitAll()` 이고 `anyRequest().authenticated()` 라 `/music/**` 은 인증 필요. BE2 가 할 일 없음) `/music/major`가 `SecurityConfig`의 `anyRequest().permitAll()`에 걸려 인증 없이 호출된다. FR-002는 `Authorization: Bearer` 요구를 MUST로 규정한다. `/music/**` 인증 요구 여부를 BE1·infra와 합의하고 매처에 반영한다. `SecurityConfig`는 BE2 소유가 아니므로 합의 전 임의 수정하지 않는다 per FR-002 (contradicts)
- [ ] T030 (2026-09-10 후반 재확인: dev 가 `AuthErrorCode` 를 `OAUTH_FAILED`·`EMAIL_ALREADY_EXISTS`·`INVALID_CREDENTIALS` 등으로 확장했으나 **`TOKEN_EXPIRED` 는 여전히 없다**. 유효) `AuthErrorCode`에 `TOKEN_EXPIRED`가 없고 `JwtAuthenticationFilter:54`가 `JwtException`을 한 덩어리로 잡아 만료와 위조를 구분하지 않는다. A6은 만료 → 401 `TOKEN_EXPIRED`, 위조·무효 → 401 `INVALID_TOKEN`을 요구한다. 만료 예외 분기와 코드를 추가한다(공통 계층이므로 BE1 합의 대상) per US3/A6 · FR-010 (partial)
- [X] T031 (2026-09-10 판정 완료 — 아래) plan "보류 항목" B5는 Core 인증 미연동을 전제로 기술돼 있으나 인증 인프라는 이미 저장소에 있다. B5 잔여 미정이 무엇인지(토큰 없음 세부 코드·`genres`/null 표현) 재확정하고 T022(A6 인증 테스트) 착수 가능 여부를 판정한다. plan.md 수정은 별도 합의 후 per plan: B5 게이트 (partial)

### T031 판정 결과 (2026-09-10) — B5 재분해

master 병합 후 실제로 남은 미정은 B5 전체가 아니다. plan.md 는 합의 후 갱신 대상이며 여기서는 판정만 기록한다.

| B5 하위 | 상태 | 근거 |
|---|---|---|
| Core 인증 연동 | **해소** (2026-09-10 후반) | `c820b53` 이 기본 거부로 전환. `SecurityConfig` 가 `anyRequest().authenticated()` 라 `/music/**` 에 인증이 걸린다 → T029 종료 |
| 토큰 없음 세부 코드 | **해소** | 코드가 `AuthErrorCode.UNAUTHENTICATED` 로 401 + 공통 실패 구조를 반환. spec A6 은 "토큰 없음은 상태·공통 실패 구조까지만 검증" 이라 이 수준으로 충분 |
| 위조·무효 → `INVALID_TOKEN` | **해소** | `AuthErrorCode.INVALID_TOKEN` 존재 |
| 만료 → `TOKEN_EXPIRED` | 미해소 | 코드 부재 + `JwtAuthenticationFilter:54` 가 `JwtException` 일괄 catch → T030 |
| DTO `genres`/null/정수 표현 범위 | 미해소 (P3-c) | 원문에 필수/null 제약 미명시. B5 잔여는 이것뿐 |

**T022 재정의**: blocker 는 "B5" 가 아니라 **T030(만료 코드) 하나**다.
T029 는 dev 가 해소했으므로 A6 의 **토큰 없음·위조 부분은 지금 착수 가능**하고, 만료 케이스만 T030 이후다.

---

## Phase 8: Convergence

**Input**: 2026-09-10 후반, 리베이스(`origin/backend/dev` 19커밋)와 문서 정합 커밋(`49509e2`) 이후 재대조.
기준선 `./gradlew test` 113 tests / 0 failures. **코드 쪽 신규 gap 없음** — 실질 미충족은
T006·T013~T017·T019·T020~T022·T024~T027·T030 이 이미 잡고 있어 중복 기재하지 않는다.
이번 findings 는 전부 plan.md Source Code 구조표가 구현 상태를 못 따라간 드리프트다.

- [ ] T032 plan.md Source Code 산문이 "아래 표의 `MajorQueryResolver`·`MajorSelection` 은 구현됐고" 라고 하지만 표에 `MajorSelection` 행이 없고 `MajorQueryResolver.java` 는 `(제안)` 표기 그대로다. 산문과 표를 일치시키고 구현 완료를 표기한다 per plan: Source Code structure (contradicts)
- [ ] T033 구현된 `backend/src/main/java/com/ssafy/backend/music/service/MajorSelection.java`(T009)를 plan.md 구조표에 행으로 추가한다. 표의 `MajorSelectionPolicy.java (제안)` 는 별개 파일(T013, B2 대기)이므로 대체하지 않는다 per plan: Source Code structure · T009 (partial)
- [ ] T034 `ObservabilityTests.java` 가 `backend/src/test/java/com/ssafy/backend/`(루트 패키지)에 있는데 plan 구조표의 테스트 경로는 `.../com/ssafy/backend/music/` 다. 기능 경계를 넘는 전역 관측 테스트라 위치는 타당하므로, 표에 전역 테스트 행을 넣거나 위치 근거를 명시한다 per plan: Source Code structure · T023 (partial)
- [ ] T035 plan.md 구조표의 경로 표기가 재배치 전 형태(`src/test/java/...`, `music/controller/...`)로 남아 있다. 그 위 산문만 `backend/` 로 갱신됐으므로 표 경로에도 접두를 반영한다 per plan: Source Code structure (partial)

---

## D15 영향 요약 (2026-09-11) — 조회 구역 모델 변경

spec FR-012·FR-013 이 **격자 모델**로 개정됐다(팀 결정: FE 구현 방식 채택). 롤백 조건과 원안 전문은
[spec.md "대체된 요구사항 — 롤백 기록"](spec.md) 절에 있다. 태스크 영향은 아래가 전부다.

| 태스크 | 영향 |
|---|---|
| T013 | ⟲ 재정의 — 서버 반경·원형 판정 → 격자 구역 판정 |
| T016 | ⟲ 재정의 — 원형 top-k → `map_sample` 정적 + `<@ box` 실시간. **B6 해소로 B2 만 남음** |
| T017 | ⟲ 보류 — A11~A13 이 보류라 대상 없음. SC-002 부분만 유효 |
| T019 | level=1 조회 대상이 `map_sample` 로 해소 후보 |
| T009·T010 | `MajorSelection.topByYoutubeCnt` 는 **원안 전용**이 됐다. 삭제하지 않는다 — 롤백 자산이고, 인기 지표가 채워지면 그대로 쓴다 |
| T025 | k 계약이 "격자 칸 수"로 바뀔 수 있다(1레이어 실측 1,094칸) |
| T007·T008 | 영향 없음 — 레벨→PC 축 쌍 매핑(FR-003)은 D15 에서 그대로 유지 |

**새로 열린 것**: DB 적재 완료(662만행)와 data 의 조회 계약 문서화로 **B6 가 해소**됐다.
남은 게이트는 B1(입력 검증)·B2(격자 파라미터·선정 규칙)·B3(누적 제약)·B4(결과 계약)다.

## D16 영향 (2026-09-11) — 격자 단위 = 화면 픽셀 기준

미정 1번을 **FE 기준**으로 확정했다. 귀결로 서버·클라이언트 역할이 갈렸다.

| | 서버 | 클라이언트 |
|---|---|---|
| 하는 일 | 레이어 **상주 집합**을 공간 균등하게 반환 | 화면 86px 격자에서 **인기순 대표 선별** |
| 격자 | 샘플링 수단으로만 사용 (칸 중심 최근접) | 표시 규칙 (칸 내 1위를 크게) |

**같이 닫힌 미정 2건**: 칸별 선정 규칙 충돌(서버는 균등·FE 는 인기 — 층위가 달라 경쟁 아님),
격자 대표곡 vs 상주 집합 동봉 여부(상주 집합이 곧 응답).

**태스크 영향**
- T013 격자 구역 판정 → **상주 집합 샘플링**으로 다시 좁혀진다. 화면 격자 로직은 서버에 두지 않는다
- T016 1레이어 `map_sample` 정적 조회는 유지. 단 그 테이블의 의미가 "대표곡"이 아니라 **"상주 집합"** 이다
- T009·T010 `MajorSelection.topByYoutubeCnt` — 인기순 선별이 클라이언트로 가면서 서버 요구에서 빠졌다.
  롤백 자산으로 유지(D15 롤백 시 복귀)
- T025 k 계약 → "상위 k" 가 아니라 **상주 집합 크기**(FE 전제 1000 vs data 실측 1,094)

⚠️ **이 귀결이 의도와 다르면 D15 의 "1레이어 정적 서빙" 을 다시 열어야 한다.** 서버가 화면 격자로
대표곡을 고르려면 요청마다 줌 배율을 받아야 하고 20,941 ms 전역 집계가 되살아난다.

## D17 영향 (2026-09-11) — 선별 재료는 제공, 선별 규칙은 유예

`weight` 필드를 응답에 **포함**한다. 현재 값은 0/균일(인기 지표 부재), 지표 확보 시 **서버만** 채운다.
어떤 규칙으로 쓸지는 클라이언트 결정이라 서버 계약에 영향이 없다.

- T016 어댑터는 `weight` 를 응답에 싣는다. 소스 컬럼이 정해지기 전에는 상수로 채운다 —
  **하드코딩 금지 대상이 아니다.** 미정 정책의 기본값이 아니라 "데이터 부재"라는 확정된 사실의 표현이다
- T025 응답 계약에 `weight` 포함을 명시. 나중에 값만 바뀌므로 스키마 변경이 아니다
- 지표가 생기면 열리는 후속: `weight` 소스 컬럼 지정 + 채우기 (서버 단독, FE 무변경)

**알려진 한계**: `weight` 가 균일한 동안 칸 승자가 임의로 정해진다. 레이아웃은 유지되고 의미만 빈다.

---

## 미정 현황 (2026-09-11 기준)

| # | 항목 | 상태 |
|---|---|---|
| 1 | 격자 단위 | ✅ **D16** — 화면 픽셀 기준, 서버는 격자 미적용 |
| 2 | 칸별 선정 규칙 | ✅ **D16** — 층위 분리로 해소(서버 공간 균등 / 클라이언트 인기순) |
| 3 | 격자 대표곡 vs 상주 집합 | ✅ **D16** — 상주 집합이 곧 응답 |
| 4 | `weight` 출처 | ✅ **D17** — 필드 포함, 값은 유예 |
| 5 | 응답 항목 필드 구성 | ✅ **D18** — FE `MapPoint` |
| 7 | 상주 집합 크기 | ✅ **D18** — 1000 은 규모 기준, 정확한 수 강제 안 함 |
| 6 | 2레이어 이후 영역 파라미터 | 🔴 미정 — 사각 범위 경계 vs 중심좌표 |
| 8 | **`genreId` 채우기** | 🔴 **신규** — D18 이 열었다 |

B1(입력 검증)·B3(누적 제약)·M4(에러 코드)·T030(`TOKEN_EXPIRED`)은 이 목록과 별개로 남아 있다.

## D18 영향 (2026-09-11) — 응답 계약 = FE MapPoint

응답 항목: `musicId`·`pc[16]`·`genreId`·`weight`·`title`·`artist`·`playable`.
`ghostOnly` 는 보내지 않는다(FE 타입이 목 전용이라 명시). `MusicDetail` 상세 필드는 `/music/{id}` 담당.
상주 집합 크기는 1000 **규모** 기준 — FE 렌더링 로직이 이 상수를 쓰지 않아 1,094 도 허용된다.

- T016 어댑터가 반환할 필드가 확정됐다. `map_sample` 은 `(music_id, x, y, title, artist)` 뿐이라
  `pc[16]`·`genreId`·`weight`·`playable` 을 어디서 채울지 정해야 한다 — `music` 조인이 필요하면 0.4 ms 이점을 재측정할 것
- T025 응답 계약을 `MapPoint` 로 고정. 페이지 계약은 해당 없음(상주 집합 전체 반환)
- `playable` 은 현재 전부 false (`youtube_url` 전 행 NULL). 검색 URL 생성은 D12 로 BE 이관됐으나 담당 태스크가 없다

### 🔴 신규 미정 8 — `genreId`

D18 을 채택하면서 드러났다. 셋이 얽혀 있다.

| | 내용 |
|---|---|
| 커버리지 | 장르 있는 곡이 **1.0%** (662만 중 6.6만). 나머지 99% 는 값이 없다 |
| 매핑 | data 는 멜론 코드 **29종**(`GN0100` 등), FE `GENRE_COLORS` 는 **10색 인덱스**. 29→10 대응표가 없다 |
| 안전성 | **음수를 보내면 FE 가 죽는다.** `draw-map.ts` 의 `spr[s.genreId % GENRE_COLORS.length]` 는 raw modulo — `-1 % 10 = -1` → `spr[-1]` undefined → `drawImage` 예외. `genreRgb` 만 `Math.abs` 로 보호돼 있다 |

최소 요구: **비음수 정수**(MUST). 99% 를 0으로 채우면 전부 "앰비언트" 색이 된다.
별도 "무장르" 색 인덱스를 추가하려면 FE 변경이 필요하다. FE1 과 정해야 한다.
