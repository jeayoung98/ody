# Tasks: 여정 역 수를 끝점 거리에 비례시킨다

**Feature**: 007-journey-station-count · **Branch**: `backend/feat/S15P21A405-286-station-count-by-distance` · **Jira**: S15P21A405-286

**Input**: [spec.md](./spec.md) · [plan.md](./plan.md) · [research.md](./research.md) · [data-model.md](./data-model.md) · [contracts/station-count.md](./contracts/station-count.md) · [quickstart.md](./quickstart.md)

**머지 순서**: 59 → 279 → 281 → **286**. 이 브랜치는 281 위에 쌓여 있다 — 279 의 ef_search 수정이 있어야 재측정이 유효하다.

**규모 주의**: 운영 코드 변경은 함수 하나와 그 배선이다. 비중은 **검증과 문서**에 있다. 태스크를 더 쪼개지 않는다.

---

## Phase 1: Setup

- [X] T001 변경 전 기준선 확보 — `cd backend && ./gradlew test` 를 돌려 **통과 건수와 클래스 목록을 기록**한다. 이 숫자가 없으면 나중에 "원래 깨져 있었나"를 구분할 수 없다. (281 에서 SameRecording 이동 때 테스트 컴파일 파손을 이 단계가 잡았다)

---

## Phase 2: Foundational (모든 스토리의 선행 조건)

**목표**: `stationCount` 를 새 규칙으로 바꾸고 배선한다. 이 단계가 끝나야 US1~US3 를 검증할 수 있다.

- [X] T002 `backend/src/main/java/com/ssafy/backend/music/journey/AxisFrame.java` 의 `stationCount` 를 `stationCount(double spacing, int cap)` 으로 바꾼다. 식은 floor(length/spacing) - 1 을 0 과 cap 사이로 자른 값. spacing 이 0 이하이거나 cap 이 음수면 `IllegalArgumentException`. `Math.clamp` 는 Java 21 이라 쓰지 않는다. farDist 파라미터를 없애되 **`far(double farDist)` 메서드는 그대로 둔다**(로그가 쓴다).

- [X] T003 `AxisFrame` 의 `stationCount` javadoc 을 새 근거로 다시 쓴다 — 왜 거리 비례인지, s 가 최근접 반경이고 좌표계 v2.1-pca16 에 귀속된다는 것, 실측값(임의 지점 최근접 거리 p50 2.272 / p90 2.684), 하한 0 이 2곡 경로를 뜻한다는 것. **근거 없는 숫자를 남기지 않는다** — 이 파일의 기존 상수가 그래서 문제였다.

- [X] T004 `backend/src/main/java/com/ssafy/backend/music/journey/AxisJourneyPathFinder.java` 에 `MAX_STATIONS = 18` 상수와 `ody.journey.station-spacing`(기본 2.5) 주입을 추가하고 호출부를 `frame.stationCount(stationSpacing, MAX_STATIONS)` 로 바꾼다. 주입은 **281 이 만든 `ody.journey.layer-limit` 패턴**(@Value + 기본값 상수)을 그대로 따른다.

- [X] T005 `AxisJourneyPathFinder` 생성자 인자가 늘었으므로 **테스트 호출부를 전부 고친다** — `AxisJourneyPathFinderTests`(2곳), `JourneyBenchmarkIT`(4곳). 281 에서 같은 일이 있었다. `./gradlew compileTestJava` 가 통과해야 이 태스크가 끝난다.

- [X] T006 `./gradlew test` 로 T001 기준선과 대조한다. **여기서 깨지는 것은 전부 기존 테스트가 옛 규칙(하한 10 · 상한 20)을 기대하기 때문**이다. 깨진 테스트를 새 규칙 기준으로 고치되, **기대값을 바꾸는 이유를 각 테스트 주석에 남긴다.**

---

## Phase 3: User Story 1 — 가까운 두 곡으로 여정을 만든다 (P1) 🎯 MVP

