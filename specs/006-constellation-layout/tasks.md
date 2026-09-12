---

description: "Task list — 별자리 배치 (musicIds → 2D 고정 좌표)"
---

# Tasks: 별자리 배치 (musicIds → 2D 고정 좌표)

**Input**: Design documents from `specs/006-constellation-layout/`

**Jira**: S15P21A405-265 | **Branch**: `backend/feat/S15P21A405-265-constellation-layout-api`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/constellation-layout.md), [quickstart.md](quickstart.md)

**Tests**: 포함한다. spec 의 Acceptance Criteria 가 "관련 테스트가 통과한다" 를 요구하고, 헌법 III(완료 전 검증)이 의무다. 결정성(FR-004~006)은 테스트 없이 확인할 방법이 없다.

**Organization**: 사용자 스토리별로 묶었다. US1 만 끝내도 별자리 오버레이가 서버 좌표로 돈다.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 병렬 가능 (다른 파일, 미완료 선행 작업 없음)
- **[Story]**: US1(같은 집합=같은 모양) · US2(플레이리스트) · US3(오류 구분)
- 경로는 저장소 루트 기준

---

## Phase 1: Setup

**Purpose**: 신규 의존성·설정·마이그레이션이 **없다.** 기존 `backend/` 모듈에 클래스를 더하는 작업이다. 시작 시점이 그린인지만 확인한다.

- [X] T001 `backend/` 에서 `./gradlew test` 를 실행해 기준선이 통과 상태인지 확인한다 (이후 실패가 이번 변경 탓인지 구분하기 위함)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 없다. US1 과 US2 가 공유하는 선행 작업이 없어 이 단계를 비운다.

**주의 (블로커 아님)**: US1 과 US2 가 `MusicDetailMapper.java` · `MusicDetailMapper.xml` 을 각각 건드린다. 질의가 달라(좌표만 vs 상세 전체) 충돌하지 않지만, 두 스토리를 동시에 진행하면 같은 파일을 만진다.

**Checkpoint**: 바로 US1 을 시작할 수 있다.

---

## Phase 3: User Story 1 - 같은 곡 집합은 누구에게나 같은 모양 (Priority: P1) 🎯 MVP

**Goal**: `POST /api/constellations/layout` 이 곡 id 목록을 받아 `-1~1` 정규화 2D 좌표를 내려준다. 같은 집합이면 언제·누가 불러도 같은 좌표다.

**Independent Test**: 같은 `musicIds` 로 두 번, 그리고 순서를 섞어 한 번 더 호출해 곡별 `x`·`y` 가 모두 같은지 확인한다 ([quickstart.md](quickstart.md) Q1~Q3, Q14, Q15).

### Tests for User Story 1 ⚠️

> 먼저 쓰고, **실패하는 것을 확인한 뒤** 구현한다.

- [X] T002 [P] [US1] 투영 단위 테스트 Q1~Q8(결정성·순서 무관·정규화·퇴화·부호 골든·입력 불변)을 `backend/src/test/java/com/ssafy/backend/music/constellation/PlanarProjectionTests.java` 에 작성
- [X] T003 [P] [US1] 서비스 테스트 Q9(순서대로 4점)·Q10(reader 호출 1회)·Q13(reader 미주입 시 명시적 실패)을 `backend/src/test/java/com/ssafy/backend/music/ConstellationServiceTests.java` 에 작성 — reader 는 호출 횟수를 세는 fake 로 둔다
- [X] T004 [P] [US1] 컨트롤러 테스트 Q14(200 응답 봉투)·Q15(본문에 `points` 를 실어도 응답 동일)를 `backend/src/test/java/com/ssafy/backend/music/ConstellationControllerTests.java` 에 작성 — standalone MockMvc + `GlobalExceptionHandler`
- [X] T005 [P] [US1] 어댑터 테스트 Q18(매퍼 1회 호출)·Q19(없는 id 는 키가 빠진다)를 `backend/src/test/java/com/ssafy/backend/music/MusicDetailReaderAdapterTests.java` 에 추가

### Implementation for User Story 1

