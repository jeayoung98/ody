/**
 * 겹 사용자 중 **가까운 사람만** 골라내기 — 순수 함수 (S15P21A405-541).
 *
 * `GET /api/realtime/layers/{layer}/users` 는 그 겹에서 재생 중인 사람을 **전부** 준다
 * (S15P21A405-537). 지도에는 그게 맞다 — 줌과 상관없이 다 찍기로 했다. 그런데 주변 사람
 * 패널은 "내 근처" 라는 뜻이 붙은 목록이라, 겹 반대편 사람까지 넣으면 그 뜻이 없어진다.
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

export interface Placed extends Point {
  email: string;
}

/**
 * 반경 안에 있는 사람을 가까운 순으로, 최대 `max` 명까지.
 *
 * `exclude` 는 **이미 목록에 있는 사람**이다 — 서버 주변 사람 응답과 데모 봇이 거기 든다.
 * 같은 사람이 두 줄로 뜨면 목록을 세는 것 자체가 안 되고, 서버 쪽 줄이 더 풍부하므로
 * (만남 횟수·곡 제목이 들어 있다) 이쪽을 버린다.
 *
 * `max` 로 자르는 것은 **사람이 몰린 구역** 때문이다. 인기 구역에서는 반경 안에 수십 명이
 * 들어올 수 있는데, 우측 패널에 수십 줄이 쌓이면 레이더도 목록도 못 읽는다.
 */
export function pickNearby<T extends Placed>(
  users: readonly T[],
  me: Point,
  radius: number,
  max: number,
  exclude: ReadonlySet<string> = new Set(),
): (T & { distance: number })[] {
  if (!(radius > 0) || max <= 0) return [];
  return users
    .filter((u) => !exclude.has(u.email))
    .map((u) => ({ ...u, distance: distanceBetween(u, me) }))
    .filter((u) => u.distance <= radius)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, max);
}
