import type { LayerBox } from "@/types";

/**
 * 내 자리 판정과 돌아가는 길 (S15P21A405-670). 순수 함수 — `tests/my-place.test.cjs` 가 묶는다.
 *
 * 겹 l 은 16차원 좌표의 `pc[2l]`·`pc[2l+1]` 평면이고, 파고들 때마다 그 평면의 사각형(`LayerBox`)이 하나씩 쌓인다.
 * 그래서 **어떤 곡이 겹 k 에 있는가**는 서버가 고른 top-k 목록이 아니라 "앞 k 개 사각형을 다 만족하는가" 로 정해진다 —
 * 최상단은 사각형이 없으니 모든 곡이 있고, 그 아래는 그 갈래로 파고든 곡만 있다.
 */

/** `pc` 가 앞 `upTo` 개 사각형을 모두 만족하는가. `upTo` 가 0(최상단)이면 참 */
export function insideBoxes(pc: readonly number[], boxes: readonly LayerBox[], upTo: number): boolean {
  return firstMismatch(pc, boxes, upTo) == null;
}

/** 처음으로 벗어나는 사각형의 겹 번호. 다 만족하면 `null` */
export function firstMismatch(pc: readonly number[], boxes: readonly LayerBox[], upTo: number): number | null {
  for (let l = 0; l < upTo; l++) {
    const b = boxes[l];
    if (!b) return l;
    const x = pc[b.layer * 2];
    const y = pc[b.layer * 2 + 1];
    if (x == null || y == null || x < b.xMin || x > b.xMax || y < b.yMin || y > b.yMax) return l;
  }
  return null;
}

const EPS = 1e-9;
const sameBox = (a: LayerBox, b: LayerBox) =>
  a.layer === b.layer && Math.abs(a.xMin - b.xMin) < EPS && Math.abs(a.xMax - b.xMax) < EPS && Math.abs(a.yMin - b.yMin) < EPS && Math.abs(a.yMax - b.yMax) < EPS;

/** 두 경로가 앞에서부터 몇 겹까지 같은가 — 그 겹까지는 같은 갈래다 */
export function sharedDepth(a: readonly LayerBox[], b: readonly LayerBox[]): number {
  const n = Math.min(a.length, b.length);
  let k = 0;
  while (k < n && sameBox(a[k], b[k])) k++;
  return k;
}

/**
 * 지금 경로에서 재생 때 경로로 돌아가는 **가장 짧은 길**.
 *
 * 마지막으로 같았던 겹(`riseTo`)까지만 떠오르고, 거기서 재생 때 사각형(`dives`)을 따라 한 겹씩 다시 파고든다.
 * 같은 갈래 안이면 떠오를 것도 파고들 것도 없다(카메라만 옮긴다). 우주까지 다 올라가지 않는 이유는 지도 문법이다 —
 * 한 겹 위에서 두 곡이 같이 보이면 한 겹만 오르내리는 것이 맞다.
 */
export function homeRoute(current: readonly LayerBox[], home: readonly LayerBox[]): { riseTo: number; dives: LayerBox[] } {
  const riseTo = sharedDepth(current, home);
  return { riseTo, dives: home.slice(riseTo) };
}
