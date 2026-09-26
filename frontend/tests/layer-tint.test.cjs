/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **겹마다 배경 색이 다르다** (S15P21A405-690).
 *
 * 색이 겹 수보다 모자라면 깊은 겹이 같은 색으로 뭉개지고, 전환 중 사이 색 계산이 틀리면 겹을 옮길 때 색이 툭 끊긴다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { LAYER_TINTS } = require("../src/constants/design-tokens.ts");
const { LAYER_COUNT } = require("../src/constants/map.ts");
const { layerTint } = require("../src/components/map/render/draw-map.ts");

test("겹마다 색이 하나씩, 서로 다르다", () => {
  assert.equal(LAYER_TINTS.length, LAYER_COUNT);
  assert.equal(new Set(LAYER_TINTS.map((c) => c.join(","))).size, LAYER_COUNT);
});

test("정수 겹이면 그 겹 색 그대로다", () => {
  for (let l = 0; l < LAYER_COUNT; l++) assert.deepEqual(layerTint(l), [...LAYER_TINTS[l]]);
});

test("전환 중에는 두 겹 색 사이다 — 옮길 때 색이 끊기지 않는다", () => {
  const mid = layerTint(2.5);
  for (let i = 0; i < 3; i++) {
    const lo = Math.min(LAYER_TINTS[2][i], LAYER_TINTS[3][i]);
    const hi = Math.max(LAYER_TINTS[2][i], LAYER_TINTS[3][i]);
    assert.ok(mid[i] >= lo && mid[i] <= hi, `채널 ${i}: ${mid[i]}`);
  }
});

test("범위 밖 겹은 끝 색으로 막는다", () => {
  assert.deepEqual(layerTint(-1), [...LAYER_TINTS[0]]);
  assert.deepEqual(layerTint(99), [...LAYER_TINTS[LAYER_COUNT - 1]]);
});
