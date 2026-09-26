/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **주변 탐색 확대는 자리만 벌린다** (S15P21A405-688).
 *
 * 캔버스를 통째로 키우던 때(S15P21A405-593)는 글씨·별까지 커져 여정 확대와 달랐다. 이제 고리 별 자리만
 * 지금 고리의 중심 별을 붙잡고 퍼진다 — 틀리면 중심이 밀려나거나, 지도 본체의 별까지 같이 움직인다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");

/** 벌리기 전 자리를 그대로 주는 엔진. 1 이 중심, 2·3 이 고리 이웃, 9 는 고리에 없는 지도 별 */
function engine(zoom) {
  const e = new MapEngine();
  const base = { 1: { x: 500, y: 400 }, 2: { x: 600, y: 400 }, 3: { x: 500, y: 250 }, 9: { x: 100, y: 100 } };
  e.probe = { zoom, exitingAt: null, rings: [{ centerId: 1, ids: [2, 3], leavingAt: null }] };
  e.freeRect = () => ({ x0: 0, y0: 0, x1: 1000, y1: 800, cx: 500, cy: 400 });
  e.probeBasePos = (id) => base[id] ?? null;
  e.overlaySlot = (id) => (id === 9 ? null : {});
  return e;
}

test("1 배면 벌리기 전 자리 그대로다", () => {
  const e = engine(1);
  assert.deepEqual(e.probePos(2), { x: 600, y: 400 });
});

test("벌려도 중심 별은 제자리다", () => {
  assert.deepEqual(engine(2.5).probePos(1), { x: 500, y: 400 });
});

test("이웃은 중심에서 배율만큼 멀어진다", () => {
  const e = engine(2);
  assert.deepEqual(e.probePos(2), { x: 700, y: 400 });
  assert.deepEqual(e.probePos(3), { x: 500, y: 100 });
});

test("고리에 없는 지도 별은 움직이지 않는다 — 배경은 그대로다", () => {
  assert.deepEqual(engine(3).probePos(9), { x: 100, y: 100 });
});

test("1 배 아래로는 좁히지 않는다 — 바닥에 닿는 입력은 뷰를 나가는 뜻이다", () => {
  assert.deepEqual(engine(0.6).probePos(2), { x: 600, y: 400 });
});
