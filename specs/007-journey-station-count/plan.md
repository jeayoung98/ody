# Implementation Plan: 여정 역 수를 끝점 거리에 비례시킨다

**Branch**: `backend/feat/S15P21A405-286-station-count-by-distance` | **Date**: 2026-09-13 | **Spec**: [spec.md](./spec.md)

**Jira**: S15P21A405-286 · **개정 대상**: 004-journey-path FR-011(정거장 수), FR-008(곡 수 표기)

## Summary

정거장 수를 **끝점 거리에 비례**시킨다. 현재는 거리와 무관하게 하한 10이라 가까운 쌍에서 직선의 8.6배를 돌아간다.

새 규칙 한 줄: `n = clamp(floor(L / s) - 1, 0, 18)`, `s = 2.5`(최근접 반경, 설정).
바뀌는 코드는 **함수 하나**(`AxisFrame.stationCount`)와 그 호출부 한 곳이다. 나머지는 문서·테스트·재측정이다.

## Technical Context

**Language/Version**: Java 17 / Spring Boot 4.1.1 / Gradle 9.7.1
**Primary Dependencies**: MyBatis, PostgreSQL 17.11 + pgvector 0.7.0(HNSW), Micrometer
**Storage**: 운영 DB `ody` · `music.location vector(16)` · 좌표계 `v2.1-pca16` (6,624,399행)
**Testing**: JUnit 5 · `AxisJourneyPathFinderTests`(합성 좌표 + mock reader) · `JourneyServiceTests` · `JourneyBenchmarkIT`(실 DB, 태그 분리)
**Target Platform**: Linux 서버 (Docker)
**Project Type**: 웹 서비스 백엔드 — 기존 기능의 국소 변경
**Performance Goals**: 이번 변경은 **층 질의 횟수를 줄이는 방향**이다(n 감소 = 질의 감소). 지연 목표를 새로 세우지 않는다.
**Constraints**: 응답 계약 불변(FR-007). `musicCnt` 범위만 12~22 → 2~20 으로 바뀐다.
**Scale/Scope**: 파일 3개 수정, 테스트 클래스 1개 신설, 004 문서 5개 갱신.

## Constitution Check

*GATE: Phase 0 전 통과, Phase 1 후 재확인*

| 원칙 | 판정 | 근거 |
| --- | --- | --- |
| I. 명세 우선 | ✅ | spec.md 를 먼저 썼고, 004 FR-011/FR-008 개정을 작업 범위(FR-008)에 넣었다. 코드부터 고치지 않는다. |
| II. 계약 우선 | ⚠️ **조건부** | 응답 스키마는 불변이나 `musicCnt` 가 취하는 값의 범위가 계약의 관측된 범위를 벗어난다. **프론트 통보가 완료 조건**이다(FR-009). 통보 없이 머지하면 위반. |
| III. 완료 전 검증 | ✅ | `./gradlew test` · `build` + 같은 8쌍 재측정(R6). SC-001~006 이 전부 측정 가능한 형태다. |
| IV. 데이터 재현성 | ✅ | 8쌍이 고정 id 목록이라 전후 비교가 재현된다. |
| V. 좌표 안정성 | ✅ | `s = 2.5` 는 `v2.1-pca16` 에 귀속된 값임을 FR-006 과 주석에 명시한다. 좌표를 바꾸지 않는다. |
| VI. 탐색 일관성 | ✅ | 사용자가 고른 두 곡을 조용히 재해석하지 않는다. 곡 수가 줄 뿐 입력 해석은 그대로다. |
| VIII. 관측 가능성 | ✅ | `recordQuality` 가 이미 `stations=` 를 로그에 남긴다. **추가 지표를 만들지 않는다** — 이번 변경의 효과는 그 값의 분포로 바로 보인다. |
| IX. 암묵적 가정 금지 | ⚠️ **확인 필요** | 아래 참조. |
| X. 아키텍처 경계 | ✅ | `backend/` 와 `specs/` 만 건드린다. |

### IX 관련 — 기획에 올려야 할 사실 하나

`s = 2.5` 로 가면 무작위 쌍의 `musicCnt` 가 **중앙값 6곡, p90 10곡**이 된다(현행 12곡/22곡). 사용자가 확정한 상한 20곡은 **0.4% 에서만 물린다.**

즉 이번 변경으로 실제 여정 길이를 정하는 값은 상한이 아니라 `s` 다. "플레이리스트 30곡" 기획 의도와 여정 6곡 사이의 간극은 **"역당 여러 곡" 설계로만 메울 수 있고 그건 범위 밖**이다(spec 명시).

**이 사실을 기획에 알리는 것을 완료 조건에 넣는다.** 구현을 막지는 않는다 — 방향은 2026-09-13 사용자 결정으로 확정됐고, 짧더라도 말이 되는 목록이 길지만 헐거운 목록보다 낫다는 판단이다.

## Project Structure

### Documentation (this feature)

```text
specs/007-journey-station-count/
├── spec.md              # 완료
├── research.md          # 완료 (R1~R6)
├── plan.md              # 이 파일
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── contracts/
│   └── station-count.md # Phase 1 — 내부 계약(함수 규약). HTTP 계약은 불변이라 004 것을 참조만 한다
└── tasks.md             # /speckit-tasks 산출물
```

### Source Code

