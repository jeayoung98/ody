# Tasks: 직접 그린 별자리 기반 플레이리스트 생성

**Input**: `specs/010-drawn-constellation-playlist/` — [plan.md](./plan.md) · [spec.md](./spec.md) · [research.md](./research.md) · [contracts/draw-match.md](./contracts/draw-match.md)

**Jira**: S15P21A405-598 · **Branch**: `backend/feat/S15P21A405-598-drawn-constellation-playlist`

**Tests**: 포함 — 헌법 III(완료 전 검증)과 SC-002·003·006 이 단위 테스트로만 검증 가능하다.

**범위**: 백엔드(`backend/`)만. US2(그림 편집)·US3(미리 듣기·저장 UI) 화면은 FE 파트 요청으로 끝난다 — 백엔드 코드 변경 없음.

경로 약어: `A = backend/src/main/java/com/ssafy/backend/artwork`, `T = backend/src/test/java/com/ssafy/backend/artwork`

## Phase 1: Setup

- [x] T001 브랜치가 최신 `origin/backend/dev` 를 포함하는지 확인하고 아니면 merge (`git merge --ff-only origin/backend/dev` 또는 일반 merge). 595 코드(`A/service/CatPlaylistGenerator.java`)가 있어야 한다
- [x] T002 `docs/rules/FEATURES.md` 변경 제안 #29 에 "자유 그리기(1-a, S15P21A405-598): `POST /api/artwork/draw`, 모양 일치도 점수, 생성·저장 분리" 를 덧붙인다 — 헌법 I. 기획(효정, 기획·구현 겸임) 결정으로 선행 구현, 2026-09-23 반영 완료

## Phase 2: Foundational (US1·US4 공통 선행)

- [x] T003 `A/service/CatPlaylistGenerator.java` 의 `generate()` 안 배치 탐색(상자 읽기 → `SCALES` 루프 → `place()` → 최소 오차 선택)을 `Placement match(List<double[]> points)` 로 추출한다. 입력은 -1~1·y 위 좌표. `generate()` 는 `match(template.points())` 를 부르고 외부 동작(응답·로그·예외)은 그대로다. 후보가 전부 사용 중이면 지금처럼 `IllegalStateException`
- [x] T004 기존 `T/CatPlaylistGeneratorTests.java` 7개가 T003 후에도 그대로 통과하는지 `./gradlew test --tests '*CatPlaylistGeneratorTests'` 로 확인 (리팩터 회귀 방지)

**Checkpoint**: 템플릿 생성 동작 불변, `match()` 재사용 가능

## Phase 3: User Story 1 — 별자리를 그려 곡 배치를 받는다 (P1) 🎯 MVP

**Goal**: `POST /api/artwork/draw` 가 점 3~20개를 받아 곡(중복 없음, 입력 순서) · layout 좌표 · 모양 일치도 점수 · 품질 단계를 돌려준다. 플리는 만들지 않는다.

**Independent Test**: 가상 격자 곡으로 5점 그림을 `draw` → 곡 5개 서로 다름·순서 유지·`ConstellationService.layout` 값과 같은 좌표·점수 0~100. 같은 그림의 이동·회전·확대본은 점수 차 ≤ 1.

### Tests

- [x] T005 [P] [US1] `T/ShapeScoreTests.java` 신규: (a) 삼각형·사각형·별·지그재그 각각 자기 자신과 비교 → 100, (b) 이동·회전(17°·90°·200°)·확대(0.5·2배) 변형본 → 점수 차 ≤ 1 (SC-003), (c) 좌우 반전(비대칭 도형 기준) → 점수가 원본보다 20 이상 낮다, (d) 잡음 σ 0.03/0.15/0.5(도형 RMS 반지름 대비 — 0.2 는 예상 점수 ≈72 로 경계에 너무 가까워 조정, 시드 고정 `new Random(0)`) → HIGH/MEDIUM/LOW (research R3), (e) 점 순서를 바꾸면 점수 하락 (FR-009)

### Implementation