**목표**: 끝점이 가까운 쌍에서 경로가 직선을 크게 벗어나지 않는다.

**독립 검증**: 끝점 거리 3~4인 쌍으로 여정을 만들어 우회 배수를 잰다. 이것만 되어도 그 구간 사용자에게 가치가 간다.

- [X] T007 [P] [US1] `backend/src/test/java/com/ssafy/backend/music/journey/AxisFrameTests.java` 를 신설해 `stationCount` 를 검증한다. contracts/station-count.md 의 **경계값 11행을 그대로** 옮기고(length 0.0 / 2.4 / 2.5 / 4.9 / 5.0 / 7.5 / 15.52 / 25.77 / 47.5 / 58.58 / 1000.0), spacing 0 이하 · cap 음수 예외 2건을 더한다. **순수 함수라 DB·목이 필요 없다 — 가장 싼 검증 지점이다.**

- [X] T008 [P] [US1] `AxisFrameTests` 에 사후 조건 검사를 더한다: 임의의 length 에 대해 반환값 n 이 0 이거나 length/(n+1) 이 spacing 이상이다(FR-002). 값 몇 개를 훑는 방식으로 충분하다 — 프로퍼티 테스트 라이브러리를 새로 들이지 않는다.

- [X] T009 [US1] `AxisJourneyPathFinderTests` 에 **n = 0 회귀**를 추가한다: 끝점 거리가 spacing 미만인 합성 좌표로 `find()` 를 부르면 reachable 이 true 이고 stationMbids 가 비어 있다. (R4 대로 이미 동작하지만 **하한 10 때문에 한 번도 실행된 적이 없는 경로**라 고정이 필요하다)

- [X] T010 [US1] `AxisJourneyPathFinderTests` 에 **층 질의 0회** 회귀를 추가한다 — n = 0 일 때 `reader.findNearest` 가 한 번도 불리지 않는다(mock 검증). 281 이 넣은 ody.journey.layer_query 카운터로도 확인 가능하지만, 단위 테스트에서는 mock 호출 횟수가 더 직접적이다.

- [X] T011 [US1] `backend/src/test/java/com/ssafy/backend/music/JourneyServiceTests.java` 에 **2곡 조립 회귀**를 추가한다 — 엔진이 reachable=true 와 빈 정거장을 주면 musicCnt 가 2, path 가 출발(step:0)·도착(step:1) 2개, 예외 없음. 기존에 같은 취지의 테스트가 있으면 보강만 한다(hydrate 빈 목록 주석이 이미 이 경우를 가리킨다).

---

## Phase 4: User Story 2 — 아주 먼 두 곡으로 여정을 만든다 (P2)

**목표**: 먼 여정이 이전보다 나빠지지 않고, 목록이 20곡을 넘지 않는다.

**독립 검증**: 끝점 거리 20~26 쌍의 이웃 구간 거리 평균을 고치기 전과 비교한다.

- [X] T012 [P] [US2] `AxisFrameTests` 에 상한 도달 검증을 더한다 — length 47.5 이상에서 n 이 cap 에 고정되고, 아무리 큰 length 를 넣어도 cap 을 넘지 않는다(FR-003).

- [X] T013 [US2] `backend/src/main/java/com/ssafy/backend/music/service/JourneyService.java` 의 `MAX_PATH_SIZE` 주석 "엔진 정거장 상한이 20 이라 실제로는 최대 22 다(D3)" 를 **18/20 기준으로 정정**한다. 가드 자체(30)는 유지한다(FR-005) — 도달 불가 방어선이라는 성격도 그대로다.

---

## Phase 5: User Story 3 — 만든 여정을 플레이리스트로 본다 (P3)

**목표**: 곡 수 상한 변경이 별자리 배치(최대 30곡)를 깨지 않는다는 것을 확인한다.