```text
backend/src/main/java/com/ssafy/backend/music/
├── journey/
│   ├── AxisFrame.java                 # 수정 — stationCount 시그니처·식
│   └── AxisJourneyPathFinder.java     # 수정 — spacing 주입, 상한 상수, 호출부
└── service/
    └── JourneyService.java            # 수정 — MAX_PATH_SIZE 주석의 "최대 22" → "최대 20"

backend/src/test/java/com/ssafy/backend/music/journey/
├── AxisFrameTests.java                # 신설 — stationCount 순수 함수 검증
└── AxisJourneyPathFinderTests.java    # 수정 — n=0 경로 회귀 + 생성자 인자

docs/rules/BACKEND-NOTES.md            # 수정 — A-5 "정거장 약 20곡" 항목에 확정값 반영
specs/004-journey-path/               # 수정 — spec.md(FR-008/FR-011), data-model.md, plan.md, quickstart.md
```

## Phase 1 설계

### 함수 규약

```java
// AxisFrame
/** 역 수. 축 방향 간격이 spacing 이상이 되도록 나누고 cap 으로 자른다. */
public int stationCount(double spacing, int cap) {
    int n = (int) Math.floor(length / spacing) - 1;
    return Math.min(cap, Math.max(0, n));
}
```

- `farDist` 를 받지 않는다(R3). `far()` 는 그대로 남아 로그에만 쓰인다.
- `Math.clamp` 는 Java 21 이라 쓸 수 없다 — 기존 코드와 같은 방식으로 자른다.
- **순수 함수**라 DB·목 없이 검증된다. `AxisFrameTests` 가 가장 싼 검증 지점이다.

### 호출부

```java
// AxisJourneyPathFinder
static final int MAX_STATIONS = 18;      // 출발·도착 포함 20곡. 근거는 주석에 (R5)
private final double stationSpacing;     // ody.journey.station-spacing, 기본 2.5 (R2)

int n = frame.stationCount(stationSpacing, MAX_STATIONS);
```

281 이 만든 `@Value("${ody.journey.layer-limit:...}")` 패턴을 그대로 따른다 — 생성자 인자가 하나 더 늘고, 테스트 5곳의 호출부가 같이 바뀐다.

### 경계값

| L | n | musicCnt | 비고 |
| --- | --- | --- | --- |
| 2.4 | 0 | 2 | 중간 곡 없음. 정상 200 (R4) |
| 3.23 | 0 | 2 | 오늘 측정한 가장 가까운 쌍 |
| 5.0 | 1 | 3 | 첫 정거장이 생기는 지점 |
| 15.52 | 5 | 7 | 무작위 쌍 중앙값 |
| 25.77 | 9 | 11 | 오늘 측정한 가장 먼 쌍 |
| 47.5+ | 18 | 20 | 상한 도달 (0.4%) |

### 위험한 지점 하나 — `n = 0`

R4 에서 **이미 안전함을 코드로 확인했다.** `ViterbiPath.solve([])` 가 `List.of()` 를 반환하고 `hydrate([])` 가 2곡 경로를 정상으로 처리한다.

다만 **이 경로는 지금까지 한 번도 실행된 적이 없다**(하한 10 때문에). 회귀 테스트로 고정하는 것이 이번 작업의 필수 항목이다:

1. `stationCount` 가 0 을 돌려주는 입력에서 `find()` 가 `reachable=true`, 빈 `stationMbids` 를 낸다
2. `JourneyService` 가 그것을 `musicCnt=2`, 200 으로 조립한다
3. 층 질의가 **0회** 나간다(`ody.journey.layer_query` 증가 없음 — 281 이 넣은 계측 재사용)

### 재측정 절차 (R6)

새 하네스를 만들지 않는다. 스크래치패드의 `pool.json` / `genres.py` / `eval_run.py` 를 그대로 쓴다.

```bash
cd backend
./gradlew bootTestRun --args='--server.port=8099 --ody.journey.station-spacing=2.5'
# 다른 셸에서
cd <scratchpad> && python eval_run.py after-2.5
```

`s` 를 2.5 / 3.0 / 3.5 로 바꿔 세 번 돌리고 **우회 배수**로 확정한다(281 의 `LAYER_LIMIT` 스윕과 같은 방법). 결과 수치는 `quickstart.md` 와 MR 본문에 남긴다 — 하네스가 저장소에 없으므로 근거는 문서에 남아야 한다.

## Phase 2 이후 — 함께 고칠 문서

| 파일 | 고칠 것 |
| --- | --- |
| `specs/004-journey-path/spec.md` | FR-011 식, FR-008 의 "엔진 상한 20 → 최대 22곡", §109 표, §288 표, 수용 시나리오 3 |
| `specs/004-journey-path/data-model.md` | `path` 길이 "1~30, 실제 최대 22" |
| `specs/004-journey-path/plan.md` | §67 Constraints, §190 흐름도 4b, §209 가드 주석 |
| `specs/004-journey-path/quickstart.md` | B8("정거장 20개 → musicCnt 22"), D5("정거장 10 초과, 최대 20") |
| `backend/.../JourneyService.java` | `MAX_PATH_SIZE` 주석 "실제로는 최대 22" |
| `docs/rules/BACKEND-NOTES.md` | A-5 "정거장 약 20곡" → 확정값과 새 범위 |

## 프론트 통보 (FR-009, 완료 조건)

- `musicCnt` 범위가 **12~22 에서 2~20 으로** 바뀐다. 하한이 더 크게 움직인다 — **중간 곡이 하나도 없는 2곡 여정이 정상 응답**이다.
- 무작위 쌍 기준 중앙값은 6곡이다. 12곡을 전제로 잡은 레이아웃이 있으면 어긋난다.
- 별자리 배치 API(최대 30곡)에는 영향이 없다. 여정은 항상 20곡 이하라 여유 안에 들어온다.

## Complexity Tracking

헌법 위반으로 정당화가 필요한 항목 없음. 추가 의존성·추상화 없음. 설정 키 1개(`ody.journey.station-spacing`)가 늘어나며, 그 이유는 R2 에 기록했다.
