/* eslint-disable @typescript-eslint/no-require-imports */
// 떠오른 뒤 내려앉을 배율 (S15P21A405-673).
// 0겹만 덮는 배율을 쓴다 — 나머지 겹은 진입 배율이 곧 축소 한계라 그대로 둬야 한다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { riseLandingScale } = require("../src/components/map/engine/rise-scale.ts");

test("0겹은 화면을 덮는 배율로 착지한다 — 반지름 맞춤은 좌우가 빈다 (469)", () => {
  assert.equal(riseLandingScale(0, 100, 240), 240);
});

test("파고든 겹은 진입 배율 그대로 — deepFit 이 이미 화면을 채우고 그게 축소 한계다", () => {
  assert.equal(riseLandingScale(1, 100, 240), 100);
  assert.equal(riseLandingScale(7, 100, 240), 100);
});

/**
 * 두 배율은 서로 다른 식(반지름 맞춤 vs 상자 덮기)에서 나와 대소가 보장되지 않는다.
 * 덮는 배율이 더 작은 상주 집합에서 그걸 쓰면 **자동으로 줌아웃된 화면에 착지**하는데,
 * 그게 이 이슈가 없애려는 동작 자체다.
 */
test("0겹이라도 덮는 배율이 더 작으면 진입 배율을 지킨다 — 자동 줌아웃 금지", () => {
  assert.equal(riseLandingScale(0, 300, 240), 300);
  assert.equal(riseLandingScale(0, 300, 300), 300);
});

test("덮는 배율이 성립하지 않으면 진입 배율로 돌아간다 — 상주가 비면 fitBox 가 답을 못 낸다", () => {
  assert.equal(riseLandingScale(0, 100, 0), 100, "0 이면 카메라가 통째로 깨진다");
  assert.equal(riseLandingScale(0, 100, -5), 100);
  assert.equal(riseLandingScale(0, 100, Number.NaN), 100);
  assert.equal(riseLandingScale(0, 100, Number.POSITIVE_INFINITY), 100);
});