- [x] T006 [P] [US1] `A/service/ShapeScore.java` 신규 순수 계산 클래스(Spring 의존 없음, `PlanarProjection` 과 같은 성격): `static int score(List<double[]> drawn, List<double[]> result)` — 각 점열을 중심 이동·프로베니우스 노름 1 로 맞추고 복소수 `a = Σ conj(u_i)·v_i`, `d = sqrt(max(0, 2 − 2|a|))`, `round(100·max(0, 1 − d))`. `static Quality quality(int score)` — `HIGH ≥ 90`, `MEDIUM ≥ 70`, 나머지 `LOW`. 경계 상수에 `ponytail:` 주석(근거 research R3, 조정은 운영 `그림 매칭` 로그 분포로). 노름 0(한 점에 몰림)은 호출 전에 막히므로 `IllegalArgumentException`
- [x] T007 [P] [US1] `A/dto/DrawRequest.java` 신규 record: `@NotNull @Size(min = 3, max = 20) List<@NotNull @Valid DrawPoint> points`, 내부 record `DrawPoint(@NotNull @DecimalMin("0") @DecimalMax("1") Double x, 같은 규칙 y)`. javadoc 에 좌표 규약(캔버스 0~1, x 오른쪽·y 아래) 명시
- [x] T008 [P] [US1] `A/dto/DrawResponse.java` 신규 record: `int score, String quality, List<ArtworkPoint> points` (`A/dto/ArtworkPoint.java` 재사용)
- [x] T009 [US1] `A/service/CatPlaylistGenerator.java` 에 `DrawResponse draw(List<DrawRequest.DrawPoint> points)` 추가: y 반전(`1 − y`) → 중심 이동 → 최대 절댓값 1 정규화 → `match()` → `constellationService.layout(musicIds)` → `ShapeScore.score(정규화 그림, layout 좌표)` → `DrawResponse`. 로그 `log.info("[Artwork] 그림 매칭 points={} score={} quality={} ms={}", ...)`. 플리 생성·제출 없음 (T006·T007·T008 선행)
- [x] T010 [US1] `T/CatPlaylistGeneratorTests.java` 에 draw 케이스 추가 (T009 선행. 기존 격자 가상 곡·매퍼 목 재사용): 곡 수 = 점 수, `musicId` 중복 없음, 응답 순서 = 입력 순서 (SC-002), 응답 `points` = 목 `ConstellationService.layout` 반환값 (FR-011), 같은 입력 두 번 → 같은 응답 (FR-012), `PlaylistService.create` 가 **호출되지 않음** (FR-020)
- [x] T011 [US1] `A/controller/ArtworkController.java` 에 `@PostMapping("/draw")` 추가: `@RequestBody @Valid DrawRequest` → `ApiResponse.success(catPlaylistGenerator.draw(...))`, **200**(생성 없음). `@Operation` 설명에 "플레이리스트를 만들지 않는다, 저장은 /playlist/create" 명시. 인증 필요(SecurityConfig permitAll 에 넣지 않음)

**Checkpoint**: T005·T010 통과 — US1 단독 시연 가능 (curl 로 draw)

## Phase 4: User Story 4 — 실패 원인을 구분해서 안다 (P2)

**Goal**: 입력 개수 부족·입력 모양 오류·처리 실패·기준 미달이 서로 다른 응답으로 구분된다.

**Independent Test**: 2점·21점 → 400 `INVALID_INPUT`, 한 점에 몰린 그림 → 400 `ARTWORK_DRAWING_DEGENERATE`, 잡음 큰 결과 → 200 + `quality: LOW`.

- [ ] T012 [P] [US4] `backend/src/main/java/com/ssafy/backend/common/ArtworkErrorCode.java` 에 `ARTWORK_DRAWING_DEGENERATE(HttpStatus.BAD_REQUEST, "ARTWORK_DRAWING_DEGENERATE", "점이 한 곳에 몰려 모양을 알 수 없습니다.")` 추가
- [ ] T013 [US4] `A/service/CatPlaylistGenerator.java` 의 `draw()` 맨 앞에서 bbox 긴 변(0~1 좌표 기준) `< 0.02` 이면 `CustomException(ArtworkErrorCode.ARTWORK_DRAWING_DEGENERATE)` (research R5). 상수에 이유 주석
- [ ] T014 [US4] `T/CatPlaylistGeneratorTests.java` 에 추가: 세 점이 0.01 안에 몰림 → `ARTWORK_DRAWING_DEGENERATE`, 일직선 세 점 → 정상 응답(Edge Case), 연속 두 점이 같은 자리 → 서로 다른 곡 2개(Edge Case)
- [ ] T015 [P] [US4] `T/DrawRequestValidationTests.java` 신규: `Validation.buildDefaultValidatorFactory()` 로 2점·21점·x=1.5·y=null → 위반 있음, 3점·20점 정상 → 위반 없음 (`GlobalExceptionHandler` 가 `INVALID_INPUT` 400 으로 바꾸는 경로는 기존 테스트가 커버)

**Checkpoint**: FR-016 네 갈래 중 백엔드 몫 세 갈래 확인. 네 번째(10 s 타임아웃)는 FE

## Phase 5: User Story 2·3 — 그림 편집 · 미리 듣기와 저장 (P1·P2) — FE 요청