- [X] T006 [P] [US1] `ConstellationPoint` record(`musicId`, `x`, `y`)를 `backend/src/main/java/com/ssafy/backend/music/dto/ConstellationPoint.java` 에 생성 — 프론트 `types/constellation.ts` 와 필드명이 같아야 한다
- [X] T007 [P] [US1] `ConstellationLayoutResponse` record(`points`)를 `backend/src/main/java/com/ssafy/backend/music/dto/ConstellationLayoutResponse.java` 에 생성
- [X] T008 [P] [US1] `ConstellationLayoutRequest` record(`musicIds`)를 `backend/src/main/java/com/ssafy/backend/music/dto/ConstellationLayoutRequest.java` 에 생성 — 검증 규칙은 T020 에서 붙인다. 요청 본문의 `points` 는 매핑하지 않는다(FR-003)
- [X] T009 [US1] `PlanarProjection` 골격을 `backend/src/main/java/com/ssafy/backend/music/constellation/PlanarProjection.java` 에 생성 — `musicId` 오름차순 정렬(R2) → 차원별 평균 제거 → 16×16 공분산 `C = XᵀX / n`. Spring 의존 없음
- [X] T010 [US1] 같은 파일에 Jacobi 회전 고유분해를 구현 — 비대각 성분 기준 수렴 판정, 고유값 내림차순(동률이면 인덱스 오름차순)으로 상위 2개 선택. 동률 시 축 선택이 임의라는 한계를 주석으로 남긴다(R1, R3)
- [X] T011 [US1] 같은 파일에 부호 규약(절댓값 최대 성분을 양수로, 동률이면 낮은 인덱스)·투영·정규화를 구현 — `x`·`y` 에 **공통** `span` 적용, `span < 1e-9` 면 전부 `(0,0)` (R3, R4, FR-007, FR-008)
- [X] T012 [US1] `findLocationsByIds(List<Long> ids)` 를 `backend/src/main/java/com/ssafy/backend/music/mapper/MusicDetailMapper.java` 에 선언
- [X] T013 [US1] `id IN (...)` 좌표 조회 select 를 `backend/src/main/resources/mapper/music/MusicDetailMapper.xml` 에 추가 — 기존 `locationColumns` 조각 재사용, `resultType` 은 `MusicDetailRow`, 제목·아티스트·장르는 읽지 않는다 (R5)
- [X] T014 [US1] `Map<Long, Location> findLocationsByIds(List<Long> ids)` 계약을 `backend/src/main/java/com/ssafy/backend/music/detail/MusicDetailReader.java` 에 추가 — 한 번의 조회, 없는 id 는 키가 빠진다(예외 아님), 부수효과 없음, 최대 30건을 javadoc 에 명시
- [X] T015 [US1] 위 계약을 `backend/src/main/java/com/ssafy/backend/music/detail/MusicDetailReaderAdapter.java` 에 구현 — `MusicDetailRow.toLocation()` 재사용, 빈 입력이면 매퍼를 부르지 않는다
- [X] T016 [US1] `ConstellationService` 를 `backend/src/main/java/com/ssafy/backend/music/service/ConstellationService.java` 에 생성 — reader 로 좌표 일괄 조회 → `PlanarProjection` 투영 → 요청 순서대로 `points` 조립(FR-009). reader 는 기존 패턴대로 `Optional` 주입
- [X] T017 [US1] `ConstellationController` 를 `backend/src/main/java/com/ssafy/backend/music/controller/ConstellationController.java` 에 생성 — `POST /api/constellations/layout`, `ApiResponse.success(...)`, `@Tag` 로 Swagger 노출

**Checkpoint**: 같은 곡 집합이 항상 같은 좌표를 내려준다. 프론트가 목 라우트만 걷어내면 서버 좌표로 별자리가 그려진다.

---

## Phase 4: User Story 3 - 모양을 만들 수 없는 요청 (Priority: P2)

**Goal**: 400(요청이 틀림)과 404(곡이 없음)를 구분해 내려준다. 부분 배치를 200 으로 내지 않는다.

**Independent Test**: 곡 1개·31개·중복·없는 id 로 각각 호출해 상태코드와 `error.code` 를 확인한다 (Q11, Q12, Q16, Q17).

**우선순위 메모**: spec 상 US2 와 같은 P2 다. US3 은 US1 과 같은 파일을 만지므로 US1 직후가 가장 싸서 먼저 둔다.

### Tests for User Story 3 ⚠️

- [X] T018 [P] [US3] 서비스 오류 테스트 Q11(4곡 중 3곡만 조회되면 `MUSIC_NOT_FOUND`, 부분 결과 금지)·Q12(1개·빈 배열·31개·중복 → `INVALID_INPUT`)를 `backend/src/test/java/com/ssafy/backend/music/ConstellationServiceTests.java` 에 추가
- [X] T019 [P] [US3] 컨트롤러 오류 테스트 Q16(`musicIds` 누락 → 400)·Q17(없는 곡 → 404, `data:null`)을 `backend/src/test/java/com/ssafy/backend/music/ConstellationControllerTests.java` 에 추가

### Implementation for User Story 3

