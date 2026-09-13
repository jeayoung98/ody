# Research: 여정 역 수를 끝점 거리에 비례시킨다

**Date**: 2026-09-13 · **Feature**: 007-journey-station-count

기술 스택은 004 와 같다(Spring Boot 4.1.1 / Java 17 / MyBatis + PostgreSQL + pgvector). 새로 고를 것이 없어 조사는 **수치 결정 5개**와 **깨질 수 있는 경로 1개**에 한정했다.

---

## R1. 정거장 간격 기준을 무엇으로 잡나 — `s = 2.5`

**Decision**: 이웃 정거장의 축 방향 간격 하한 `s` 를 **최근접 반경 그 자체(2.5)** 로 잡는다. `n = clamp(floor(L / s) - 1, 0, 18)`.

**문제**: 스펙 안에서 두 값이 충돌했다. FR-002 는 "간격이 반경 이상"(`s = r = 2.5`)이라 쓰고, Assumptions 는 "이웃 둘이 각각 반경만큼 이탈하니 반경의 2배"(`s = 2r = 5.0`)를 출발점으로 적었다.

**Rationale**:

1. **2배 근거가 고차원에서 성립하지 않는다.** 이웃한 두 정거장의 이탈 벡터는 축에 직교하는 15차원 부분공간 안에 있고, 고차원에서 두 무작위 방향은 **거의 직교**한다. 따라서 둘 사이 거리는 `2r` 이 아니라 `r√2 ≈ 3.54` 에 가깝다. `2r` 은 두 이탈이 정반대를 향하는 최악만 가정한 값이다.
2. **실측이 `2r` 을 배제한다.** 1,438,800쌍에 세 값을 대입한 결과:

   | `s` | musicCnt 중앙값 | p90 | 2곡으로 끝나는 비율 | 상한 18 도달 |
   | --- | --- | --- | --- | --- |
   | **2.5** | **6** | 10 | 0.1% | 0.4% |
   | 3.54 | 5 | 7 | 1.5% | 0% |
   | 5.0 | 3 | 5 | **12.1%** | 0% |

   `s = 5.0` 이면 **여정 8건 중 1건이 중간 곡 없는 2곡짜리**가 된다. 기능이 성립하지 않는다.
   또 `s = 3.54` 와 `5.0` 에서는 **상한 18 이 한 번도 쓰이지 않는다** — 사용자가 확정한 "출도착 포함 20곡" 결정이 죽은 값이 된다.
3. `s = 2.5` 만 셋을 동시에 만족한다 — FR-002 를 문자 그대로 지키고, 2곡 결과가 예외(0.1%)로 남고, 상한이 살아 있다(0.4%).

**Alternatives considered**:

- `s = 2r = 5.0` — ❌ 위 표. 12.1% 가 2곡.
- `s = r√2 = 3.54` — ❌ 이론적으로는 가장 정확하지만 상한이 죽고 중앙값이 5곡으로 더 짧다. 2.5 대비 얻는 것이 없다.
- 현행 유지(거리 무관 하한 10) — ❌ 이 기능을 여는 이유 자체.

**남는 것**: `s` 는 **설정으로 뺀다**(R2). 2.5 는 8세트 32개 구간에서 관측한 축 이탈 중앙값(2.05~3.95)의 아래쪽이고, 구현 단계에서 같은 8세트에 2.5/3.0/3.5 를 스윕해 우회 배수로 확정한다 — **S15P21A405-281 이 `LAYER_LIMIT` 을 정한 것과 같은 방법이다.**

---

## R2. 상수 `s` 를 어디에 두나 — `ody.journey.station-spacing`

**Decision**: `ody.journey.station-spacing`(기본 2.5) 설정으로 주입하고, `AxisJourneyPathFinder` 가 들고 있다가 `stationCount` 에 넘긴다. `AxisFrame` 은 상수를 갖지 않는다.

**Rationale**:

- **`ServingRules` 에 넣으면 안 된다.** 그 클래스는 "값의 유일한 출처는 데이터 파트 `postprocess_rules.json`" 이라고 못 박혀 있는데, 최근접 반경은 **그 파일에 없는 값**이다. 넣으면 규칙이 두 벌이 된다.
- **281 선례가 있다.** `ody.journey.layer-limit` 을 같은 방식(`@Value` + 기본값 상수)으로 만들었고, 재빌드 없이 스윕을 돌리는 데 실제로 썼다. 같은 패턴을 쓰면 이번 재측정도 앱 재기동만으로 끝난다.
- **`AxisFrame` 을 순수하게 유지한다.** `AxisFrame.of(a, b)` 로 만드는 값 객체라 스프링이 주입할 자리가 없다. 상수를 인자로 받으면 `stationCount` 가 순수 함수로 남아 **테스트가 가장 싸다**(DB·목 없이 값만 넣어 확인).

**Alternatives considered**: `AxisFrame` 상수(스윕 때마다 재빌드), `ServingRules` 필드(출처 규칙 위반), `application.yml` 의 `ody.serving` 블록(같은 이유로 기각).

---

## R3. `stationCount` 시그니처에서 `farDist` 를 떼도 되나 — 뗀다

**Decision**: `stationCount(double spacing, int cap)` 으로 바꾼다. `farDist` 를 받지 않는다.

