/**
 * 주변 사람 목록의 **거리와 순서** — 순수 함수 (S15P21A405-541 · 582).
 *
 * 하는 일이 셋이다. **좌표로 거리를 재고**, **경계 안만 남기고**, **합친 뒤 상한까지 자른다.**
 *
 * 경계를 한 번 걷어냈다가 되돌렸다. 5차 명세는 서버가 층 전체를 기준으로 삼으니 화면이 또
 * 자를 이유가 없다고 했는데(S15P21A405-582), 그러면 **사람이 적은 층에서 층 반대편 사람이
 * "주변 사람" 으로 뜬다.** 서버 상한은 열두 명을 *채우는* 값이라 멀어도 넣기 때문이다.
 * 패널은 "내 근처" 라는 뜻이므로 경계가 있어야 하고, 가까이 아무도 없으면 **비는 것이 맞다**
 * (S15P21A405-596).
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
 * "가깝다" 의 경계를 **그 겹의 곡 분포에서** 뽑는다.
 *
 * PC 값에 고정 숫자를 박지 않는 이유는 **겹마다 축의 퍼짐이 다르기 때문**이다. 주성분은 앞
 * 축일수록 분산이 크다 — 0겹에서 "가깝다" 인 거리가 7겹에서는 겹 전체를 덮는 거리일 수 있다.
 * 그러면 한 겹에서는 아무도 안 뜨고 다른 겹에서는 전부 뜬다.
 *
 * 대신 **내 곡에서 `k` 번째로 가까운 곡까지의 거리**를 쓴다. "내 주변 곡 `k` 개가 놓인 만큼의
 * 범위" 라는 뜻이라 겹이 바뀌어도 같은 크기의 이웃을 가리킨다.
 *
 * 곡이 `k` 개보다 적으면 있는 것 중 제일 먼 곡까지다. 하나도 없으면 `0` — 아무도 안 들어온다.
 */
export function radiusFromNeighbors(distances: readonly number[], k: number): number {
  const sorted = [...distances].filter(Number.isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return 0;
  return sorted[Math.min(k, sorted.length) - 1];
}

/**
 * 경계 안에 있는 사람만 (S15P21A405-596).
 *
 * **인원을 채우지 않는다.** 서버는 층에서 가까운 순으로 열두 명을 주는데, 그 열두 명이 층
 * 반대편에 있어도 목록에는 들어온다 — 사람이 적은 층에서는 "주변 사람" 이 아니라 그냥 "이 층
 * 사람" 이 된다. 경계를 걸면 **가까이 아무도 없을 때 빈 목록이 나오고**, 그게 사실이다.
 *
 * 경계를 모르면(`null`, 아직 아무 곡도 안 틀었다) 아무도 못 넣는다. 거리를 잴 기준이 없는데
 * 넣어 두면 "가깝다" 가 아무 뜻이 없어진다.
 */
export function withinRadius<T extends { distance: number }>(people: readonly T[], radius: number | null): T[] {
  if (radius == null || !(radius > 0)) return [];
  return people.filter((p) => p.distance <= radius);
}

/**
 * 가까운 순으로 `max` 명까지.
 *
 * **상한이 여기 하나뿐이다** (S15P21A405-582). 출처가 셋이라(서버 목록 · 겹 조회 · 봇) 각자
 * 자르면 합친 결과가 상한을 넘는다. 경계 안에 사람이 몰려 있을 때 레이더가 못 읽게 되는 것을
 * 막는 이중 장치다 — **채우는 값이 아니라 넘지 않는 값**이다.
 *
 * **이 상한은 패널만의 것이다.** 지도는 겹 조회를 따로 받아 층 사람을 다 그리고 겹친 사람은
 * 묶는다 (`use-viewport-subscription`). 여기서 자른다고 지도에서 사라지지 않는다.
 */
export function nearestFirst<T extends { distance: number }>(people: readonly T[], max: number): T[] {
  if (max <= 0) return [];
  return [...people].sort((a, b) => a.distance - b.distance).slice(0, max);
}
