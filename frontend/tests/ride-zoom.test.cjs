/* eslint-disable @typescript-eslint/no-require-imports */
// 휠 한 칸이 무엇이 되는가. 따라가는 중의 분기는 여기 없다 — 엔진이 먼저 거른다 (S15P21A405-605).
// 틀려도 화면에 티가 안 난다 — 압력만 차고 안 열리는 계기는 "눌렀는데 아무 일도 없는" 상태다.
const { test } = require("node:test");
const assert = require("node:assert/strict");
const { wheelIntent } = require("../src/components/map/engine/ride-zoom.ts");

const base = { zoomIn: true, gateOpen: false, zoomedOutEnough: false, hasStack: false };

test("평소에는 게이트가 열려 있으면 파고든다", () => {
  assert.equal(wheelIntent({ ...base, zoomIn: true, gateOpen: true }), "dig");
  assert.equal(wheelIntent({ ...base, zoomIn: true, gateOpen: false }), "zoom", "게이트가 닫혀 있으면 그냥 확대");
});

test("평소에는 충분히 축소했고 돌아갈 겹이 있으면 떠오른다", () => {
  assert.equal(wheelIntent({ ...base, zoomIn: false, hasStack: true, zoomedOutEnough: true }), "rise");
  assert.equal(wheelIntent({ ...base, zoomIn: false, hasStack: false, zoomedOutEnough: true }), "zoom", "맨 위 겹이면 떠오를 데가 없다");
  assert.equal(wheelIntent({ ...base, zoomIn: false, hasStack: true, zoomedOutEnough: false }), "zoom", "아직 덜 축소했다");
});
