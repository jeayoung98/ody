# Quickstart: 여정 역 수 검증

**Feature**: 007-journey-station-count · **Date**: 2026-09-13

## 전제

- 운영 DB `ody` 접근(`backend/.env`). 좌표계 `v2.1-pca16`.
- 이 브랜치는 S15P21A405-281 위에 쌓여 있다 — **279 의 `ef_search` 수정이 있어야 재측정이 유효하다.** `backend/dev` 기준으로 재면 어떤 limit 을 넣어도 40행만 와서 층 후보가 왜곡된다.

## A. 단위 검증 — 가장 싼 자리

```bash
cd backend
./gradlew test --tests '*AxisFrameTests*'
```

`stationCount` 는 순수 함수라 DB·목 없이 [contracts 경계값 표](./contracts/station-count.md)를 그대로 확인한다. 기대: 표의 11개 행 전부 일치, `spacing ≤ 0` · `cap < 0` 에서 `IllegalArgumentException`.

## B. 전체 스위트

```bash
cd backend
./gradlew test && ./gradlew build
```

기대: 전건 통과. 281 기준 266건에서 `AxisFrameTests` 만큼 늘어난다.

## C. `n = 0` 경로 (이번 변경에서 유일하게 새로 실행되는 경로)

```bash
cd backend
./gradlew bootTestRun --args='--server.port=8099'
```

끝점 거리가 `spacing` 미만인 두 곡을 넣는다. 2026-09-13 측정 기준 가장 가까운 쌍:

```bash
# Taylor Swift - Cruel Summer  →  Coldplay - My Universe   (L = 3.23)
curl -s "http://localhost:8099/api/music/journey?start=<id>&end=<id>" | python -m json.tool
```

| 확인할 것 | 기대 |
| --- | --- |
| HTTP | **200** (422 아님) |
| `musicCnt` | **2** |
| `path` | 출발곡(`step:0`) · 도착곡(`step:1`) 2개 |
| 층 질의 | **0회** — `curl -s localhost:8099/actuator/prometheus \| grep ody_journey_layer_query` 가 증가하지 않는다 |

> 액추에이터는 `/api` 아래가 아니라 **루트**에 있다.

## D. 8세트 재측정 — 우회 배수로 `s` 확정

새 하네스를 만들지 않는다. 2026-09-13 정성 평가에 쓴 것을 그대로 쓴다(`pool.json` · `genres.py` · `eval_run.py`).

```bash
# s 를 바꿔가며 세 번
./gradlew bootTestRun --args='--server.port=8099 --ody.journey.station-spacing=2.5'
# 다른 셸에서
cd <scratchpad> && python eval_run.py after-2.5
```

`2.5` / `3.0` / `3.5` 로 각각 돌리고 아래 표를 채운다. 8쌍은 고정 id 라 **고치기 전 수치와 직접 비교된다.**

| 쌍 | L | 고치기 전 우회 배수 | s=2.5 | s=3.0 | s=3.5 |
| --- | --- | --- | --- | --- | --- |
| Taylor Swift → Coldplay | 3.23 | 8.6 | | | |
| W O L F C L U B → The Bad Dreamers | 3.80 | 7.3 | | | |
| 자우림 → Crowded House | 3.30 | 8.1 | | | |
| Hollow Coves → ヨルシカ | 3.70 | 6.4 | | | |
| Green Day → Schumann | 19.76 | 2.8 | | | |
| Satie → Bach | 22.17 | 2.8 | | | |
| Oasis → Linkin Park | 22.91 | 2.7 | | | |
| Bach → The G | 25.77 | 2.9 | | | |

**합격선**
- SC-001: 가까운 쌍 4개의 우회 배수가 **4 미만**
- SC-002: 먼 쌍 4개의 이웃 구간 거리 평균이 **이전보다 나빠지지 않음**
- SC-003: 모든 쌍에서 축 방향 한 칸 `L/(n+1) ≥ s`

측정 결과는 **이 표에 채워 커밋하고 MR 본문에도 싣는다.** 하네스가 저장소에 없으므로 근거는 문서에만 남는다.

## E. 별자리 영향 없음 확인 (SC 보조)

가장 먼 쌍으로 만든 여정(최대 20곡)을 별자리 배치 API 입력 상한(30곡)에 넣어 400 이 나지 않는지 본다. 265 브랜치가 머지된 뒤에만 가능하다 — **머지 전이면 "미실행"으로 보고한다.**

## F. 문서 정합 (SC-006)

```bash
grep -rn "정거장 20\|최대 22\|musicCnt 22\|clamp(10, 20)\|clamp(round(10" specs/004-journey-path/ backend/src/main/java/ docs/rules/
```

기대: **0건**. 남으면 SC-006 미달이다.

---

## 측정 기록

> 채우는 자리. 구현 완료 시 D 의 표와 판정을 여기 옮긴다.
