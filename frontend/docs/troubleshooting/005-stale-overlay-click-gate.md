# 005. 여정을 한 번 만들면 그 뒤로 지도의 별이 안 눌린다

- 이슈: S15P21A405-270
- 커밋 / MR: `9e97d3a` · MR !110
- 날짜: 2026-09-12

## 증상

> "여정탐색하고 뭐 주변탐색하고 이러다보면 갑자기 화면에 있는 별들이 안눌리거든? (자주 그럼)"

무슨 조건인지 안 잡히는 게 이 버그의 성격이었다. **아무 반응이 없어서** 클릭이 씹힌 건지,
렌더가 멈춘 건지, 데이터가 없는 건지 구분이 안 됐다.

## 재현

1. 여정 패널 → 출발·도착 고르고 `경로 만들기` → 별자리 뷰가 열린다 (22곡)
2. `별자리 뷰 닫기` → 화면은 기본 뷰로 돌아온다
3. **경로에 없는 별을 클릭** → 아무 일도 안 일어난다
4. **경로에 있는 별을 클릭** → 정상으로 열린다

4번이 결정적이었다. **클릭이 죽은 게 아니라 걸러지고 있다.**

## 증거

"안 눌린다"를 두 갈래로 갈라서 봤다. `selectedId` 가 바뀌는지가 갈림길이다.

```js
const e = window.__odyEngine;
// 경로 밖 별을 클릭한 뒤
({ selectedId: e.selectedId, 패널: [...document.querySelectorAll("h2")].map((x) => x.textContent) });
```

| 클릭 대상 | `selectedId` | 패널 |
| --- | --- | --- |
| 경로 **밖** 별 | `70714` (안 바뀜) | `[]` |
| 경로 **안** 별 | `191450` (바뀜) | `["곡 상세"]` |

`selectedId` 가 **아예 안 바뀐다**는 건 `selectMusic()` 앞에서 `return` 했다는 뜻이다.
클릭 핸들러에서 그 앞에 있는 건 오버레이 게이트 하나뿐이다.

그래서 오버레이 상태를 찍어 봤다.

```js
// 별자리 뷰를 닫고 8초 뒤
({ constellationActive: e.constellationActive(), constellationIdSet: [...e.constellationIdSet()].length });
// → { constellationActive: false, constellationIdSet: 22 }
```

**닫혔다고 하면서 집합은 22개를 그대로 들고 있었다.**

## 원인

`exitConstellation()` 은 해제 시각만 찍는다.

```ts
exitConstellation() {
  if (!this.constellation || this.constellation.exitingAt) return;
  this.constellation.exitingAt = performance.now();   // ← 객체는 그대로 남는다
  this.route = [];
}
```

주변 탐색(probe)은 `frame()` 에서 애니메이션이 끝나면 정리한다.

```ts
if (this.probe?.exitingAt && now - this.probe.exitingAt > PROBE.exitMs) this.probe = null;
```

**별자리에는 그 한 줄이 없었다.** `constellation` 을 null 로 만드는 곳은 `startFollow()` 하나뿐이라,
따라가기를 시작하지 않는 한 앱이 살아 있는 내내 남는다.

그리고 클릭 핸들러가 그걸 그대로 믿었다 ([map-view.tsx](../../src/components/map/map-view.tsx)).

```ts
const overlayIds = engine.constellationIdSet() ?? engine.probeIdSet();
if (overlayIds && !overlayIds.has(id)) return;
```

오버레이가 떠 있는 동안 뒷화면 별을 못 고르게 하려는 의도였다 (PATH-01-1). 의도는 맞는데
**판정 재료가 "떠 있는지"가 아니라 "집합이 있는지"** 였다. 집합이 안 지워지니 닫은 뒤에도 계속 가뒀다.

`??` 가 하나 더 얹었다. 별자리 잔재가 non-null 이라 `probeIdSet()` 은 평가조차 안 된다 →
**그 뒤에 주변 탐색을 열어도 이웃 곡이 안 눌린다.** "여정탐색하고 주변탐색하고 이러다보면"이 이거다.

## 조치

**1. 별자리도 해제 뒤 정리한다** — probe 와 같은 자리에서.

```ts
if (this.probe?.exitingAt && now - this.probe.exitingAt > PROBE.exitMs) this.probe = null;
if (this.constellation?.exitingAt && now - this.constellation.exitingAt > CONSTELLATION.exitMs) this.constellation = null;
```

**2. 그리기용 집합과 클릭용 집합을 가른다.** 1번만 하면 해제 애니메이션(500ms) 동안은 여전히 갇힌다.
근본적으로 **판정 재료가 틀렸으므로** 클릭 전용 접근자를 따로 만들었다.

```ts
clickableOverlayIds(): Set<number> | null {
  if (this.constellationActive()) return this.constellationIdSet();
  if (this.probe && !this.probe.exitingAt) return this.probeIdSet();
  return null;
}
```

`constellationIdSet()` 은 그대로 둔다 — 그리기 쪽은 해제 애니메이션 동안 곡들이 제자리로
흩어지는 걸 그려야 해서 그 집합이 필요하다.

## 확인

| 시나리오 | 결과 |
| --- | --- |
| 별자리 떠 있는 동안 | `clickableOverlayIds()` = 22 → 뒷화면 별 여전히 차단 (의도대로) |
| 닫고 4초 뒤 | `constellation === null`, `clickableOverlayIds()` = `null` |
| 그 상태에서 경로 **밖** 별 클릭 | `selectedId` 4803049, `곡 상세` 열림 ✅ |
| 이어서 주변 탐색 열기 | `clickableOverlayIds()` = 11 (기준곡 + 이웃 10) |
| 그 안의 이웃 곡 클릭 | `selectedId` 6597767, `곡 상세` 열림 ✅ |

## 배운 것

**"상태 플래그"와 "그 상태의 데이터"를 같은 것으로 쓰면 언젠가 갈라진다.**
여기서는 `constellationActive()`(플래그)와 `constellationIdSet()`(데이터)이 있었는데,
클릭 판정이 데이터 쪽을 봤다. 데이터는 애니메이션·정리 사정 때문에 플래그보다 **오래 산다.**

그리고 **"아무 일도 안 일어난다"는 증상은 로그가 없다.** 여기서 길을 찾은 건
`selectedId` 가 바뀌는지 안 바뀌는지였다 — 핸들러 안 어느 `return` 에서 끊겼는지가 그걸로 갈렸다.
같은 계열 문제를 만나면 **핸들러의 이른 return 들을 상태 변화로 이분 탐색**하는 게 빠르다.

### 곁다리 — 같은 화면의 또 다른 이른 return

클릭 핸들러에는 게이트가 하나 더 있다.

```ts
if (journey.pickTarget) { journey.pickForNext(id); selectMusic(id); return; }
```

여정 만들기 중에는 지도 클릭이 출발·도착 지정으로 쓰인다(의도). 이때는 `selectedId` 가 **바뀌므로**
위 이분 탐색으로 구분된다. 커서가 `crosshair` 로 바뀌는 게 유일한 신호라 눈치채기 어려운데,
`pickTarget` 은 여정 검색창을 닫으면(`closeComposer`·`requestRoute`) 반드시 풀리므로 이번 건과 달리
**갇히지는 않는다.** 이번 수정 범위에 넣지 않았다.