- [X] T020 [US3] `backend/src/main/java/com/ssafy/backend/music/dto/ConstellationLayoutRequest.java` 에 검증 추가 — `@NotNull`, `@Size(min=2, max=30)`, 원소 `@Min(1)`. 중복 검사는 애너테이션으로 안 되므로 서비스에서 한다
- [X] T021 [US3] `backend/src/main/java/com/ssafy/backend/music/service/ConstellationService.java` 에 중복 id 검사(→ `GlobalErrorCode.INVALID_INPUT`)와 누락 id 판정(요청 id − 조회된 키 ≠ ∅ → `MusicErrorCode.MUSIC_NOT_FOUND`) 추가 — 새 오류 코드를 만들지 않는다
- [X] T022 [US3] `backend/src/main/java/com/ssafy/backend/common/GlobalExceptionHandler.java` 를 읽어 `@Valid` 위반이 400 `INVALID_INPUT` 으로 변환되는지 확인 — 이미 처리하면 변경 없음, 아니면 이 기능에 필요한 분기만 추가

**Checkpoint**: 잘못된 요청이 500 으로 떨어지지 않고 400/404 로 구분된다 (SC-006).

---

## Phase 5: User Story 2 - 플레이리스트 별자리 (Priority: P2)

**Goal**: 30곡 플레이리스트 상세가 곡 조회 1회로 끝난다. 좌표는 이미 내려가고 있으므로 **남은 것은 성능뿐이다.**

**Independent Test**: 30곡 플레이리스트 상세 조회에서 곡 조회 왕복이 1회인지, `musics` 가 저장된 순서를 유지하는지 확인한다.

**소유권**: `backend/.../playlist/` 는 BE1(박준서) 소유지만 2026-09-13 합의로 이번 이슈 범위에 포함한다(헌법 X). **커밋을 분리한다** — 리뷰어가 `playlist/` 변경만 따로 보고, 문제가 생기면 배치 API 를 건드리지 않고 되돌릴 수 있어야 한다.

- [X] T023 [US2] `playlist/` 수정 합의(2026-09-13)를 S15P21A405-265 코멘트로 남겨 MR 리뷰어가 근거를 볼 수 있게 한다
- [X] T024 [P] [US2] 왕복 1회·순서 유지 테스트를 `backend/src/test/java/com/ssafy/backend/playlist/PlaylistServiceTests.java` 에 추가 — 호출 횟수를 세는 fake reader 로 30곡 상세 조회가 1회인지, `musics` 가 `position` 순인지 확인
- [X] T025 [US2] `findByIds(List<Long> ids)` 선언을 `backend/src/main/java/com/ssafy/backend/music/mapper/MusicDetailMapper.java` 에, `id IN (...)` 상세 select 를 `backend/src/main/resources/mapper/music/MusicDetailMapper.xml` 에 추가 — 기존 `findByMbids` 와 같은 컬럼 집합
- [X] T026 [US2] `List<MusicDetail> findDetailsByIds(List<Long> ids)` 를 `backend/src/main/java/com/ssafy/backend/music/detail/MusicDetailReader.java` 에 추가하고 `MusicDetailReaderAdapter.java` 에 구현 — **순서 미보장·없는 id 는 빠짐** 을 `JourneyTrackReader` 와 같은 문구로 javadoc 에 명시
- [X] T027 [US2] `backend/src/main/java/com/ssafy/backend/playlist/service/PlaylistService.java` 의 `loadMusicDetails` 를 일괄 조회로 바꾸고 `musicIds` 순서로 재조립 — US1 과 **커밋을 분리한다**

**Checkpoint**: 플레이리스트 상세가 곡 수와 무관하게 DB 1왕복 (SC-004).

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T028 [P] `docs/rules/BACKEND-NOTES.md` 의 A-9 행을 갱신 — 상태 "협의 전" → 구현본, 요청·응답·오류를 확정값으로 교체하고 "요청 본문의 좌표는 쓰지 않는다" 를 명시
- [ ] T029 [P] `specs/006-constellation-layout/contracts/constellation-layout.md` §6 미결정(C-1 경로·C-2 상한·C-3 자릿수)을 MR 설명에 옮겨 FE1 확인을 요청한다
- [ ] T030 [quickstart.md](quickstart.md) 의 수동 확인 절차를 실제로 한 번 돌린다 — 같은 요청 2회 + 순서 섞은 1회의 곡별 좌표가 일치하는지
- [X] T031 `backend/` 에서 `./gradlew test` 와 `./gradlew build` 를 실행해 전체 통과를 확인한다 (CLAUDE.md §5 — 이것 없이 완료라고 하지 않는다)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: 선행 없음
- **Phase 2 (Foundational)**: 작업 없음 — 건너뛴다
- **Phase 3 (US1)**: Phase 1 이후. **MVP**
- **Phase 4 (US3)**: Phase 3 이후 (같은 서비스·컨트롤러·요청 DTO 파일을 만진다)
- **Phase 5 (US2)**: Phase 1 이후 착수 가능. US1·US3 과 독립이라 병렬 진행할 수 있다
- **Phase 6 (Polish)**: 진행하기로 한 스토리가 모두 끝난 뒤