**독립 검증**: 가장 먼 쌍의 여정(최대 20곡)을 별자리 배치 입력에 넣어 400 이 나지 않는다.

- [~] T014 [US3] **미실행 (265 머지 대기)** — 별자리 배치 API 와의 상한 관계를 확인해 quickstart.md E 절에 기록한다. **265 브랜치가 아직 머지 전이면 실행할 수 없으므로 "미실행(265 머지 대기)" 으로 명시한다** — 확인 못 한 것을 통과로 적지 않는다. 근거는 18 + 2 = 20 이 30 보다 작아 구조적으로 안전하다는 것이고, 실행 확인은 별개다.

---

## Phase 6: 재측정 — s 확정 (SC-001 · SC-002 · SC-003 · SC-007)

**새 하네스를 만들지 않는다.** 스크래치패드의 pool.json · genres.py · eval_run.py 를 그대로 쓴다. 8쌍이 고정 id 라 고치기 전 수치와 직접 비교된다.

- [X] T015 `eval_run.py` 에 **무작위 30쌍** 모드를 더한다(고정 시드). 8쌍은 가까움 4·멂 4 로 편향돼 **거리 5~19 구간이 비어 있다**(SC-007). 기존 8쌍 경로는 건드리지 않는다.

- [X] T016 s = 2.5 로 재측정한다 — `./gradlew bootTestRun --args='--server.port=8099 --ody.journey.station-spacing=2.5'` 를 띄우고 8쌍 + 30쌍을 돌린다. 우회 배수 · 축 한 칸 · 이웃 구간 거리 평균을 기록한다.

- [X] T017 s = 3.0 과 s = 3.5 로 같은 측정을 반복한다. 값마다 앱을 재기동한다(설정 주입이라 재빌드는 없다).

- [X] T018 스윕 결과로 **s 최종값을 정하고 근거를 적는다**. 판정 기준은 SC-001(가까운 쌍 우회 배수 4 미만) · SC-002(먼 쌍 품질 비악화) · SC-003(축 한 칸이 s 이상). 2026-09-13 clarify 로 **담당자가 정하되 표와 근거를 남기는 것이 조건**이다.

- [X] T019 quickstart.md 의 D 절 표와 "측정 기록" 절을 실제 수치로 채워 커밋한다. **하네스가 저장소에 없으므로 근거는 문서에만 남는다** — 비워 두면 이 작업의 근거가 사라진다.

- [X] T020 **건너뜀 (s = 2.5 확정)** — T018 에서 정한 값이 2.5 가 아니면 `AxisJourneyPathFinder` 의 기본값 상수와 `AxisFrameTests` 경계값, contracts/station-count.md 표, data-model.md 를 함께 고친다. 2.5 면 이 태스크는 건너뛴다.

---

## Phase 7: 문서 정합 (SC-006) · 통보 (FR-009)

- [X] T021 [P] `specs/004-journey-path/spec.md` 를 갱신한다 — FR-011 식, FR-008 의 "엔진 상한 20 → 최대 22곡", 109행 표, 288행 표, 수용 시나리오 3. **004 를 다시 쓰지 않고 해당 줄만 고치고, 007 로 개정됐음을 한 줄로 가리킨다.**

- [X] T022 [P] `specs/004-journey-path/data-model.md`(path 길이 "1~30, 실제 최대 22") · `plan.md`(67행 Constraints, 190행 흐름도 4b, 209행 가드 주석) · `quickstart.md`(B8, D5) 를 갱신한다.

- [X] T023 [P] `docs/rules/BACKEND-NOTES.md` A-5 의 "정거장 약 20곡" 을 확정값(musicCnt 2~20, 중앙값 6)으로 갱신한다. 이 표는 **프론트가 읽는 계약 문서**라 여기 값이 실제와 다르면 안 된다.

