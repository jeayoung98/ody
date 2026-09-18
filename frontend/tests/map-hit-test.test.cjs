/* eslint-disable @typescript-eslint/no-require-imports */
// 앨범 커버로 그린 곡의 클릭 판정 (S15P21A405-452). 커버는 repIds 에서 뽑고 visible 은 격자
// 승자만 담아서, 커버로 떠 있는데 집을 자리가 없는 곡이 있었다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

/** visible 에는 없고 커버로만 그려진 곡 하나, 격자 대표곡 하나 */
function engine() {
  const e = new MapEngine();
  e.songs = [{ musicId: 11 }, { musicId: 22 }];
  e.visible = [{ i: 0, px: 100, py: 100, r: 15 }];
  e.coverHits = [{ i: 1, px: 200, py: 200, r: 22 }];
  return e;
}

test("커버로만 뜬 곡도 잡힌다 — 격자 대표곡이 아니어도", () => {
  assert.equal(engine().hitTest(200, 200).i, 1);
});

test("커버 그림 안이면 가장자리도 잡히고, 밖은 안 잡힌다", () => {
  const e = engine();
  assert.equal(e.hitTest(200, 200 + 21).i, 1); // 별 r=15 로는 못 닿던 자리
  assert.equal(e.hitTest(200, 200 + 23), null);
});

test("겹치면 가까운 쪽이 이긴다 — 커버가 이웃 별의 클릭을 밀지 않는다", () => {
  const e = engine();
  e.coverHits = [{ i: 1, px: 110, py: 100, r: 22 }];
  assert.equal(e.hitTest(102, 100).i, 0);
  assert.equal(e.hitTest(112, 100).i, 1);
});

test("오버레이가 떠 있으면 그 밖의 커버는 안 잡힌다", () => {
  const e = engine();
  e.clickableOverlayIds = () => new Set([11]);
  assert.equal(e.hitTest(200, 200), null);
  assert.equal(e.hitTest(100, 100).i, 0);
});