### User Story Dependencies

- **US1 (P1)**: 다른 스토리에 의존하지 않는다. 이것만으로 배포 가능
- **US3 (P2)**: US1 의 서비스·컨트롤러가 있어야 오류 분기를 붙일 곳이 생긴다. 기능적으로는 US1 의 마감 작업
- **US2 (P2)**: US1·US3 과 코드가 겹치지 않는다(`playlist/` 와 `MusicDetailMapper` 의 다른 질의). 소유권 합의도 끝났다

### Within Each User Story

- 테스트를 먼저 쓰고 실패를 확인한 뒤 구현한다
- DTO → 계산(`PlanarProjection`) → 조회(mapper·reader) → 서비스 → 컨트롤러
- T009 → T010 → T011 은 **같은 파일**이라 순차다
- T012 → T013 → T014 → T015 는 선언 → SQL → 계약 → 구현 순서다

### Parallel Opportunities

- T002~T005: 테스트 4개, 모두 다른 파일 → 동시 가능
- T006~T008: DTO 3개, 모두 다른 파일 → 동시 가능
- T018·T019: 오류 테스트 2개, 다른 파일 → 동시 가능 (단 T003·T004 완료 후)
- T028·T029: 문서 2건 → 동시 가능
- US1(+US3) 과 US2 는 서로 다른 사람이 동시에 진행 가능 — 단 `MusicDetailMapper.xml` 을 둘 다 만진다

---

## Parallel Example: User Story 1

```bash
# 테스트 4개를 함께 (모두 다른 파일)
Task: "T002 PlanarProjectionTests 작성"
Task: "T003 ConstellationServiceTests 작성"
Task: "T004 ConstellationControllerTests 작성"
Task: "T005 MusicDetailReaderAdapterTests 에 Q18·Q19 추가"

# DTO 3개를 함께
Task: "T006 ConstellationPoint"
Task: "T007 ConstellationLayoutResponse"
Task: "T008 ConstellationLayoutRequest"
```

---

## Implementation Strategy

### MVP (US1 만)

1. Phase 1 → Phase 3
2. **멈추고 검증**: 같은 집합 2회 + 순서 섞은 1회 호출의 좌표 일치
3. 프론트에 "서버 배치 API 가 떴다, 목 라우트와 `points` 동봉을 빼도 된다" 통보
4. 이 시점에 배포 가능 — US3·US2 없이도 정상 경로가 돈다

### 증분 전달

1. US1 → MVP 배포
2. US3 → 오류 응답 정리 (같은 브랜치, 같은 MR)
3. US2 → 커밋 분리해서 진행 (`playlist/` 변경을 따로 볼 수 있게)

### 완료 보고 전

`./gradlew test` 와 `./gradlew build` 를 돌리고 결과를 그대로 적는다. 실패하면 실패했다고 쓴다. 건너뛴 Phase 가 있으면 무엇을 왜 건너뛰었는지 밝힌다.

---

## 실행 기록 (2026-09-13)

- **테스트를 구현보다 먼저 쓰지 않았다.** Phase 3 의 "먼저 쓰고 실패를 확인한 뒤 구현한다" 를 지키지 못했다 —
  구현(T006~T017)을 먼저 쓰고 테스트(T002~T005)를 뒤에 붙였다. 테스트가 실패하는 것을 본 적이 없으므로
  "테스트가 실제로 뭔가를 잡는다" 는 보장이 약하다. 결정성·순서 무관 테스트는 일부러 깨뜨려 확인해 볼 가치가 있다.
- T029(MR 설명)·T030(수동 확인)은 하지 않았다. 이유는 완료 보고 참조.
- 커밋은 아직 만들지 않았다. Phase 5 가 요구하는 `music/` ↔ `playlist/` 커밋 분리는 커밋 시점에 지켜야 한다.

---

## Notes

- `[P]` = 다른 파일, 선행 의존 없음
- 커밋 메시지에 Jira Key 를 넣는다: `feat: 별자리 배치 API 구현 [S15P21A405-265]`
- MR target 은 `backend/dev`
- 체크포인트에서 멈춰 스토리를 독립적으로 검증할 수 있다