- [X] T024 문서 정합을 **grep 한 줄로 확인**한다. 대상 경로는 specs/004-journey-path/ · backend/src/main/java/ · docs/rules/ 이고, 찾을 문자열은 "정거장 20" · "최대 22" · "musicCnt 22" · "clamp(10, 20)" · "clamp(round(10" 다. **0건**이어야 한다(SC-006). 남으면 T021~T023 미완이다.

- [ ] T025 프론트·기획 통보문을 쓴다(FR-009) — musicCnt 범위 12~22 에서 **2~20**, 중앙값 12 에서 **6**, **중간 곡 없는 2곡 여정이 정상 응답**, 별자리 배치에는 영향 없음. 왜 짧아지는지(임의 두 곡 사이에 최근접 반경이 6.8칸뿐)를 한 문단으로 붙인다.

- [ ] T026 T025 의 내용을 노션 「결정 통보 · 물음」 DB 에 **행으로 만든다**. 파일만 쓰고 채팅에 나열하면 팀은 그 건이 있는지도 모른다. 담당은 프론트, 유형은 🔴 물음(받는 쪽 작업이 필요하다), 제목은 서술어 없는 명사구.

---

## Phase 8: 마무리

- [X] T027 `cd backend && ./gradlew test && ./gradlew build` 전건 통과를 확인한다. T001 기준선 대비 늘어난 건수(= AxisFrameTests + 회귀 4종)를 기록한다.

- [ ] T028 MR 본문을 쓴다 — 팀 양식(assets/mr-template-default.md)을 따르고, 스윕 표·재측정 결과·s 판정 근거·프론트 통보 항목을 싣는다. **281 위에 쌓여 있음을 상단에 명시**하고 머지 순서 59 → 279 → 281 → 286 을 적는다.

---

## Dependencies

```
T001 (기준선)
  └─ Phase 2: T002 → T003 → T004 → T005 → T006     [순차 — 같은 파일·컴파일 사슬]
       ├─ Phase 3 (US1): T007 [P] T008 [P] → T009 → T010 → T011
       ├─ Phase 4 (US2): T012 [P] · T013 [P]
       ├─ Phase 5 (US3): T014
       └─ Phase 6 (재측정): T015 → T016 → T017 → T018 → T019 → T020
            └─ Phase 7: T021 [P] T022 [P] T023 [P] → T024 → T025 → T026
                 └─ Phase 8: T027 → T028
```

- **Phase 2 는 전부 순차다** — AxisFrame 시그니처가 바뀌면 컴파일이 연쇄로 깨진다. T005 를 건너뛰면 T006 이 통과할 수 없다.
- **Phase 3·4·5 는 서로 독립**이다. US1 만 끝내도 MVP 로 성립한다.
- **Phase 6 은 Phase 2 이후 언제든 가능**하지만, Phase 3 의 회귀가 먼저 통과해야 측정값을 믿을 수 있다.
- **T020 은 조건부**다 — s 가 2.5 로 확정되면 실행하지 않는다.

## 병렬 실행 예

- Phase 4 시작 시: T012(테스트)와 T013(주석)은 파일이 달라 병렬
- Phase 7 시작 시: T021, T022, T023 은 파일이 달라 병렬

## MVP 범위

**Phase 1 + Phase 2 + Phase 3 (US1)** = T001~T011.

여기까지면 가까운 쌍의 경로 붕괴가 고쳐지고 n = 0 경로가 회귀로 고정된다. 나머지는 먼 쌍 확인(US2)·문서 정합·통보이며, **재측정(Phase 6) 없이는 s 를 확정했다고 말할 수 없으므로 머지 전에 반드시 끝낸다.**

## 하지 않는 것

- 역당 여러 곡 설계 — 2026-09-13 결정으로 **후속 이슈도 열지 않는다.**
- LAYER_LIMIT · MIN_LAYER · MAX_RETRY — S15P21A405-281.
- Viterbi 비용 함수, 주변 탐색(005), 별자리(265).
- 새 지표 추가 — recordQuality 가 이미 stations= 를 남긴다.
