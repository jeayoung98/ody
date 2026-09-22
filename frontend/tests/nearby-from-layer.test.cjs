/* eslint-disable @typescript-eslint/no-require-imports */
// 겹 사용자 중 "가까운 사람" 을 고르는 규칙 (S15P21A405-541).
// 화면으로는 "이 사람이 왜 떴지" 를 판단할 수 없어서(거리가 PC 값이라 눈에 안 보인다) 수치로 묶는다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { distanceBetween, pickNearby, radiusFromNeighbors } = require("../src/lib/nearby-from-layer.ts");
const { LAYER_USERS } = require("../src/constants/realtime.ts");

const me = { x: 0, y: 0 };
/** 퍼짐이 `spread` 인 겹의 곡 1,000개를 흉내 낸다 */
function layerSongs(spread, n = 1000) {
  const out = [];
  for (let i = 0; i < n; i++) {
    // 격자로 깔면 거리 분포가 고르게 나온다 — 난수로 두면 테스트가 실행마다 흔들린다
    const k = Math.sqrt(n) | 0;
    const gx = ((i % k) / k - 0.5) * 2 * spread;
    const gy = (Math.floor(i / k) / k - 0.5) * 2 * spread;
    out.push(distanceBetween({ x: gx, y: gy }, me));
  }
  return out;
}

test("경계는 k 번째로 가까운 곡까지의 거리다", () => {
  const d = [5, 1, 3, 2, 4];
  assert.equal(radiusFromNeighbors(d, 1), 1);
  assert.equal(radiusFromNeighbors(d, 3), 3);
  assert.equal(radiusFromNeighbors(d, 5), 5);
});

test("곡이 k 개보다 적으면 있는 것 중 제일 먼 곡까지, 없으면 0", () => {
  assert.equal(radiusFromNeighbors([2, 7], 80), 7);
  assert.equal(radiusFromNeighbors([], 80), 0, "0 이면 아무도 안 들어온다 — 아무나 넣는 것보다 낫다");
  assert.equal(radiusFromNeighbors([Number.NaN, 4], 80), 4, "값이 깨진 곡은 세지 않는다");
});

/**
 * **이 파일의 핵심이다.** PC 는 앞 축일수록 분산이 크다 — 겹마다 퍼짐이 다르다.
 * 고정 숫자를 박았다면 한 겹에서는 아무도 안 뜨고 다른 겹에서는 전부 뜬다.
 */
test("겹의 퍼짐이 10배 달라도 비슷한 수의 이웃을 잡는다", () => {
  const wide = radiusFromNeighbors(layerSongs(5), LAYER_USERS.neighborK);
  const tight = radiusFromNeighbors(layerSongs(0.5), LAYER_USERS.neighborK);
  assert.ok(wide > tight * 5, `퍼진 겹의 경계가 따라 커져야 한다 (wide=${wide} tight=${tight})`);

  const count = (songs, radius) => songs.filter((d) => d <= radius).length;
  const a = count(layerSongs(5), wide);
  const b = count(layerSongs(0.5), tight);
  assert.ok(Math.abs(a - b) <= 2, `잡히는 곡 수가 겹마다 비슷해야 한다 (${a} vs ${b})`);

  // 고정 숫자였다면 이렇게 된다 — 이 줄이 무너지는 날 위 규칙을 되돌린 것이다
  assert.equal(count(layerSongs(0.5), wide), 1000, "좁은 겹에 넓은 겹의 경계를 쓰면 통째로 들어온다");
});

test("반경 밖은 안 들어오고, 가까운 순으로 나온다", () => {
  const users = [
    { email: "far", x: 9, y: 0 },
    { email: "mid", x: 2, y: 0 },
    { email: "near", x: 0.5, y: 0 },
  ];
  const got = pickNearby(users, me, 3, 10);
  assert.deepEqual(
    got.map((u) => u.email),
    ["near", "mid"],
  );
  assert.equal(got[0].distance, 0.5, "거리를 붙여 준다 — 레이더가 이 값으로 자리를 잡는다");
});

test("이미 목록에 있는 사람은 빼고, 명수를 넘기지 않는다", () => {
  const users = Array.from({ length: 40 }, (_, i) => ({ email: `u${i}`, x: i * 0.01, y: 0 }));
  const taken = new Set(["u0", "u1", "u2"]);
  const got = pickNearby(users, me, 99, LAYER_USERS.maxInPanel, taken);

  assert.equal(got.length, LAYER_USERS.maxInPanel, "몰린 구역에서 목록이 넘치면 안 읽힌다");
  for (const e of taken) assert.ok(!got.some((u) => u.email === e), `${e} 가 두 줄로 떴다`);
  assert.equal(got[0].email, "u3", "빠진 자리를 그다음 가까운 사람이 메운다");
});

test("경계가 0 이면 아무도 안 넣는다 — 내 자리를 모를 때다", () => {
  const users = [{ email: "a", x: 0, y: 0 }];
  assert.deepEqual(pickNearby(users, me, 0, 10), []);
  assert.deepEqual(pickNearby(users, me, 5, 0), []);
});
