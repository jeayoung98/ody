/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * **최상단은 더 확대해야 파고든다** (S15P21A405-728).
 * 최상단 샘플은 진입 시점에 이미 밀도 임계 아래라 배율 조건만 남는데, 3배는 휠 몇 칸이었다.
 */
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { MapEngine } = require("../src/components/map/engine/map-engine.ts");
const { DRILL } = require("../src/constants/map.ts");

const pt = (id, x, y) => ({ musicId: id, pc: Array.from({ length: 16 }, (_, k) => (k % 2 ? y : x)), genreId: 1, weight: 1, title: `t${id}`, artist: "a", youtubeUrl: null });
const songs = [];
for (let gx = -3, id = 1; gx <= 3; gx++) for (let gy = -3; gy <= 3; gy++) songs.push(pt(id++, gx * 0.7, gy * 0.7));

function top() {
  const e = new MapEngine();
  e.setSize(1280, 800);
  e.setLayerSongs(0, songs);
  e.frame(performance.now());
  return e;
}

test("최상단 문턱은 파고든 겹보다 높다", () => {
  assert.ok(DRILL.gateMinZoom.top > DRILL.gateMinZoom.deep);
});

test("최상단에서 예전 문턱(3배)으로는 안 열리고, 새 문턱을 넘으면 열린다", () => {
  const e = top();
  e.cam.s = e.entryS * DRILL.gateMinZoom.deep;
  assert.equal(e.gateOpen(), false, "3배는 아직이다");
  assert.ok(e.gateProgress() < 1, "안내 막대도 덜 찼다");
  e.cam.s = e.entryS * (DRILL.gateMinZoom.top + 0.01);
  assert.equal(e.gateOpen(), true);
  assert.equal(e.gateProgress(), 1);
});