**Goal**: 백엔드 변경 없음. 계약을 넘기고 FE 가 구현한다.

- [ ] T016 [US3] `docs/rules/BACKEND-NOTES.md` 에 `### 6-8. 그린 별자리 매칭 (S15P21A405-598)` 절 추가: 엔드포인트·요청/응답·에러 표를 `specs/010-drawn-constellation-playlist/contracts/draw-match.md` 에서 요약, 저장은 기존 `/playlist/create` 에 `points` 순서 그대로, LOW = 경고+저장 허용, FE 요청 타임아웃 10 s, `types/api.ts` 에 `ARTWORK_DRAWING_DEGENERATE` 추가 필요
- [ ] T017 [US2] 노션 「결정 통보 · 물음」에 FE 요청 1건(🔴 물음, 담당 FE — 담당자는 사용자에게 확인): 캔버스 그리기 화면 US1~4(점 추가·자동 연결·`n / 20`·최소 3 전 비활성·최대 20 제한·마지막 점 취소·전체 초기화·결과 무효화 FR-022·비교 화면·미리 듣기·저장), 근거 BACKEND-NOTES 6-8. 올린 뒤 fetch 로 되읽어 한글·자동 링크 확인

## Phase 6: Polish & Cross-Cutting

- [ ] T018 `A/service/CatPlaylistGenerator.java` 에 `@EventListener(ApplicationReadyEvent.class)` 예열 추가: 데몬 스레드(`Thread t = new Thread(...); t.setDaemon(true)`, 이름 `artwork-bounds-warmup`)에서 `bounds.updateAndGet(...)` 로 `findPc12Bounds` 를 미리 읽고 `log.info("[Artwork] 상자 예열 ms={}")`. 예외는 WARN 로그만(첫 요청 때 다시 읽는 기존 동작 유지). H2 테스트 프로필에서 `percentile_cont` 가 없어 실패해도 기동이 깨지지 않아야 한다 (research R4)
- [ ] T019 T018 단위 테스트를 `T/CatPlaylistGeneratorTests.java` 에 추가: 예열 메서드를 직접 호출 → 이후 `draw`·`generate` 에서 `findPc12Bounds` 추가 호출 0회. 매퍼가 예외를 던지면 예열은 조용히 끝나고 다음 요청이 다시 읽는다
- [ ] T020 `cd backend && ./gradlew test && ./gradlew build` — 실패 0 확인, 결과 XML 에서 실패·오류 수로 검증
- [ ] T021 (배포 후, 사람+Claude) [quickstart.md](./quickstart.md) 운영 절차: draw 3점 → 200·중복 없음·HIGH 예상, layout 대조, 같은 요청 반복 동일, 배포 직후 첫 요청 < 1 s, 컨테이너 로그 `상자 예열`·`그림 매칭`. 추가: (a) draw 결과로 `/api/playlist/create` → 상세 재조회 → 곡 순서 동일, 같은 곡으로 layout → draw 좌표와 동일 (SC-005·FR-021), (b) 20점 draw 30회 → p95 < 3 s 기록 (SC-001), (c) 삼각형·사각형·별·지그재그 draw 4회 → 3개 이상 MEDIUM 이상 (SC-007)

## Dependencies

```text
T001 → T002(완료) → T003 → T004
T004 → {T005, T006, T007, T008} → T009 → T010 → T011      (US1)
T011 → {T012, T015} ; T012 → T013 → T014                  (US4)
T011 → T016 → T017                                        (FE 요청 — 계약 확정 후)
T009 → T018 → T019 ; {T014, T019} → T020 → T021
```

US4 는 US1 의 `draw()` 위에 얹힌다. US2·US3 는 백엔드 코드와 독립(문서·요청만).

## Parallel Example — US1

```text
동시에: T005 ShapeScoreTests · T006 ShapeScore · T007 DrawRequest · T008 DrawResponse   (파일이 모두 다름)
그다음: T009 → T010 → T011
```

## Implementation Strategy

1. **MVP = Phase 1~3 (US1)**: `draw` 가 곡·좌표·점수를 돌려주면 FE 가 붙기 시작할 수 있다.
2. Phase 4 (US4) 로 오류 구분 완성 → Phase 5 로 계약 전달.
3. Phase 6 은 배포 전에 반드시 — 예열(T018) 없이 배포하면 첫 요청이 8.9 s 로 SC-001 을 위협한다.
4. 커밋 단위: Phase 2 리팩터 / US1 / US4 / 문서 / 예열을 나눠 `[S15P21A405-598]` 로 커밋. MR 은 `backend/dev` 로 하나.