**Rationale**: 새 식에 `farDist` 가 등장하지 않는다. `far()` 는 별도 메서드로 남고 **`recordQuality` 로그에만 쓰인다**(`AxisJourneyPathFinder:122,132` → `JourneyService:148`). 응답에는 싣지 않는다(FR-023). 즉 `farDist` 의 다른 소비자가 있으므로 `ServingRules.farEndpointDist` 자체는 그대로 두고, `stationCount` 만 의존을 끊는다.

**확인한 것**: `grep -rn "\.far("` 결과 3곳 전부 위 경로다. 다른 사용처 없음.

---

## R4. `n = 0` 일 때 경로가 깨지나 — 이미 안전하다

**Decision**: 별도 분기를 만들지 않는다. 현재 코드가 그대로 2곡 경로를 정상 200 으로 낸다.

**추적 결과**:

```
collect(reader, frame, rules, guard, n=0, ...)
  → for (k=1; k<=0)  루프 미실행 → layers = []
repair(layers=[], ...)
  → usable = []
  → usable.stream().anyMatch(List::isEmpty) = false   (원소가 없으므로)
  → ViterbiPath.solve([]) → layers.isEmpty() 분기 → List.of()   ← null 이 아니다
  → duplicateRecording([]) = null, artistsOverCap([]) = []      → List.of() 반환
find()
  → path = [] (null 아님) → mode 는 "axis" 유지
  → EnginePath(reachable=true, mbids=[], progresses=[], ...)
JourneyService
  → hydrate([]) → List.of()   ← 주석: "출발·도착 2곡 경로가 정상이다 (FR-009, FR-012)"
  → songs = [start, end] → assemble → musicCnt = 2, 200 OK
```

**Rationale**: 좌표가 같은 두 곡(`frame.degenerate()`)이 이미 **같은 모양**(`reachable=true` + 빈 정거장)으로 조기 반환하고 있어서, 빈 정거장 경로가 설계상 정상 출력으로 이미 자리를 잡고 있다. `ViterbiPath.solve` 의 `layers.isEmpty() → List.of()` 도 그 전제 위에 쓰인 코드다.

**그래도 할 일**: 이 경로는 **지금까지 한 번도 실행된 적이 없다**(하한 10 때문에 `n ≥ 10` 이었다). 회귀 테스트로 고정한다 — 이번 변경에서 가장 깨지기 쉬운 지점이라는 판단은 유지하되, 원인은 "구현이 없어서"가 아니라 "검증이 없어서"다.

---

## R5. 상한 18 을 어디에 두나 — `AxisJourneyPathFinder` 상수

**Decision**: `MAX_STATIONS = 18` 을 `AxisJourneyPathFinder` 상수로 두고 `stationCount` 에 넘긴다. 설정으로 빼지 않는다.

**Rationale**: `s` 와 달리 **측정으로 정하는 값이 아니라 계약에서 내려온 값**이다(기획의 플레이리스트 30곡, 프론트 A-5 의 "정거장 약 20곡"). 스윕 대상이 아니므로 설정 표면을 늘릴 이유가 없다. 근거는 주석으로 남긴다.

**확인한 것**: `JourneyService.MAX_PATH_SIZE = 30` 가드는 그대로 둔다. 18 + 2 = 20 < 30 이라 여전히 도달 불가 방어선이고, FR-005 가 유지를 요구한다.

---

## R6. 재측정을 무엇으로 하나 — 기존 하네스 재사용

**Decision**: 새 벤치를 만들지 않는다. 2026-09-13 정성 평가에 쓴 스크래치패드 도구를 그대로 쓴다.

- `pool.json` — 스포티파이 기록으로 매칭한 398곡(좌표 포함)
- `genres.py` — 아티스트 장르 라벨
- `eval_run.py` — 고정 8쌍 + API 호출 + 결과 저장

**절차**: `./gradlew bootTestRun --args='--server.port=8099 --ody.journey.station-spacing=<s>'` 로 띄우고 `eval_run.py` 를 돌린 뒤, 저장된 `eval_result.json` 과 우회 배수·축 한 칸·이웃 구간 거리를 비교한다.

**Rationale**: 8쌍이 **고정 id 목록**이라 이전 결과와 직접 비교된다. `JourneyBenchmarkIT`(실 DB 통합 테스트)는 무작위 쌍이라 전후 비교에 쓸 수 없다. 새로 만들면 비교 기준선이 사라진다.

**주의**: 이 하네스는 세션 스크래치패드에 있고 저장소에 없다. 재측정 결과 수치는 `quickstart.md` 와 MR 본문에 남겨 저장소 쪽에 근거가 남게 한다.

---

## 참고 — 이 변경이 곡 수에 미치는 영향

`s = 2.5`, 상한 18 기준으로 무작위 쌍의 `musicCnt` 는 **중앙값 6곡, p90 10곡**이다. 현행은 가까운 쌍 12곡·먼 쌍 22곡 두 값뿐이었다.

**상한 20곡은 0.4% 에서만 물린다.** 사용자가 확정한 "출도착 포함 20곡" 은 계약 상한으로서 의미가 있고 실제 길이를 정하는 값은 아니다 — 길이는 `s` 가 정한다. 이 둘을 같이 결정했으므로 여기 명시해 둔다.
