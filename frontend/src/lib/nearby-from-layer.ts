/**
 * 주변 사람 목록의 **거리와 순서** — 순수 함수 (S15P21A405-541 · 582).
 *
 * 예전에는 여기서 "가까운 사람만" 을 골라냈다. 겹 조회가 층 사람을 전부 주는데 패널은
 * "내 근처" 라는 뜻이라 반경 안만 남겼다. **그 자르기를 걷어냈다** (S15P21A405-582, 5차 명세)
 * — 이제 서버가 층 전체를 기준으로 삼고 가까운 순으로 상한까지 잘라 주므로, 화면이 한 번 더
 * 자르면 서버가 일부러 넣은 사람을 도로 버린다.
 *
 * 남은 일은 둘뿐이다. **좌표로 거리를 재는 것**과 **합친 뒤 상한까지 자르는 것**.
 *
 * 화면도 엔진도 모른다. 좌표와 숫자만 받아 좌표와 숫자를 돌려준다 — 이 규칙이 맞는지는
 * 눈으로 판단할 수 없고 수치로 묶어야 한다 (`tests/nearby-from-layer.test.cjs`).
 */

export interface Point {
  x: number;
  y: number;
}

export const distanceBetween = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * 내 자리에서 그 사람까지. **잴 수 없으면 무한대**다 — 맨 뒤로 가고 상한에서 먼저 잘린다.
 *
 * 잴 수 없는 경우가 둘이다. 내가 아직 아무 곡도 안 틀어 자리가 없을 때, 그리고 그 사람의
 * 자리를 서버도 지도도 모를 때다. 둘 다 0 으로 채우면 **모르는 사람이 제일 가까운 사람으로**
 * 올라온다 — 틀린 값을 앞에 끼우는 것보다 뒤로 보내는 편이 정직하다.
 */
export function distanceFrom(me: Point | null, at: Point | null): number {
  if (!me || !at) return Number.POSITIVE_INFINITY;
  return distanceBetween(me, at);
}

/**
 * 가까운 순으로 `max` 명까지.
 *
 * **상한이 여기 하나뿐이다** (S15P21A405-582). 출처가 셋이라(서버 목록 · 겹 조회 · 봇) 각자
 * 자르면 합친 결과가 상한을 넘는다. 서버도 가까운 순으로 자르므로 같은 기준을 한 번 더 건다.
 *
 * **이 상한은 패널만의 것이다.** 지도는 겹 조회를 따로 받아 층 사람을 다 그리고 겹친 사람은
 * 묶는다 (`use-viewport-subscription`). 여기서 자른다고 지도에서 사라지지 않는다.
 */
export function nearestFirst<T extends { distance: number }>(people: readonly T[], max: number): T[] {
  if (max <= 0) return [];
  return [...people].sort((a, b) => a.distance - b.distance).slice(0, max);
}
