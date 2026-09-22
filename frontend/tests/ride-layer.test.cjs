/* eslint-disable @typescript-eslint/no-require-imports */
// 따라가는 사람이 어느 겹으로 옮기는가 (S15P21A405-560).
// 잘못 짚으면 조용히 망가진다 — 없는 겹으로 모프하거나, 같은 겹인데 지도가 한 번 출렁인다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { rideLayerTarget } = require("../src/components/map/engine/ride-layer.ts");
const { LAYER_COUNT } = require("../src/constants/map.ts");

test("인솔자가 다른 겹이면 그 겹으로 간다", () => {
  assert.equal(rideLayerTarget(0, 3), 3, "파고들기");
  assert.equal(rideLayerTarget(3, 0), 0, "떠오르기");
  assert.equal(rideLayerTarget(2, 3), 3, "한 겹 아래");
});

test("같은 겹이면 아무것도 안 한다 — 옮기면 이유 없이 한 번 출렁인다", () => {
  assert.equal(rideLayerTarget(2, 2), null);
  assert.equal(rideLayerTarget(0, 0), null);
});

/**
 * **모르면 가만히 있는다.** 모르는 겹으로 옮기는 것은 제자리에 있는 것보다 나쁘고,
 * 따라가는 사람은 되돌릴 길이 없다.
 */
test("겹을 안 주거나 있을 수 없는 번호면 안 움직인다", () => {
  assert.equal(rideLayerTarget(1, null), null, "옛 배포는 이 값을 안 준다");
  assert.equal(rideLayerTarget(1, undefined), null);
  assert.equal(rideLayerTarget(1, -1), null);
  assert.equal(rideLayerTarget(1, LAYER_COUNT), null, "마지막 겹 번호는 LAYER_COUNT-1 이다");
  assert.equal(rideLayerTarget(1, 1.5), null, "정수가 아니면 겹이 아니다");
  assert.equal(rideLayerTarget(1, Number.NaN), null);
});

test("맨 위·맨 아래 겹은 유효하다", () => {
  assert.equal(rideLayerTarget(3, 0), 0);
  assert.equal(rideLayerTarget(0, LAYER_COUNT - 1), LAYER_COUNT - 1);
});
